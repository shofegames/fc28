// ===== Camara televisiva (predeterminada), camara de gol, intro y menu =====
const CAM_PRESETS = [
  { name: 'TV', h: 22, d: 54, fov: 26, look: 0.78 },
  { name: 'TV ALTA', h: 34, d: 58, fov: 27, look: 0.7 },
  { name: 'CERCANA', h: 13, d: 34, fov: 32, look: 0.85 },
];
const Cam = {
  mode: 'menu', fx: 0, fz: 0, px: 0, py: 30, pz: 60, lx: 0, ly: 0, lz: 0, fov: 30, t: 0, target: null,
  intro() { this.mode = 'intro'; this.t = 0; },
  goal(p) { this.mode = 'goal'; this.t = 0; this.target = p; },
  snap() { const b = G.ball; this.fx = b.px; this.fz = b.pz; this.t = 0; },
  update(dt) {
    const cam = G.camera, b = G.ball;
    this.t += dt;
    let px, py, pz, lx, ly, lz, fov, k = 2.2;
    if (this.mode === 'menu') {
      const a = this.t * 0.05;
      px = Math.cos(a) * 78; pz = Math.sin(a) * 58 + 8; py = 24 + Math.sin(this.t * 0.11) * 6;
      lx = b.px * 0.4; ly = 2; lz = b.pz * 0.3; fov = 38; k = 1.2;
    } else if (this.mode === 'goal') {
      const p = this.target;
      const tx = p ? p.pos.x : b.px, tz = p ? p.pos.z : b.pz;
      const a = 0.4 + this.t * 0.25;
      px = tx + Math.sin(a) * 9; pz = tz + Math.cos(a) * 9; py = 3.2 + this.t * 0.3;
      lx = tx; ly = 1.3; lz = tz; fov = 40; k = 2.5;
      if (this.t < 0.05) { this.px = px; this.py = py; this.pz = pz; this.lx = lx; this.ly = ly; this.lz = lz; }
    } else {
      const P = CAM_PRESETS[CFG.cam] || CAM_PRESETS[0];
      let tx = b.px + b.vx * 0.3, tz = b.pz + b.vz * 0.22;
      if (G.owner) tx += G.owner.team.attackDir * 3;
      this.fx = damp(this.fx, tx, 2.4, dt); this.fz = damp(this.fz, tz, 1.7, dt);
      const near = clamp((Math.abs(this.fx) - 30) / 18, 0, 1);
      const fast = clamp(Math.hypot(b.vx, b.vz) / 28, 0, 1);
      fov = P.fov - near * 2.5 + fast * 3 + (b.py > 4 ? 2 : 0);
      if (innerHeight < 520) fov *= 0.86; // en el celular, un poco mas cerca para ver bien a los jugadores
      px = clamp(this.fx * 0.86, -42, 42); py = P.h - near * 2; pz = P.d + this.fz * 0.18;
      lx = this.fx; ly = 0; lz = this.fz * P.look + 1.5;
      // penal: camara atras del que patea
      const r = G.match && G.match.restart;
      if (r && r.type === 'penalty' && r.ready) G.match.penCam = { x: r.spot.x, gx: r.team.oppGoalX, until: G.time + 2.4 };
      const pc = G.match && G.match.penCam;
      if (pc && G.time < pc.until && this.mode === 'tv' && (!r || r.type === 'penalty')) {
        const gx = pc.gx, sg = Math.sign(gx);
        px = pc.x - sg * 10; py = 3.6; pz = 4.5; lx = gx; ly = 1.2; lz = 0; fov = 40; k = 3;
      }
      if (this.mode === 'intro') {
        // barrido inicial desde lo alto del estadio
        const u = smooth(clamp(this.t / 2.6, 0, 1));
        px = lerp(-70, px, u); py = lerp(46, py, u); pz = lerp(78, pz, u); lx = lerp(0, lx, u); lz = lerp(0, lz, u); fov = lerp(40, fov, u);
        if (u >= 1) this.mode = 'tv';
        this.px = px; this.py = py; this.pz = pz; this.lx = lx; this.ly = ly; this.lz = lz; this.fov = fov;
      }
    }
    this.px = damp(this.px, px, k, dt); this.py = damp(this.py, py, k * 0.8, dt); this.pz = damp(this.pz, pz, k * 0.8, dt);
    this.lx = damp(this.lx, lx, k * 1.6, dt); this.ly = damp(this.ly, ly, k * 1.6, dt); this.lz = damp(this.lz, lz, k * 1.3, dt);
    this.fov = damp(this.fov, fov, 1.6, dt);
    cam.position.set(this.px, this.py, this.pz); cam.lookAt(this.lx, this.ly, this.lz);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  },
};
