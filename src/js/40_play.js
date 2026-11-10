// ===== Juego con la pelota: control, conduccion, pases, disparos, cabezazos y entradas =====
function possTeam() { return G.owner ? G.owner.team : G.lastTouch ? G.lastTouch.team : null; }
function nearestOpp(p) {
  let best = null, bd = 1e9;
  for (const o of p.team.opp.players) { const d = Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z); if (d < bd) { bd = d; best = o; } }
  return { p: best, d: bd };
}
function pressureOn(p) { return clamp((3.5 - nearestOpp(p).d) / 3.5, 0, 1); }

function setOwner(p) {
  const prev = G.owner;
  G.owner = p;
  if (!p) return;
  const lt = G.lastTouch;
  if (G.passInfo && G.passInfo.from !== p) {
    const pi = G.passInfo;
    if (pi.from.team === p.team && !pi.shot) { pi.from.stats.passOk++; p.team.stats.passOk++; }
    G.passInfo = null;
  }
  if (lt && lt.team !== p.team) p.team.recovered = G.time;
  touchBy(p);
  if (G.human && prev !== p) G.human.onPossession(p, prev);
}

// control de pelota de todos los jugadores
function updatePossession(h) {
  const b = G.ball;
  if (b.held) { if (G.owner !== b.held) setOwner(b.held); return; }
  let o = G.owner;
  if (o) {
    const fp = o.foot(0.45), d = Math.hypot(b.px - fp.x, b.pz - fp.z);
    if (d > 1.55 || b.py > 1.15 || o.stun > 0 || (o.action && (o.action.type === 'dive' || o.action.type === 'fall'))) { G.owner = null; o = null; }
  }
  if (o) { dribble(o, h); return; }
  let best = null, bd = 1e9;
  const restart = G.match && G.match.state === 'restart';
  for (const p of G.players) {
    if (p.controlCd > 0 || p.stun > 0) continue;
    if (p.action && (p.action.type === 'slide' || p.action.type === 'dive' || p.action.type === 'fall')) continue;
    if (restart && G.match.restart.taker !== p) continue;
    const fp = p.foot(0.32), d = Math.hypot(b.px - fp.x, b.pz - fp.z);
    let reach = 0.72 + p.a.dri / 100 * 0.25;
    // cortar un pase rapido del rival es mas dificil que recibir uno propio
    const pi = G.passInfo;
    if (pi && pi.from.team !== p.team && pi.to) { const bs = Math.hypot(b.vx, b.vz); reach *= clamp(1.25 - bs / 16, 0.35, 1) * (0.75 + p.a.def / 100 * 0.35); if (G.time - pi.t < 0.15) reach *= 0.5; }
    if (b.py > 0.75) { if (b.py > 1.7 || p.isGK) continue; reach *= 0.7; }
    if (d < reach && d < bd) { bd = d; best = p; }
  }
  if (best) receive(best);
}
function receive(p) {
  const b = G.ball;
  // si tenia apretado un pase/disparo: le pega de primera
  if (p.buffer && p.buffer.until > G.time && !p.action) {
    const bf = p.buffer; p.buffer = null;
    setOwner(p); touchBy(p);
    startKick(p, bf.kind, bf.opts, true);
    return;
  }
  const rvx = b.vx - p.vel.x, rvz = b.vz - p.vel.z, rel = Math.hypot(rvx, rvz, b.vy * 0.6);
  // ---- calidad del primer toque: velocidad y altura de la pelota, habilidad, presion, de espaldas al arco y si va corriendo ----
  const skill = (p.a.dri * 0.6 + p.a.pas * 0.4) / 100, near = nearestOpp(p), press = clamp((3 - near.d) / 3, 0, 1);
  const f = p.fwd(), ad = p.team.attackDir, sp = Math.hypot(p.vel.x, p.vel.z);
  const backToGoal = f.x * ad < -0.3;
  const diff = rel / 27 + (b.py > 0.5 ? 0.1 + (b.py - 0.5) * 0.12 : 0) + press * 0.3 + (backToGoal ? 0.07 : 0) + sp / 26;
  const err = clamp(diff - skill * 0.78 + randn() * 0.07, 0, 1.2);
  // hacia donde la acomoda: el usuario hacia donde apunta; la IA hacia el arco si hay lugar, o la protege lejos del rival
  let dx = 0, dz = 0, human = G.human && G.human.p === p;
  if (human) { const mv = Input.move(); if (mv.l > 0.2) { dx = mv.x / mv.l; dz = mv.z / mv.l; } }
  else if (!p.isGK) {
    if (press > 0.4 && near.p) { dx = p.pos.x - near.p.pos.x; dz = p.pos.z - near.p.pos.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; dx = dx * 0.6 + ad * 0.4; }
    else { dx = ad; dz = -p.pos.z * 0.01; }
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  }
  const dist = 0.45 + err * 3.3; // buen toque: 0,5-0,8 m; malo: hasta 4 m
  const ang = randn() * err * 0.9, ca = Math.cos(ang), sa = Math.sin(ang);
  if (!dx && !dz) { dx = f.x; dz = f.z; }
  const ux = dx * ca - dz * sa, uz = dx * sa + dz * ca;
  p._recvY = b.py;
  if (err > 0.55) {
    // mal control: se le va lejos y puede quedar para el rival
    b.vx = p.vel.x * 0.6 + ux * dist * 1.7 - rvx * 0.15; b.vz = p.vel.z * 0.6 + uz * dist * 1.7 - rvz * 0.15;
    b.vy = Math.max(0, b.vy * 0.2 + Math.random() * err); b.trajDirty = true; G.kickSeq++;
    touchBy(p); p.controlCd = 0.3 + err * 0.2; AU.touch();
    if (G.passInfo && G.passInfo.from.team !== p.team) G.passInfo = null;
    p.action = p.action || { type: 'trap', t: 0, dur: 0.32, contact: 9, fired: true, foot: p.info.foot || 'R', kind: b.py > 0.95 ? 'chest' : b.py > 0.42 ? 'thigh' : 'inside' };
    return;
  }
  setOwner(p); touchBy(p);
  // IA: decide antes de recibir. Pared devuelta de primera, o pase de primera si lo apuran
  if (!human && !p.isGK && G.match && G.match.state === 'play') {
    const pi = G.passInfo, mate = pi && pi.from && pi.from.team === p.team ? pi.from : null;
    if (mate && mate.brain.wall && mate.brain.wall.to === p && G.time - mate.brain.wall.t < 2.5) {
      const ahead = (mate.pos.x - p.pos.x) * ad, runX = mate.pos.x + ad * 5;
      if (ahead > 1 && passRisk(p, runX, mate.pos.z, false, mate) < 0.45) { mate.brain.wall = null; startKick(p, 'through', { receiver: mate, power: 0.4 }, true); return; }
    }
    if (near.d < 1.4 && Math.random() < 0.5) { const bp = bestPass(p, near.d); if (bp && bp.kind === 'pass' && passRisk(p, bp.m.pos.x, bp.m.pos.z, false, bp.m) < 0.3) { startKick(p, 'pass', { receiver: bp.m, power: 0.4 }, true); return; } }
  }
  b.vx = p.vel.x + ux * dist * 1.6 + rvx * 0.04; b.vz = p.vel.z + uz * dist * 1.6 + rvz * 0.04;
  p.touchHold = G.time + 0.18 + err * 0.4; // durante el primer toque la pelota sigue sola un ratito (no se pega al pie de una)
  // animacion de recepcion segun como viene
  if (!p.action && rel > 2.5) { const hy = p._recvY; p.action = { type: 'trap', t: 0, dur: 0.32, contact: 9, fired: true, foot: p.info.foot || 'R', kind: hy > 0.95 ? 'chest' : hy > 0.42 ? 'thigh' : rel < 6 ? 'sole' : 'inside' }; }
  if (b.py > BALL_R + 0.05) b.vy = Math.min(0, b.vy) * 0.3;
  b.wx = b.wy = b.wz = 0; b.trajDirty = true; G.kickSeq++;
  AU.touch();
}// todo toque pasa por aca: sirve para el fuera de juego y los tiros libres indirectos
function touchBy(p) { if (G.match && G.match.state === 'play') G.match.involve(p); G.lastTouch = p; }

