// ===== Arranque y bucle principal (fisica y logica a 60 pasos fijos por segundo) =====
function clearMatch() {
  for (const t of G.teams) t.dispose();
  if (G.match) for (const p of G.match.leaving) p.rig.dispose();
  Refs.dispose();
  if (G.human) G.human.dispose();
  G.teams = []; G.players = []; G.human = null; G.match = null; G.owner = null; G.passInfo = null; G.lastTouch = null;
}
function makeTeams(homeId, awayId, homeKit, awayKit, opts) {
  const hc = clubById(homeId), ac = clubById(awayId);
  const hk = homeKit === 'away' ? 'away' : 'home';
  const ak = awayKit === 'auto' || !awayKit ? pickAwayKit(hc, hk, ac) : awayKit;
  const home = new Team(0, hc, hk, opts.formation || hc.form, opts.tactic, !!opts.human);
  const away = new Team(1, ac, ak, ac.form, Object.keys(TACTICS)[Math.floor(Math.random() * 4)], false);
  G.teams = [home, away];
  home.build(away.kit); away.build(home.kit);
  G.players = home.players.concat(away.players);
  Refs.create();
  Stadium.paintCrowd(home.kit.shirt, home.kit.shirt2, away.kit.shirt, away.kit.shirt2);
}
// partido de fondo en el menu (IA contra IA)
function startAttract() {
  clearMatch();
  G.mode = 'menu'; G.paused = false;
  const pool = CLUBS.filter(c => c.ovr >= 80);
  const a = pool[Math.floor(Math.random() * pool.length)];
  let b; do { b = pool[Math.floor(Math.random() * pool.length)]; } while (b === a);
  makeTeams(a.id, b.id, 'home', 'auto', {});
  G.match = new Match({ halfMin: 6, attract: true });
  G.match.start();
  R.setEnv(G.setup.night, G.setup.cloudy);
  Stadium.drawScreen();
  Hud.show(false); Cam.mode = 'menu';
  $('home').classList.remove('hidden'); UI.go('home');
  $('pause').classList.add('hidden'); $('end').classList.add('hidden'); $('help').classList.add('hidden');
}
function startMatch() {
  clearMatch();
  const S = G.setup;
  G.mode = 'match'; G.paused = false;
  makeTeams(S.home, S.away, S.homeKit, S.awayKit, { human: true, formation: S.formation, tactic: S.tactic });
  G.human = new Human(G.teams[0]);
  G.match = new Match({ halfMin: S.halfMin });
  R.setEnv(S.night, S.cloudy);
  Stadium.drawScreen(G.teams[0].club.short + ' 0 - 0 ' + G.teams[1].club.short);
  for (const s of ['home', 'setup', 'cfg']) $(s).classList.add('hidden');
  $('end').classList.add('hidden');
  Hud.init(); Hud.show(true);
  G.match.start();
  G.human.select(G.match.restart.taker);
  Cam.snap(); Cam.intro();
  AU.init(); AU.cheer(0.6);
  if (!store.get('fc28_seenHelp', false)) { store.set('fc28_seenHelp', true); setTimeout(() => { if (G.mode === 'match') UI.help(true); }, 2800); }
}
function applyQuality() {
  const q = Q();
  G.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
  G.renderer.setSize(innerWidth, innerHeight);
}

// los jugadores no se atraviesan y no salen de los limites
function separate() {
  const ps = G.players, n = ps.length;
  for (let i = 0; i < n; i++) {
    const a = ps[i];
    for (let j = i + 1; j < n; j++) {
      const b = ps[j];
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d2 = dx * dx + dz * dz;
      const min = a.action && a.action.type === 'slide' || b.action && b.action.type === 'slide' ? 0.45 : 0.68;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2), push = (min - d) / 2, nx = dx / d, nz = dz / d;
        const lockA = G.match.locked(a), lockB = G.match.locked(b);
        const wa = lockA ? 0 : lockB ? 2 : 1, wb = lockB ? 0 : lockA ? 2 : 1;
        a.pos.x -= nx * push * wa; a.pos.z -= nz * push * wa; b.pos.x += nx * push * wb; b.pos.z += nz * push * wb;
        // frenan un poco al chocar
        const rv = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
        if (rv < 0) { a.vel.x += nx * rv * 0.3; a.vel.z += nz * rv * 0.3; b.vel.x -= nx * rv * 0.3; b.vel.z -= nz * rv * 0.3; }
      }
    }
    a.pos.x = clamp(a.pos.x, -57, 57); a.pos.z = clamp(a.pos.z, -38, 38);
  }
}

function step(h) {
  G.time += h; G.frame++;
  Input.poll();
  for (const p of G.players) p.prev.copy(p.pos);
  G.match.update(h);
  if (G.human) G.human.update(h);
  aiUpdate(h);
  for (const p of G.players) p.update(h);
  separate();
  Refs.update(h);
  updatePossession(h);
  G.ball.update(h);
  G.match.checkBall();
  Input.endStep();
}
let last = performance.now(), acc = 0, fpsT = 0, fpsN = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1;
  if (!G.paused && G.match) {
    acc += dt; let n = 0;
    while (acc >= DT && n < 5) { step(DT); acc -= DT; n++; }
    if (n === 5) acc = 0;
  } else if (G.paused) Input.endStep();
  const alpha = G.paused ? 1 : acc / DT;
  render(G.paused ? 0 : dt, alpha);
  fpsT += dt; fpsN++;
  if (fpsT > 0.5) { if (CFG.showFps) $('fps').textContent = Math.round(fpsN / fpsT) + ' FPS'; fpsT = 0; fpsN = 0; if (G.mode === 'menu') UI.homeCard(); }
}
function render(dt, alpha) {
  for (const p of G.players) {
    const r = p.rig.root;
    r.position.set(lerp(p.prev.x, p.pos.x, alpha), 0, lerp(p.prev.z, p.pos.z, alpha));
    r.rotation.y = p.facing;
    if (dt > 0) p.rig.animate(dt, p);
  }
  if (G.match) for (const p of G.match.leaving) { p.rig.root.position.set(p.pos.x, 0, p.pos.z); p.rig.root.rotation.y = p.facing; if (dt > 0) p.rig.animate(dt, p); }
  Refs.render(alpha, dt);
  if (G.ball) G.ball.render(alpha, dt);
  if (G.human) G.human.render(alpha);
  Goals.update(dt); Pitch.update(G.time);
  // nivel de peligro: pelota cerca de un arco
  const b = G.ball, danger = b ? clamp((Math.abs(b.px) - 32) / 18, 0, 1) * (Math.abs(b.pz) < 22 ? 1 : 0.4) : 0;
  Stadium.update(G.time, Math.max(AU.excite, danger * 0.25));
  AU.update(dt, danger);
  if (dt > 0) Cam.update(dt);
  Hud.update();
  G.renderer.render(G.scene, G.camera);
}
function boot() {
  if (!window.THREE) { $('loading').innerHTML = '<div style="padding:24px;text-align:center">No se pudo cargar el motor 3D. Revisá la conexión a internet y recargá la página.</div>'; return; }
  Input.init();
  R.init();
  Pitch.build(); Goals.build(); Stadium.build();
  G.ball = new Ball();
  UI.init();
  startAttract();
  $('fps').classList.toggle('hidden', !CFG.showFps);
  requestAnimationFrame(t => { last = t; requestAnimationFrame(loop); });
  setTimeout(() => $('loading').classList.add('off'), 300);
  addEventListener('pointerdown', () => AU.init(), { once: true });
}
boot();
