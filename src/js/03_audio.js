// ===== Sonido (todo sintetizado con WebAudio, sin archivos) =====
const AU = {
  ctx: null, master: null, crowdG: null, crowdF: null, roarG: null, excite: 0, base: 0.16, muted: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = CFG.volume; this.master.connect(ctx.destination);
    // ruido marron para el murmullo del publico
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    this.crowdF = ctx.createBiquadFilter(); this.crowdF.type = 'bandpass'; this.crowdF.frequency.value = 520; this.crowdF.Q.value = 0.45;
    this.crowdG = ctx.createGain(); this.crowdG.gain.value = 0;
    src.connect(this.crowdF); this.crowdF.connect(this.crowdG); this.crowdG.connect(this.master); src.start();
    // capa "griterio" para goles y llegadas
    const src2 = ctx.createBufferSource(); src2.buffer = buf; src2.loop = true; src2.playbackRate.value = 1.7;
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 1100; hp.Q.value = 0.6;
    this.roarG = ctx.createGain(); this.roarG.gain.value = 0;
    src2.connect(hp); hp.connect(this.roarG); this.roarG.connect(this.master); src2.start(0, 1.3);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    if (this._rainWanted) this.rain(true);
  },
  // lluvia: ruido blanco filtrado en loop
  rain(on) {
    const ctx = this.ctx; if (!ctx) { this._rainWanted = on; return; }
    if (!this.rainG) {
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
      this.rainG = ctx.createGain(); this.rainG.gain.value = 0;
      s.connect(hp); hp.connect(lp); lp.connect(this.rainG); this.rainG.connect(this.master); s.start();
    }
    this.rainG.gain.setTargetAtTime(on ? 0.075 : 0, ctx.currentTime, 0.6);
  },
  // silbidos del publico (falta del visitante, perdida de tiempo)
  boo() { for (let i = 0; i < 4; i++) setTimeout(() => this.noise(1.1 + Math.random() * 0.5, 2500 + Math.random() * 900, 7, 0.045), i * 90); },
  // bombo de la barra y cantos (el griterio sube y baja al ritmo) mientras se juega
  drums(dt) {
    const m = G.match; if (!m || G.mode !== 'match' || m.training || m.state !== 'play') { this.drumT = 0; return; }
    this.drumT = (this.drumT || 0) + dt;
    const cyc = this.drumT % 18; if (cyc > 10) return; // 10 s de cantos, 8 de murmullo
    const beat = Math.floor(cyc / 0.25);
    if (beat !== this.lastBeat) {
      this.lastBeat = beat;
      const pat = [1, 0, 0, 1, 1, 0, 1, 0];
      if (pat[beat % 8]) { this.tone(60, 0.24, 0.09, 'sine', 38); this.noise(0.06, 180, 1.2, 0.05, 'lowpass'); }
      if (beat % 4 === 0 && this.roarG) this.roarG.gain.setTargetAtTime(0.05 + this.excite * 0.5, this.ctx.currentTime, 0.12);
    }
  },
  setVolume(v) { CFG.volume = v; if (this.master) this.master.gain.value = v; },
  update(dt, danger) {
    if (!this.ctx) return;
    this.excite = Math.max(0, this.excite - dt * 0.18);
    const t = this.ctx.currentTime;
    const g = (G.mode === 'menu' ? 0.07 : this.base) + danger * 0.1 + this.excite * 0.35;
    this.crowdG.gain.setTargetAtTime(g, t, 0.25);
    this.roarG.gain.setTargetAtTime(this.excite * 0.5 + danger * 0.05, t, 0.2);
    this.crowdF.frequency.setTargetAtTime(480 + danger * 200 + this.excite * 500, t, 0.3);
    this.drums(dt);
  },
  cheer(k) { this.excite = Math.min(1, Math.max(this.excite, k)); },
  noise(dur, freq, q, vol, type) {
    const ctx = this.ctx; if (!ctx) return;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.02);
  },
  tone(freq, dur, vol, type, freqEnd, delay) {
    const ctx = this.ctx; if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain(); const t = ctx.currentTime + (delay || 0);
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  kick(power) { const v = 0.12 + power * 0.45; this.tone(140, 0.12, v, 'sine', 45); this.noise(0.05, 1500, 0.8, v * 0.6); },
  touch() { this.tone(170, 0.05, 0.05, 'sine', 90); },
  post() { this.tone(880, 0.6, 0.18, 'triangle'); this.tone(1320, 0.4, 0.08, 'sine'); this.tone(2210, 0.25, 0.05, 'sine'); },
  net() { this.noise(0.35, 2400, 0.7, 0.2, 'bandpass'); },
  bounce(v) { this.tone(120, 0.08, Math.min(0.12, v * 0.015), 'sine', 60); },
  ui() { this.tone(900, 0.06, 0.06, 'sine', 1300); },
  uiBack() { this.tone(700, 0.07, 0.05, 'sine', 450); },
  whistle(n, long) {
    const ctx = this.ctx; if (!ctx) return;
    for (let i = 0; i < (n || 1); i++) {
      const t = ctx.currentTime + i * 0.42, dur = long ? 0.75 : 0.28;
      const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 2950; lfo.frequency.value = 34; lg.gain.value = 140;
      lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.02); g.gain.setValueAtTime(0.16, t + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    }
  },
};