// conduccion estilo juego de celular: la pelota va pegada al pie, un poco mas adelante cuanto mas rapido corre,
// y en los giros acompaña al jugador (no sigue de largo). Nunca se escapa sola.
function dribble(o, h) {
  const b = G.ball;
  if (o.action && o.action.type === 'kick' && o.action.fired) return;
  const f = o.fwd(), sp = Math.hypot(o.vel.x, o.vel.z);
  if (b.py > BALL_R + 0.15) b.vy = Math.min(b.vy, -1);
  // direccion: mezcla de hacia donde mira y hacia donde corre (asi en un giro la pelota ya va para el lado nuevo)
  let dx = f.x, dz = f.z;
  if (sp > 0.6) { dx = f.x * 0.4 + o.vel.x / sp * 0.6; dz = f.z * 0.4 + o.vel.z / sp * 0.6; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; }
  // un toquecito cada paso: la pelota "late" un poco adelante al correr (se ve como que la va tocando)
  o.dribT = (o.dribT || 0) + h * (1.6 + sp * 0.35);
  const pulse = sp > 2 ? Math.max(0, Math.sin(o.dribT * TAU)) * Math.min(0.22, sp * 0.03) : 0;
  const lead = 0.36 + Math.min(sp, 8.5) * 0.045 + pulse;
  const tx = o.pos.x + dx * lead + o.vel.x * h, tz = o.pos.z + dz * lead + o.vel.z * h;
  const ctrl = 0.8 + o.a.dri / 100 * 0.45;
  const ex = tx - b.px, ez = tz - b.pz, err = Math.hypot(ex, ez);
  const gain = err > 0.9 ? 22 : 12; // si se alejo, la trae enseguida
  const dvx = o.vel.x + ex * gain, dvz = o.vel.z + ez * gain;
  let k = clamp(h * 18 * ctrl, 0, 1);
  if (o.touchHold > G.time) k *= 0.12; // primer toque: todavia no la domino del todo
  b.vx += (dvx - b.vx) * k; b.vz += (dvz - b.vz) * k;
  // tope: nunca mas rapido que el jugador + un poco (si no, se iria sola)
  const bs = Math.hypot(b.vx, b.vz), cap = sp + 2.5;
  if (bs > cap && !(o.touchHold > G.time)) { b.vx *= cap / bs; b.vz *= cap / bs; }
}

