// ===== Arbitro y asistentes: se mueven con la jugada, cobran con gestos, muestran tarjetas y levantan el banderin =====
const REF_KITS = [K('#151515', '#151515', 'plain', '#151515', '#151515', '#f2e600'), K('#f2e600', '#151515', 'plain', '#151515', '#151515', '#151515'),
  K('#e8202a', '#151515', 'plain', '#151515', '#151515'), K('#18c3e0', '#151515', 'plain', '#151515', '#151515', '#151515')];
class Official {
  constructor(kind, kit, z) {
    this.kind = kind; this.isGK = false; this.isOfficial = true;
    this.info = { height: 1.8, build: 1, num: '', last: '', first: '', skin: SKINS[Math.floor(Math.random() * 5)], hair: Math.random() < 0.4 ? 'bald' : 'buzz', hairColor: '#2b1d14', boots: '#111111', official: kind };
    this.a = { pac: 70 };
    this.pos = new THREE.Vector3(0, 0, z || 0); this.prev = this.pos.clone(); this.vel = new THREE.Vector3();
    this.facing = 0; this.turnRate = 0; this.accelV = 0; this.phase = 0; this.action = null; this.wantFace = null;
    this.want = { x: 0, z: 0 }; this.vmax = 7; this.sprint = false; this.task = null;
    this.rig = new Rig(this.info, kit, null); G.scene.add(this.rig.root);
  }
  goTo(x, z, fast) {
    const dx = x - this.pos.x, dz = z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.6) { this.want.x = this.want.z = 0; return d; }
    const sp = Math.min(fast ? this.vmax : d > 8 ? 5.5 : 3.2, d * 1.8 + 0.3);
    this.want.x = dx / d * sp; this.want.z = dz / d * sp; return d;
  }
  update(h) {
    const ac = this.action;
    if (ac) { ac.t += h; if (ac.t >= ac.dur) this.action = null; }
    const dvx = this.want.x - this.vel.x, dvz = this.want.z - this.vel.z, dl = Math.hypot(dvx, dvz), maxA = 10 * h;
    if (dl > maxA) { this.vel.x += dvx / dl * maxA; this.vel.z += dvz / dl * maxA; } else { this.vel.x = this.want.x; this.vel.z = this.want.z; }
    this.pos.x += this.vel.x * h; this.pos.z += this.vel.z * h;
    const sp = Math.hypot(this.vel.x, this.vel.z), sp0 = this._sp || 0; this._sp = sp;
    this.accelV = damp(this.accelV, (sp - sp0) / h, 8, h);
    const b = G.ball, md = Math.atan2(this.vel.x, this.vel.z);
    let tf = this.wantFace != null ? this.wantFace : sp > 2.5 ? md : Math.atan2(b.px - this.pos.x, b.pz - this.pos.z);
    if (this.wantFace == null && sp > 1 && Math.abs(angWrap(md - Math.atan2(b.px - this.pos.x, b.pz - this.pos.z))) < 1.4) tf = Math.atan2(b.px - this.pos.x, b.pz - this.pos.z);
    const st = clamp(angWrap(tf - this.facing), -8 * h, 8 * h);
    this.facing = angWrap(this.facing + st); this.turnRate = damp(this.turnRate, st / h, 10, h);
    const vf = sp > 0.05 ? Math.abs(Math.cos(md - this.facing)) : 1;
    this.phase += sp * h / (gaitLen(sp) * (0.55 + 0.45 * vf)) * TAU;
  }
  gesture(type, dur, extra) { this.action = Object.assign({ type, t: 0, dur, contact: 9, fired: true }, extra || {}); }
}
const Refs = {
  ref: null, ar: [], all: [],
  create() {
    this.dispose();
    const kits = G.teams.map(t => t.kit).concat(G.teams.map(t => t.gkKit));
    const kit = REF_KITS.find(k => kits.every(o => colorDist(o.shirt, k.shirt) > 0.5)) || REF_KITS[0];
    this.ref = new Official('ref', kit, -6);
    // asistentes: uno en cada banda, cada uno cubre una mitad
    this.ar = [new Official('ar', kit, PITCH.HW + 1.2), new Official('ar', kit, -PITCH.HW - 1.2)];
    this.ar[0].half = 1; this.ar[1].half = -1;
    this.ar[0].pos.x = 20; this.ar[1].pos.x = -20;
    this.all = [this.ref].concat(this.ar);
    for (const o of this.all) o.prev.copy(o.pos);
  },
  dispose() { for (const o of this.all) o.rig.dispose(); this.all = []; this.ar = []; this.ref = null; },
  // linea del penultimo defensor de la mitad que cubre cada asistente
  arLine(half) {
    const def = G.teams.find(t => Math.sign(t.ownGoalX) === half);
    if (!def) return half * 20;
    const xs = def.players.map(p => p.pos.x * half).sort((a, b) => b - a);
    const line = Math.max(xs[1] != null ? xs[1] : 0, G.ball.px * half);
    return clamp(line, 0, PITCH.HL) * half;
  },
  update(h) {
    if (!this.ref) return;
    const b = G.ball, m = G.match, ref = this.ref;
    for (const o of this.all) o.prev.copy(o.pos);
    // arbitro: sistema diagonal, a unos 12-18 m de la pelota, sin meterse en el medio
    const t = ref.task;
    ref.wantFace = null;
    if (t && t.type === 'card') {
      t.t += h;
      const p = t.player;
      const d = ref.goTo(p.pos.x + 1.8, p.pos.z + 1.2, true);
      if ((d < 2.5 || t.t > 2.2) && !t.shown) { t.shown = true; ref.gesture('card', 1.9, { color: t.color }); ref.wantFace = Math.atan2(p.pos.x - ref.pos.x, p.pos.z - ref.pos.z); }
      if (t.shown && !ref.action) ref.task = null;
    } else if (t && t.type === 'point') {
      t.t += h; ref.want.x *= 0.8; ref.want.z *= 0.8; ref.wantFace = t.dir;
      if (!ref.action && t.t > 0.15 && !t.done) { t.done = true; ref.gesture('point', 1.3); }
      if (t.done && !ref.action) ref.task = null;
    } else if (m && m.state === 'restart' && m.restart && m.restart.kickoff) {
      ref.goTo(-6, -4);
    } else {
      const sx = Math.sign(b.px) || 1;
      let tx = b.px - sx * 7, tz = clamp(b.pz * 0.45 - sx * 9, -26, 26);
      const dx = tx - b.px, dz = tz - b.pz, dd = Math.hypot(dx, dz);
      if (dd < 10) { tx = b.px + dx / (dd || 1) * 10; tz = b.pz + dz / (dd || 1) * 10; }
      ref.goTo(clamp(tx, -48, 48), tz, Math.hypot(tx - ref.pos.x, tz - ref.pos.z) > 15);
    }
    for (const a of this.ar) {
      const lx = this.arLine(a.half);
      a.goTo(clamp(lx, -PITCH.HL, PITCH.HL), a.half > 0 ? PITCH.HW + 1.2 : -PITCH.HW - 1.2, Math.abs(lx - a.pos.x) > 6);
      a.wantFace = a.half > 0 ? Math.PI : 0; // mirando a la cancha
      if (a.action && a.action.type === 'flag') a.want.x = a.want.z = 0;
    }
    for (const o of this.all) o.update(h);
    // los jugadores no atraviesan al arbitro
    for (const p of G.players) {
      const dx = p.pos.x - ref.pos.x, dz = p.pos.z - ref.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.7 && d > 1e-4) { ref.pos.x -= dx / d * (0.7 - d); ref.pos.z -= dz / d * (0.7 - d); }
    }
  },
  showCard(p, color) { if (this.ref) this.ref.task = { type: 'card', player: p, color, t: 0 }; },
  point(dir) { if (this.ref && !(this.ref.task && this.ref.task.type === 'card')) this.ref.task = { type: 'point', dir, t: 0 }; },
  flag(x) { const a = this.ar.find(a => Math.sign(x || 1) === a.half) || this.ar[0]; if (a) a.gesture('flag', 2.2); },
  render(alpha, dt) {
    for (const o of this.all) {
      const r = o.rig.root;
      r.position.set(lerp(o.prev.x, o.pos.x, alpha), 0, lerp(o.prev.z, o.pos.z, alpha)); r.rotation.y = o.facing;
      if (dt > 0) o.rig.animate(dt, o);
    }
  },
};
