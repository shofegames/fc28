// ===== Inteligencia artificial de los jugadores de campo =====
function moveTo(p, x, z, mode, arrive) {
  const r = G.match && G.match.restart;
  if (r && r.team !== p.team && r.taker !== p) { // en un saque los rivales se alejan de la pelota
    const keep = r.type === 'throw' ? 2.5 : r.type === 'goalkick' ? 0 : PITCH.circR;
    const dx = x - r.spot.x, dz = z - r.spot.z, d = Math.hypot(dx, dz);
    if (keep && d < keep) { const k = keep / (d || 1); x = r.spot.x + dx * k; z = r.spot.z + dz * k; }
    if (r.type === 'goalkick') { const gx = r.team.ownGoalX; if (Math.abs(x - gx) < PITCH.boxX + 1 && Math.abs(z) < PITCH.boxHW + 1) x = gx + r.team.attackDir * (PITCH.boxX + 1.5); }
  }
  const dx = x - p.pos.x, dz = z - p.pos.z, d = Math.hypot(dx, dz);
  if (d < 0.25) { p.want.x = 0; p.want.z = 0; p.sprint = false; return d; }
  let sp;
  if (mode === 'sprint') sp = p.vmax;
  else if (mode === 'run') sp = p.vmax * 0.66;
  else if (mode === 'walk') sp = 2;
  else sp = d > 14 ? p.vmax * 0.9 : d > 5 ? p.vmax * 0.62 : Math.max(1.2, d * 1.3);
  if (arrive !== false) sp = Math.min(sp, d * 2.6 + 0.4);
  p.sprint = sp > p.vmax * 0.7;
  p.want.x = dx / d * sp; p.want.z = dz / d * sp;
  return d;
}
function faceBall(p) { const b = G.ball; p.wantFace = Math.atan2(b.px - p.pos.x, b.pz - p.pos.z); }