// ---- acciones ----
const KICK_T = { shot: [0.4, 0.15], chip: [0.36, 0.14], pass: [0.28, 0.1], through: [0.3, 0.11], lob: [0.36, 0.14], cross: [0.38, 0.15], clear: [0.34, 0.13], throw: [0.62, 0.36], header: [0.5, 0.2], knock: [0.2, 0.06] };
function startKick(p, kind, opts, quick) {
  if (p.action && p.action.type !== 'catch' && p.action.type !== 'trap') return false;
  opts = opts || {};
  const t = KICK_T[kind] || KICK_T.pass;
  const type = kind === 'throw' ? 'throw' : kind === 'header' ? 'header' : 'kick';
  // hacia donde va a salir la pelota: se elige el receptor YA (asi el cuerpo se acomoda y el pase va a ese compañero)
  let face = null;
  if (kind !== 'knock' && kind !== 'header') {
    const dir = opts.dir && (opts.dir.x || opts.dir.z) ? opts.dir : p.fwd();
    if ((kind === 'pass' || kind === 'through' || kind === 'lob') && !opts.receiver && !opts.target) {
      let rec = pickReceiver(p, dir, kind);
      if (!rec && kind === 'pass') rec = pickReceiver(p, dir, 'pass', -0.1) || pickReceiver(p, { x: -dir.x, z: -dir.z }, 'pass', -1);
      if (rec) opts.receiver = rec;
    }
    const tg = opts.target || (opts.receiver ? { x: opts.receiver.pos.x + opts.receiver.vel.x * 0.4, z: opts.receiver.pos.z + opts.receiver.vel.z * 0.4 } : null);
    if (tg) face = Math.atan2(tg.x - p.pos.x, tg.z - p.pos.z);
    else if (kind === 'shot' || kind === 'chip') face = Math.atan2(p.team.oppGoalX - p.pos.x, (opts.aimZ || 0) - p.pos.z);
    else face = Math.atan2(dir.x, dir.z);
  }
  // si tiene que girar mucho, tarda un poquito mas en pegarle (se acomoda antes de patear)
  const turn = face == null ? 0 : Math.abs(angWrap(face - p.facing));
  const extra = quick ? 0 : clamp((turn - 0.3) / 12, 0, 0.13);
  const contact = quick ? Math.min(0.06, t[1]) : t[1] + extra;
  let ty2 = type, dur = t[0] + extra, cont = contact;
  if (p.isGK && G.ball.held === p && type === 'kick') { ty2 = kind === 'pass' ? 'gkthrow' : 'gkvolley'; dur = ty2 === 'gkthrow' ? 0.62 : 0.72; cont = ty2 === 'gkthrow' ? 0.3 : 0.4; }
  // pie: el habil, salvo que la pelota tenga que salir muy para el lado del otro pie (pierna mala = mas error)
  const pref = p.info.foot || 'R', rel = face == null ? 0 : angWrap(face - p.facing); // + = hacia la izquierda del jugador
  const weak = (pref === 'R' && rel < -0.65) || (pref === 'L' && rel > 0.65);
  const foot = weak ? (pref === 'R' ? 'L' : 'R') : pref;
  const bb = G.ball, ftRel = quick ? Math.hypot(bb.vx - p.vel.x, bb.vz - p.vel.z) : 0;
  p.action = { type: ty2, kind, t: quick ? Math.max(0, cont - contact) : 0, dur, contact: cont, fired: false, opts, foot, jump: 1, face, turn, weak, ftRel };
  // pie de apoyo: al costado de la pelota (25 cm) y un poquito atras, del lado contrario al pie que patea
  if (ty2 === 'kick' && kind !== 'knock') {
    const b = G.ball, fa = face != null ? face : p.facing, side = foot === 'L' ? -1 : 1;
    const bx = b.px + b.vx * cont * 0.6, bz = b.pz + b.vz * cont * 0.6;
    p.action.plant = { x: bx + Math.cos(fa) * 0.25 * side - Math.sin(fa) * 0.12, z: bz - Math.sin(fa) * 0.25 * side - Math.cos(fa) * 0.12 };
  }
  return true;
}
function actionFire(p, ac) {
  if (ac.type === 'kick' || ac.type === 'throw' || ac.type === 'header' || ac.type === 'gkthrow' || ac.type === 'gkvolley') executeKick(p, ac.kind, ac.opts);
  else if (ac.type === 'tackle') resolveTackle(p);
}
function executeKick(p, kind, o) {
  const b = G.ball;
  if (b.held !== p) {
    const fp = p.foot(kind === 'header' ? 0.25 : 0.45), d = Math.hypot(b.px - fp.x, b.pz - fp.z);
    if (kind === 'header') { if (d > 1.25 || b.py < 1.0 || b.py > 2.9) return; }
    else if (d > 1.25 || b.py > 1.05) return; // no llego
  }
  if (kind === 'knock') { // toque largo para picar
    const f = p.fwd(); b.launch(p.vel.x + f.x * 5.5, 0, p.vel.z + f.z * 5.5); setOwner(null); touchBy(p); p.controlCd = 0.2; b.ignore = p; b.ignoreT = 0.2; AU.touch(); return;
  }
  const shot = kind === 'shot' || kind === 'chip' || (kind === 'header' && o.attack);
  const r = kind === 'header' ? computeHeader(p, o) : shot ? computeShot(p, o) : computePass(p, kind, o);
  if (!r) return;
  if (b.held) { b.held = null; }
  if (kind !== 'header' && kind !== 'throw' && b.py < BALL_R + 0.3) b.py = BALL_R;
  b.launch(r.vx, r.vy, r.vz, r.w);
  b.ignore = p; b.ignoreT = 0.22; p.controlCd = 0.3; p.buffer = null; p.lastKickT = G.time;
  G.owner = null; touchBy(p);
  G.passInfo = { from: p, to: r.receiver || null, x: r.tx, z: r.tz, t: G.time, kind, shot };
  if (shot) { p.stats.shots++; p.team.stats.shots++; G.lastShot = { p, t: G.time, onTarget: false }; }
  else if (kind === 'pass' && r.receiver && !p.isGK && !(G.human && G.human.p === p) && Math.hypot(r.receiver.pos.x - p.pos.x, r.receiver.pos.z - p.pos.z) < 14 && (p.pos.x * p.team.attackDir) > -15 && Math.random() < 0.45) p.brain.wall = { t: G.time, to: r.receiver }; // tiro la pared
  else if (kind !== 'clear') { p.stats.passes++; p.team.stats.passes++; }
  AU.kick(kind === 'pass' ? 0.25 : kind === 'header' ? 0.3 : clamp(Math.hypot(r.vx, r.vz) / 30, 0.2, 1));
  if (G.match) G.match.onKick(p, kind);
  if (G.human) G.human.onKick(p, r, kind);
}

