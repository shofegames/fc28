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
  dispose() {
    for (const m of [this.ring, this.arrow, this.dirG]) G.scene.remove(m);
    for (const m of [this.ring, this.arrow, this.dir]) { m.geometry.dispose(); m.material.dispose(); } // (el material del anillo y la flecha de direccion es el mismo: dispose dos veces no hace nada)
  }
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
    // cambio automatico: con la pelota suelta o en el aire (pelotazo, despeje, rebote, pase del rival), el control pasa
    // al compañero que llega primero a donde va a caer (el destinatario del pase tiene prioridad salvo que otro llegue mucho antes)
    this.autoT = (this.autoT || 0) - h; this.autoChase = false;
    if (!G.owner && !b.held && m.state === 'play' && b.speed > 2.5) {
      if (this.autoT <= 0) {
        this.autoT = 0.12;
        let best = null, bt = 1e9, mine = 1e9;
        for (const q of this.team.players) {
          if (q.isGK || q.stun > 0) continue;
          const it = interceptFor(q, true), t = it.t + Math.hypot(it.x - q.pos.x, it.z - q.pos.z) * 0.015;
          if (q === p) mine = t;
          if (t < bt) { bt = t; best = q; }
        }
        const pi = G.passInfo, toMe = pi && pi.to === p && pi.from.team === this.team;
        if (best && best !== p && mine - bt > (toMe ? 0.6 : 0.25) && G.time - this.lastSwitch > 0.35) { this.select(best); this.autoSel = best; return; }
        this.autoSel = best === p ? p : null;
      }
      this.autoChase = this.autoSel === p;
    }
    // cambio de jugador
    this.switchCd -= h;
    if (Input.hit('switch') && this.switchCd <= 0) { const c = this.bestCandidate(true); if (c) this.select(c); this.switchCd = 0.2; return; }
    // movimiento
    const sprint = Input.btn('sprint');
    p.sprint = sprint && mv.l > 0.1;
    const sp = p.sprint ? p.vmax : p.vmax * 0.66 * Math.max(0.35, mv.l);
    p.wantFace = null;
    const pi = G.passInfo, loose = !G.owner && !b.held;
    const goesForIt = loose && ((pi && pi.to === p && G.time - pi.t < 4) || this.autoChase);
    if (mv.l > 0.1) {
      let ux = mv.x / Math.max(mv.l, 0.01), uz = mv.z / Math.max(mv.l, 0.01);
      // ayuda: si apunta mas o menos hacia la pelota suelta (o la que le llega), el jugador va derecho a donde la puede agarrar
      if (loose && (goesForIt || Math.hypot(b.px - p.pos.x, b.pz - p.pos.z) < 7)) {
        const it = interceptFor(p, true), ix = it.x - p.pos.x, iz = it.z - p.pos.z, il = Math.hypot(ix, iz);
        if (il > 0.3 && (ux * ix + uz * iz) / il > 0.6) { ux = ix / il; uz = iz / il; }
      }
      p.want.x = ux * sp * Math.min(1, mv.l * 1.2); p.want.z = uz * sp * Math.min(1, mv.l * 1.2);
    }
    else {
      // sin tocar nada: si le viene un pase o es el que llega primero a la pelota suelta, va a buscarla solo
      if (goesForIt) chase(p, (this.autoChase && !(pi && pi.to === p)) || nearestOpp(p).d < 4); // con un rival cerca, pica a buscarla
      else { p.want.x = 0; p.want.z = 0; if (G.owner !== p) faceBall(p); }
    }
    const mine = G.owner === p;
    const defending = G.owner && G.owner.team !== this.team && !G.ball.held;
    // defendiendo (como en los juegos de futbol de celular): PASE cambia de jugador, FILTRADO presiona y quita, TIRO barrida
    p.jockey = false;
    if (defending) {
      this.charge = null; Hud.power(null);
      p.jockey = Math.hypot(G.owner.pos.x - p.pos.x, G.owner.pos.z - p.pos.z) < 5;
      if (Input.hit('pass') && this.switchCd <= 0) { const c = this.bestCandidate(true); if (c) this.select(c); this.switchCd = 0.2; return; }
      if (Input.btn('through')) {
        const o = G.owner, d = Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z);
        if (mv.l < 0.1) moveTo(p, o.pos.x + o.vel.x * 0.25, o.pos.z + o.vel.z * 0.25, 'sprint', false); // va solo a buscarlo
        else p.sprint = true;
        p.wantFace = Math.atan2(o.pos.x - p.pos.x, o.pos.z - p.pos.z);
        if (d < 1.7 && p.tackleCd <= 0 && !p.action) startTackle(p);
      }
      if (Input.hit('tackle')) startTackle(p);
      if (Input.hit('shoot') || Input.hit('action')) startSlide(p);
      return;
    }
    // PASE sale al toque, sin cargar. Filtrado, centro y tiro se cargan manteniendo apretado
    if (Input.hit('pass') && !this.charge) this.fire('pass', 0.5, mv);
    for (const a of ['through', 'shoot', 'lob']) {
      if (Input.hit(a) && !this.charge) this.charge = { a, t0: G.time };
    }
    if (this.charge) {
      const pw = clamp((G.time - this.charge.t0) / 0.85, 0, 1);
      Hud.power(pw, ACTION_LABEL[this.charge.a]);
      if (Input.up(this.charge.a) || pw >= 1) {
        this.fire(this.charge.a, Math.max(0.08, pw), mv);
        this.charge = null; Hud.power(null);
      }
    }
    if (!mine && Input.hit('tackle')) startTackle(p);
    if (mine && Input.hit('action')) startKick(p, 'knock', {});
    else if (!mine && Input.hit('action')) startSlide(p);
  }
  fire(a, power, mv) {
    const p = this.p, b = G.ball;
    const dir = mv.l > 0.1 ? { x: mv.x, z: mv.z } : null;
    const gx = this.team.oppGoalX, goalD = Math.hypot(gx - p.pos.x, p.pos.z);
    let kind = a === 'pass' ? 'pass' : a === 'through' ? 'through' : a === 'lob' ? 'lob' : 'shot';
    let opts = { dir, power };
    const wide = Math.abs(p.pos.x - gx) < 32 && Math.abs(p.pos.z) > 15;
    if (a === 'lob') {
      if (goalD < 24 && Math.abs(p.pos.z) < 16) { kind = 'chip'; opts.chip = true; }
      else if (wide) kind = 'cross';
    }
    // filtrado desde la banda en el ultimo tercio = centro (asi alcanzan 3 botones)
    if (a === 'through' && wide) kind = 'cross';
    const fp = p.foot(0.45), near = Math.hypot(b.px - fp.x, b.pz - fp.z) < 1.3 && b.py < 1.0;
    if (G.owner === p || near) { startKick(p, kind, opts); return; }
    // pelota en el aire cerca: cabezazo
    const hd = Math.hypot(b.px - p.pos.x, b.pz - p.pos.z);
    if (b.py > 1.1 && b.py < 2.8 && hd < 2.2) {
      startKick(p, 'header', { attack: kind === 'shot' || goalD < 18, dir });
      if (p.action) { p.action.contact = clamp(hd / 7, 0.08, 0.25); p.action.jump = clamp((b.py - 1.6) / 0.8, 0.3, 1.2); }
      return;
    }
    // de primera: solo si la pelota ya viene hacia el jugador y esta cerca (asi no sale sola despues)
    const bs = Math.hypot(b.vx, b.vz), toMe = ((p.pos.x - b.px) * b.vx + (p.pos.z - b.pz) * b.vz) / (bs || 1);
    if (hd < 7 && bs > 2 && toMe > 0) { p.buffer = { kind, opts, until: G.time + 0.6 }; return; }
    // pelota suelta lejos: PASE cambia al jugador mas cercano
    if (a === 'pass' && !G.owner) { const c = this.bestCandidate(true); if (c && c !== p) this.select(c); }
  }  takeRestart(r, mv, h) {
    const p = this.p;
    p.want.x = p.want.z = 0;
    // apuntar con las flechas/WASD
    if (mv.l > 0.2) r.aim = Math.atan2(mv.x, mv.z);
    p.wantFace = r.aim != null ? r.aim : p.facing;
    if (Input.hit('pass') && !this.charge) this.charge = { a: 'pass', t0: G.time - 0.35, quick: true };
    for (const a of ['through', 'shoot', 'lob']) if (Input.hit(a) && !this.charge) this.charge = { a, t0: G.time };
    if (this.charge) {
      const pw = clamp((G.time - this.charge.t0) / 0.85, 0, 1);
      Hud.power(pw, ACTION_LABEL[this.charge.a]);
      if (this.charge.quick || Input.up(this.charge.a) || pw >= 1) {
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
