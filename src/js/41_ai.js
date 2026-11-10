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
  const B = p.brain, pursuit = arrive === false;
  p.calm = !pursuit && mode !== 'sprint';
  // ya llego a su lugar: se queda quieto hasta que el lugar se mueva de verdad (sin pasitos ni temblores)
  if (!pursuit && mode !== 'sprint') {
    if (B.parked && d < (B.parkR || 1.4)) { p.want.x = 0; p.want.z = 0; p.sprint = false; return d; }
    B.parked = d < 0.45;
  } else B.parked = false;
  if (d < 0.25) { p.want.x = 0; p.want.z = 0; p.sprint = false; return d; }
  let sp;
  if (mode === 'sprint') sp = p.vmax;
  else if (mode === 'run') sp = p.vmax * 0.66;
  else if (mode === 'walk') sp = 2;
  // reubicarse: trote suave; solo pica si esta muy lejos de donde tiene que estar
  else sp = d > 18 ? p.vmax * 0.85 : d > 8 ? p.vmax * 0.55 : Math.max(1.4, d * 0.75);
  if (!pursuit) sp = Math.min(sp, Math.sqrt(2 * 7 * d) * 0.9 + 0.2); // frena a tiempo para no pasarse
  p.sprint = sp > p.vmax * 0.7;
  let ux = dx / d, uz = dz / d;
  // esquivar a los que tiene adelante (en vez de chocarlos)
  if (!pursuit && d > 1.5) {
    let sx = 0, sz = 0;
    for (const q of G.players) {
      if (q === p) continue;
      const rx = q.pos.x - p.pos.x, rz = q.pos.z - p.pos.z, rd = Math.hypot(rx, rz);
      if (rd > 2.4 || rd < 0.01) continue;
      const ahead = rx * ux + rz * uz; if (ahead <= 0 || ahead > d) continue;
      const lat = rx * -uz + rz * ux, k = (2.4 - rd) / 2.4;
      const side = lat > 0 ? -1 : 1; sx += -uz * side * k; sz += ux * side * k;
    }
    if (sx || sz) { ux += sx * 0.9; uz += sz * 0.9; const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l; }
  }
  p.want.x = ux * sp; p.want.z = uz * sp;
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
      // presion tras perdida: los primeros segundos despues de perderla, el segundo tambien va a apretar
      t.counterPress = t.hadBallT && G.time - t.hadBallT < 2.5 && (o.pos.x * t.attackDir) > -10;
    } else {
      const ds = field.filter(p => p !== o).map(p => ({ p, d: Math.hypot(p.pos.x - o.pos.x, p.pos.z - o.pos.z) + (t.form[p.slot].role === 'DF' ? 6 : 0) - (prevS.includes(p) ? 4 : 0) })).sort((a, b) => a.d - b.d);
      t.support = ds.slice(0, 3).map(e => e.p);
      t.hadBallT = G.time;
    }
    teamShape(t);
  }
}
function lastDefenderX(team) { // linea del ultimo defensor rival (relativa al que ataca)
  const ad = team.attackDir; let xs = team.opp.players.map(p => p.pos.x * ad).sort((a, b) => b - a);
  return xs.length > 1 ? xs[1] : 40;
}
// ---- forma del equipo: linea defensiva, bloque y corrimiento (se calcula una vez cada 2 cuadros) ----
function teamShape(t) {
  const ad = t.attackDir, b = G.ball, bx = b.px * ad, bz = b.pz, tac = TACTICS[t.tactic];
  const attacking = possTeam() === t;
  const sh = t.shape || (t.shape = {});
  sh.attacking = attacking;
  // promedio de profundidad de cada linea de la formacion (para escalonar MCD/MC/MCO, etc.)
  if (!t._avg || t._avgKey !== t.formKey) {
    t._avgKey = t.formKey; t._avg = {};
    for (const r of ['DF', 'MF', 'FW']) { const xs = t.form.filter(s => s.role === r).map(s => s.x); t._avg[r] = xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : 0; }
  }
  if (!attacking) {
    // la linea sube y baja con la pelota; si el que la lleva viene de frente y sin marca, retrocede para no quedar mal parada
    let line = bx * 0.6 - 15 + tac.press * 0.6;
    const o = G.owner;
    if (o && o.team !== t) {
      const free = nearestOpp(o).d > 4, facing = o.fwd().x * -ad > 0.4;
      if (free && facing && bx < 25) line -= 5;
    }
    line = Math.min(line, bx - 7);
    sh.line = clamp(line, -46, 6);
    sh.mid = sh.line + 11 * tac.lenD; sh.fwd = sh.mid + 12 * tac.lenD;
    sh.shiftZ = bz * 0.45; sh.wf = 0.78 * tac.widthD;
  } else {
    sh.line = clamp(Math.min(bx * 0.55 - 6 + tac.push, bx - 2), -38, 22);
    sh.off = lastDefenderX(t);
    sh.fwd = Math.max(sh.off - 0.6, bx + 5);
    sh.mid = clamp((sh.line + sh.fwd) / 2 + 2, sh.line + 8, sh.fwd - 6);
    sh.shiftZ = bz * 0.12; sh.wf = 1.0 * tac.width;
  }
}
function formationTarget(p) {
  const team = p.team, ad = team.attackDir, b = G.ball, s = team.form[p.slot], tac = TACTICS[team.tactic];
  const bx = b.px * ad, bz = b.pz;
  const sh = team.shape || (teamShape(team), team.shape);
  const attacking = sh.attacking, avg = team._avg || { DF: -0.6, MF: -0.3, FW: 0 };
  const base = s.role === 'DF' ? sh.line : s.role === 'MF' ? sh.mid : sh.fwd;
  let x = base + (s.x - avg[s.role]) * (attacking ? 22 : 14);
  let z = s.z * (attacking ? 32 : 27) * sh.wf + sh.shiftZ;
  const wide = Math.abs(s.z) > 0.55, side = Math.sign(s.z) || 1;
  if (attacking) {
    if (s.role === 'DF') {
      x = Math.min(x, bx - 1);
      // lateral que pasa al ataque por su banda
      if (wide && side === Math.sign(bz || side) && bx > -15) { x = Math.max(x, bx - 3); z = side * 30; }
    }
    if (wide && s.role !== 'DF') z = side === Math.sign(bz || side) ? side * 30 : side * 22; // extremos abiertos; el del otro lado cierra un poco
    if (s.role === 'FW') {
      const off = sh.off;
      // desmarque: cuando el compañero levanta la cabeza, pica en diagonal sobre la linea (habilitado)
      p.brain.runT -= DT;
      const o = G.owner, canFeed = o && o.team === team && o !== p && nearestOpp(o).d > 3 && o.fwd().x * ad > 0.2;
      if (p.brain.runT <= 0) { p.brain.run = canFeed && Math.random() < 0.6 ? 1.6 : 0; p.brain.runT = rand(2, 5); p.brain.runOff = Math.random() < 0.15 ? 1.0 : -0.4; }
      if (p.brain.run > 0 && o && o !== p) { p.brain.run -= DT; x = off + (p.brain.runOff || -0.4); z = lerp(z, bz * 0.3, 0.4); }
      else x = Math.min(x, off - 0.6);
    }
    // llegada al area: primer palo, segundo palo y punto penal
    if (bx > 20) {
      if (s.role === 'FW') { x = Math.max(x, Math.min(39, sh.off + 2)); if (bx > 28) z = clamp(z * 0.35, -7, 7); }
      else if (s.role === 'MF' && !wide) x = Math.max(x, 28);
    }
  } else if (s.role === 'DF') {
    x = sh.line + (wide ? 1 : 0);
  }
  x = clamp(x, -PITCH.HL + 2, PITCH.HL - 3);
  let wx = x * ad, wz = clamp(z, -31.5, 31.5);
  if (!attacking) {
    // marca: los defensores toman al delantero que entra en su zona (cerca del area, marca al hombre)
    if (s.role === 'DF') {
      const range = bx < -25 ? 13 : 9;
      let mk = null, md = range;
      for (const o of team.opp.players) { if (o.isGK) continue; const d = Math.hypot(o.pos.x - wx, o.pos.z - wz); if (d < md) { md = d; mk = o; } }
      if (mk) {
        const gx = team.ownGoalX, dx = gx - mk.pos.x, dz = -mk.pos.z, dl = Math.hypot(dx, dz) || 1;
        const mx = mk.pos.x + dx / dl * 1.6, mz = mk.pos.z + dz / dl * 1.6;
        const k = (bx < -25 ? 0.85 : 0.5) * (1 - md / range) + 0.2;
        // afuera del area la linea se mantiene: se corren de costado, casi no salen de la linea
        wx = lerp(wx, mx, bx < -25 ? k : k * 0.25); wz = lerp(wz, mz, k);
      }
    } else if (G.owner && G.owner.team !== team) {
      // volantes y delanteros: se paran en la linea de pase hacia el rival de su zona (cerrar el pase)
      const c = G.owner; let mk = null, md = 12;
      for (const o of team.opp.players) { if (o === c || o.isGK) continue; const d = Math.hypot(o.pos.x - wx, o.pos.z - wz); if (d < md) { md = d; mk = o; } }
      if (mk) { const lx = lerp(c.pos.x, mk.pos.x, 0.62), lz = lerp(c.pos.z, mk.pos.z, 0.62); const k = s.role === 'MF' ? 0.45 : 0.25; wx = lerp(wx, lx, k); wz = lerp(wz, lz, k); }
    }
  } else if (G.owner && G.owner.team === team && G.owner !== p) {
    // atacando: cada uno busca un espacio libre cerca de su lugar donde le puedan pasar la pelota
    const B = p.brain;
    B.supT -= DT;
    if (!B.sup || B.supT <= 0) { B.sup = team.support.includes(p) ? supportSpot(p, G.owner) : spaceNear(p, G.owner, wx, wz); B.supT = rand(0.45, 0.8); if (Math.random() < 0.1) p.askT = G.time + 0.9; } // a veces levanta la mano para pedirla
    const k = team.support.includes(p) ? 0.8 : 0.65;
    wx = lerp(wx, B.sup.x, k); wz = lerp(wz, B.sup.z, k);
  }
  return { x: wx, z: wz };
}
// lugar libre cerca de (x,z): que no lo corten si le pasan y que no quede en offside
function spaceNear(p, c, x, z) {
  const ad = p.team.attackDir, off = p.team.shape ? p.team.shape.off : 40;
  let best = { x, z }, bs = -1e9;
  for (let k = 0; k < 9; k++) {
    const a = k * TAU / 8, r = k === 8 ? 0 : 5;
    let px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (Math.abs(px) > PITCH.HL - 3 || Math.abs(pz) > PITCH.HW - 2) continue;
    if (px * ad > off - 0.4 && !(p.brain.run > 0)) px = (off - 0.4) * ad;
    let open = 8; for (const o of p.team.opp.players) open = Math.min(open, Math.hypot(o.pos.x - px, o.pos.z - pz));
    const risk = passRisk(c, px, pz, false, null);
    const s = open / 8 * 0.6 - risk * 1.2 + (px - c.pos.x) * ad * 0.01 - r * 0.03;
    if (s > bs) { bs = s; best = { x: px, z: pz }; }
  }
  return best;
}
// los 2 o 3 mas cercanos ofrecen un pase corto con angulo (uno adelante, otros al costado)
function supportSpot(p, c) {
  const ad = p.team.attackDir, off = p.team.shape ? p.team.shape.off : 40; let best = null, bs = -1e9;
  const taken = p.team.support.filter(m => m !== p && m.brain.sup).map(m => m.brain.sup);
  for (const ang of [-1.2, -0.7, -0.3, 0.3, 0.7, 1.2, 2.3, -2.3]) for (const d of [9, 14]) {
    let x = c.pos.x + Math.cos(ang) * d * ad, z = c.pos.z + Math.sin(ang) * d;
    if (Math.abs(x) > PITCH.HL - 3 || Math.abs(z) > PITCH.HW - 2) continue;
    if (x * ad > off - 0.4) x = (off - 0.4) * ad;
    let open = 8; for (const o of p.team.opp.players) open = Math.min(open, Math.hypot(o.pos.x - x, o.pos.z - z));
    const risk = passRisk(c, x, z, false, null);
    let s = open * 0.15 - risk * 1.4 + Math.cos(ang) * 0.5 - Math.hypot(x - p.pos.x, z - p.pos.z) * 0.04;
    for (const q of taken) if (Math.hypot(q.x - x, q.z - z) < 7) s -= 1; // no ir al mismo lugar que otro compañero
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
  p.sprint = false; p.wantFace = null; p.jockey = false;
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
  // despues de tirar la pared, pica hacia adelante para recibir la devolucion
  if (p.brain.wall && G.time - p.brain.wall.t < 2.2 && possTeam() === team) { moveTo(p, p.pos.x + team.attackDir * 6, p.pos.z * 0.95, 'sprint', false); return; }
  if (!o && team.chaser === p) { chase(p, true); return; }
  if (o && o.team !== team) {
    if (team.presser === p && !b.held) { press(p, o, h); return; }
    if (team.cover === p && team.counterPress) { press(p, o, h); return; }
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
  if (B.hold && dd < (B.parkR === 0.6 ? 0.8 : 2.2)) { p.want.x *= 0.85; p.want.z *= 0.85; p.sprint = false; faceBall(p); return; }
  B.hold = dd < 0.8;
  // los defensores, defendiendo, se acomodan mas fino para mantener la linea
  B.parkR = p.team.form[p.slot].role === 'DF' && possTeam() !== p.team ? 0.6 : 1.4;
  // ataque: los que tienen que ganar metros hacia el arco rival lo hacen con intensidad (acompañan la jugada)
  // defensa: si quedaron atras de la pelota, vuelven rapido a su lugar
  const ad = p.team.attackDir, ahead = (B.tx - p.pos.x) * ad, attacking = possTeam() === p.team;
  const behindBall = (G.ball.px - p.pos.x) * ad < -6;
  let mode;
  if (attacking && ahead > 6) mode = ahead > 14 && p.team.form[p.slot].role !== 'DF' ? 'sprint' : 'run';
  else if (!attacking && behindBall && dd > 8) mode = dd > 16 ? 'sprint' : 'run';
  const d = moveTo(p, B.tx, B.tz, mode);
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
  // perfilarse: si le llega el pase y no lo apuran, recibe con el cuerpo abierto hacia el arco rival
  const pi = G.passInfo;
  if (pi && pi.to === p && it.t < 0.9 && nearestOpp(p).d > 3) { const toBall = Math.atan2(b.px - p.pos.x, b.pz - p.pos.z), toGoal = Math.atan2(p.team.oppGoalX - p.pos.x, -p.pos.z); p.wantFace = toBall + angWrap(toGoal - toBall) * 0.45; }
  // pelota alta llegando: cabezazo
  if (!p.action && b.py > 1.15 && b.py < 2.6) {
    const hd = Math.hypot(b.px - p.pos.x, b.pz - p.pos.z);
    if (hd < 1.5 && b.vy < 2) {
      const gx = p.team.oppGoalX, toGoal = Math.hypot(gx - p.pos.x, p.pos.z);
      const attack = toGoal < 18;
      // lejos del arco y con un compañero mas adelante: la peina para que siga
      const flick = !attack && toGoal < 32 && G.lastTouch && G.lastTouch.team === p.team && p.team.players.some(m => m !== p && (m.pos.x - p.pos.x) * p.team.attackDir > 6);
      startKick(p, 'header', { attack, flick, dir: { x: p.team.attackDir, z: -p.pos.z * 0.02 } });
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
  p.jockey = d < 5; // se pone de perfil y baja el centro de gravedad
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
    // remate segun la calidad de la ocasion (angulo al arco, distancia y rivales tapando)
    const xg = xgAt(team, p.pos.x, p.pos.z);
    if (xg > 0.02) {
      let blk = 0; for (const o of team.opp.players) if (!o.isGK) { const sd = segDist(p.pos.x, p.pos.z, gx, 0, o.pos.x, o.pos.z); if (sd < 1.5) blk += (1.5 - sd) / 1.5; }
      const s = xg * (1 - Math.min(0.8, blk * 0.35)) * 12 - 0.1 - (G.mode === 'menu' ? 0.1 : 0);
      p.brain.xg = xg;
      opts.push({ s: s + randn() * dd.noise, f: () => aiShoot(p, goalD) });
    }
    if (rx > 30 && Math.abs(p.pos.z) > 16) opts.push({ s: 0.85 + (tac.cross || 0) + randn() * dd.noise, f: () => aiCross(p) });
    const bp = bestPass(p, near.d);
    if (bp) opts.push({ s: bp.s + tac.pass + randn() * dd.noise, f: () => startKick(p, bp.kind, { receiver: bp.m, power: bp.power }) });
    let space = 8; for (const o of team.opp.players) { const ox = (o.pos.x - p.pos.x) * ad, oz = o.pos.z - p.pos.z; if (ox > -1 && ox < 9 && Math.abs(oz) < ox * 0.9 + 1.5) space = Math.min(space, Math.hypot(ox, oz)); }
    // encarar: en campo rival y con lugar adelante, avanza con la pelota hacia el arco
    const ds = 0.25 + space / 8 * 0.6 - (near.d < 2 ? 0.45 : 0) + tac.dribble + (rx < -30 ? -0.3 : 0) + (rx > 12 && space > 3 ? 0.35 : 0);
    opts.push({ s: ds + randn() * dd.noise, f: null });
    // en peligro en el area propia: reventarla
    if (rx < -30 && near.d < 2.5) opts.push({ s: 0.9 + randn() * 0.2, f: () => startKick(p, 'clear', { dir: Math.random() < 0.5 ? { x: ad * 0.5, z: (Math.sign(p.pos.z) || 1) } : { x: ad, z: -Math.sign(p.pos.z) * 0.5 }, power: 0.8 }) });
    let best = opts[0]; for (const o of opts) if (o.s > best.s) best = o;
    // si lo unico que hay es un pase muy arriesgado, mejor proteger un ratito y esperar apoyo
    if (best.f && bp && best.s === bp.s + tac.pass && near.d < 1.8 && passRisk(p, bp.m.pos.x, bp.m.pos.z, bp.kind === 'lob', bp.m) > 0.65 && Math.random() < 0.7) best = { f: null };
    if (best.f) { best.f(); return; }
  }
  // proteger: con un rival encima y sin pase, se aleja despacio poniendo el cuerpo entre el rival y la pelota
  if (near.d < 1.6 && near.p && (near.p.pos.x - p.pos.x) * ad > -0.5) {
    let sx = p.pos.x - near.p.pos.x, sz = p.pos.z - near.p.pos.z; const sl = Math.hypot(sx, sz) || 1; sx /= sl; sz /= sl;
    p.sprint = false; p.want.x = sx * 2.2; p.want.z = sz * 2.2; p.wantFace = Math.atan2(sx, sz); return;
  }
  // conducir hacia el arco esquivando rivales
  let dx = ad, dz = clamp(-p.pos.z * 0.02, -0.4, 0.4);
  if (rx > 18) dz = clamp(-p.pos.z * 0.05, -0.8, 0.8); // en el ultimo tercio, se cierra hacia el arco
  for (const o of team.opp.players) {
    const ox = o.pos.x - p.pos.x, oz = o.pos.z - p.pos.z, d = Math.hypot(ox, oz);
    if (d < 6 && d > 0.01 && ox * ad > -1) { const k = (6 - d) / 6 * 1.4; dx -= ox / d * k * 0.6; dz -= oz / d * k; }
  }
  if (Math.abs(p.pos.z) > 30) dz -= Math.sign(p.pos.z) * 0.8;
  const l = Math.hypot(dx, dz) || 1;
  const sp = near.d > 4 ? p.vmax : p.vmax * 0.7;
  p.sprint = near.d > 4; p.want.x = dx / l * sp; p.want.z = dz / l * sp;
}
// calidad de una ocasion de gol desde (x,z): angulo que se ve del arco y distancia (0..~0.35)
function xgAt(team, x, z) {
  const gx = team.oppGoalX, dx = Math.abs(gx - x), D = Math.hypot(dx, z);
  if (D > 35 || (x - gx) * team.attackDir > 0) return 0;
  const ang = Math.abs(Math.atan2(z + PITCH.goalHW, dx) - Math.atan2(z - PITCH.goalHW, dx));
  return Math.pow(clamp(ang / 1.1, 0, 1), 1.1) * Math.exp(-D / 16) * 1.2;
}
// riesgo de que un rival llegue antes a la pelota en un pase de (sx,sz) a (tx,tz). 0 = limpio, 1 = seguro lo cortan
function passRisk(p, tx, tz, lob, rec) {
  const sx = p.pos.x, sz = p.pos.z, D = Math.hypot(tx - sx, tz - sz) || 1;
  const vavg = lob ? D / (0.95 + D * 0.034) : 7 + D * 0.33; // igual que la velocidad real de los pases (computePass)
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
    // un rival pegado a la linea de pase cerca del que patea la corta con la pierna aunque la pelota vaya rapido
    if (!lob && t < 0.35 && t * D < 4) { const sd = Math.hypot(o.pos.x - px, o.pos.z - pz); if (sd < 1.0) risk = Math.max(risk, 0.9 - sd * 0.4); }
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
    let s = gain * 0.035 + (m.pos.x * ad > 20 && p.pos.x * ad < 20 ? 0.25 : 0) + open / 8 * 0.35 + xgAt(team, m.pos.x, m.pos.z) * 5 - risk * 1.7 - Math.max(0, risk - 0.45) * 2.5 - (d > 35 ? 0.3 : 0) + (pressure < 2.2 ? 0.25 : -0.1) - (lob ? 0.15 - tac.direct * 0.3 : 0);
    if (m.isGK) s -= pressure < 2 ? 0.3 : 1.2;
    if (lob && Math.abs(m.pos.z - p.pos.z) > 28 && open > 5 && risk < 0.4) s += 0.3; // cambio de frente
    let kind = lob ? 'lob' : 'pass';
    // pase filtrado al delantero que pica
    // pase filtrado al espacio para el que esta en la linea (habilitado) y tiene lugar atras de la defensa
    const offL = lastDefenderX(team);
    if (team.form[m.slot].role !== 'DF' && !m.isGK && gain > 3 && m.pos.x * ad < offL - 0.2 && m.pos.x * ad > offL - 6 && (m.brain.run > 0 || Math.random() < 0.5)) {
      const fx = m.pos.x + ad * 9, fz = m.pos.z * 0.85;
      const rT = passRisk(p, fx, fz, false, null);
      const sT = gain * 0.035 + 0.55 + xgAt(team, fx, fz) * 4 - rT * 1.2;
      if (rT < 0.55 && sT > s) { kind = 'through'; s = sT; }
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
  const team = p.team, gx = team.oppGoalX, ad = team.attackDir, rx = p.pos.x * ad;
  const mates = team.players.filter(m => m !== p && !m.isGK);
  const nearTo = (x, z, r) => { let rec = null, bd = r; for (const m of mates) { const d = Math.hypot(m.pos.x - x, m.pos.z - z); if (d < bd) { bd = d; rec = m; } } return rec; };
  // desde el fondo (cerca de la linea): pase atras rasante al punto penal
  if (rx > 44 && Math.abs(p.pos.z) < 24) {
    const cx = gx - ad * rand(10, 14), cz = p.pos.z * 0.25, rec = nearTo(cx, cz, 9);
    if (rec && passRisk(p, rec.pos.x, rec.pos.z, false, rec) < 0.5) { startKick(p, 'pass', { receiver: rec, power: 0.5 }); return; }
  }
  // centro tenso (bajo y rapido) si hay alguien entrando al primer palo; si no, bombeado al segundo palo o al punto penal
  const side = Math.sign(p.pos.z) || 1, npx = gx - ad * 6, npz = side * 4;
  const nearPost = nearTo(npx, npz, 4.5);
  let tgt, rec, driven = false;
  if (nearPost) { rec = nearPost; tgt = { x: npx, z: npz * 0.8 }; driven = true; }
  else { tgt = { x: gx - ad * rand(5, 11), z: -side * rand(0, 5) }; rec = nearTo(tgt.x, tgt.z, 16); }
  if (rec && !driven) { tgt.x = rec.pos.x + rec.vel.x * 0.8; tgt.z = rec.pos.z + rec.vel.z * 0.8; }
  startKick(p, 'cross', { target: tgt, receiver: rec, power: 0.7, driven, inswing: Math.random() < 0.6 });
}