// ---- pelota rodando por el pasto (mismo roce que ballStep): velocidad y tiempo despues de D metros ----
function groundRoll(v0, D) {
  let v = v0, x = 0, t = 0; const h = 1 / 60;
  while (x < D && v > 0.05 && t < 8) { v = v / (1 + BP.rollK * h) - BP.rollC * h; x += v * h; t += h; }
  return { v: x >= D ? v : 0, t };
}
// velocidad de salida para que llegue a D metros a la velocidad vArr
function groundV0(D, vArr) {
  let lo = vArr, hi = 40;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (groundRoll(m, D).v < vArr) lo = m; else hi = m; }
  return hi;
}
// velocidad comoda de llegada de un pase rasante: 8 m/s corto, hasta 12 m/s largo
const passArrive = D => clamp(8 + D * 0.1, 8, 12);
function laneBlock(p, tx, tz) {
  let pen = 0;
  for (const o of p.team.opp.players) { const d = segDist(p.pos.x, p.pos.z, tx, tz, o.pos.x, o.pos.z); if (d < 1.8) pen += (1.8 - d) / 1.8; }
  return pen;
}
function pickReceiver(p, dir, kind, minCos) {
  let best = null, bs = -1e9;
  const lob = kind === 'lob' || kind === 'cross';
  for (const m of p.team.players) {
    if (m === p) continue;
    const dx = m.pos.x - p.pos.x, dz = m.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d < 3) continue;
    const cos = (dx * dir.x + dz * dir.z) / d;
    if (cos < (minCos != null ? minCos : 0.42)) continue;
    const ideal = lob ? 30 : kind === 'through' ? 20 : 12;
    let s = cos * 2.2 - Math.abs(d - ideal) / (lob ? 30 : 22);
    if (!lob) s -= laneBlock(p, m.pos.x, m.pos.z) * 0.7;
    if (p.team.human && !lob) s -= passRisk(p, m.pos.x + m.vel.x * 0.4, m.pos.z + m.vel.z * 0.4, false, m) * 1.2;
    if (m.isGK) s -= 1.2;
    if (s > bs) { bs = s; best = m; }
  }
  return best;
}
function computePass(p, kind, o) {
  const b = G.ball, team = p.team, ad = team.attackDir;
  let dir = o.dir && (o.dir.x || o.dir.z) ? o.dir : p.fwd();
  const lob = kind === 'lob' || kind === 'cross' || kind === 'clear';
  const throwIn = kind === 'throw';
  let rec = o.receiver || null;
  if (!rec && !o.target && kind !== 'clear') rec = pickReceiver(p, dir, throwIn ? 'pass' : kind);
  // pase corto: nunca al vacio. Si no hay nadie para ese lado, busca al compañero mas logico (un poco mas abierto, o el mas cercano)
  if (!rec && !o.target && (kind === 'pass' || throwIn)) rec = pickReceiver(p, dir, 'pass', -0.1) || pickReceiver(p, { x: -dir.x, z: -dir.z }, 'pass', -1);
  const sx = b.px, sz = b.pz;
  let tx, tz;
  if (o.target) { tx = o.target.x; tz = o.target.z; }
  else if (rec) {
    if (kind === 'through') {
      // al espacio: adelante del receptor, hacia el arco rival
      const rl = Math.hypot(rec.vel.x, rec.vel.z);
      let rx = ad * 0.75 + (rl > 1 ? rec.vel.x / rl * 0.4 : 0), rz = (rl > 1 ? rec.vel.z / rl * 0.4 : 0) - rec.pos.z * 0.008;
      const l = Math.hypot(rx, rz) || 1; rx /= l; rz /= l;
      const lead = 4 + (o.power || 0.5) * 9;
      tx = rec.pos.x + rx * lead; tz = rec.pos.z + rz * lead;
    } else {
      // pase adelantado: va adonde VA a estar el compañero (se calcula el tiempo de viaje real 2 veces)
      tx = rec.pos.x; tz = rec.pos.z;
      for (let it = 0; it < 2; it++) {
        const D0 = Math.hypot(tx - sx, tz - sz);
        const tEst = lob ? 1.0 + D0 * 0.035 : groundRoll(groundV0(D0, passArrive(D0)), D0).t;
        tx = rec.pos.x + rec.vel.x * tEst * 0.9; tz = rec.pos.z + rec.vel.z * tEst * 0.9;
      }
    }
  } else {
    const D = kind === 'clear' ? 35 + (o.power || 0.7) * 15 : throwIn ? 8 + (o.power || 0.5) * 14 : 10 + (o.power || 0.5) * (lob ? 35 : 25);
    tx = sx + dir.x * D; tz = sz + dir.z * D;
  }
  tx = clamp(tx, -54, 54); tz = clamp(tz, -35, 35);
  const D = Math.max(1, Math.hypot(tx - sx, tz - sz));
  // error: habilidad, presion, posicion del cuerpo y distancia
  const pr = pressureOn(p), skill = p.a.pas / 100, f = p.fwd();
  const facing = ((tx - sx) * f.x + (tz - sz) * f.z) / D;
  const dd = teamDiff(team);
  // error segun la situacion: habilidad, presion, cuerpo mal orientado (90 grados es lo mas dificil; para atras es facil),
  // pierna mala, de primera con la pelota viniendo rapido y distancia
  const ac = p.action || {}, turn = ac.turn || Math.acos(clamp(facing, -1, 1));
  const bodyK = turn > 2.3 ? 1.1 : 1 + 0.8 * Math.sin(Math.min(turn, Math.PI / 2));
  let err = (0.012 + (1 - skill) * 0.07) * (1 + pr * 0.9) * bodyK * (ac.weak ? 1.35 : 1) * (1 + (ac.ftRel || 0) / 25) * (lob ? 1.2 : 1) * (team.human ? 0.7 : dd.passErr) * (1 + D / 80);
  if (G.mode === 'menu') err *= 1.1;
  const ang = Math.atan2(tz - sz, tx - sx) + randn() * err;
  const pe = 1 + randn() * err * 0.8;
  let r;
  if (!lob && !throwIn) {
    // la fuerza se calcula con el roce del pasto para que llegue a una velocidad comoda (8-12 m/s)
    const v0 = Math.min(groundV0(D, kind === 'through' ? 4.5 : passArrive(D)) * pe, 32);
    r = { vx: Math.cos(ang) * v0, vy: 0, vz: Math.sin(ang) * v0, w: null };
  } else {
    const driven = kind === 'cross' && o.driven;
    const T = throwIn ? 0.55 + D * 0.035 : kind === 'clear' ? 1.7 + D * 0.015 : driven ? 0.62 + D * 0.02 : kind === 'cross' ? 1.05 + D * 0.03 : 0.95 + D * 0.034;
    const ex = sx + Math.cos(ang) * D * pe, ez = sz + Math.sin(ang) * D * pe;
    const ty = driven ? 0.9 : kind === 'cross' ? 1.3 : throwIn ? 0.6 : BALL_R + 0.2;
    const sy = b.held ? b.py : Math.max(b.py, BALL_R);
    // los centros doblan en el aire (efecto Magnus): hacia el arco (cerrado) o hacia afuera (abierto)
    const w = kind === 'cross' ? { x: 0, y: (o.inswing === false ? -1 : 1) * Math.sign(sz || 1) * Math.sign(team.attackDir) * -(driven ? 13 : 16), z: 0 } : null; // ~1,4 m de curva el alto, ~0,8 m el rasante
    const v = solveLaunch(sx, sy, sz, ex, ty, ez, D / T, w);
    r = { vx: v.vx, vy: v.vy, vz: v.vz, w };
  }
  return Object.assign(r, { receiver: rec, tx, tz });
}
function computeShot(p, o) {
  const team = p.team, gx = team.oppGoalX, b = G.ball;
  const sx = b.px, sy = Math.max(b.py, BALL_R), sz = b.pz;
  const pw = clamp(o.power == null ? 0.6 : o.power, 0.05, 1);
  let aimZ;
  if (o.aimZ != null) aimZ = o.aimZ;
  else if (o.dir && Math.abs(o.dir.z) > 0.3) aimZ = Math.sign(o.dir.z) * 2.85;
  else aimZ = (Math.abs(sz) < 2 ? (Math.random() < 0.5 ? -1 : 1) : -Math.sign(sz)) * 2.5;
  const finesse = o.finesse != null ? o.finesse : pw < 0.45 && !o.chip;
  const D = Math.hypot(gx - sx, aimZ - sz);
  let ty = o.chip ? 2.0 : 0.3 + pw * 1.45;
  const sk = p.a.sho / 100, pr = pressureOn(p), f = p.fwd();
  const fd = (f.x * (gx - sx) + f.z * (aimZ - sz)) / D;
  const dd = teamDiff(team);
  const sac = p.action || {}, run = Math.hypot(p.vel.x, p.vel.z);
  let err = (0.0118 + (1 - sk) * 0.057) * (1 + pr * 0.7) * (fd < 0.3 ? 1.8 : 1) * (1 + Math.max(0, pw - 0.8) * 2.5) * (finesse ? 0.75 : 1) * (team.human ? 1 : dd.shotErr) * (1 + D / 60)
    * (sac.weak ? 1.4 : 1) * (run > 6 ? 1.25 : 1) * (1 + (sac.ftRel || 0) / 30);
  if (b.py > 0.4) err *= 1.35;
  const ang = Math.atan2(aimZ - sz, gx - sx) + randn() * err;
  ty += randn() * err * D * 0.35 + (pw > 0.88 ? Math.random() * (pw - 0.88) * 9 : 0);
  ty = Math.max(BALL_R, ty);
  const tx = sx + Math.cos(ang) * D, tz = sz + Math.sin(ang) * D;
  const hs = o.chip ? clamp(D * 0.6, 9, 16) : (13 + pw * 15 + sk * 5) * (finesse ? 0.8 : 1);
  // efecto: colocado = con rosca hacia el palo lejano; potente = con un poco de efecto al azar
  const ux = (tx - sx) / D, uz = (tz - sz) / D;
  const w = { x: 0, y: 0, z: 0 };
  if (finesse) { const curve = Math.sign(aimZ - sz) || 1; w.y = -curve * Math.sign(ux) * 11; }
  else w.y = randn() * 3;
  const top = o.chip ? 6 : -pw * 4; // backspin (+) o topspin (-)
  w.x += -uz * top; w.z += ux * top;
  const v = solveLaunch(sx, sy, sz, tx, ty, tz, hs, w);
  return { vx: v.vx, vy: v.vy, vz: v.vz, w, receiver: null, tx, tz };
}
function computeHeader(p, o) {
  const b = G.ball, team = p.team, gx = team.oppGoalX;
  const toGoal = Math.hypot(gx - b.px, b.pz);
  let tx, ty, tz, s;
  if (o.attack && toGoal < 20) { tz = (Math.random() < 0.5 ? -1 : 1) * rand(1, 3.2); tx = gx; ty = rand(0.3, 2.2); s = 13 + p.a.sho / 100 * 5; }
  else if (o.flick) { const bl = Math.hypot(b.vx, b.vz) || 1; tx = b.px + b.vx / bl * 12; tz = b.pz + b.vz / bl * 12; ty = 1.6; s = 9; } // peinada: sigue la direccion de la pelota
  else if (o.receiver) { tx = o.receiver.pos.x; tz = o.receiver.pos.z; ty = 0.5; s = 11; }
  else { const d = o.dir && (o.dir.x || o.dir.z) ? o.dir : { x: team.attackDir, z: -b.pz * 0.01 }; tx = b.px + d.x * 18; tz = b.pz + d.z * 18; ty = 3; s = 12; }
  const err = (0.04 + (1 - p.a.sho / 100) * 0.12);
  const dx = tx - b.px, dy = ty - b.py, dz = tz - b.pz, l = Math.hypot(dx, dy, dz) || 1;
  const a = randn() * err;
  const cx = Math.cos(a), sn = Math.sin(a);
  const vx = (dx * cx - dz * sn) / l * s, vz = (dx * sn + dz * cx) / l * s;
  return { vx, vy: dy / l * s + (o.attack ? -1 : 2.5), vz, w: null, receiver: o.receiver || null, tx, tz };
}

