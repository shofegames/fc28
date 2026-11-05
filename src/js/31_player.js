// ===== Jugador: movimiento, orientacion, energia y acciones =====
class Player {
  constructor(team, info, slot) {
    this.team = team; this.info = info; this.slot = slot;
    this.isGK = slot === 0; this.a = info.attrs;
    this.pos = new THREE.Vector3(); this.prev = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.facing = 0; this.turnRate = 0; this.accel = 0;
    this.want = { x: 0, z: 0 }; this.wantFace = null; this.sprint = false;
    this.vmax = 6.3 + this.a.pac / 100 * 2.5;
    this.stamina = 1; this.action = null; this.stun = 0;
    this.controlCd = 0; this.tackleCd = 0; this.touchCd = 0; this.buffer = null;
    this.phase = Math.random() * TAU;
    this.brain = { decide: Math.random() * 0.4, tk: 0, sup: null, supT: 0, run: 0, runT: rand(2, 6) };
    this.stats = { passes: 0, passOk: 0, shots: 0, goals: 0, tackles: 0, saves: 0 };
    const kit = this.isGK ? team.gkKit : team.kit;
    this.rig = new Rig(Object.assign({ gk: this.isGK }, info), kit, team.crestImg);
    G.scene.add(this.rig.root);
  }
  get name() { return this.info.last; }
  fwd() { return { x: Math.sin(this.facing), z: Math.cos(this.facing) }; }
  foot(d) { const f = this.fwd(); return { x: this.pos.x + f.x * d, z: this.pos.z + f.z * d }; }
  teleport(x, z, face) { this.pos.set(x, 0, z); this.prev.copy(this.pos); this.vel.set(0, 0, 0); if (face != null) this.facing = face; this.action = null; this.stun = 0; this.want.x = this.want.z = 0; this.celebrateWith = null; this.buffer = null; this.controlCd = 0; }
  speedCap() {
    const st = 0.72 + 0.28 * Math.min(1, this.stamina * 1.6);
    let v = this.sprint ? this.vmax * st : this.vmax * 0.66;
    if (G.owner === this) v *= this.sprint ? 0.9 : 0.94;
    return v;
  }
  update(h) {
    this.controlCd -= h; this.tackleCd -= h;
    let tx = this.want.x, tz = this.want.z;
    const ac = this.action;
    let free = false; // movimiento libre (barrida/estirada): sin aceleracion controlada
    if (this.stun > 0) { this.stun -= h; tx = 0; tz = 0; }
    if (ac) {
      ac.t += h;
      if (ac.type === 'kick' || ac.type === 'throw') { tx *= 0.35; tz *= 0.35; }
      else if (ac.type === 'header' || ac.type === 'tackle') { tx *= 0.5; tz *= 0.5; }
      else if (ac.type === 'slide' || ac.type === 'dive') { free = true; }
      else if (ac.type === 'fall') { tx = 0; tz = 0; }
      if (!ac.fired && ac.t >= ac.contact) { ac.fired = true; actionFire(this, ac); }
      if (ac.type === 'slide') slideCheck(this, ac);
      if (ac.t >= ac.dur) { this.action = null; if (ac.type === 'slide') this.stun = 0.35; if (ac.type === 'dive') this.stun = 0.45; }
    }
    if (free) {
      const k = ac.type === 'slide' ? (ac.t < 0.55 ? 1.1 : 4) : (ac.t < 0.45 ? 0.6 : 5);
      this.vel.x *= 1 - Math.min(1, k * h); this.vel.z *= 1 - Math.min(1, k * h);
    } else {
      const wl = Math.hypot(tx, tz), cap = this.speedCap();
      if (wl > cap) { tx *= cap / wl; tz *= cap / wl; }
      const sp0 = Math.hypot(this.vel.x, this.vel.z);
      const dvx = tx - this.vel.x, dvz = tz - this.vel.z, dl = Math.hypot(dvx, dvz);
      // acelerar cuesta mas que frenar; girar a toda velocidad cuesta un poco mas
      const speeding = wl > sp0;
      // el jugador que maneja el usuario responde mas rapido (como en los juegos de futbol)
      const hb = G.human && G.human.p === this ? 1.45 : 1;
      const maxA = (speeding ? 8.5 + this.a.pac / 100 * 5 : 17) * hb * h;
      if (dl > maxA) { this.vel.x += dvx / dl * maxA; this.vel.z += dvz / dl * maxA; } else { this.vel.x = tx; this.vel.z = tz; }
      this.accel = speeding && dl > maxA ? 1 : 0;
    }
    this.pos.x += this.vel.x * h; this.pos.z += this.vel.z * h;
    // orientacion del cuerpo
    const sp = Math.hypot(this.vel.x, this.vel.z), spPrev = this._sp || 0; this._sp = sp;
    this.accelV = damp(this.accelV || 0, (sp - spPrev) / h, 8, h);
    const moveDir = Math.atan2(this.vel.x, this.vel.z);
    let tf = this.facing;
    const busy = ac && (ac.type === 'slide' || ac.type === 'dive');
    if (this.wantFace != null && !busy && !(sp > 3.6 && Math.abs(angWrap(this.wantFace - moveDir)) > 1.6)) tf = this.wantFace; // no corre para atras mirando la pelota
    else if (sp > 1.0 && !(ac && ac.type === 'dive')) tf = moveDir;
    const human = G.human && G.human.p === this;
    const rate = (ac && ac.type === 'kick') ? 3 : human ? (sp < 3 ? 16 : 10) : sp < 2.5 ? 10 : 7;
    const df = angWrap(tf - this.facing), st = clamp(df, -rate * h, rate * h);
    this.facing = angWrap(this.facing + st); this.turnRate = damp(this.turnRate, st / h, 10, h);
    // la zancada es mas corta de costado y para atras
    const vf = sp > 0.05 ? Math.abs(Math.cos(moveDir - this.facing)) : 1;
    // energia
    // el cansancio va en tiempo de partido: con tiempos cortos se cansan mas rapido por segundo real
    const fk = G.match ? clamp(270 / G.match.halfLen, 0.4, 3) : 1;
    if (this.sprint && sp > 5) this.stamina = Math.max(0, this.stamina - h * 0.03 * fk * (1.45 - this.a.phy / 100));
    else if (sp > 3) this.stamina = Math.max(0, this.stamina - h * 0.0035 * fk);
    else this.stamina = Math.min(1, this.stamina + h * (sp < 2 ? 0.0022 : 0.0006) * fk);
    // fase de la carrera: avanza con la distancia recorrida (los pies no patinan)
    this.phase += sp * h / ((1.0 + sp * 0.17) * (0.55 + 0.45 * vf)) * TAU;
  }
}
