// ===== Interfaz: HUD del partido, menu principal, seleccion de equipos, configuracion, pausa y resultados =====
const Hud = {
  shown: false, lastP: null,
  init() {
    const [h, a] = G.teams;
    $('sbCH').src = crestURL(h.club); $('sbCA').src = crestURL(a.club);
    $('sbNH').textContent = h.club.short; $('sbNA').textContent = a.club.short;
    $('sbGH').textContent = '0'; $('sbGA').textContent = '0';
    // color del local/visitante en el marcador
    $('sbNH').parentElement.style.boxShadow = 'inset 0 -3px 0 ' + h.kit.shirt;
    $('sbNA').parentElement.style.boxShadow = 'inset 0 -3px 0 ' + a.kit.shirt;
    this.msg(null); this.info(null); this.power(null);
  },
  show(v) { $('hud').classList.toggle('hidden', !v); this.shown = v; },
  score(side) {
    const el = side === 0 ? $('sbGH') : $('sbGA');
    el.textContent = G.teams[side].score; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  },
  player(p) { if (!p) return; $('pNum').textContent = p.info.num; $('pName').textContent = p.info.last.toUpperCase() + ' · ' + p.tag; this.lastP = p; },
  power(pw, label) {
    const el = $('power');
    if (pw == null) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden'); $('powFill').style.width = (pw * 100).toFixed(0) + '%'; $('powLbl').textContent = label || '';
  },
  msg(big, small) {
    const el = $('msg');
    if (!big) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden'); el.classList.toggle('small', big.length > 8);
    const b = $('msgBig'); b.textContent = big; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    $('msgSm').textContent = small || ''; $('msgSm').style.display = small ? '' : 'none';
  },
  info(t) { const el = $('sbInfo'); if (!t) { el.classList.remove('on'); return; } el.textContent = t; el.classList.add('on'); },
  update() {
    if (!this.shown || !G.match) return;
    $('sbClock').textContent = G.match.clockText();
    const p = G.human && G.human.p;
    if (p) { if (p !== this.lastP) this.player(p); $('pSta').style.width = (p.stamina * 100).toFixed(0) + '%'; }
  },
};

