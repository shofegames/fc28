// ===== Pelota: fisica propia (gravedad, rebotes, roce, efecto Magnus, postes, red, cuerpos) =====
// Se usa un motor propio en vez de Rapier: la misma funcion sirve para mover la pelota y para PREDECIR su
// trayectoria (arqueros, pases, intercepciones), asi la prediccion coincide exactamente con lo que pasa.
const BP = { eGround: 0.56, minBounce: 0.9, rollK: 0.36, rollC: 0.2, drag: 0.0085, magnus: 0.016, ePost: 0.7, eNet: 0.07, netFric: 0.3, eBody: 0.32 };

function capsuleHit(s, ax, ay, az, bx, by, bz, r, e) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, l = dx * dx + dy * dy + dz * dz;
  let t = ((s.px - ax) * dx + (s.py - ay) * dy + (s.pz - az) * dz) / l; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + dx * t, cy = ay + dy * t, cz = az + dz * t;
  let nx = s.px - cx, ny = s.py - cy, nz = s.pz - cz; const d = Math.hypot(nx, ny, nz), Rr = r + BALL_R;
  if (d >= Rr || d < 1e-6) return 0;
  nx /= d; ny /= d; nz /= d;
  s.px = cx + nx * Rr; s.py = cy + ny * Rr; s.pz = cz + nz * Rr;
  const vn = s.vx * nx + s.vy * ny + s.vz * nz;
  if (vn < 0) { s.vx -= (1 + e) * vn * nx; s.vy -= (1 + e) * vn * ny; s.vz -= (1 + e) * vn * nz; return -vn; }
  return 0;
}
// pared fina de red: se puede pegar de los dos lados
function netWall(s, o, ax, val, b1, lo1, hi1, b2, lo2, hi2) {
  const p1 = s['p' + b1], p2 = s['p' + b2];
  if (p1 < lo1 || p1 > hi1 || p2 < lo2 || p2 > hi2) return 0;
  const d0 = o[ax] - val, d1 = s['p' + ax] - val;
  const side = d0 !== 0 ? Math.sign(d0) : -Math.sign(s['v' + ax] || 1);
  if (Math.sign(d1) !== side || Math.abs(d1) < BALL_R) {
    s['p' + ax] = val + side * BALL_R;
    const v = s['v' + ax];
    if (v * side < 0) { s['v' + ax] = -v * BP.eNet; s['v' + b1] *= BP.netFric; s['v' + b2] *= BP.netFric; return Math.abs(v); }
  }
  return 0;
}
const _o = { x: 0, y: 0, z: 0 };
function collideGoal(s, sg, ev) {
  const gx = sg * PITCH.HL, pz = PITCH.goalHW + PITCH.postR, top = PITCH.goalH + PITCH.postR, R = PITCH.postR;
  const depth = (s.px - gx) * sg;
  if (Math.abs(s.pz) > pz + 1 || s.py > top + 1 || depth < -1 || depth > PITCH.goalD + 1) return;
  let v = capsuleHit(s, gx, 0, -pz, gx, top, -pz, R, BP.ePost) + capsuleHit(s, gx, 0, pz, gx, top, pz, R, BP.ePost) + capsuleHit(s, gx, top, -pz, gx, top, pz, R, BP.ePost);
  if (v > 1.5 && ev) ev('post', v);
  const bx = gx + sg * PITCH.goalD, x0 = Math.min(gx, bx), x1 = Math.max(gx, bx);
  let n = netWall(s, _o, 'x', bx, 'z', -pz, pz, 'y', 0, top);
  if (n && ev) ev('netback', n, sg);
  n = netWall(s, _o, 'z', -pz, 'x', x0, x1, 'y', 0, top) + netWall(s, _o, 'z', pz, 'x', x0, x1, 'y', 0, top) + netWall(s, _o, 'y', top, 'x', x0, x1, 'z', -pz, pz);
  if (n > 2 && ev) ev('net', n, sg);
}
// un paso de fisica (h segundos). ev = callback de eventos (null en predicciones). free = sin arcos (para calcular disparos)
function ballStep(s, h, ev, free) {
  _o.x = s.px; _o.y = s.py; _o.z = s.pz;
  const onGround = s.py <= BALL_R + 0.004 && Math.abs(s.vy) < 0.05;
  if (!onGround) {
    s.vy -= GRAV * h;
    const sp = Math.hypot(s.vx, s.vy, s.vz), d = 1 - BP.drag * sp * h;
    s.vx *= d; s.vy *= d; s.vz *= d;
    const k = BP.magnus * h;
    const ax = s.wy * s.vz - s.wz * s.vy, ay = s.wz * s.vx - s.wx * s.vz, az = s.wx * s.vy - s.wy * s.vx;
    s.vx += ax * k; s.vy += ay * k; s.vz += az * k;
    const wd = 1 - 0.3 * h; s.wx *= wd; s.wy *= wd; s.wz *= wd;
  } else {
    s.vy = 0; s.py = BALL_R;
    const hs = Math.hypot(s.vx, s.vz);
    if (hs > 0) {
      let ns = hs / (1 + BP.rollK * h) - BP.rollC * h; if (hs < 0.3) ns = hs - 1.2 * h;
      if (ns < 0) ns = 0; const f = ns / hs; s.vx *= f; s.vz *= f;
    }
    s.wx = s.vz / BALL_R; s.wz = -s.vx / BALL_R; s.wy *= 1 - 2 * h;
  }
  s.px += s.vx * h; s.py += s.vy * h; s.pz += s.vz * h;
  if (s.py < BALL_R) {
    s.py = BALL_R;
    if (s.vy < 0) {
      const vy = -s.vy;
      if (vy > BP.minBounce) { s.vy = vy * BP.eGround; s.vx *= 0.9; s.vz *= 0.9; if (ev && vy > 2.5) ev('bounce', vy); }
      else s.vy = 0;
    }
  }
  if (!free) {
    if (Math.abs(s.px) > PITCH.HL - 1.2) collideGoal(s, Math.sign(s.px), ev);
    if (Math.abs(s.px) > 57.4) { s.px = Math.sign(s.px) * 57.4; s.vx *= -0.35; }
    if (Math.abs(s.pz) > 38.4) { s.pz = Math.sign(s.pz) * 38.4; s.vz *= -0.35; }
  }
}

