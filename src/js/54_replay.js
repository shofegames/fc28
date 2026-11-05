// ===== Repeticion del gol: graba los ultimos segundos (30 cuadros por segundo) y los vuelve a mostrar con otra camara =====
const Replay = {
  buf: [], max: 240, alpha: 1, acc: 0, active: false, t: 0, i0: 0, goalIdx: 0, frames: null, cam: { x: 0, y: 6, z: 20, lx: 0, ly: 0, lz: 0 },
  reset() { this.buf = []; this.active = false; },
  snapAction(a) { return a ? { type: a.type, t: a.t, dur: a.dur, contact: a.contact, kind: a.kind, side: a.side, hgt: a.hgt, foot: a.foot, jump: a.jump, color: a.color, fired: true } : null; },
  // se llama en cada paso de la simulacion
  rec(h) {
    const m = G.match; if (!m || m.attract) return;
    if (m.state !== 'play' && !(m.state === 'goal' && m.timer < 1.3) && m.state !== 'restart') return;
    this.acc += h; if (this.acc < 1 / 30 - 1e-6) return; this.acc = 0;
    const b = G.ball;
    const f = { b: [b.px, b.py, b.pz, b.wx, b.wy, b.wz], p: [], owner: G.owner, goal: m.state === 'goal' };
    for (const p of G.players.concat(Refs.all)) f.p.push({ o: p, x: p.pos.x, z: p.pos.z, vx: p.vel.x, vz: p.vel.z, f: p.facing, ph: p.phase, tr: p.turnRate, av: p.accelV || 0, a: this.snapAction(p.action) });
    this.buf.push(f); if (this.buf.length > this.max) this.buf.shift();
  },
  has() { return this.buf.length > 60; },
  start() {
    const gi = this.buf.findIndex(f => f.goal);
    this.goalIdx = gi < 0 ? this.buf.length - 1 : gi;
    this.i0 = Math.max(0, this.goalIdx - 4.3 * 30);
    this.frames = this.buf.slice(this.i0); this.goalIdx -= this.i0;
    this.t = 0; this.active = true;
    Hud.replay(true); Hud.msg(null); Touch.show(false);
    // la camara arranca cerca de la pelota
    const f = this.frames[0]; this.cam.x = f.b[0]; this.cam.z = f.b[2] + 14; this.cam.y = 6; this.cam.lx = f.b[0]; this.cam.lz = f.b[2];
  },
  stop() {
    this.active = false; this.buf = []; Hud.replay(false); Touch.show(true);
    for (const p of G.players.concat(Refs.all)) { p.prev.copy(p.pos); }
    G.match.afterReplay();
  },
  // avanza la repeticion (en el bucle de dibujo, porque la simulacion esta parada)
  update(dt) {
    if (!this.active) return;
    if (Input.hit('pass') || Input.hit('shoot') || Input.hit('action') || Input.down.has('Enter') || Input.down.has('Escape')) { Input.endStep(); this.stop(); return; }
    Input.poll(); Input.endStep();
    const fi = this.t * 30, near = Math.abs(fi - this.goalIdx) < 30;
    this.t += dt * (near ? 0.45 : 0.85); // camara lenta cerca del gol
    const n = this.frames.length;
    if (fi >= n - 1) { this.stop(); return; }
    const i = Math.floor(fi), u = fi - i, A = this.frames[i], B = this.frames[Math.min(n - 1, i + 1)];
    this.alpha = u;
    // jugadores y arbitros
    for (let k = 0; k < A.p.length; k++) {
      const a = A.p[k], b = B.p[k] && B.p[k].o === a.o ? B.p[k] : a, p = a.o;
      if (p.gone || p.sentOff && !G.match.leaving.includes(p)) continue;
      p.prev.set(a.x, 0, a.z); p.pos.set(b.x, 0, b.z);
      p.vel.set(lerp(a.vx, b.vx, u), 0, lerp(a.vz, b.vz, u));
      p.facing = a.f + angWrap(b.f - a.f) * u; p.phase = lerp(a.ph, b.ph, u); p.turnRate = a.tr; p.accelV = a.av;
      p.action = a.a ? Object.assign({}, a.a, { t: lerp(a.a.t, b.a && b.a.type === a.a.type ? b.a.t : a.a.t, u) }) : null;
    }
    // pelota
    const bl = G.ball;
    bl.prev.set(A.b[0], A.b[1], A.b[2]); bl.px = B.b[0]; bl.py = B.b[1]; bl.pz = B.b[2]; bl.wx = A.b[3]; bl.wy = A.b[4]; bl.wz = A.b[5];
    if (i === this.goalIdx && !this._hit) { this._hit = true; AU.cheer(0.9); AU.net(); Goals.hit(Math.sign(bl.px), bl.pz, bl.py, 12); }
    if (i !== this.goalIdx) this._hit = false;
    G.owner = A.owner;
    // camara: al costado de la jugada, mas baja y cerca que la de TV; al final, detras del arco
    const bx = lerp(A.b[0], B.b[0], u), bz = lerp(A.b[2], B.b[2], u), by = lerp(A.b[1], B.b[1], u), sg = Math.sign(this.frames[this.goalIdx].b[0]) || 1;
    const late = fi > this.goalIdx - 40;
    let cx, cy, cz;
    if (late) { cx = sg * (PITCH.HL + 9); cy = 3.2; cz = bz * 0.5 + 5; }
    else { cx = bx - sg * 9; cy = 4.5; cz = bz + 12; }
    const k = 1 - Math.exp(-dt * (late ? 2.2 : 3));
    const C = this.cam; C.x += (cx - C.x) * k; C.y += (cy - C.y) * k; C.z += (cz - C.z) * k;
    C.lx += (bx - C.lx) * k * 2; C.ly += (Math.min(by, 2) * 0.6 + 0.6 - C.ly) * k * 2; C.lz += (bz - C.lz) * k * 2;
    const cam = G.camera; cam.position.set(C.x, C.y, C.z); cam.lookAt(C.lx, C.ly, C.lz);
    if (Math.abs(cam.fov - 36) > 0.01) { cam.fov = 36; cam.updateProjectionMatrix(); }
  },
};