// entrada de pie
function startTackle(p) {
  if (p.action || p.tackleCd > 0 || p.stun > 0) return;
  p.action = { type: 'tackle', t: 0, dur: 0.42, contact: 0.15, fired: false };
  const b = G.ball; p.facing = Math.atan2(b.px - p.pos.x, b.pz - p.pos.z); // se tira hacia la pelota
  p.tackleCd = 0.75;
  const f = p.fwd(); p.vel.x += f.x * 1.5; p.vel.z += f.z * 1.5;
}
function resolveTackle(p) {
  const b = G.ball, fp = p.foot(0.75);
  const bx = b.px - p.pos.x, bz = b.pz - p.pos.z, dB = Math.hypot(bx, bz), fw = p.fwd();
  if (b.held || dB > 1.75 || b.py > 0.8 || (bx * fw.x + bz * fw.z) / (dB || 1) < 0.2) { p.stun = 0.25; return; }
  const o = G.owner, f = p.fwd();
  if (o && o.team !== p.team) {
    const dd = teamDiff(p.team);
    const behind = (o.pos.x - p.pos.x) * o.fwd().x + (o.pos.z - p.pos.z) * o.fwd().z > 0.3; // de atras: mas dificil
    const chance = clamp(0.5 + (p.a.def - o.a.dri) / 110 + (p.team.human ? 0.06 : dd.tackle) - (behind ? 0.2 : 0), 0.12, 0.9);
    if (Math.random() < chance) {
      b.launch(p.vel.x * 0.4 + f.x * 3.2 + randn(), 0, p.vel.z * 0.4 + f.z * 3.2 + randn());
      G.owner = null; touchBy(p); o.stun = 0.45; o.controlCd = 0.4; p.controlCd = 0;
      p.stats.tackles++; p.team.stats.tackles++; AU.touch(); G.passInfo = null;
    } else {
      p.stun = 0.5;
      // si no toca la pelota y se lleva al rival: falta
      const close = Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z) < 1.5;
      if (close && Math.random() < (behind ? 0.55 : 0.2) * (1.15 - p.a.def / 100)) { o.action = { type: 'fall', t: 0, dur: 1.0, contact: 9, fired: true }; o.stun = 1.0; G.owner = null; if (G.match) G.match.foul(p, o, 'tackle'); }
    }
  } else if (!o) {
    b.launch(f.x * 5 + p.vel.x * 0.3, 0, f.z * 5 + p.vel.z * 0.3); touchBy(p); AU.touch();
  }
}
// barrida
function startSlide(p) {
  if (p.action || p.tackleCd > 0 || p.stun > 0) return;
  const f = p.fwd(), sp = Math.max(6.5, Math.hypot(p.vel.x, p.vel.z) + 1.2);
  p.vel.set(f.x * sp, 0, f.z * sp);
  p.action = { type: 'slide', t: 0, dur: 0.95, contact: 9, fired: true, hit: false };
  p.tackleCd = 1.5;
}
function slideCheck(p, ac) {
  if (ac.hit || ac.t < 0.06 || ac.t > 0.62) return;
  const b = G.ball; if (b.held || b.py > 0.55) return;
  const fp = p.foot(0.95), d = Math.hypot(b.px - fp.x, b.pz - fp.z);
  if (d < 0.75) {
    ac.hit = true;
    const o = G.owner, f = p.fwd();
    b.launch(f.x * 7 + p.vel.x * 0.25 + randn(), 0.6, f.z * 7 + p.vel.z * 0.25 + randn());
    if (o && o.team !== p.team) { o.action = { type: 'fall', t: 0, dur: 1.1, contact: 9, fired: true }; o.stun = 1.1; p.stats.tackles++; p.team.stats.tackles++; }
    G.owner = null; touchBy(p); AU.touch(); G.passInfo = null;
    return;
  }
  // si se lleva puesto al rival sin tocar la pelota (en la fase 3 sera falta)
  for (const o of p.team.opp.players) {
    if (o.action && o.action.type === 'fall') continue;
    const dd = Math.hypot(o.pos.x - fp.x, o.pos.z - fp.z);
    if (dd < 0.55) { o.action = { type: 'fall', t: 0, dur: 1.0, contact: 9, fired: true }; o.stun = 1.0; if (G.owner === o) G.owner = null; ac.hit = true; if (G.match) G.match.foul(p, o, 'slide'); break; }
  }
}
// punto donde el jugador puede alcanzar la pelota (usa la trayectoria predicha)
function interceptFor(p, allowHigh) {
  const b = G.ball, T = b.traj, n = b.trajN;
  if (!n) return { x: b.px, z: b.pz, t: 0, y: b.py };
  const vm = p.vmax * 0.95;
  for (let i = 0; i < n; i++) {
    const x = T[i * 4], y = T[i * 4 + 1], z = T[i * 4 + 2], t = i / 30;
    if (y > (allowHigh ? 2.5 : 1.0)) continue;
    const d = Math.hypot(x - p.pos.x, z - p.pos.z) - 0.6;
    if (d / vm + 0.2 <= t || d < 0.3) return { x, z, t, y };
  }
  const k = (n - 1) * 4; return { x: T[k], z: T[k + 2], t: n / 30, y: T[k + 1] };
}