class Ball {
  constructor() {
    this.px = 0; this.py = BALL_R; this.pz = 0; this.vx = 0; this.vy = 0; this.vz = 0; this.wx = 0; this.wy = 0; this.wz = 0;
    this.prev = new THREE.Vector3(0, BALL_R, 0);
    this.held = null; this.ignore = null; this.ignoreT = 0;
    this.traj = new Float32Array(91 * 4); this.trajN = 0; this.trajDirty = true;
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 18), new THREE.MeshPhongMaterial({ map: ballTexture(), shininess: 40, specular: 0x333333 }));
    this.mesh.castShadow = true; G.scene.add(this.mesh);
    this.q = new THREE.Quaternion();
    this.lastSfx = 0;
  }
  get speed() { return Math.hypot(this.vx, this.vy, this.vz); }
  place(x, z, y) { this.px = x; this.pz = z; this.py = y || BALL_R; this.vx = this.vy = this.vz = 0; this.wx = this.wy = this.wz = 0; this.held = null; this.trajDirty = true; this.prev.set(this.px, this.py, this.pz); }
  launch(vx, vy, vz, w) {
    this.vx = vx; this.vy = vy; this.vz = vz;
    if (w) { this.wx = w.x; this.wy = w.y; this.wz = w.z; } else { this.wx = this.wy = this.wz = 0; }
    this.trajDirty = true; G.kickSeq++;
  }
  update(h) {
    this.prev.set(this.px, this.py, this.pz);
    if (this.held) {
      const p = this.held, f = p.fwd();
      const ac = p.action; let hy = ac && ac.type === 'throw' ? 2.05 : 1.12, fwd = hy > 2 ? 0.05 : 0.32;
      if (ac && ac.type === 'gkthrow') { const u = clamp(ac.t / ac.contact, 0, 1); hy = keyf(u, [[0, 1.12], [0.75, 1.75], [1, 2.15]]); fwd = keyf(u, [[0, 0.32], [0.75, -0.35], [1, 0.25]]); }
      if (ac && ac.type === 'gkvolley') { const u = clamp(ac.t / ac.contact, 0, 1); hy = keyf(u, [[0, 1.1], [0.45, 1.0], [1, 0.45]]); fwd = 0.42; }
      this.px = p.pos.x + f.x * fwd; this.pz = p.pos.z + f.z * fwd; this.py = hy;
      this.vx = p.vel.x; this.vz = p.vel.z; this.vy = 0; this.wx = this.wy = this.wz = 0;
      this.trajN = 0; return;
    }
    if (this.ignoreT > 0) { this.ignoreT -= h; if (this.ignoreT <= 0) this.ignore = null; }
    const sh = h / SUB;
    for (let i = 0; i < SUB; i++) {
      ballStep(this, sh, ballEvent);
      this.bodies();
    }
    if (this.trajDirty || G.frame % 3 === 0) this.predict();
  }
  // choque con el cuerpo de los jugadores (torso; las piernas las maneja el control de pelota)
  bodies() {
    // pelota baja y suelta (pase o rebote): si pega en las piernas de alguien que no la pudo controlar, rebota (no las atraviesa)
    if (this.py < 0.6 && !G.owner && Math.hypot(this.vx, this.vz) > 3) {
      for (const p of G.players) {
        if (p === this.ignore || p.isGK || p.controlCd > 0 && p === G.lastTouch) continue;
        const dx = this.px - p.pos.x, dz = this.pz - p.pos.z;
        if (dx * dx + dz * dz > 0.25) continue;
        this.vx -= p.vel.x; this.vz -= p.vel.z;
        const v = capsuleHit(this, p.pos.x, 0.05, p.pos.z, p.pos.x, 0.55, p.pos.z, 0.15, 0.25);
        this.vx += p.vel.x; this.vz += p.vel.z;
        if (v > 0.5) { this.vx *= 0.75; this.vz *= 0.75; touchBy(p); this.trajDirty = true; G.kickSeq++; AU.touch(); if (G.passInfo && G.passInfo.to !== p) G.passInfo = null; }
      }
    }
    if (this.py < 0.45 || this.py > 2.5) return;
    for (const p of G.players) {
      if (p === this.ignore || p.noBody || p.isGK) continue;
      const dx = this.px - p.pos.x, dz = this.pz - p.pos.z;
      if (dx * dx + dz * dz > 0.5) continue;
      const sc = p.info.height / 1.8;
      const ja = p.action && (p.action.type === 'jump' || p.action.type === 'header') ? p.action : null;
      const jy = ja ? Math.sin(Math.PI * clamp(ja.t / ja.dur, 0, 1)) * 0.42 * (ja.jump || 1) : 0; // la barrera salta
      // velocidad relativa al jugador
      this.vx -= p.vel.x; this.vz -= p.vel.z;
      const v = capsuleHit(this, p.pos.x, 0.72 * sc + jy, p.pos.z, p.pos.x, 1.55 * sc + jy, p.pos.z, 0.23 * p.info.build, BP.eBody);
      this.vx += p.vel.x; this.vz += p.vel.z;
      if (v > 0.5) {
        this.vx *= 0.8; this.vz *= 0.8;
        touchBy(p); this.trajDirty = true; G.kickSeq++;
        if (v > 4) AU.touch();
        if (G.passInfo && G.passInfo.from.team !== p.team) G.passInfo = null;
      }
    }
  }
  // trayectoria futura: 3 s, 30 puntos por segundo (x, y, z, vel horizontal)
  predict() {
    this.trajDirty = false;
    const s = { px: this.px, py: this.py, pz: this.pz, vx: this.vx, vy: this.vy, vz: this.vz, wx: this.wx, wy: this.wy, wz: this.wz };
    const T = this.traj; let n = 0;
    T[0] = s.px; T[1] = s.py; T[2] = s.pz; T[3] = Math.hypot(s.vx, s.vz); n = 1;
    for (let i = 1; i <= 90; i++) {
      for (let k = 0; k < 4; k++) ballStep(s, 1 / 120, null);
      T[n * 4] = s.px; T[n * 4 + 1] = s.py; T[n * 4 + 2] = s.pz; T[n * 4 + 3] = Math.hypot(s.vx, s.vz); n++;
      if (T[n * 4 - 1] < 0.05 && s.py <= BALL_R + 0.01) break;
    }
    this.trajN = n;
  }
  render(alpha, dt) {
    const m = this.mesh;
    m.position.set(lerp(this.prev.x, this.px, alpha), lerp(this.prev.y, this.py, alpha), lerp(this.prev.z, this.pz, alpha));
    const w = Math.hypot(this.wx, this.wy, this.wz);
    if (w > 0.01) { const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(this.wx / w, this.wy / w, this.wz / w), w * dt); this.q.premultiply(q); m.quaternion.copy(this.q); }
  }
}
function ballEvent(type, v, sg) {
  const t = G.time;
  if (type === 'post') { if (t - G.ball.lastSfx > 0.1) AU.post(); G.ball.lastSfx = t; G.kickSeq++; AU.cheer(0.45); if (G.match) G.match.stats.post = (G.match.stats.post || 0) + 1; }
  else if (type === 'netback' || type === 'net') { if (t - G.ball.lastSfx > 0.15) AU.net(); G.ball.lastSfx = t; Goals.hit(sg, G.ball.pz, G.ball.py, v); }
  else if (type === 'bounce') { if (t - G.ball.lastSfx > 0.1) AU.bounce(v); G.ball.lastSfx = t; }
}
// calcula la velocidad para que la pelota pase por (tx,ty,tz) con velocidad horizontal hs, corrigiendo roce y efecto
function solveLaunch(sx, sy, sz, tx, ty, tz, hs, w) {
  let ax = tx, ay = ty, az = tz, v = null;
  const D0 = Math.hypot(tx - sx, tz - sz) || 0.01;
  const s = {};
  for (let it = 0; it < 4; it++) {
    const dx = ax - sx, dz = az - sz, D = Math.hypot(dx, dz) || 0.01, T = D / hs;
    v = { vx: dx / D * hs, vy: (ay - sy) / T + 0.5 * GRAV * T, vz: dz / D * hs };
    if (it === 3) break;
    Object.assign(s, { px: sx, py: sy, pz: sz, vx: v.vx, vy: v.vy, vz: v.vz, wx: w ? w.x : 0, wy: w ? w.y : 0, wz: w ? w.z : 0 });
    const ux = (tx - sx) / D0, uz = (tz - sz) / D0;
    let t = 0;
    while (t < 4) { ballStep(s, 1 / 120, null, true); t += 1 / 120; if ((s.px - sx) * ux + (s.pz - sz) * uz >= D0) break; if (Math.hypot(s.vx, s.vz) < 0.2) break; }
    ax += tx - s.px; az += tz - s.pz; ay += clamp(ty - s.py, -3, 3);
  }
  return v;
}
function ballTexture() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const c = cv.getContext('2d');
  c.fillStyle = '#f4f5f7'; c.fillRect(0, 0, 512, 256);
  // diseño original: paneles curvos de colores
  const cols = ['#11151d', '#b8ff3c', '#11151d', '#3cf0ff'];
  for (let i = 0; i < 8; i++) {
    const x = i * 64 + 10, y = i % 2 ? 70 : 150;
    c.fillStyle = cols[i % 4];
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 30, y - 50, x + 60, y - 10); c.quadraticCurveTo(x + 40, y + 10, x + 50, y + 40); c.quadraticCurveTo(x + 20, y + 20, x, y); c.fill();
  }
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2;
  for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, 40 + i * 36); c.bezierCurveTo(128, 20 + i * 36, 384, 60 + i * 36, 512, 40 + i * 36); c.stroke(); }
  return new THREE.CanvasTexture(cv);
}
