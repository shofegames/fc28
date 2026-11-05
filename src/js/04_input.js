// ===== Teclado y joystick =====
const Input = {
  down: new Set(), pressed: new Set(), released: new Set(), pad: null, padPrev: {}, rebinding: null,
  init() {
    addEventListener('keydown', e => {
      if (this.rebinding) { e.preventDefault(); this.rebinding(e.code); return; }
      if (G.mode === 'match' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (typeof onKeyUI === 'function') onKeyUI(e);
    });
    addEventListener('keyup', e => { this.down.delete(e.code); this.released.add(e.code); });
    addEventListener('blur', () => { this.down.forEach(c => this.released.add(c)); this.down.clear(); });
  },
  // nombre de accion -> codigos de tecla y boton del joystick
  btn(name) {
    const k = CFG.keys[name];
    if (this.down.has(k)) return true;
    if (name === 'sprint' && this.down.has('ShiftRight')) return true;
    return !!(this.pad && this.pad[name]);
  },
  hit(name) {
    const k = CFG.keys[name];
    return this.pressed.has(k) || (name === 'sprint' && this.pressed.has('ShiftRight')) || !!(this.pad && this.pad[name] && !this.padPrev[name]);
  },
  up(name) {
    const k = CFG.keys[name];
    return this.released.has(k) || !!(this.pad && !this.pad[name] && this.padPrev[name]);
  },
  // direccion de movimiento en coordenadas de la cancha (la camara mira hacia -z)
  move() {
    let x = 0, z = 0;
    if (this.btn('left') || this.down.has('ArrowLeft')) x -= 1;
    if (this.btn('right') || this.down.has('ArrowRight')) x += 1;
    if (this.btn('up') || this.down.has('ArrowUp')) z -= 1;
    if (this.btn('down') || this.down.has('ArrowDown')) z += 1;
    if (this.pad && Math.hypot(this.pad.ax, this.pad.az) > 0.22) { x = this.pad.ax; z = this.pad.az; }
    const l = Math.hypot(x, z);
    if (l > 1) { x /= l; z /= l; }
    return { x, z, l: Math.min(1, l) };
  },
  poll() {
    this.padPrev = this.pad ? Object.assign({}, this.pad) : {};
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null; for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) { this.pad = null; return; }
    const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    this.pad = { ax: gp.axes[0] || 0, az: gp.axes[1] || 0, pass: b(0), shoot: b(1), through: b(2), lob: b(3), switch: b(4), tackle: b(5), sprint: b(7) || b(6), action: b(10) || b(11), pause: b(9) };
    if (this.pad.pause && !this.padPrev.pause && typeof togglePause === 'function') togglePause();
  },
  endStep() { this.pressed.clear(); this.released.clear(); },
};
const keyLabel = code => {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return ({ Space: 'ESPACIO', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT DER', ControlLeft: 'CTRL', AltLeft: 'ALT', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'ENTER', Tab: 'TAB' })[code] || code;
};
