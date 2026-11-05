// ===== Controles tactiles para celular y tablet: joystick a la izquierda, botones a la derecha =====
// Los botones generan "teclas" virtuales (T_pass, T_shoot...) en Input, asi el resto del juego no cambia.
const Touch = {
  on: false, ax: 0, az: 0, mag: 0, stickId: null, cx: 0, cy: 0, R: 62, def: null,
  enabled() {
    if (CFG.touch === 'on') return true;
    if (CFG.touch === 'off') return false;
    return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
  },
  init() {
    const zone = $('tStickZone'), base = $('tStick'), knob = $('tKnob');
    const rest = () => { const r = zone.getBoundingClientRect(); this.cx = r.left + Math.min(110, r.width * 0.35); this.cy = r.bottom - Math.min(110, r.height * 0.4); place(); base.classList.remove('act'); };
    const place = () => { base.style.left = (this.cx - this.R) + 'px'; base.style.top = (this.cy - this.R) + 'px'; };
    const setKnob = (x, y) => {
      let dx = x - this.cx, dy = y - this.cy; const l = Math.hypot(dx, dy);
      if (l > this.R) { dx *= this.R / l; dy *= this.R / l; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      this.ax = dx / this.R; this.az = dy / this.R; this.mag = Math.min(1, Math.hypot(this.ax, this.az));
    };
    zone.addEventListener('pointerdown', e => {
      if (this.stickId != null) return;
      e.preventDefault(); AU.init();
      this.stickId = e.pointerId; try { zone.setPointerCapture(e.pointerId); } catch (err) { }
      this.cx = e.clientX; this.cy = e.clientY; place(); base.classList.add('act'); setKnob(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', e => { if (e.pointerId === this.stickId) { e.preventDefault(); setKnob(e.clientX, e.clientY); } });
    const end = e => { if (e.pointerId !== this.stickId) return; this.stickId = null; this.ax = this.az = this.mag = 0; knob.style.transform = ''; rest(); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    // botones de accion
    document.querySelectorAll('#touch .tb').forEach(b => {
      const code = 'T_' + b.dataset.a;
      const down = e => { e.preventDefault(); AU.init(); try { b.setPointerCapture(e.pointerId); } catch (err) { } b.classList.add('on'); if (!Input.down.has(code)) Input.pressed.add(code); Input.down.add(code); if (navigator.vibrate) navigator.vibrate(8); };
      const up = e => { b.classList.remove('on'); if (Input.down.has(code)) { Input.down.delete(code); Input.released.add(code); } };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      b.addEventListener('contextmenu', e => e.preventDefault());
    });
    $('tPause').addEventListener('click', () => { AU.ui(); togglePause(); });
    addEventListener('resize', () => { if (this.on) rest(); this.checkRotate(); });
    this._rest = rest;
  },
  show(v) {
    this.on = !!v && this.enabled();
    $('touch').classList.toggle('hidden', !this.on);
    document.body.classList.toggle('touchmode', this.on);
    if (this.on) requestAnimationFrame(() => this._rest && this._rest());
    this.checkRotate();
  },
  // en el celular parado se pide girarlo (el partido se pausa solo)
  checkRotate() {
    const need = this.on && G.mode === 'match' && innerHeight > innerWidth * 1.05;
    $('rotate').classList.toggle('hidden', !need);
    if (need && !G.paused) { G.paused = true; this.rotPaused = true; }
    else if (!need && this.rotPaused) { this.rotPaused = false; if ($('pause').classList.contains('hidden') && $('end').classList.contains('hidden') && $('subs').classList.contains('hidden') && $('help').classList.contains('hidden')) G.paused = false; }
  },
  // etiquetas segun la situacion: defendiendo, pase = entrada y tiro = barrida
  update() {
    if (!this.on || !G.human) return;
    const def = !!(G.owner && G.owner.team !== G.human.team && !G.ball.held);
    if (def === this.def) return;
    this.def = def;
    $('tbPass').firstChild.textContent = def ? 'ENTRADA' : 'PASE';
    $('tbShoot').firstChild.textContent = def ? 'BARRIDA' : 'TIRO';
    $('touch').classList.toggle('defending', def);
  },
  // pide pantalla completa y horizontal (anda en Android; en iPhone se ignora)
  fullscreen() {
    if (!this.enabled()) return;
    try {
      const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
      if (rq && !document.fullscreenElement) {
        const p = rq.call(el);
        const lock = () => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } };
        if (p && p.then) p.then(lock).catch(() => { }); else lock();
      }
    } catch (e) { }
  },
};
