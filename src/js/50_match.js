// ===== Partido: reglas basicas, saques, goles, tiempos y estadisticas =====
const RESTART_NAME = { kickoff: 'SAQUE DEL MEDIO', throw: 'SAQUE LATERAL', corner: 'CÓRNER', goalkick: 'SAQUE DE ARCO' };
class Match {
  constructor(opts) {
    this.state = 'intro'; this.timer = 0; this.half = 1; this.clock = 0;
    this.halfLen = (opts.halfMin || 3) * 60; this.restart = null; this.firstKick = Math.random() < 0.5 ? 0 : 1;
    this.attract = !!opts.attract; this.stats = {}; this.events = []; this.inPlay = true;
  }
  get minute() { return Math.min(45, this.clock / this.halfLen * 45) + (this.half - 1) * 45; }
  clockText() { const m = this.minute, mm = Math.floor(m), ss = Math.floor((m - mm) * 60); return String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0'); }
  start() { this.setKickoff(this.firstKick); this.state = 'intro'; this.timer = 0; if (!this.attract) Cam.intro(); }
  locked(p) { return !!(this.restart && this.restart.taker === p); }
  setKickoff(ti) {
    const team = G.teams[ti];
    for (const t of G.teams) t.players.forEach((p, i) => { const k = t.kickoffPos(i, t === team); p.teleport(k.x, k.z, t.attackDir > 0 ? Math.PI / 2 : -Math.PI / 2); p.stamina = Math.min(1, p.stamina + 0.15); });
    // los dos delanteros del que saca, en el medio
    const fws = team.players.filter(p => !p.isGK).sort((a, b) => Math.hypot(a.pos.x, a.pos.z) - Math.hypot(b.pos.x, b.pos.z));
    const ad = team.attackDir;
    fws[0].teleport(-ad * 0.45, 0.2, ad > 0 ? Math.PI / 2 : -Math.PI / 2);
    fws[1].teleport(-ad * 0.6, 2.6, ad > 0 ? Math.PI / 2 + 0.5 : -Math.PI / 2 - 0.5);
    G.ball.place(0, 0); G.owner = null; G.passInfo = null; G.lastTouch = null;
    this.restart = { type: 'kickoff', kickoff: true, team, spot: { x: 0, z: 0 }, taker: fws[0], mate: fws[1], t: 0, ready: false, aim: ad > 0 ? Math.PI / 2 : -Math.PI / 2 };
    this.state = 'restart';
    Hud.info(null);
  }
  setRestart(type, team, spot) {
    const b = G.ball;
    let taker = null;
    if (type === 'goalkick') taker = team.gk;
    else { let bd = 1e9; for (const p of team.players) { if (p.isGK) continue; const d = Math.hypot(p.pos.x - spot.x, p.pos.z - spot.z); if (d < bd) { bd = d; taker = p; } } }
    const ad = team.attackDir;
    // hacia donde mira el que saca
    let aim;
    if (type === 'throw') aim = Math.atan2(ad * 0.6, -Math.sign(spot.z));
    else if (type === 'corner') aim = Math.atan2(-Math.sign(spot.x) * 0.6, -Math.sign(spot.z));
    else aim = ad > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.restart = { type, team, spot, taker, t: 0, ready: false, delay: 0.9, aim };
    this.state = 'restart';
    G.owner = null; G.passInfo = null;
    if (type === 'corner') team.stats.corners++;
    Hud.info(RESTART_NAME[type]);
    if (type !== 'throw') AU.whistle(1);
    if (type === 'corner') AU.cheer(0.35);
  }
  onKick(p, kind) {
    if (this.state === 'restart' && this.restart && this.restart.taker === p) {
      this.state = 'play'; this.restart = null; p.controlCd = 0.45; Hud.info(null); this.inPlay = false; this.kickT = G.time;
    }
  }
  update(h) {
    this.timer += h;
    const st = this.state;
    if (st === 'intro') {
      if (this.timer > (this.attract ? 0.5 : 2.6)) { this.state = 'restart'; AU.whistle(1, true); }
      return;
    }
    if (st === 'restart') { this.clock += this.restart && this.restart.kickoff ? 0 : h; this.updateRestart(h); }
    else if (st === 'play') {
      this.clock += h;
      const pt = possTeam(); if (pt) pt.stats.poss += h;
      if (this.clock >= this.halfLen && !(G.passInfo && G.passInfo.shot && G.time - G.passInfo.t < 2)) this.endHalf();
    }
    else if (st === 'goal') {
      if (this.timer > 4.6) { Cam.mode = 'tv'; this.setKickoff(this.concede.side); Hud.msg(null); }
    }
  }
  updateRestart(h) {
    const r = this.restart; if (!r) return;
    r.t += h;
    const b = G.ball, T = r.taker;
    if (r.delay > 0) { r.delay -= h; if (r.delay <= 0) { b.place(r.spot.x, r.spot.z); } else return; }
    const ad = r.team.attackDir;
    const fx = Math.sin(r.aim), fz = Math.cos(r.aim);
    const back = r.type === 'throw' ? 0.15 : 0.55;
    const sx = r.spot.x - fx * back, sz = r.spot.z - fz * back;
    if (!r.ready) {
      if (r.type !== 'throw') b.place(r.spot.x, r.spot.z);
      const d = moveTo(T, sx, sz, 'sprint');
      T.wantFace = r.aim;
      if (r.kickoff) { T.teleport(sx, sz, r.aim); }
      if ((d < 0.5 || r.kickoff) && r.t > (r.kickoff ? 0.2 : 0.8)) {
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
    if (!humanTakes && r.readyT > (r.kickoff ? 0.8 : 1.1) && !T.action) this.aiTake(r);
  }
  aiTake(r) {
    const T = r.taker, team = r.team, ad = team.attackDir;
    if (r.kickoff) { startKick(T, 'pass', { receiver: r.mate, power: 0.3 }); return; }
    if (r.type === 'throw') {
      let best = null, bs = -1e9;
      for (const m of team.players) { if (m === T || m.isGK) continue; const d = Math.hypot(m.pos.x - T.pos.x, m.pos.z - T.pos.z); if (d > 24) continue; let open = 8; for (const o of team.opp.players) open = Math.min(open, Math.hypot(o.pos.x - m.pos.x, o.pos.z - m.pos.z)); const s = open * 0.4 - d * 0.05 + (m.pos.x - T.pos.x) * ad * 0.03; if (s > bs) { bs = s; best = m; } }
      startKick(T, 'throw', { receiver: best, power: 0.5 }); return;
    }
    if (r.type === 'corner') { aiCross(T); return; }
    if (r.type === 'goalkick') { keeperDistribute(T); return; }
  }
  // pelota afuera y goles
  checkBall() {
    if (this.state !== 'play') return;
    const b = G.ball; if (b.held) return;
    const ax = Math.abs(b.px), az = Math.abs(b.pz);
    // despues de un saque la pelota tiene que entrar a la cancha antes de poder volver a salir
    if (!this.inPlay) { if (ax < PITCH.HL && az < PITCH.HW) this.inPlay = true; else if (G.time - this.kickT < 1.5) return; }
    if (ax > PITCH.HL + BALL_R && ax < PITCH.HL + PITCH.goalD + 0.4 && az < PITCH.goalHW && b.py < PITCH.goalH) {
      const sg = Math.sign(b.px); const scorer = G.teams.find(t => t.attackDir === sg);
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
    const scorer = own ? lt : lt;
    if (scorer && !own) { scorer.stats.goals++; }
    team.stats.onTarget += own ? 0 : 1;
    this.events.push({ min: Math.ceil(this.minute), team: team.side, name: scorer ? scorer.name : '', own });
    this.state = 'goal'; this.timer = 0; this.concede = team.opp; G.owner = null; G.passInfo = null;
    AU.cheer(1); AU.whistle(1);
    Hud.score(team.side);
    Hud.msg('¡GOOOL!', scorer ? (own ? 'En contra · ' + scorer.name : scorer.info.num + ' · ' + scorer.name) + ' · ' + team.club.short : team.club.name);
    Stadium.drawScreen(G.teams[0].club.short + ' ' + G.teams[0].score + ' - ' + G.teams[1].score + ' ' + G.teams[1].club.short);
    if (scorer && !own) { scorer.action = { type: 'celebrate', t: 0, dur: 4.2, contact: 9, fired: true }; Cam.goal(scorer); }
    else Cam.goal(null);
    // los del equipo que hizo el gol salen a festejar con el goleador
    for (const p of team.players) if (p !== scorer && !p.isGK && scorer && Math.hypot(p.pos.x - scorer.pos.x, p.pos.z - scorer.pos.z) < 25) p.celebrateWith = scorer;
  }
  endHalf() {
    AU.whistle(this.half === 1 ? 2 : 3, true);
    if (this.half === 1) { this.state = 'halftime'; this.timer = 0; if (this.attract) this.secondHalf(); else UI.showEnd(false); }
    else { this.state = 'fulltime'; this.timer = 0; if (this.attract) startAttract(); else UI.showEnd(true); }
  }
  secondHalf() {
    this.half = 2; this.clock = 0;
    for (const t of G.teams) t.attackDir *= -1;
    this.setKickoff(1 - this.firstKick);
    this.state = 'intro'; this.timer = 0; if (!this.attract) Cam.intro();
  }
}
