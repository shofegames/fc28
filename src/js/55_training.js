// ===== Entrenamiento: practicas sin rival (solo el arquero) para aprender los controles =====
const DRILLS = {
  libre: { name: 'PRÁCTICA LIBRE', icon: '⚽', desc: 'Tu equipo contra el arquero. Probá todos los controles sin presión.' },
  disparos: { name: 'DISPAROS', icon: '🎯', desc: 'Arrancás con la pelota cerca del área. Definí contra el arquero.' },
  penales: { name: 'PENALES', icon: '🥅', desc: 'Apuntá con la dirección y mantené TIRO para cargar la fuerza.' },
  tiroslibres: { name: 'TIROS LIBRES', icon: '🧱', desc: 'Con barrera, desde distintos lugares. Un tiro suave sale con efecto.' },
  centros: { name: 'CENTROS', icon: '↗', desc: 'Desde la banda, tirá el centro con CENTRO para que cabeceen tus delanteros.' },
  pases: { name: 'PASES', icon: '🔁', desc: 'Hacé circular la pelota. Contamos los pases seguidos sin que se pierda.' },
};
const Training = {
  drill: null, goals: 0, tries: 0, streak: 0, best: 0, shotOpen: 0, waitT: 0, lastOk: 0,
  start(drill) {
    this.drill = drill; this.goals = this.tries = this.streak = this.best = 0;
    $('trainBox').classList.remove('hidden'); $('sb').classList.add('hidden');
    this.reset(); this.hud();
    Hud.msg(DRILLS[drill].name, DRILLS[drill].desc); setTimeout(() => { if (G.match && G.match.training && G.match.state !== 'goal') Hud.msg(null); }, 2600);
  },
  reset() {
    const m = G.match, T = G.teams[0], O = G.teams[1], b = G.ball, gx = T.oppGoalX, sg = Math.sign(gx);
    m.restart = null; m.offside = null; m.indirect = null; G.owner = null; G.passInfo = null; G.lastTouch = null;
    this.shotOpen = 0; this.waitT = 0; this.lastOk = T.stats.passOk;
    // compañeros en posicion de ataque
    for (const p of T.players) {
      const s = T.form[p.slot];
      if (p.isGK) { p.teleport(-sg * (PITCH.HL - 2), 0, sg > 0 ? Math.PI / 2 : -Math.PI / 2); continue; }
      const x = clamp((s.x + 0.3) * 36 + 10, -30, 40) * sg, z = s.z * 27;
      p.teleport(x, z, sg > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    for (const p of O.players) { if (p.isGK) p.teleport(gx - sg * 0.6, 0, sg > 0 ? -Math.PI / 2 : Math.PI / 2); else p.teleport(gx - sg * 20, (p.slot - 5) * 3, 0); }
    const fw = T.players.filter(p => T.form[p.slot].role === 'FW')[0] || T.players[T.players.length - 1];
    const playWith = (p, x, z) => { p.teleport(x - sg * 0.55, z, sg > 0 ? Math.PI / 2 : -Math.PI / 2); b.place(x, z); m.state = 'play'; m.inPlay = true; G.owner = p; G.lastTouch = p; G.human.select(p); };
    const d = this.drill;
    if (d === 'libre' || d === 'pases') playWith(fw, sg * 8, 0);
    else if (d === 'disparos') { const x = gx - sg * rand(15, 25), z = rand(-13, 13); playWith(fw, x, z); }
    else if (d === 'centros') {
      const wing = T.players.filter(p => !p.isGK).sort((a, b) => Math.abs(b.pos.z) - Math.abs(a.pos.z))[0];
      const side = Math.random() < 0.5 ? -1 : 1;
      for (const p of T.players) if (T.form[p.slot].role === 'FW' && p !== wing) p.teleport(gx - sg * rand(11, 15), rand(-5, 5), 0);
      playWith(wing, gx - sg * rand(16, 24), side * 27);
    }
    else if (d === 'penales') { m.setRestart('penalty', T, { x: gx - sg * PITCH.penX, z: 0 }, { silent: true, delay: 0.3 }); }
    else if (d === 'tiroslibres') { m.setRestart('freekick', T, { x: gx - sg * rand(19, 29), z: rand(-15, 15) }, { silent: true, delay: 0.4 }); }
    Hud.info(null);
  },
  update(h) {
    const m = G.match, T = G.teams[0], b = G.ball;
    if (this.waitT > 0) { this.waitT -= h; if (this.waitT <= 0) { Hud.msg(null); this.reset(); } return; }
    const d = this.drill;
    // contar intentos (remates o centros del jugador)
    const pi = G.passInfo;
    const tryKick = pi && pi.from.team === T && (pi.shot || (d === 'centros' && (pi.kind === 'cross' || pi.kind === 'lob')));
    if (d !== 'libre' && d !== 'pases' && tryKick && !this.shotOpen) { this.shotOpen = G.time; this.tries++; this.hud(); }
    if (this.shotOpen && (b.held || G.time - this.shotOpen > (d === 'centros' ? 5 : 3.2))) this.end(false);
    // el arquero rival agarro la pelota en practica libre o pases: se reinicia
    if ((d === 'libre' || d === 'pases') && b.held && b.held.team !== T) this.end(false);
    // pases seguidos
    if (d === 'pases') {
      if (T.stats.passOk > this.lastOk) { this.streak += T.stats.passOk - this.lastOk; this.lastOk = T.stats.passOk; this.best = Math.max(this.best, this.streak); this.hud(); }
      if (G.owner && G.owner.team !== T) { this.streak = 0; this.hud(); }
    }
  },
  end(ok, msg) {
    if (this.waitT > 0) return;
    this.waitT = ok ? 1.8 : 1.1;
    if (this.drill === 'pases' && !ok) { this.streak = 0; }
    if (msg) Hud.msg(msg); this.hud();
  },
  onGoal() { this.goals++; AU.cheer(0.8); AU.whistle(1); this.end(true, '¡GOL!'); },
  onOut() { this.end(false); },
  hud() {
    const d = this.drill, el = $('trainBox');
    const right = d === 'pases' ? `<b>${this.streak}</b> seguidos · récord <b>${this.best}</b>`
      : d === 'libre' ? `<b>${this.goals}</b> goles` : `<b>${this.goals}</b> / ${this.tries} ${d === 'centros' ? 'centros' : 'remates'}${this.tries ? ' · ' + Math.round(this.goals / this.tries * 100) + '%' : ''}`;
    el.innerHTML = `<span class="tt">${DRILLS[d].icon} ${DRILLS[d].name}</span><span class="ts">${right}</span>`;
  },
};
function startTraining(drill) {
  clearMatch();
  const S = G.setup;
  G.mode = 'match'; G.paused = false;
  makeTeams(S.home, S.away, S.homeKit, S.awayKit, { human: true, formation: S.formation, tactic: S.tactic });
  const O = G.teams[1], keep = O.players.filter(p => !p.isGK).slice(0, drill === 'tiroslibres' ? 4 : 0);
  for (const p of O.players) if (!p.isGK && !keep.includes(p)) p.rig.dispose();
  O.players = O.players.filter(p => p.isGK || keep.includes(p));
  G.players = G.teams[0].players.concat(O.players);
  G.human = new Human(G.teams[0]); Replay.reset();
  G.match = new Match({ halfMin: 999, training: true }); G.match.training = true; G.match.state = 'play';
  R.setEnv(S);
  for (const s of ['home', 'setup', 'cfg', 'train']) $(s).classList.add('hidden');
  $('end').classList.add('hidden');
  Hud.init(); Hud.show(true); Touch.show(true); R.prep(G.scene);
  Cam.snap(); Cam.mode = 'tv';
  AU.init();
  Training.start(drill);
}