// asigna roles por equipo: quien va a la pelota, quien presiona, quien cubre, quien da apoyo
function assignRoles() {
  const b = G.ball, o = G.owner;
  for (const t of G.teams) {
    const prevC = t.chaser, prevP = t.presser, prevS = t.support;
    t.chaser = t.presser = t.cover = null; t.support = [];
    const field = t.players.filter(p => !p.isGK);
    if (!o) {
      let best = null, bt = 1e9;
      // el que ya iba sigue yendo salvo que otro llegue claramente antes (evita que dos jugadores duden)
      for (const p of field) { const it = interceptFor(p, true); const tt = it.t + Math.hypot(it.x - p.pos.x, it.z - p.pos.z) * 0.02 - (p === prevC ? 0.35 : 0); if (tt < bt) { bt = tt; best = p; } }
      t.chaser = best;
    } else if (o.team !== t) {
      const gx = t.ownGoalX;
      let best = null, bs = 1e9, second = null, ss = 1e9;
      for (const p of field) {
        const d = Math.hypot(p.pos.x - o.pos.x, p.pos.z - o.pos.z);
        const goalSide = (o.pos.x - p.pos.x) * Math.sign(-gx || 1) > 0 ? 0 : 4; // los que estan del lado del arco cuentan como mas cerca
        const s = d + goalSide - (p === prevP ? 2.5 : 0);
        if (s < bs) { ss = bs; second = best; bs = s; best = p; } else if (s < ss) { ss = s; second = p; }
      }
      t.presser = best; t.cover = ss < 22 ? second : null;
    } else {
      const ds = field.filter(p => p !== o).map(p => ({ p, d: Math.hypot(p.pos.x - o.pos.x, p.pos.z - o.pos.z) + (t.form[p.slot].role === 'DF' ? 6 : 0) - (prevS.includes(p) ? 4 : 0) })).sort((a, b) => a.d - b.d);
      t.support = ds.slice(0, 2).map(e => e.p);
    }
  }
}
function lastDefenderX(team) { // linea del ultimo defensor rival (relativa al que ataca)
  const ad = team.attackDir; let xs = team.opp.players.map(p => p.pos.x * ad).sort((a, b) => b - a);
  return xs.length > 1 ? xs[1] : 40;
}
function formationTarget(p) {
  const team = p.team, ad = team.attackDir, b = G.ball, s = team.form[p.slot], tac = TACTICS[team.tactic];
  const bx = b.px * ad, bz = b.pz;
  const attacking = possTeam() === team;
  let x, z;
  if (attacking) {
    const block = clamp(bx * 0.6 + 4 + tac.push, -25, 30);
    x = block + (s.x + 0.3) * 44 * tac.lenA;
    z = s.z * 31 * tac.width + bz * 0.15;
    if (s.role === 'DF') x = Math.min(x, bx + 4);
    if (s.role === 'FW') {
      const off = lastDefenderX(team);
      // desmarque: cada tanto pica al espacio detras de la defensa
      p.brain.runT -= DT;
      if (p.brain.runT <= 0) { p.brain.run = Math.random() < 0.45 ? 1.6 : 0; p.brain.runT = rand(3, 7); p.brain.runOff = Math.random() < 0.22 ? 1.2 : -0.35; } // a veces se adelanta de mas (fuera de juego)
      // desmarque en la linea del ultimo defensor (habilitado) para recibir el pase filtrado al espacio
      if (p.brain.run > 0 && G.owner && G.owner !== p) { p.brain.run -= DT; x = off + (p.brain.runOff || -0.35); z = z * 0.6; }
      else x = Math.min(x, off - 0.6);
      if (bx > 25) { x = Math.max(x, 38); z = z * 0.55; } // entrar al area en ataques avanzados
    }
    if (s.role === 'MF' && bx > 28) x = Math.max(x, 26);
  } else {
    const block = clamp(bx * 0.55 - 6 + tac.press, -36, 18);
    x = block + (s.x + 0.3) * 36 * tac.lenD;
    z = s.z * 26 * tac.widthD + bz * 0.35;
    if (s.role === 'DF') x = Math.max(x, -PITCH.HL + 3);
  }
  x = clamp(x, -PITCH.HL + 2, PITCH.HL - 3);
  let wx = x * ad, wz = clamp(z, -31.5, 31.5);
  // marca: los defensores se pegan al delantero rival que tengan cerca
  if (!attacking && s.role === 'DF') {
    let mk = null, md = 11;
    for (const o of team.opp.players) { if (o.isGK) continue; const d = Math.hypot(o.pos.x - wx, o.pos.z - wz); if (d < md) { md = d; mk = o; } }
    if (mk) {
      const gx = team.ownGoalX, dx = gx - mk.pos.x, dz = -mk.pos.z, dl = Math.hypot(dx, dz) || 1;
      const mx = mk.pos.x + dx / dl * 1.8, mz = mk.pos.z + dz / dl * 1.8;
      const k = 0.6 * (1 - md / 11) + 0.25;
      wx = lerp(wx, mx, k); wz = lerp(wz, mz, k);
    }
  }
  // apoyo al que tiene la pelota
  if (attacking && team.support.includes(p) && G.owner) {
    p.brain.supT -= DT;
    if (!p.brain.sup || p.brain.supT <= 0) { p.brain.sup = supportSpot(p, G.owner); p.brain.supT = rand(0.5, 0.9); }
    wx = lerp(wx, p.brain.sup.x, 0.75); wz = lerp(wz, p.brain.sup.z, 0.75);
  }
  return { x: wx, z: wz };
}
function supportSpot(p, c) {
  const ad = p.team.attackDir; let best = null, bs = -1e9;
  for (const ang of [-1.1, -0.6, -0.25, 0.25, 0.6, 1.1, 2.2, -2.2]) for (const d of [9, 14]) {
    const x = c.pos.x + Math.cos(ang) * d * ad, z = c.pos.z + Math.sin(ang) * d;
    if (Math.abs(x) > PITCH.HL - 3 || Math.abs(z) > PITCH.HW - 2) continue;
    let open = 8; for (const o of p.team.opp.players) open = Math.min(open, Math.hypot(o.pos.x - x, o.pos.z - z));
    const lane = Math.min(3, ...p.team.opp.players.map(o => segDist(c.pos.x, c.pos.z, x, z, o.pos.x, o.pos.z)));
    const s = open * 0.25 + lane * 0.35 + Math.cos(ang) * 0.6 - Math.hypot(x - p.pos.x, z - p.pos.z) * 0.04;
    if (s > bs) { bs = s; best = { x, z }; }
  }
  return best || { x: p.pos.x, z: p.pos.z };
}