// ---------- menus ----------
const UI = {
  screen: 'home',
  go(name) {
    for (const s of ['home', 'setup', 'cfg']) $(s).classList.toggle('hidden', s !== name);
    this.screen = name;
    if (name === 'setup') this.buildSetup();
    if (name === 'cfg') this.buildCfg();
  },
  init() {
    const click = (id, f) => $(id).addEventListener('click', e => { AU.init(); AU.ui(); f(e); });
    click('bPlay', () => this.go('setup'));
    click('bCfg', () => this.go('cfg'));
    click('sBack', () => { AU.uiBack(); this.go('home'); });
    click('cBack', () => { AU.uiBack(); this.go('home'); });
    click('bStart', () => { store.set('fc28_setup', G.setup); fadeTo(() => startMatch()); });
    click('pCont', () => togglePause(false));
    click('pHelp', () => this.help(true));
    click('hClose', () => this.help(false));
    click('pCam', () => cycleCam());
    click('pRestart', () => { togglePause(false); fadeTo(() => startMatch()); });
    click('pExit', () => { togglePause(false); fadeTo(() => startAttract()); });
    click('eNext', () => { $('end').classList.add('hidden'); if (G.match.state === 'halftime') { G.match.secondHalf(); G.paused = false; } else fadeTo(() => startMatch()); });
    click('eMenu', () => { $('end').classList.add('hidden'); G.paused = false; fadeTo(() => startAttract()); });
    click('cReset', () => { CFG.scheme = 'flechas'; CFG.keys = Object.assign({}, DEFAULT_KEYS); saveCfg(); this.buildCfg(); });
    // botones del menu con sonido al pasar
    document.querySelectorAll('.hbtn,.obtn,.cta').forEach(b => b.addEventListener('mouseenter', () => { if (AU.ctx) AU.tone(1400, 0.03, 0.02, 'sine'); }));
  },
  // tarjeta "en vivo" del partido de fondo
  homeCard() {
    if (this.screen !== 'home' || G.mode !== 'menu' || !G.teams.length) return;
    const [h, a] = G.teams;
    $('hcard').innerHTML = `<h4>EN VIVO · PARTIDO DE EXHIBICIÓN</h4><div class="live"><img src="${crestURL(h.club)}">${h.club.short} <b>${h.score} - ${a.score}</b> ${a.club.short}<img src="${crestURL(a.club)}"></div><div>${G.match.clockText()} · ${h.club.name} vs ${a.club.name}</div>`;
  },
  // ---- seleccion de equipos ----
  buildSetup() {
    const S = G.setup;
    const pick = (el, side) => {
      const key = side === 0 ? 'home' : 'away', kk = side === 0 ? 'homeKit' : 'awayKit';
      const club = clubById(S[key]);
      const idx = CLUBS.indexOf(club);
      const kitSel = S[kk] === 'auto' ? (side === 1 ? pickAwayKit(clubById(S.home), S.homeKit === 'auto' ? 'home' : S.homeKit, club) : 'home') : S[kk];
      el.innerHTML = `<div class="side">${side === 0 ? 'LOCAL · VOS' : 'VISITANTE · CPU'}</div>
        <div class="crow"><button class="arr" data-d="-1">‹</button><img class="crest pop" src="${crestURL(club)}" alt=""><button class="arr" data-d="1">›</button></div>
        <div class="tname">${club.name}</div><div class="tctry">${COUNTRIES[club.country]}</div>
        <div class="rat"><div class="ovr"><b>${club.ovr}</b><span>MEDIA</span></div><div><b>${club.att}</b><span>ATA</span></div><div><b>${club.mid}</b><span>MED</span></div><div><b>${club.def}</b><span>DEF</span></div></div>
        <div class="kits"><div class="kit ${kitSel === 'home' ? 'on' : ''}" data-k="home" title="Titular"></div><div class="kit ${kitSel === 'away' ? 'on' : ''}" data-k="away" title="Alternativa"></div></div>
        ${side === 0 ? `<select id="formSel">${Object.keys(FORMATIONS).map(f => `<option ${f === S.formation ? 'selected' : ''}>${f}</option>`).join('')}</select>
        <select id="tacSel">${Object.keys(TACTICS).map(t => `<option value="${t}" ${t === S.tactic ? 'selected' : ''}>${TACTICS[t].name}</option>`).join('')}</select>` : `<div class="ctrl">Formación ${club.form} · la CPU elige su táctica</div>`}`;
      el.querySelectorAll('.kit').forEach(k => k.appendChild(kitIcon(club[k.dataset.k], 80)));
      el.querySelectorAll('.arr').forEach(b => b.onclick = () => {
        AU.init(); AU.ui();
        let i = (idx + Number(b.dataset.d) + CLUBS.length) % CLUBS.length;
        const other = side === 0 ? S.away : S.home;
        if (CLUBS[i].id === other) i = (i + Number(b.dataset.d) + CLUBS.length) % CLUBS.length;
        S[key] = CLUBS[i].id; if (side === 0) S.formation = CLUBS[i].form; S[kk] = side === 1 ? 'auto' : 'home';
        if (side === 0) S.awayKit = 'auto';
        this.buildSetup();
      });
      el.querySelectorAll('.kit').forEach(k => k.onclick = () => { AU.ui(); S[kk] = k.dataset.k; this.buildSetup(); });
      if (side === 0) { $('formSel').onchange = e => { S.formation = e.target.value; }; $('tacSel').onchange = e => { S.tactic = e.target.value; }; }
    };
    pick($('pickH'), 0); pick($('pickA'), 1);
    const seg = (label, key, items) => `<div class="opt"><label>${label}</label><div class="seg" data-key="${key}">${items.map(([v, t]) => `<button data-v="${v}" class="${String(S[key]) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div></div>`;
    $('sopts').innerHTML = `<div class="opt"><label>ESTADIO</label><div class="seg"><button class="on">Estadio Shofe</button></div></div>` +
      seg('HORA', 'night', [[false, 'Día'], [true, 'Noche']]) +
      seg('CLIMA', 'cloudy', [[false, 'Soleado'], [true, 'Nublado']]) +
      seg('DIFICULTAD DE LA IA', 'diff', DIFFS.map((d, i) => [i, d.name])) +
      seg('DURACIÓN DE CADA TIEMPO', 'halfMin', [[2, '2 min'], [3, '3 min'], [5, '5 min'], [8, '8 min'], [12, '12 min']]) +
      `<div class="opt"><label>LLUVIA</label><div class="seg"><button disabled style="opacity:.45">Próximamente</button></div></div>`;
    $('sopts').querySelectorAll('.seg[data-key] button').forEach(b => b.onclick = () => {
      AU.ui(); const key = b.parentElement.dataset.key; let v = b.dataset.v;
      v = v === 'true' ? true : v === 'false' ? false : Number(v);
      S[key] = v; this.buildSetup();
      if (key === 'night' || key === 'cloudy') R.setEnv(S.night, S.cloudy);
    });
  },
  // ---- configuracion ----
  buildCfg() {
    const seg = (label, cur, items, on) => { const id = 'cs' + Math.random().toString(36).slice(2, 7); setTimeout(() => $(id).querySelectorAll('button').forEach(b => b.onclick = () => { AU.ui(); on(b.dataset.v); saveCfg(); this.buildCfg(); })); return `<div class="crow2"><span>${label}</span><div class="seg" id="${id}">${items.map(([v, t]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div></div>`; };
    const schemes = Object.keys(SCHEMES).map(k => [k, SCHEMES[k].name]); if (CFG.scheme === 'custom') schemes.push(['custom', 'Personalizado']);
    $('cOpts').innerHTML =
      seg('Teclas', CFG.scheme, schemes, v => { CFG.scheme = v; if (SCHEMES[v]) CFG.keys = Object.assign({}, SCHEMES[v].keys); }) +
      seg('Calidad gráfica', CFG.quality, Object.keys(QUALITY).map(k => [k, QUALITY[k].name]), v => { CFG.quality = v; applyQuality(); }) +
      seg('Cámara', CFG.cam, CAM_PRESETS.map((c, i) => [i, c.name]), v => { CFG.cam = Number(v); }) +
      seg('Volumen', Math.round(CFG.volume * 4) / 4, [[0, '0'], [0.25, '25'], [0.5, '50'], [0.75, '75'], [1, '100']], v => AU.setVolume(Number(v))) +
      seg('Mostrar FPS', CFG.showFps, [[false, 'No'], [true, 'Sí']], v => { CFG.showFps = v === 'true'; $('fps').classList.toggle('hidden', !CFG.showFps); }) +
      `<p class="cnote">Baja/Media/Alta/Ultra cambian la resolución, las sombras y el público. Las sombras y el antialiasing se aplican del todo al recargar la página.</p>`;
    const alt = altKeys();
    $('cKeys').innerHTML = Object.keys(DEFAULT_KEYS).map(k => `<div class="crow2"><span>${KEY_NAMES[k]}${alt[k] ? ' <small style="color:var(--muted)">(también ' + keyLabel(alt[k]) + ')</small>' : ''}</span><button class="keyb" data-k="${k}">${keyLabel(CFG.keys[k])}</button></div>`).join('');
    $('cKeys').querySelectorAll('.keyb').forEach(b => b.onclick = () => {
      b.classList.add('wait'); b.textContent = 'apretá una tecla';
      Input.rebinding = code => { Input.rebinding = null; if (code !== 'Escape') { for (const k in CFG.keys) if (CFG.keys[k] === code) CFG.keys[k] = CFG.keys[b.dataset.k]; CFG.keys[b.dataset.k] = code; CFG.scheme = 'custom'; saveCfg(); } this.buildCfg(); };
    });
  },
  help(v) {
    const alt = altKeys();
    if (v) $('helpGrid').innerHTML = Object.keys(DEFAULT_KEYS).map(k => `<div><span>${KEY_NAMES[k]}</span><kbd>${keyLabel(CFG.keys[k])}${alt[k] ? ' / ' + keyLabel(alt[k]) : ''}${k === 'sprint' && CFG.keys[k] !== 'ShiftLeft' ? ' / SHIFT' : ''}</kbd></div>`).join('') +
      `<div><span>Pausa</span><kbd>ESC / P</kbd></div><div><span>Cambiar cámara</span><kbd>C</kbd></div><div><span>Esta ayuda</span><kbd>H</kbd></div><div><span>Joystick</span><kbd>A X B Y LB RT RB</kbd></div>`;
    $('help').classList.toggle('hidden', !v);
    if (G.mode === 'match' && !$('pause').classList.contains('hidden')) return;
    if (G.mode === 'match') G.paused = v;
  },
  statsHTML() {
    const [h, a] = G.teams, tot = h.stats.poss + a.stats.poss || 1;
    const rows = [
      ['POSESIÓN', Math.round(h.stats.poss / tot * 100) + '%', Math.round(a.stats.poss / tot * 100) + '%', h.stats.poss, a.stats.poss],
      ['REMATES', h.stats.shots, a.stats.shots], ['REMATES AL ARCO', h.stats.onTarget, a.stats.onTarget],
      ['PASES', h.stats.passes, a.stats.passes],
      ['PRECISIÓN DE PASES', (h.stats.passes ? Math.round(h.stats.passOk / h.stats.passes * 100) : 0) + '%', (a.stats.passes ? Math.round(a.stats.passOk / a.stats.passes * 100) : 0) + '%', h.stats.passOk / (h.stats.passes || 1), a.stats.passOk / (a.stats.passes || 1)],
      ['QUITES', h.stats.tackles, a.stats.tackles], ['ATAJADAS', h.stats.saves, a.stats.saves],
      ['CÓRNERS', h.stats.corners, a.stats.corners], ['FALTAS', h.stats.fouls, a.stats.fouls],
    ];
    return rows.map(r => {
      const va = r[3] != null ? r[3] : Number(r[1]), vb = r[4] != null ? r[4] : Number(r[2]), t = va + vb || 1;
      return `<div class="srow"><div class="sv">${r[1]}</div><div class="sl">${r[0]}<div class="bars"><i style="width:${va / t * 100}%;background:${h.kit.shirt === '#ffffff' || h.kit.shirt === '#f7f7f7' ? '#dfe4ea' : h.kit.shirt}"></i><i style="width:${vb / t * 100}%;background:${a.kit.shirt}"></i></div></div><div class="sv">${r[2]}</div></div>`;
    }).join('');
  },
  showEnd(final) {
    G.paused = true;
    const [h, a] = G.teams;
    $('eTitle').textContent = final ? 'FINAL DEL PARTIDO' : 'ENTRETIEMPO';
    const sc = side => G.match.events.filter(e => e.team === side).map(e => `${e.name} ${e.min}'${e.own ? ' (e/c)' : ''}`).join(', ');
    $('eScore').innerHTML = `<div class="en r">${h.club.name}</div><img src="${crestURL(h.club)}"><div class="eg">${h.score} - ${a.score}</div><img src="${crestURL(a.club)}"><div class="en">${a.club.name}</div>`;
    $('eStats').innerHTML = `<div class="escorers"><span>${sc(0)}</span><span>${sc(1)}</span></div>` + this.statsHTML() + (final ? this.bestPlayers() : '');
    $('eNext').textContent = final ? 'REVANCHA' : 'SEGUNDO TIEMPO';
    $('end').classList.remove('hidden');
  },
  bestPlayers() {
    const all = G.players.slice().sort((x, y) => (y.stats.goals * 3 + y.stats.passOk * 0.1 + y.stats.tackles * 0.5 + y.stats.saves * 0.8 + y.stats.shots * 0.2) - (x.stats.goals * 3 + x.stats.passOk * 0.1 + x.stats.tackles * 0.5 + x.stats.saves * 0.8 + x.stats.shots * 0.2)).slice(0, 4);
    return `<div class="etitle" style="margin-top:10px">FIGURAS</div>` + all.map(p => `<div class="srow"><div class="sv">${p.info.num}</div><div class="sl" style="text-align:left;letter-spacing:.04em;color:#fff">${p.info.name} · ${p.team.club.short} — ${p.stats.goals} gol, ${p.stats.passOk}/${p.stats.passes} pases, ${p.stats.tackles} quites${p.isGK ? ', ' + p.stats.saves + ' atajadas' : ''}</div><div class="sv"></div></div>`).join('');
  },
};
function togglePause(v) {
  if (G.mode !== 'match' || !G.match || G.match.state === 'halftime' || G.match.state === 'fulltime') return;
  const on = v == null ? $('pause').classList.contains('hidden') : v;
  $('pause').classList.toggle('hidden', !on);
  if (!on) $('help').classList.add('hidden');
  G.paused = on;
  if (on) { const [h, a] = G.teams; $('pStats').textContent = `${h.club.short} ${h.score} - ${a.score} ${a.club.short} · ${G.match.clockText()}`; $('pCam').textContent = 'CÁMARA: ' + CAM_PRESETS[CFG.cam].name; }
}
function cycleCam() { CFG.cam = (CFG.cam + 1) % CAM_PRESETS.length; saveCfg(); $('pCam').textContent = 'CÁMARA: ' + CAM_PRESETS[CFG.cam].name; if (G.match && G.mode === 'match') Hud.info('CÁMARA ' + CAM_PRESETS[CFG.cam].name); setTimeout(() => { if (!G.match || !G.match.restart) Hud.info(null); }, 1200); }
function onKeyUI(e) {
  AU.init();
  if (e.code === 'F3') { CFG.showFps = !CFG.showFps; $('fps').classList.toggle('hidden', !CFG.showFps); saveCfg(); }
  if (G.mode !== 'match') return;
  if (e.code === 'Escape' || e.code === 'KeyP') { if (!$('help').classList.contains('hidden') && $('pause').classList.contains('hidden')) UI.help(false); else togglePause(); }
  else if (e.code === 'KeyH') UI.help($('help').classList.contains('hidden'));
  else if (e.code === 'KeyC' && !G.paused) cycleCam();
}
function fadeTo(f) { $('fade').classList.add('on'); setTimeout(() => { f(); setTimeout(() => $('fade').classList.remove('on'), 80); }, 380); }
