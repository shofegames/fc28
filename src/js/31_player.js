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
    if (this.want.x === 0 && this.want.z === 0 && this.calm === undefined) this.calm = true;
    let tx = this.want.x, tz = this.want.z;
    const ac = this.action;
    let free = false; // movimiento libre (barrida/estirada): sin aceleracion controlada
    if (this.stun > 0) { this.stun -= h; tx = 0; tz = 0; }
    if (ac) {
      ac.t += h;
      if (ac.type === 'kick' || ac.type === 'throw' || ac.type === 'gkthrow' || ac.type === 'gkvolley') { tx *= 0.35; tz *= 0.35; }
      else if (ac.type === 'header' || ac.type === 'tackle') { tx *= 0.5; tz *= 0.5; }
      else if (ac.type === 'slide' || ac.type === 'dive') { free = true; }
      else if (ac.type === 'fall' || ac.type === 'getup' || ac.type === 'frustrate' || ac.type === 'protest') { tx = ac.type === 'frustrate' ? tx * 0.3 : 0; tz = ac.type === 'frustrate' ? tz * 0.3 : 0; }
      if (!ac.fired && ac.t >= ac.contact) { ac.fired = true; actionFire(this, ac); }
      if (ac.type === 'slide') slideCheck(this, ac);
      if (ac.t >= ac.dur) { this.action = null; if (ac.type === 'slide') { this.stun = 0.5; this.action = { type: 'getup', t: 0, dur: 0.5, contact: 9, fired: true }; } if (ac.type === 'dive') this.stun = 0.45; }
    }
    if (free) {
      const k = ac.type === 'slide' ? (ac.t < 0.55 ? 1.1 : 4) : (ac.t < 0.45 ? 0.6 : 5);
      this.vel.x *= 1 - Math.min(1, k * h); this.vel.z *= 1 - Math.min(1, k * h);
    } else {
      const wl = Math.hypot(tx, tz), cap = this.speedCap();
      if (wl > cap) { tx *= cap / wl; tz *= cap / wl; }
      // Movimiento con fisica de jugador real:
      //  - arranque explosivo que se va apagando cerca de la velocidad maxima
      //  - frenada fuerte
      //  - giro limitado por la velocidad (a toda carrera se abre; si el cambio es muy grande, primero frena y despues sale)
      const human = G.human && G.human.p === this, hb = human ? 1.22 : 1;
      const pac = this.a.pac / 100, vx = this.vel.x, vz = this.vel.z, sp0 = Math.hypot(vx, vz);
      const tired = 0.8 + 0.2 * Math.min(1, this.stamina * 1.5); // cansado: arranca mas lento
      const aFwd = ((4.6 + 3 * pac) * (1 - 0.72 * clamp(sp0 / this.vmax, 0, 1)) + 0.8) * hb * tired * (this.calm && !human ? 0.7 : 1);
      // reubicandose tranquilo (calm) frena y arranca suave; persiguiendo o con el usuario, a fondo
      const calm = this.calm && !human, aBrake = (calm ? 5.5 : 10.5) * hb, aLat = Math.max(4.6, 11 - 0.8 * sp0) * hb * (G.owner === this ? 0.92 : 1) * (calm ? 0.8 : 1);
      if (sp0 < 0.8) {
        const dvx = tx - vx, dvz = tz - vz, dl = Math.hypot(dvx, dvz), m = (wl > sp0 ? aFwd : aBrake) * h;
        if (dl > m) { this.vel.x += dvx / dl * m; this.vel.z += dvz / dl * m; } else { this.vel.x = tx; this.vel.z = tz; }
      } else {
        const ux = vx / sp0, uz = vz / sp0, nx = -uz, nz = ux;
        let tLong = tx * ux + tz * uz, tLat = tx * nx + tz * nz;
        // cambio de direccion muy grande: clava los pies y frena antes de salir para el otro lado
        if (wl > 0.5 && tLong / wl < -0.42) { tLong = 0; tLat = 0; }
        const dLong = clamp(tLong - sp0, -aBrake * h, aFwd * h), dLat = clamp(tLat, -aLat * h, aLat * h);
        const ns = Math.max(0, sp0 + dLong);
        this.vel.x = ux * ns + nx * dLat; this.vel.z = uz * ns + nz * dLat;
      }
      this.accel = Math.hypot(this.vel.x, this.vel.z) > sp0 + 0.01 ? 1 : 0;
    }
    this.pos.x += this.vel.x * h; this.pos.z += this.vel.z * h;
    // orientacion del cuerpo: mira hacia donde corre; solo de a poco (o retrocediendo despacio) mira a la pelota
    const sp = Math.hypot(this.vel.x, this.vel.z), spPrev = this._sp || 0; this._sp = sp;
    this.accelV = damp(this.accelV || 0, (sp - spPrev) / h, 8, h);
    // aceleracion lateral (para inclinarse en las curvas)
    if (sp > 0.8 && this._vx != null) { const ax = (this.vel.x - this._vx) / h, az = (this.vel.z - this._vz) / h; this.latA = damp(this.latA || 0, (ax * this.vel.z - az * this.vel.x) / sp, 10, h); } else this.latA = damp(this.latA || 0, 0, 6, h);
    this._vx = this.vel.x; this._vz = this.vel.z;
    const moveDir = Math.atan2(this.vel.x, this.vel.z);
    let tf = this.facing;
    const busy = ac && (ac.type === 'slide' || ac.type === 'dive');
    if (this.wantFace != null && !busy && (sp < 3.2 || Math.abs(angWrap(this.wantFace - moveDir)) < 1.2)) tf = this.wantFace;
    else if (sp > 0.8 && !(ac && ac.type === 'dive')) tf = moveDir;
    // al patear, el cuerpo se acomoda hacia donde va la pelota
    if (ac && ac.face != null && !ac.fired) tf = ac.face;
    const human2 = G.human && G.human.p === this;
    const rate = ac && ac.face != null && !ac.fired ? 13 : (ac && ac.type === 'kick') ? 3 : human2 ? (sp < 3 ? 14 : 9) : sp < 2.5 ? 9 : 6;
    const df = angWrap(tf - this.facing), st = clamp(df, -rate * h, rate * h);
    this.facing = angWrap(this.facing + st); this.turnRate = damp(this.turnRate, st / h, 10, h);
    // la zancada es mas corta de costado y para atras
    const vf = sp > 0.05 ? Math.abs(Math.cos(moveDir - this.facing)) : 1;    // energia
    // el cansancio va en tiempo de partido: con tiempos cortos se cansan mas rapido por segundo real
    const fk = G.match ? clamp(270 / G.match.halfLen, 0.4, 3) : 1;
    if (this.sprint && sp > 5) this.stamina = Math.max(0, this.stamina - h * 0.03 * fk * (1.45 - this.a.phy / 100));
    else if (sp > 3) this.stamina = Math.max(0, this.stamina - h * 0.0035 * fk);
    else this.stamina = Math.min(1, this.stamina + h * (sp < 2 ? 0.0022 : 0.0006) * fk);
    // fase de la carrera: avanza con la distancia recorrida (los pies no patinan)
    this.phase += sp * h / (gaitLen(sp) * (0.55 + 0.45 * vf)) * TAU;
  }
}