function aiUpdate(h) {
  if (G.frame % 2 === 0) assignRoles();
  const human = G.human ? G.human.p : null;
  for (const p of G.players) {
    if (G.match.locked(p)) continue; // el que saca lo maneja el partido
    if (p === human) continue;
    if (p.isGK) { keeperAI(p, h); continue; }
    brain(p, h);
  }
}
function brain(p, h) {
  const team = p.team, b = G.ball, o = G.owner, st = G.match.state;
  p.sprint = false; p.wantFace = null;
  if (st === 'goal' || st === 'halftime' || st === 'fulltime' || st === 'intro') { idleBrain(p); return; }
  const r = G.match.restart;
  if (r) { // en saques: el que saca va a la pelota, los demas a su lugar
    if (r.kickoff) { p.want.x = p.want.z = 0; p.wantFace = team.attackDir > 0 ? Math.PI / 2 : -Math.PI / 2; return; }
    // barrera
    if (r.wall) { const w = r.wall.find(w => w.p === p); if (w) { moveTo(p, w.x, w.z, 'run'); faceBall(p); return; } }
    // penal: todos afuera del area y de la medialuna
    if (r.type === 'penalty') {
      const gxA = r.team.oppGoalX, sg = Math.sign(gxA);
      const z = clamp((p.slot - 5) * 2.4 + (p.team === r.team ? 1.2 : 0), -19, 19);
      moveTo(p, gxA - sg * 21.5, z); faceBall(p); return;
    }
    const t = formationTarget(p); moveTo(p, t.x, t.z); faceBall(p); return;
  }
  if (o === p) { carrierAI(p, h); return; }
  const pi = G.passInfo;
  if (!o && pi && pi.to === p && G.time - pi.t < 4) { chase(p, true); return; }
  if (!o && team.chaser === p) { chase(p, true); return; }
  if (o && o.team !== team) {
    if (team.presser === p && !b.held) { press(p, o, h); return; }
    if (team.cover === p && teamDiff(team).cover) {
      const gx = team.ownGoalX, dx = gx - o.pos.x, dz = -o.pos.z, dl = Math.hypot(dx, dz) || 1;
      moveTo(p, o.pos.x + dx / dl * 6, o.pos.z + dz / dl * 6); faceBall(p); return;
    }
  }
  const t = formationTarget(p), B = p.brain;
  if (B.tx == null || Math.hypot(B.tx - t.x, B.tz - t.z) > 12) { B.tx = t.x; B.tz = t.z; }
  B.tx = damp(B.tx, t.x, 2.5, DT); B.tz = damp(B.tz, t.z, 2.5, DT);
  // si ya esta cerca de su lugar, se queda (no da pasitos todo el tiempo)
  const dd = Math.hypot(B.tx - p.pos.x, B.tz - p.pos.z);
  if (B.hold && dd < 2.2) { p.want.x *= 0.85; p.want.z *= 0.85; p.sprint = false; faceBall(p); return; }
  B.hold = dd < 0.8;
  const d = moveTo(p, B.tx, B.tz);
  if (d < 4) faceBall(p);
}
function idleBrain(p) {
  const m = G.match;
  if (m && m.state === 'goal') {
    if (p.action && p.action.type === 'celebrate') { moveTo(p, clamp(p.pos.x, -44, 44), 29, p.action.t < 2.6 ? 'sprint' : 'walk'); return; }
    if (p.celebrateWith) { const s = p.celebrateWith; moveTo(p, s.pos.x + ((p.slot % 3) - 1) * 1.3, s.pos.z - 1.4 - (p.slot % 2), 'run'); return; }
  }
  p.want.x *= 0.9; p.want.z *= 0.9; if (Math.hypot(p.want.x, p.want.z) < 0.3) { p.want.x = p.want.z = 0; } faceBall(p); }
function chase(p, sprint) {
  const it = interceptFor(p, true), b = G.ball;
  const d = moveTo(p, it.x, it.z, sprint ? 'sprint' : 'run', false);
  if (d < 2) faceBall(p);
  // pelota alta llegando: cabezazo
  if (!p.action && b.py > 1.15 && b.py < 2.6) {
    const hd = Math.hypot(b.px - p.pos.x, b.pz - p.pos.z);
    if (hd < 1.5 && b.vy < 2) {
      const gx = p.team.oppGoalX, toGoal = Math.hypot(gx - p.pos.x, p.pos.z);
      const attack = toGoal < 18;
      startKick(p, 'header', { attack, dir: { x: p.team.attackDir, z: -p.pos.z * 0.02 } });
      p.action.contact = Math.max(0.08, Math.min(0.2, hd / 6)); p.action.jump = clamp((b.py - 1.6) / 0.8, 0.3, 1.2);
    }
  }
}
function press(p, o, h) {
  const team = p.team, gx = team.ownGoalX, dd = teamDiff(team), tac = TACTICS[team.tactic];
  const dx = gx - o.pos.x, dz = -o.pos.z, dl = Math.hypot(dx, dz) || 1;
  const d = Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z);
  const stand = d > 4 ? 1.0 : 1.7;
  moveTo(p, o.pos.x + dx / dl * stand + o.vel.x * 0.3, o.pos.z + dz / dl * stand + o.vel.z * 0.3, d > 3 ? 'sprint' : 'run', false);
  p.wantFace = Math.atan2(o.pos.x - p.pos.x, o.pos.z - p.pos.z);
  // si el compañero humano esta encima, la IA acompaña sin tirarse
  if (team.human && G.human && G.human.p && Math.hypot(G.human.p.pos.x - o.pos.x, G.human.p.pos.z - o.pos.z) < 4) return;
  p.brain.tk -= h;
  const dBall = Math.hypot(G.ball.px - p.pos.x, G.ball.pz - p.pos.z);
  if (dBall < 1.9 && p.brain.tk <= 0 && !p.action) {
    p.brain.tk = rand(0.5, 1.3) / (dd.press * tac.pressK);
    const r = Math.random();
    if (r < 0.5 * dd.press) startTackle(p);
    else if (r < 0.56 * dd.press && dBall < 1.6 && (G.setup.diff >= 2 || Math.random() < 0.4)) startSlide(p);
  }
}

