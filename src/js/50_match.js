// ===== Partido: reglas, saques, faltas, tarjetas, penales, fuera de juego, tiempo añadido y cambios =====
const RESTART_NAME = { kickoff: 'SAQUE DEL MEDIO', throw: 'SAQUE LATERAL', corner: 'CÓRNER', goalkick: 'SAQUE DE ARCO', freekick: 'TIRO LIBRE', penalty: 'PENAL' };
class Match {
  constructor(opts) {
    this.state = 'intro'; this.timer = 0; this.half = 1; this.clock = 0;
    this.halfLen = (opts.halfMin || 3) * 60; this.restart = null; this.firstKick = Math.random() < 0.5 ? 0 : 1;
    this.attract = !!opts.attract; this.stats = {}; this.events = []; this.cards = []; this.inPlay = true;
    this.stoppage = 0; this.added = null; // minutos de descuento de este tiempo (se anuncian al llegar a 45/90)
    this.offside = null; this.indirect = null; this.pendingSubs = []; this.leaving = [];
  }
  get baseMin() { return (this.half - 1) * 45; }
  get minute() { return this.clock / this.halfLen * 45 + this.baseMin; }
  clockText() {
    const m = Math.min(this.minute, this.baseMin + 45 + (this.added || 0)), mm = Math.floor(m), ss = Math.floor((m - mm) * 60);
    return String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  }
  start() { this.setKickoff(this.firstKick); this.state = 'intro'; this.timer = 0; if (!this.attract) Cam.intro(); }
  locked(p) { return !!(this.restart && this.restart.taker === p); }
  setKickoff(ti) {
    const team = G.teams[ti];
    this.applySubs();
    for (const t of G.teams) t.players.forEach(p => { const k = t.kickoffPos(p.slot, t === team); p.teleport(k.x, k.z, t.attackDir > 0 ? Math.PI / 2 : -Math.PI / 2); p.stamina = Math.min(1, p.stamina + 0.03); });
    // los dos delanteros del que saca, en el medio
    const fws = team.players.filter(p => !p.isGK).sort((a, b) => Math.hypot(a.pos.x, a.pos.z) - Math.hypot(b.pos.x, b.pos.z));
    const ad = team.attackDir;
    fws[0].teleport(-ad * 0.45, 0.2, ad > 0 ? Math.PI / 2 : -Math.PI / 2);
    fws[1].teleport(-ad * 0.6, 2.6, ad > 0 ? Math.PI / 2 + 0.5 : -Math.PI / 2 - 0.5);
    G.ball.place(0, 0); G.owner = null; G.passInfo = null; G.lastTouch = null; this.offside = null; this.indirect = null;
    this.restart = { type: 'kickoff', kickoff: true, team, spot: { x: 0, z: 0 }, taker: fws[0], mate: fws[1], t: 0, ready: false, aim: ad > 0 ? Math.PI / 2 : -Math.PI / 2 };
    this.state = 'restart';
    Hud.info(null);
  }
  setRestart(type, team, spot, opt) {
    opt = opt || {};
    let taker = null;
    const ad = team.attackDir, gx = team.oppGoalX;
    const fieldP = team.players.filter(p => !p.isGK);
    if (type === 'goalkick') taker = team.gk;
    else if (type === 'penalty') taker = fieldP.slice().sort((a, b) => (b.a.sho + b.info.ovr * 0.2) - (a.a.sho + a.info.ovr * 0.2))[0];
    else if (type === 'freekick' && Math.hypot(gx - spot.x, spot.z) < 32) taker = fieldP.slice().sort((a, b) => (b.a.sho + b.a.pas) - (a.a.sho + a.a.pas) + (Math.hypot(a.pos.x - spot.x, a.pos.z - spot.z) - Math.hypot(b.pos.x - spot.x, b.pos.z - spot.z)) * 0.3)[0];
    else { let bd = 1e9; for (const p of fieldP) { const d = Math.hypot(p.pos.x - spot.x, p.pos.z - spot.z); if (d < bd) { bd = d; taker = p; } } }
    if (!taker) taker = team.players[0];
    // hacia donde mira el que saca
    let aim;
    if (type === 'throw') aim = Math.atan2(ad * 0.6, -Math.sign(spot.z));
    else if (type === 'corner') aim = Math.atan2(-Math.sign(spot.x) * 0.6, -Math.sign(spot.z));
    else if (type === 'freekick' || type === 'penalty') aim = Math.atan2(gx - spot.x, -spot.z * 0.6);
    else aim = ad > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.restart = { type, team, spot, taker, t: 0, ready: false, delay: opt.delay != null ? opt.delay : type === 'penalty' ? 2 : 0.9, aim, indirect: !!opt.indirect };
    // barrera en tiros libres cerca del arco
    if (type === 'freekick') {
      const dg = Math.hypot(gx - spot.x, spot.z);
      if (dg < 34 && Math.abs(spot.z) < 28 && !opt.indirect || dg < 20) {
        const n = dg < 22 ? 4 : dg < 28 ? 3 : 2;
        const ux = (gx - spot.x) / dg, uz = -spot.z / dg, wx = spot.x + ux * PITCH.circR, wz = spot.z + uz * PITCH.circR;
        const defs = team.opp.players.filter(p => !p.isGK).sort((a, b) => Math.hypot(a.pos.x - wx, a.pos.z - wz) - Math.hypot(b.pos.x - wx, b.pos.z - wz)).slice(0, n);
        const side = -Math.sign(spot.z) || 1; // la barrera tapa el palo mas cercano
        this.restart.wall = defs.map((p, i) => ({ p, x: wx + (-uz) * (i - (n - 1) / 2 - side * 0.6) * 0.62, z: wz + ux * (i - (n - 1) / 2 - side * 0.6) * 0.62 }));
      }
    }
    this.state = 'restart';
    G.owner = null; G.passInfo = null; this.offside = null;
    if (type === 'corner') team.stats.corners++;
    Hud.info(RESTART_NAME[type] + (opt.indirect ? ' INDIRECTO' : ''));
    if (type !== 'throw' && !opt.silent) AU.whistle(1);
    if (type === 'corner') AU.cheer(0.35);
    if (type === 'penalty') AU.cheer(0.7);
    // el arbitro marca
    if (type === 'freekick' || type === 'corner' || type === 'goalkick' || type === 'throw') Refs.point(Math.atan2(ad, 0));
    if (type === 'penalty') Refs.point(Math.atan2(gx - (Refs.ref ? Refs.ref.pos.x : 0), -(Refs.ref ? Refs.ref.pos.z : 0)));
    this.applySubs();
  }
  onKick(p, kind) {
    const r = this.restart;
    if (this.state === 'restart' && r && r.taker === p) {
      // fuera de juego no cuenta en laterales, corners ni saques de arco
      if (r.type !== 'throw' && r.type !== 'corner' && r.type !== 'goalkick') this.snapOffside(p);
      if (r.indirect) this.indirect = { taker: p };
      if (r.wall) for (const w of r.wall) if (!w.p.action) w.p.action = { type: 'jump', t: 0, dur: 0.6, contact: 0.27, fired: true, jump: 0.9 };
      if (r.type === 'penalty') this.keeperGuess(r);
      this.state = 'play'; this.restart = null; p.controlCd = 0.45; Hud.info(null); this.inPlay = false; this.kickT = G.time;
      return;
    }
    if (this.state === 'play') this.snapOffside(p);
  }
  // ---- fuera de juego ----
  snapOffside(p) {
    if (this.training) { this.offside = null; return; }
    const team = p.team, ad = team.attackDir, b = G.ball;
    const opp = team.opp.players.map(o => o.pos.x * ad).sort((a, b) => b - a);
    const second = opp.length > 1 ? opp[1] : PITCH.HL;
    const bx = b.px * ad;
    const set = team.players.filter(m => m !== p && m.pos.x * ad > 0.1 && m.pos.x * ad > bx + 0.1 && m.pos.x * ad > second + 0.15);
    this.offside = set.length ? { team, set } : null;
  }
  // cada vez que un jugador toca la pelota
  involve(p) {
    if (this.indirect && p !== this.indirect.taker) this.indirect = null;
    const o = this.offside; if (!o) return;
    if (o.set.includes(p) && this.state === 'play') { this.callOffside(p); return; }
    if (p.team !== o.team || !o.set.includes(p)) this.offside = null;
  }
  callOffside(p) {
    this.offside = null;
    p.team.stats.offsides++;
    AU.whistle(1); Refs.flag(p.pos.x);
    G.owner = null;
    this.setRestart('freekick', p.team.opp, { x: clamp(p.pos.x, -PITCH.HL + 1, PITCH.HL - 1), z: clamp(p.pos.z, -PITCH.HW + 1, PITCH.HW - 1) }, { indirect: true, delay: 1.6, silent: true });
    Hud.info('FUERA DE JUEGO · ' + p.name.toUpperCase());
    this.stoppage += 0.2;
  }
  // ---- faltas y tarjetas ----
  foul(f, v, kind) {
    if (this.training) return;
    if (this.state !== 'play' || !f || !v || f.team === v.team) return;
    const team = v.team, gx = f.team.ownGoalX;
    f.team.stats.fouls++; f.stats.fouls = (f.stats.fouls || 0) + 1;
    const vf = v.fwd(), dx = v.pos.x - f.pos.x, dz = v.pos.z - f.pos.z, dl = Math.hypot(dx, dz) || 1;
    const behind = (vf.x * dx + vf.z * dz) / dl > 0.4;
    const hadBall = G.owner === v || v.hadBallT && G.time - v.hadBallT < 0.6;
    let card = null;
    const yel = kind === 'slide' ? (behind ? 0.6 : 0.2) : (behind ? 0.22 : 0.05);
    if (Math.random() < yel) card = 'yellow';
    // ocasion manifiesta de gol: el atacante iba solo al arco
    if (hadBall && Math.hypot(gx - v.pos.x, v.pos.z) < 28) {
      let cover = 0;
      for (const d of f.team.players) if (d !== f && !d.isGK && Math.abs(d.pos.x - gx) < Math.abs(v.pos.x - gx) + 1 && Math.abs(d.pos.z - v.pos.z) < 12) cover++;
      if (cover === 0 && Math.random() < 0.75) card = 'red';
    }
    if (kind === 'slide' && behind && Math.random() < 0.05) card = 'red';
    if (f.isGK && card === 'red') card = 'yellow';
    const spot = { x: clamp(v.pos.x, -PITCH.HL + 0.5, PITCH.HL - 0.5), z: clamp(v.pos.z, -PITCH.HW + 0.5, PITCH.HW - 0.5) };
    const inBox = Math.abs(spot.x - gx) < PITCH.boxX && Math.abs(spot.z) < PITCH.boxHW;
    // ley de ventaja: si el equipo que recibio la falta sigue con la pelota, se sigue jugando
    const adv = !inBox && card !== 'red' && G.owner && G.owner.team === team && G.owner !== v;
    if (card) this.giveCard(f, card);
    if (adv) { Hud.info('VENTAJA'); this.infoT = G.time + 1.6; return; }
    AU.whistle(1);
    this.stoppage += 0.25;
    if (inBox) this.setRestart('penalty', team, { x: gx - Math.sign(gx) * PITCH.penX, z: 0 }, { silent: true, delay: card ? 2.6 : 2 });
    else this.setRestart('freekick', team, spot, { silent: true, delay: card ? 2.6 : 1.4 });
    Hud.info((inBox ? 'PENAL · falta de ' : 'FALTA de ') + f.name.toUpperCase());
  }
  giveCard(p, color) {
    if (p.sentOff || (this.sendQ || []).some(s => s.p === p)) return;
    if (color === 'yellow' && p.yellow) color = 'red2';
    const red = color !== 'yellow';
    if (color === 'yellow') { p.yellow = true; p.team.stats.yellow++; }
    else { p.team.stats.red++; if (color === 'red2') p.team.stats.yellow++; }
    this.cards.push({ min: Math.ceil(this.minute), team: p.team.side, name: p.name, color });
    this.stoppage += 0.4;
    Refs.showCard(p, red ? 'red' : 'yellow');
    Hud.card(p, color);
    if (red) (this.sendQ = this.sendQ || []).push({ p, t: G.time + 1.6 });
    AU.cheer(red ? 0.7 : 0.35);
  }
  sendOff(p) {
    const t = p.team; if (!t.players.includes(p)) return;
    p.sentOff = true;
    t.players = t.players.filter(x => x !== p);
    G.players = G.players.filter(x => x !== p);
    if (G.owner === p) G.owner = null;
    if (G.ball.held === p) G.ball.held = null;
    if (this.restart && this.restart.taker === p) { const r = this.restart; this.restart = null; this.setRestart(r.type, r.team, r.spot, { indirect: r.indirect, silent: true, delay: 0.6 }); }
    if (G.human && G.human.p === p) { G.human.p = null; G.human.select(G.human.bestCandidate(false)); }
    p.action = null; p.stun = 0;
    this.leaving.push(p); // camina hacia el tunel
    Hud.updateReds();
  }
  keeperGuess(r) {
    const gk = r.team.opp.gk; if (!gk) return;
    const g = Math.random() < 0.25 ? 0 : (Math.random() < 0.5 ? -1 : 1);
    gk.brain.seq = G.kickSeq; gk.brain.react = g ? 9 : 0.32; // ya decidio de que lado tirarse
    if (g) { startDive(gk, { t: 0.5, z: g * rand(1.6, 2.9), y: rand(0.4, 1.7), onTarget: true }, teamDiff(gk.team)); gk.vel.z *= 0.8; }
  }
  update(h) {
    if (this.training) { this.timer += h; if (this.state === 'restart') this.updateRestart(h); Training.update(h); return; }
    this.timer += h;
    if (this.infoT && G.time > this.infoT) { this.infoT = 0; if (!this.restart) Hud.info(null); }
    for (const p of this.leaving) {
      p.prev.copy(p.pos); p.want.x = p.want.z = 0; moveTo(p, 0, -41.5, 'walk'); p.sprint = false; p.update(h);
      if (Math.hypot(p.pos.x, p.pos.z + 41.5) < 1) { p.rig.dispose(); p.gone = true; }
    }
    this.leaving = this.leaving.filter(p => !p.gone);
    if (this.sendQ && this.sendQ.length) { const due = this.sendQ.filter(s => G.time >= s.t); this.sendQ = this.sendQ.filter(s => G.time < s.t); for (const s of due) this.sendOff(s.p); }
    const st = this.state;
    if (st === 'intro') {
      if (this.timer > (this.attract ? 0.5 : 2.6)) { this.state = 'restart'; AU.whistle(1, true); }
      return;
    }
    if (st === 'restart') { this.clock += this.restart && this.restart.kickoff ? 0 : h; this.updateRestart(h); this.checkTime(false); }
    else if (st === 'play') {
      this.clock += h;
      const pt = possTeam(); if (pt) pt.stats.poss += h;
      this.checkTime(true);
      if (G.owner) G.owner.hadBallT = G.time;
    }
    else if (st === 'goal') {
      // repeticion del gol (en el partido de fondo del menu no hay)
      if (this.timer > 3.4 && !this.attract && Replay.has()) { this.state = 'replay'; Replay.start(); }
      else if (this.timer > 4.6) this.afterReplay();
    }
    if (!this.attract && st !== 'goal') this.aiSubs();
  }
  // tiempo reglamentario y descuento
  checkTime(playing) {
    if (this.clock < this.halfLen) return;
    if (this.added == null) {
      this.added = clamp(Math.round(this.stoppage + rand(0.3, 1.3)), 1, 6);
      Hud.added(this.added);
      if (!this.attract) Hud.info('TIEMPO AÑADIDO +' + this.added), this.infoT = G.time + 2.5;
    }
    const end = this.halfLen * (45 + this.added) / 45;
    if (this.clock < end) return;
    // no se termina en medio de un remate, un penal o un tiro libre peligroso
    if (playing && G.passInfo && G.passInfo.shot && G.time - G.passInfo.t < 2) return;
    if (!playing && this.restart && (this.restart.type === 'penalty' || this.restart.type === 'kickoff')) return;
    if (playing || this.restart) this.endHalf();
  }
  updateRestart(h) {
    const r = this.restart; if (!r) return;
    r.t += h;
    const b = G.ball, T = r.taker;
    const fx = Math.sin(r.aim), fz = Math.cos(r.aim);
    if (r.delay > 0) {
      r.delay -= h; if (r.delay > 0) return;
      b.place(r.spot.x, r.spot.z);
      // en penales y tiros libres el que patea aparece cerca de la pelota (como en la tele, que cortan la toma)
      if ((r.type === 'penalty' || r.type === 'freekick') && Math.hypot(T.pos.x - r.spot.x, T.pos.z - r.spot.z) > 8) T.teleport(r.spot.x - fx * 3.5, r.spot.z - fz * 3.5, r.aim);
    }
    const back = r.type === 'throw' ? 0.15 : r.type === 'penalty' ? 1.6 : 0.55;
    const sx = r.spot.x - fx * back, sz = r.spot.z - fz * back;
    if (!r.ready) {
      if (r.type !== 'throw') b.place(r.spot.x, r.spot.z);
      const d = moveTo(T, sx, sz, 'sprint');
      T.wantFace = r.aim;
      if (r.kickoff) { T.teleport(sx, sz, r.aim); }
      const wait = r.kickoff ? 0.2 : r.type === 'penalty' ? 1.2 : r.wall ? 1.6 : 0.8;
      if ((d < 0.5 || r.kickoff) && r.t > wait) {
        r.ready = true; r.readyT = 0; T.teleport(sx, sz, r.aim);
        if (r.type === 'throw') b.held = T; else b.place(r.spot.x, r.spot.z);
        G.owner = T; G.lastTouch = T;
      }
      return;
    }
    // listo: la pelota queda quieta (o en las manos) hasta que saque
    r.readyT += h;
    T.want.x = T.want.z = 0; T.pos.set(sx, 0, sz); T.vel.set(0, 0, 0); T.wantFace = r.aim;
    if (r.type !== 'throw') { b.px = r.spot.x; b.pz = r.spot.z; b.py = BALL_R; b.vx = b.vy = b.vz = 0; }
    G.owner = T;
    const humanTakes = r.team.human && G.human && !T.isGK && !this.attract;
    if (!humanTakes && r.readyT > (r.kickoff ? 0.8 : r.type === 'penalty' ? 1.6 : 1.1) && !T.action) this.aiTake(r);
  }
  aiTake(r) {
    const T = r.taker, team = r.team, ad = team.attackDir, gx = team.oppGoalX;
    if (r.kickoff) { startKick(T, 'pass', { receiver: r.mate, power: 0.3 }); return; }
    if (r.type === 'throw') {
      let best = null, bs = -1e9;
      for (const m of team.players) { if (m === T || m.isGK) continue; const d = Math.hypot(m.pos.x - T.pos.x, m.pos.z - T.pos.z); if (d > 24) continue; let open = 8; for (const o of team.opp.players) open = Math.min(open, Math.hypot(o.pos.x - m.pos.x, o.pos.z - m.pos.z)); const s = open * 0.4 - d * 0.05 + (m.pos.x - T.pos.x) * ad * 0.03; if (s > bs) { bs = s; best = m; } }
      startKick(T, 'throw', { receiver: best, power: 0.5 }); return;
    }
    if (r.type === 'corner') { aiCross(T); return; }
    if (r.type === 'goalkick') { keeperDistribute(T); return; }
    if (r.type === 'penalty') { startKick(T, 'shot', { aimZ: (Math.random() < 0.5 ? -1 : 1) * rand(1.3, 3.1), power: rand(0.5, 0.82), finesse: false }); return; }
    if (r.type === 'freekick') {
      const dg = Math.hypot(gx - r.spot.x, r.spot.z);
      if (!r.indirect && dg < 30 && Math.abs(r.spot.z) < 20) {
        const side = r.wall ? Math.sign(r.spot.z) || 1 : (Math.random() < 0.5 ? -1 : 1); // al palo que no tapa la barrera
        startKick(T, 'shot', { aimZ: side * rand(1.8, 3.1), power: rand(0.35, 0.7), finesse: Math.random() < 0.75 }); return;
      }
      if (r.spot.x * ad > 25) { aiCross(T); return; }
      const bp = bestPass(T, 5);
      if (bp) startKick(T, bp.kind, { receiver: bp.m, power: bp.power }); else startKick(T, 'lob', { dir: { x: ad, z: 0 }, power: 0.7 });
    }
  }
  // pelota afuera y goles
  checkBall() {
    if (this.state !== 'play') return;
    const b = G.ball; if (b.held) return;
    if (this.training) {
      if (Training.waitT > 0) return;
      const ax = Math.abs(b.px), az = Math.abs(b.pz);
      if (ax > PITCH.HL + BALL_R && ax < PITCH.HL + PITCH.goalD + 0.4 && az < PITCH.goalHW && b.py < PITCH.goalH) { if (Math.sign(b.px) === G.teams[0].attackDir) Training.onGoal(); else Training.onOut(); return; }
      if (ax > PITCH.HL + BALL_R || az > PITCH.HW + BALL_R) Training.onOut();
      return;
    }
    const ax = Math.abs(b.px), az = Math.abs(b.pz);
    // despues de un saque la pelota tiene que entrar a la cancha antes de poder volver a salir
    if (!this.inPlay) { if (ax < PITCH.HL && az < PITCH.HW) this.inPlay = true; else if (G.time - this.kickT < 1.5) return; }
    if (ax > PITCH.HL + BALL_R && ax < PITCH.HL + PITCH.goalD + 0.4 && az < PITCH.goalHW && b.py < PITCH.goalH) {
      const sg = Math.sign(b.px); const scorer = G.teams.find(t => t.attackDir === sg);
      // un tiro libre indirecto que entra directo no es gol
      if (this.indirect && G.lastTouch === this.indirect.taker) { this.indirect = null; this.setRestart('goalkick', scorer.opp, { x: sg * (PITCH.HL - PITCH.sixX), z: 4 }); Hud.info('INDIRECTO: NO VALE'); return; }
      this.goal(scorer); return;
    }
    const lt = G.lastTouch;
    if (az > PITCH.HW + BALL_R) {
      const team = lt ? lt.team.opp : G.teams[0];
      this.setRestart('throw', team, { x: clamp(b.px, -PITCH.HL + 1, PITCH.HL - 1), z: Math.sign(b.pz) * (PITCH.HW + 0.25) });
      return;
    }
    if (ax > PITCH.HL + BALL_R) {
      const sg = Math.sign(b.px);
      const def = G.teams.find(t => Math.sign(t.ownGoalX) === sg), att = def.opp;
      if (lt && lt.team === def) this.setRestart('corner', att, { x: sg * (PITCH.HL - 0.35), z: (Math.sign(b.pz) || 1) * (PITCH.HW - 0.35) });
      else this.setRestart('goalkick', def, { x: sg * (PITCH.HL - PITCH.sixX), z: (Math.sign(b.pz) || 1) * 4 });
    }
  }
  goal(team) {
    team.score++;
    const lt = G.lastTouch;
    const own = lt && lt.team !== team;
    const scorer = lt;
    if (scorer && !own) { scorer.stats.goals++; }
    team.stats.onTarget += own ? 0 : 1;
    this.events.push({ min: Math.ceil(this.minute), team: team.side, name: scorer ? scorer.name : '', own });
    this.state = 'goal'; this.timer = 0; this.concede = team.opp; G.owner = null; G.passInfo = null; this.offside = null; this.indirect = null;
    this.stoppage += 0.6;
    AU.cheer(1); AU.whistle(1);
    Hud.score(team.side);
    Hud.msg('¡GOOOL!', scorer ? (own ? 'En contra · ' + scorer.name : scorer.info.num + ' · ' + scorer.name) + ' · ' + team.club.short : team.club.name);
    Stadium.drawScreen(G.teams[0].club.short + ' ' + G.teams[0].score + ' - ' + G.teams[1].score + ' ' + G.teams[1].club.short);
    if (scorer && !own) { scorer.action = { type: 'celebrate', t: 0, dur: 4.2, contact: 9, fired: true }; Cam.goal(scorer); }
    else Cam.goal(null);
    for (const p of team.players) if (p !== scorer && !p.isGK && scorer && Math.hypot(p.pos.x - scorer.pos.x, p.pos.z - scorer.pos.z) < 25) p.celebrateWith = scorer;
  }
  afterReplay() { Cam.mode = 'tv'; Hud.msg(null); this.setKickoff(this.concede.side); }
  endHalf() {
    AU.whistle(this.half === 1 ? 2 : 3, true);
    this.restart = null; Hud.added(null);
    if (this.half === 1) { this.state = 'halftime'; this.timer = 0; if (this.attract) this.secondHalf(); else UI.showEnd(false); }
    else { this.state = 'fulltime'; this.timer = 0; if (this.attract) startAttract(); else UI.showEnd(true); }
  }
  secondHalf() {
    this.half = 2; this.clock = 0; this.added = null; this.stoppage = 0;
    for (const p of G.players) p.stamina = Math.min(1, p.stamina + 0.2); // descanso del entretiempo
    for (const t of G.teams) t.attackDir *= -1;
    this.setKickoff(1 - this.firstKick);
    this.state = 'intro'; this.timer = 0; if (!this.attract) Cam.intro();
  }
  // ---- cambios: se hacen en la proxima pelota parada ----
  queueSub(team, out, info) {
    if (team.subsLeft <= 0 || !team.players.includes(out)) return false;
    if (this.pendingSubs.some(s => s.out === out || s.info === info)) return false;
    if ((info.role === 'GK') !== out.isGK) return false;
    this.pendingSubs.push({ team, out, info });
    team.subsLeft--;
    if (this.state === 'halftime' || this.state === 'restart' || this.state === 'intro') this.applySubs();
    return true;
  }
  applySubs() {
    if (!this.pendingSubs.length) return;
    for (const s of this.pendingSubs) {
      const { team, out, info } = s;
      if (!team.players.includes(out)) { team.subsLeft++; continue; }
      const np = new Player(team, info, out.slot); R.prep(np.rig.root);
      np.tag = team.form[out.slot].tag;
      np.teleport(out.pos.x, out.pos.z, out.facing);
      team.players[team.players.indexOf(out)] = np;
      team.bench = team.bench.filter(b => b !== info);
      team.benchOut = (team.benchOut || []).concat([out.info]);
      team.subbed = (team.subbed || []).concat([out]);
      out.rig.dispose();
      if (G.owner === out) G.owner = null;
      if (this.restart && this.restart.taker === out) this.restart.taker = np;
      if (G.human && G.human.p === out) { G.human.p = null; G.human.select(np); }
      this.stoppage += 0.3;
      Hud.sub(team, out, np);
    }
    G.players = G.teams[0].players.concat(G.teams[1].players);
    this.pendingSubs = [];
  }
  // la computadora cambia jugadores cansados en el segundo tiempo
  aiSubs() {
    if (this.state !== 'restart' || this.minute < 58) return;
    for (const t of G.teams) {
      if (t.human || t.subsLeft <= 2 || this.pendingSubs.some(s => s.team === t)) continue;
      if (t._aiSubMin && this.minute - t._aiSubMin < 7) continue;
      const tired = t.players.filter(p => !p.isGK && p.stamina < 0.8).sort((a, b) => a.stamina - b.stamina)[0];
      if (!tired) continue;
      const role = t.form[tired.slot].role;
      const sub = t.bench.filter(b => b.role !== 'GK').sort((a, b) => (b.role === role) - (a.role === role) || b.ovr - a.ovr)[0];
      if (sub) { t._aiSubMin = this.minute; this.queueSub(t, tired, sub); }
    }
  }
}
