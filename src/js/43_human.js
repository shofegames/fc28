// ===== Jugador humano: control, carga de potencia, cambio de jugador inteligente, indicador =====
const ACTION_LABEL = { pass: 'PASE', through: 'PASE FILTRADO', shoot: 'DISPARO', lob: 'CENTRO / PASE LARGO' };
class Human {
  constructor(team) {
    this.team = team; this.p = null; this.charge = null; this.switchCd = 0; this.lastSwitch = 0;
    // indicador: aro en el piso + flecha arriba de la cabeza
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe94d, transparent: true, opacity: 0.9, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.64, 32), mat); this.ring.rotation.x = -Math.PI / 2; this.ring.renderOrder = 2;
    const arrowGeo = new THREE.ConeGeometry(0.22, 0.38, 3); arrowGeo.rotateX(Math.PI);
    this.arrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0xffe94d }));
    this.dir = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 3), mat); this.dir.rotation.x = Math.PI / 2;
    this.dirG = new THREE.Group(); this.dirG.add(this.dir); this.dir.position.z = 0.95;
    G.scene.add(this.ring); G.scene.add(this.arrow); G.scene.add(this.dirG);
  }
  dispose() { for (const m of [this.ring, this.arrow, this.dirG]) G.scene.remove(m); }
  select(p) {
    if (!p || p === this.p || p.isGK) return;
    if (this.p) this.p.want.x = this.p.want.z = 0;
    this.p = p; this.lastSwitch = G.time; this.charge = null; Hud.player(p);
  }
  // el mejor jugador para tomar: defendiendo, el mas cerca y del lado del arco; si no, el mas cercano a la pelota
  bestCandidate(excludeCurrent) {
    const b = G.ball, gx = this.team.ownGoalX, poss = possTeam();
    const it = b.trajN ? { x: b.traj[Math.min(b.trajN - 1, 15) * 4], z: b.traj[Math.min(b.trajN - 1, 15) * 4 + 2] } : { x: b.px, z: b.pz };
    let best = null, bs = 1e9;
    for (const m of this.team.players) {
      if (m.isGK || (excludeCurrent && m === this.p)) continue;
      let s = Math.hypot(m.pos.x - it.x, m.pos.z - it.z);
      if (poss && poss !== this.team) { const goalSide = (m.pos.x - b.px) * Math.sign(gx) > 0; if (goalSide) s -= 4; }
      if (s < bs) { bs = s; best = m; }
    }
    return best;
  }
  onPossession(p, prev) {
    if (p.team === this.team) { if (p !== this.p && !p.isGK) this.select(p); }
    else if (this.p && Math.hypot(this.p.pos.x - G.ball.px, this.p.pos.z - G.ball.pz) > 14) {
      const c = this.bestCandidate(false); if (c) this.select(c);
    }
  }
  onKick(p, r, kind) {
    if (p.team !== this.team) return;
    if (r.receiver && !r.receiver.isGK && kind !== 'shot') this.select(r.receiver);
  }
  update(h) {
    const p = this.p, m = G.match;
    if (!p) { this.select(this.bestCandidate(false)); return; }
    if (m.state !== 'play' && m.state !== 'restart') { p.want.x = p.want.z = 0; this.charge = null; Hud.power(null); return; }
    const mv = Input.move();
    const r = m.restart;
    // saque de nuestro equipo: controlamos al que saca cuando esta listo
    if (r && r.team === this.team) {
      if (r.taker && r.taker !== p && !r.taker.isGK) this.select(r.taker);
      if (r.taker === this.p && r.ready) { this.takeRestart(r, mv, h); return; }
      if (r.taker === this.p) return; // camina a la pelota solo
    }
    if (r && r.kickoff) { p.want.x = p.want.z = 0; return; }
    const b = G.ball;
    // cambio de jugador
    this.switchCd -= h;
    if (Input.hit('switch') && this.switchCd <= 0) { const c = this.bestCandidate(true); if (c) this.select(c); this.switchCd = 0.2; return; }
    // movimiento
    const sprint = Input.btn('sprint');
    p.sprint = sprint && mv.l > 0.1;
    const sp = p.sprint ? p.vmax : p.vmax * 0.66 * Math.max(0.35, mv.l);
    p.wantFace = null;
    if (mv.l > 0.1) { p.want.x = mv.x / Math.max(mv.l, 0.01) * sp * Math.min(1, mv.l * 1.2); p.want.z = mv.z / Math.max(mv.l, 0.01) * sp * Math.min(1, mv.l * 1.2); }
    else {
      // sin tocar nada: si le viene un pase, va a buscarlo; si no, se queda mirando la pelota
      const pi = G.passInfo;
      if (!G.owner && pi && pi.to === p && G.time - pi.t < 4) chase(p, false);
      else { p.want.x = 0; p.want.z = 0; if (G.owner !== p) faceBall(p); }
    }
    const mine = G.owner === p;
    // acciones con carga de potencia
    for (const a of ['pass', 'through', 'shoot', 'lob']) {
      if (Input.hit(a) && !this.charge) this.charge = { a, t0: G.time };
    }
    if (this.charge) {
      const pw = clamp((G.time - this.charge.t0) / 0.85, 0, 1);
      Hud.power(pw, ACTION_LABEL[this.charge.a]);
      if (Input.up(this.charge.a) || pw >= 1 && this.charge.a !== 'pass') {
        this.fire(this.charge.a, Math.max(0.08, pw), mv);
        this.charge = null; Hud.power(null);
      }
    }
    // defensa
    if (!mine) {
      if (Input.hit('tackle')) startTackle(p);
      if (Input.hit('action')) startSlide(p);
    } else if (Input.hit('action')) startKick(p, 'knock', {});
  }
  fire(a, power, mv) {
    const p = this.p, b = G.ball;
    const dir = mv.l > 0.1 ? { x: mv.x, z: mv.z } : null;
    const gx = this.team.oppGoalX, goalD = Math.hypot(gx - p.pos.x, p.pos.z);
    let kind = a === 'pass' ? 'pass' : a === 'through' ? 'through' : a === 'lob' ? 'lob' : 'shot';
    let opts = { dir, power };
    if (a === 'lob') {
      if (goalD < 24 && Math.abs(p.pos.z) < 16) { kind = 'chip'; opts.chip = true; }
      else if (Math.abs(p.pos.x - gx) < 30 && Math.abs(p.pos.z) > 15) kind = 'cross';
    }
    const fp = p.foot(0.45), near = Math.hypot(b.px - fp.x, b.pz - fp.z) < 1.3 && b.py < 1.0;
    if (G.owner === p || near) { startKick(p, kind, opts); return; }
    // pelota en el aire cerca: cabezazo
    const hd = Math.hypot(b.px - p.pos.x, b.pz - p.pos.z);
    if (b.py > 1.1 && b.py < 2.8 && hd < 2.2) {
      startKick(p, 'header', { attack: kind === 'shot' || goalD < 18, dir });
      if (p.action) { p.action.contact = clamp(hd / 7, 0.08, 0.25); p.action.jump = clamp((b.py - 1.6) / 0.8, 0.3, 1.2); }
      return;
    }
    // si no tiene la pelota: queda guardado para pegarle de primera cuando llegue
    p.buffer = { kind, opts, until: G.time + 1.0 };
  }
  takeRestart(r, mv, h) {
    const p = this.p;
    p.want.x = p.want.z = 0;
    // apuntar con las flechas/WASD
    if (mv.l > 0.2) r.aim = Math.atan2(mv.x, mv.z);
    p.wantFace = r.aim != null ? r.aim : p.facing;
    for (const a of ['pass', 'through', 'shoot', 'lob']) if (Input.hit(a) && !this.charge) this.charge = { a, t0: G.time };
    if (this.charge) {
      const pw = clamp((G.time - this.charge.t0) / 0.85, 0, 1);
      Hud.power(pw, ACTION_LABEL[this.charge.a]);
      if (Input.up(this.charge.a) || pw >= 1 && this.charge.a !== 'pass') {
        const a = this.charge.a; this.charge = null; Hud.power(null);
        const f = p.fwd(); const dir = { x: f.x, z: f.z };
        if (r.type === 'throw') { if (a !== 'shoot') startKick(p, 'throw', { dir, power: a === 'lob' ? Math.max(0.6, pw) : pw }); }
        else if (a === 'shoot' && r.type !== 'corner') startKick(p, 'shot', { dir: mv.l > 0.1 ? { x: mv.x, z: mv.z } : null, power: Math.max(0.1, pw) });
        else if (r.kickoff && a === 'pass' && mv.l < 0.2) startKick(p, 'pass', { receiver: r.mate, power: 0.3 });
        else startKick(p, a === 'lob' ? (r.type === 'corner' ? 'cross' : 'lob') : a === 'through' ? 'through' : 'pass', { dir, power: Math.max(0.15, pw) });
      }
    }
  }
  render(alpha) {
    const p = this.p;
    const vis = !!p && G.match && (G.match.state === 'play' || G.match.state === 'restart');
    this.ring.visible = this.arrow.visible = this.dirG.visible = vis;
    if (!vis) return;
    const x = lerp(p.prev.x, p.pos.x, alpha), z = lerp(p.prev.z, p.pos.z, alpha);
    this.ring.position.set(x, 0.03, z);
    this.arrow.position.set(x, 2.35 * p.info.height / 1.86 + Math.sin(G.time * 5) * 0.06, z);
    this.dirG.position.set(x, 0.03, z); this.dirG.rotation.y = p.facing;
  }
}