// ---- IA con la pelota ----
function carrierAI(p, h) {
  const team = p.team, ad = team.attackDir, dd = teamDiff(team), tac = TACTICS[team.tactic];
  const gx = team.oppGoalX, rx = p.pos.x * ad, goalD = Math.hypot(gx - p.pos.x, p.pos.z);
  if (p.action) { p.want.x *= 0.5; p.want.z *= 0.5; return; }
  p.brain.decide -= h;
  const near = nearestOpp(p);
  if (p.brain.decide <= 0 || (near.d < 1.6 && p.brain.decide < dd.decide * 0.5)) {
    p.brain.decide = dd.decide * rand(0.7, 1.3);
    const opts = [];
    if (goalD < 28 && Math.abs(p.pos.z) < 22) {
      let blk = 0; for (const o of team.opp.players) if (!o.isGK) { const sd = segDist(p.pos.x, p.pos.z, gx, 0, o.pos.x, o.pos.z); if (sd < 1.5) blk += (1.5 - sd) / 1.5; }
      let s = (28 - goalD) / 14 - blk * 0.45 + (goalD < 13 ? 0.6 : 0) - (G.mode === 'menu' ? 0.2 : 0);
      opts.push({ s: s + randn() * dd.noise, f: () => aiShoot(p, goalD) });
    }
    if (rx > 30 && Math.abs(p.pos.z) > 16) opts.push({ s: 0.85 + (tac.cross || 0) + randn() * dd.noise, f: () => aiCross(p) });
    const bp = bestPass(p, near.d);
    if (bp) opts.push({ s: bp.s + tac.pass + randn() * dd.noise, f: () => startKick(p, bp.kind, { receiver: bp.m, power: bp.power }) });
    let space = 8; for (const o of team.opp.players) { const ox = (o.pos.x - p.pos.x) * ad, oz = o.pos.z - p.pos.z; if (ox > -1 && ox < 9 && Math.abs(oz) < ox * 0.9 + 1.5) space = Math.min(space, Math.hypot(ox, oz)); }
    const ds = 0.25 + space / 8 * 0.6 - (near.d < 2 ? 0.45 : 0) + tac.dribble + (rx < -30 ? -0.3 : 0);
    opts.push({ s: ds + randn() * dd.noise, f: null });
    // en peligro en el area propia: reventarla
    if (rx < -30 && near.d < 2.5) opts.push({ s: 0.9 + randn() * 0.2, f: () => startKick(p, 'clear', { dir: Math.random() < 0.5 ? { x: ad * 0.5, z: (Math.sign(p.pos.z) || 1) } : { x: ad, z: -Math.sign(p.pos.z) * 0.5 }, power: 0.8 }) });
    let best = opts[0]; for (const o of opts) if (o.s > best.s) best = o;
    if (best.f) { best.f(); return; }
  }
  // conducir hacia el arco esquivando rivales
  let dx = ad, dz = clamp(-p.pos.z * 0.02, -0.4, 0.4);
  if (rx > 34) dz = clamp(-p.pos.z * 0.06, -0.8, 0.8);
  for (const o of team.opp.players) {
    const ox = o.pos.x - p.pos.x, oz = o.pos.z - p.pos.z, d = Math.hypot(ox, oz);
    if (d < 6 && d > 0.01 && ox * ad > -1) { const k = (6 - d) / 6 * 1.4; dx -= ox / d * k * 0.6; dz -= oz / d * k; }
  }
  if (Math.abs(p.pos.z) > 30) dz -= Math.sign(p.pos.z) * 0.8;
  const l = Math.hypot(dx, dz) || 1;
  const sp = near.d > 4 ? p.vmax : p.vmax * 0.7;
  p.sprint = near.d > 4; p.want.x = dx / l * sp; p.want.z = dz / l * sp;
}
// riesgo de que un rival llegue antes a la pelota en un pase de (sx,sz) a (tx,tz). 0 = limpio, 1 = seguro lo cortan
function passRisk(p, tx, tz, lob, rec) {
  const sx = p.pos.x, sz = p.pos.z, D = Math.hypot(tx - sx, tz - sz) || 1;
  const vavg = lob ? D / (0.95 + D * 0.034) : Math.max(6, 4 + D * 0.25);
  const recT = rec ? Math.max(0, Math.hypot(rec.pos.x - tx, rec.pos.z - tz) - 0.7) / (rec.vmax * 0.9) : 0;
  let risk = 0;
  for (const o of p.team.opp.players) {
    const ox = o.pos.x - sx, oz = o.pos.z - sz;
    let t = (ox * (tx - sx) + oz * (tz - sz)) / (D * D);
    if (lob) t = Math.max(t, 0.85); // en un pase alto solo se puede cortar donde cae
    t = clamp(t, 0.05, 1);
    const px = sx + (tx - sx) * t, pz = sz + (tz - sz) * t;
    const tb = t * D / vavg + (t > 0.95 ? recT * 0.5 : 0);
    const to = Math.max(0, Math.hypot(o.pos.x - px, o.pos.z - pz) - 0.8) / 7 + 0.25;
    if (to < tb) risk = Math.max(risk, clamp((tb - to) / 0.5 + 0.3, 0, 1));
  }
  return risk;
}
function bestPass(p, pressure) {
  const team = p.team, ad = team.attackDir; let best = null;
  const tac = TACTICS[team.tactic];
  for (const m of team.players) {
    if (m === p) continue;
    const dx = m.pos.x - p.pos.x, dz = m.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d < 5 || d > 45) continue;
    const gain = dx * ad;
    let open = 8; for (const o of team.opp.players) open = Math.min(open, Math.hypot(o.pos.x - m.pos.x, o.pos.z - m.pos.z));
    const lead = 0.5;
    const tx = m.pos.x + m.vel.x * lead, tz = m.pos.z + m.vel.z * lead;
    const rG = passRisk(p, tx, tz, false, m), rL = d > 14 ? passRisk(p, tx, tz, true, m) : 1;
    const lob = rL + 0.15 < rG || d > 30;
    const risk = lob ? rL : rG;
    let s = gain * 0.022 + open / 8 * 0.35 - risk * 1.3 - (d > 35 ? 0.3 : 0) + (pressure < 2.2 ? 0.25 : -0.1) - (lob ? 0.15 - tac.direct * 0.3 : 0);
    if (m.isGK) s -= pressure < 2 ? 0.3 : 1.2;
    let kind = lob ? 'lob' : 'pass';
    // pase filtrado al delantero que pica
    if (team.form[m.slot].role === 'FW' && m.brain.run > 0 && gain > 4 && m.pos.x * ad < lastDefenderX(team) - 0.2) {
      const fx = m.pos.x + ad * 9, fz = m.pos.z;
      const rT = passRisk(p, fx, fz, false, null);
      if (rT < 0.5) { kind = 'through'; s = gain * 0.03 + 0.5 - rT; }
    }
    if (!best || s > best.s) best = { m, s, kind, power: clamp(d / 40, 0.3, 0.9) };
  }
  return best;
}
function aiShoot(p, goalD) {
  const gk = p.team.opp.gk;
  const aimZ = (gk && gk.pos.z > 0 ? -1 : 1) * rand(1.6, 3.0);
  const power = clamp(0.45 + goalD / 45 + randn() * 0.08, 0.35, 0.95);
  startKick(p, 'shot', { aimZ, power, finesse: goalD < 20 && Math.random() < 0.35 });
}
function aiCross(p) {
  const gx = p.team.oppGoalX, ad = p.team.attackDir;
  const tgt = { x: gx - ad * rand(5, 12), z: rand(-6, 6) };
  let rec = null, bd = 16;
  for (const m of p.team.players) { if (m === p || m.isGK) continue; const d = Math.hypot(m.pos.x - tgt.x, m.pos.z - tgt.z); if (d < bd) { bd = d; rec = m; } }
  if (rec) { tgt.x = rec.pos.x + rec.vel.x * 0.8; tgt.z = rec.pos.z + rec.vel.z * 0.8; }
  startKick(p, 'cross', { target: tgt, receiver: rec, power: 0.7 });
}
