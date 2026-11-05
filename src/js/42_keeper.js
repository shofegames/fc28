// ===== Arqueros: ubicacion, lectura del remate (trayectoria predicha), estiradas, atajadas y saques =====
function shotThreat(team) {
  const b = G.ball, T = b.traj, n = b.trajN, ad = team.attackDir, gl = -PITCH.HL;
  if (!n || b.held || G.owner) return null;
  if (b.vx * ad > -4) return null; // no va hacia el arco propio
  for (let i = 1; i < Math.min(n, 52); i++) {
    const x0 = T[(i - 1) * 4] * ad, x1 = T[i * 4] * ad;
    if (x0 > gl && x1 <= gl) {
      const k = (x0 - gl) / (x0 - x1 || 1);
      const z = lerp(T[(i - 1) * 4 + 2], T[i * 4 + 2], k), y = lerp(T[(i - 1) * 4 + 1], T[i * 4 + 1], k);
      if (Math.abs(z) < PITCH.goalHW + 0.7 && y < PITCH.goalH + 0.5) return { t: (i - 1 + k) / 30, z, y, onTarget: Math.abs(z) < PITCH.goalHW && y < PITCH.goalH };
      return null;
    }
  }
  return null;
}
function keeperAI(p, h) {
  const team = p.team, b = G.ball, ad = team.attackDir, gx = team.ownGoalX, K = p.brain;
  const dd = teamDiff(team), st = G.match.state;
  p.sprint = false; p.wantFace = null;
  if (st === 'goal' || st === 'intro' || st === 'halftime' || st === 'fulltime') { idleBrain(p); return; }
  if (G.match.restart && G.match.restart.kickoff) { p.want.x = p.want.z = 0; p.wantFace = ad > 0 ? Math.PI / 2 : -Math.PI / 2; return; }
  const rr = G.match.restart;
  if (rr && rr.type === 'penalty' && rr.team !== team && !rr.kicked) { moveTo(p, gx + ad * 0.15, 0, 'run'); p.wantFace = ad > 0 ? Math.PI / 2 : -Math.PI / 2; return; }
  K.saveCd = (K.saveCd || 0) - h;
  // con la pelota en las manos
  if (b.held === p) {
    K.hold = (K.hold || 0) + h;
    const tx = gx + ad * 6, tz = clamp(p.pos.z, -6, 6);
    moveTo(p, tx, tz, 'walk'); p.wantFace = ad > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (K.hold > 1.6) { K.hold = 0; keeperDistribute(p); }
    return;
  }
  K.hold = 0;
  if (p.action && p.action.type === 'dive') { saveCheck(p, dd); return; }
  const th = shotThreat(team);
  if (th) {
    if (K.seq !== G.kickSeq) { K.seq = G.kickSeq; K.react = dd.gkReact * rand(0.75, 1.3) * (1.35 - p.a.gk / 100 * 0.55); }
    K.react -= h;
    if (K.react <= 0) {
      const lat = th.z - p.pos.z;
      const lineX = gx + ad * 0.3;
      if (Math.abs(lat) < 0.75 && th.y < 2.1) { moveTo(p, lineX + ad * Math.max(0, p.pos.x * ad - lineX * ad), th.z, 'sprint', false); }
      else if (!p.action && th.t < 1.2) startDive(p, th, dd);
      else moveTo(p, p.pos.x, th.z, 'sprint', false);
    } else { keeperPosition(p); }
    saveCheck(p, dd);
    return;
  }
  // salir a buscar pelotas sueltas en el area (o centros)
  if (!G.owner && !G.match.restart) {
    const it = interceptFor(p, true);
    const inBox = Math.abs(it.x - gx) < PITCH.boxX - 1 && Math.abs(it.z) < PITCH.boxHW - 2;
    if (inBox) {
      let mine = true; const myT = it.t;
      for (const o of team.opp.players) { const oi = interceptFor(o, true); if (oi.t < myT - 0.15) { mine = false; break; } }
      if (mine) { moveTo(p, it.x, it.z, 'sprint', false); faceBall(p); claimCheck(p); return; }
    }
  }
  // salir a achicar si un rival se escapa solo
  const o = G.owner;
  if (o && o.team !== team && Math.abs(o.pos.x - gx) < 20 && Math.abs(o.pos.z) < 14) {
    let defBetween = false;
    for (const m of team.players) if (m !== p && Math.abs(m.pos.x - gx) < Math.abs(o.pos.x - gx) - 1 && Math.abs(m.pos.z - o.pos.z) < 3) defBetween = true;
    if (!defBetween && Math.hypot(o.pos.x - gx, o.pos.z) < 17) {
      const dx = o.pos.x - gx, dz = o.pos.z, dl = Math.hypot(dx, dz) || 1;
      const off = clamp(dl - 3, 1, 9);
      moveTo(p, gx + dx / dl * off, dz / dl * off, 'sprint', false); faceBall(p);
      if (Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z) < 1.8 && !p.action && Math.random() < 0.08) { p.action = { type: 'dive', t: 0, dur: 0.9, contact: 9, fired: true, side: 0, hgt: 0 }; p.vel.set((o.pos.x - p.pos.x) * 2, 0, (o.pos.z - p.pos.z) * 2); }
      saveCheck(p, dd); claimCheck(p);
      return;
    }
  }
  keeperPosition(p);
  saveCheck(p, dd);
}
function keeperPosition(p) {
  const team = p.team, b = G.ball, gx = team.ownGoalX, ad = team.attackDir;
  const dx = b.px - gx, dz = b.pz, d = Math.hypot(dx, dz) || 1;
  const off = clamp(d * 0.1, 0.6, 3.6);
  let tx = gx + dx / d * off, tz = clamp(dz / d * off * 1.6, -3.2, 3.2);
  if ((tx - gx) * ad < 0.4) tx = gx + ad * 0.4;
  moveTo(p, tx, tz, Math.hypot(tx - p.pos.x, tz - p.pos.z) > 3 ? 'sprint' : 'run');
  faceBall(p);
}
function startDive(p, th, dd) {
  const lat = th.z - p.pos.z;
  const f = p.fwd(), lx = Math.cos(p.facing), lz = -Math.sin(p.facing); // eje +x local del modelo en el mundo
  const side = Math.sign(0 * lx + Math.sign(lat) * lz) || 1;
  const reach = (1.6 + p.a.gk / 100 * 1.6) * dd.gkReach;
  const tAvail = Math.max(0.12, th.t);
  const need = Math.min(Math.abs(lat), reach + 0.4);
  const vz = Math.sign(lat) * Math.min(need / tAvail * 1.15, 4.5 + p.a.gk / 100 * 2.5) * dd.gkReach;
  p.vel.set(f.x * 0.8, 0, vz);
  p.action = { type: 'dive', t: 0, dur: 1.15, contact: 9, fired: true, side, hgt: clamp((th.y - 0.4) / 1.9, 0, 1), dz: Math.sign(lat), ty: th.y };
}
// contacto de la pelota con las manos/cuerpo del arquero
function saveCheck(p, dd) {
  const b = G.ball, K = p.brain;
  if (K.saveCd > 0 || b.held || G.time - (p.lastKickT || -9) < 0.7) return;
  const ac = p.action, sc = p.info.height / 1.86;
  // la pelota puede moverse ~0.5 m por paso: se revisa el recorrido entero (prev -> actual)
  const pv = b.prev, N = 6;
  const near = (fn, r) => { for (let i = 0; i <= N; i++) { const u = i / N; if (fn(lerp(pv.x, b.px, u), lerp(pv.y, b.py, u), lerp(pv.z, b.pz, u)) < r) return true; } return false; };
  let hit = false, catchK = 0;
  if (ac && ac.type === 'dive') {
    if (ac.side === 0) { // achique a los pies
      hit = near((x, y, z) => Math.hypot(x - p.pos.x, z - p.pos.z) + Math.max(0, y - 0.8) * 2, 1.1); catchK = 0.5;
    } else {
      // cuerpo estirado: de la cadera a las manos, que van a la altura del remate
      const k = clamp(ac.t / 0.22, 0, 1);
      const hipY = lerp(0.95, 0.35 + ac.hgt * 1.2, k);
      const handY = lerp(1.2, clamp(ac.ty, 0.25, 2.45 * sc), k);
      const handZ = p.pos.z + ac.dz * lerp(0.5, 1.4, k) * sc;
      const reach = (0.34 + p.a.gk / 100 * 0.2) * dd.gkReach;
      hit = near((x, y, z) => segDist3(p.pos.x, hipY, p.pos.z - ac.dz * 0.3, p.pos.x, handY, handZ, x, y, z), reach);
      catchK = -0.15;
    }
  } else {
    // parado: brazos arriba y a los costados
    hit = near((x, y, z) => segDist3(p.pos.x, 0.15, p.pos.z, p.pos.x, 2.25 * sc, p.pos.z, x, y, z), 0.45 + p.a.gk / 100 * 0.2);
    catchK = 0.2;
  }  if (!hit) return;
  const sp = b.speed;
  const prob = clamp(1.15 - sp / 26 + p.a.gk / 220 + catchK, 0.05, 0.96);
  K.saveCd = 0.35; K.touchT = G.time;
  const shot = G.passInfo && G.passInfo.shot && G.passInfo.from.team !== p.team;
  if (shot) { p.stats.saves++; p.team.stats.saves++; G.passInfo.from.team.stats.onTarget++; }
  if (Math.random() < prob && sp < 30) {
    b.held = p; b.vx = b.vy = b.vz = 0; setOwner(p); G.passInfo = null; AU.touch();
    p.action = ac && ac.type === 'dive' ? ac : { type: 'catch', t: 0, dur: 0.5, contact: 9, fired: true };
    if (ac && ac.type === 'dive') ac.dur = Math.max(ac.t + 0.5, 0.9);
  } else {
    // rechazo: la pelota sale hacia afuera
    const ad = p.team.attackDir;
    b.launch(ad * (Math.abs(b.vx) * 0.25 + rand(2, 5)), Math.abs(b.vy) * 0.3 + rand(1.5, 5), b.vz * 0.3 + (Math.sign(b.pz - p.pos.z) || 1) * rand(2, 6));
    touchBy(p); b.ignore = p; b.ignoreT = 0.3; p.controlCd = 0.45; G.passInfo = null; AU.touch(); AU.cheer(0.5);
  }
  if (shot) AU.cheer(0.55);
}
function claimCheck(p) {
  const b = G.ball; if (b.held || G.owner || G.time - (p.lastKickT || -9) < 0.7) return;
  const box = Math.abs(b.px - p.team.ownGoalX) < PITCH.boxX && Math.abs(b.pz) < PITCH.boxHW;
  if (!box) return;
  const d = Math.hypot(b.px - p.pos.x, b.pz - p.pos.z);
  if (d < 0.9 && b.py < 2.6 * p.info.height / 1.86) { b.held = p; b.vx = b.vy = b.vz = 0; setOwner(p); G.passInfo = null; p.brain.saveCd = 0.4; AU.touch(); }
}
function segDist3(ax, ay, az, bx, by, bz, px, py, pz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, l = dx * dx + dy * dy + dz * dz;
  let t = l ? ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / l : 0; t = clamp(t, 0, 1);
  return Math.hypot(ax + dx * t - px, ay + dy * t - py, az + dz * t - pz);
}
function keeperDistribute(p) {
  const team = p.team, ad = team.attackDir;
  let best = null, bs = -1e9;
  for (const m of team.players) {
    if (m === p) continue;
    const d = Math.hypot(m.pos.x - p.pos.x, m.pos.z - p.pos.z);
    let open = 10; for (const o of team.opp.players) open = Math.min(open, Math.hypot(o.pos.x - m.pos.x, o.pos.z - m.pos.z));
    const s = open * 0.3 + (m.pos.x * ad) * 0.02 - (d > 45 ? 2 : 0);
    if (s > bs) { bs = s; best = m; }
  }
  const d = best ? Math.hypot(best.pos.x - p.pos.x, best.pos.z - p.pos.z) : 40;
  if (best && d < 25) startKick(p, 'pass', { receiver: best, power: 0.5 });
  else startKick(p, 'lob', { receiver: best, power: 0.9 });
  if (G.human && G.human.team === team) G.human.lockGK = false;
}
