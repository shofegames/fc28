// ===== Panel de cambios, formacion, tactica y cambio de posiciones (desde la pausa o el entretiempo) =====
const Subs = {
  sel: null, from: null,
  open() {
    if (!G.match || !G.human) return;
    this.from = !$('end').classList.contains('hidden') ? 'end' : 'pause';
    $('pause').classList.add('hidden'); $('end').classList.add('hidden');
    $('subs').classList.remove('hidden'); G.paused = true; this.sel = null;
    const t = G.human.team;
    $('sForm').innerHTML = Object.keys(FORMATIONS).map(f => `<option ${f === t.formKey ? 'selected' : ''}>${f}</option>`).join('');
    $('sTac').innerHTML = Object.keys(TACTICS).map(k => `<option value="${k}" ${k === t.tactic ? 'selected' : ''}>${TACTICS[k].name}</option>`).join('');
    $('sForm').onchange = e => { t.setFormation(e.target.value); this.draw(); };
    $('sTac').onchange = e => { t.tactic = e.target.value; };
    this.draw();
  },
  close() {
    $('subs').classList.add('hidden');
    if (this.from === 'end') $('end').classList.remove('hidden');
    else { $('pause').classList.remove('hidden'); }
  },
  draw() {
    const t = G.human.team, m = G.match;
    const pend = m.pendingSubs.filter(s => s.team === t);
    $('sLeft').textContent = 'CAMBIOS DISPONIBLES: ' + t.subsLeft;
    const field = t.players.slice().sort((a, b) => a.slot - b.slot);
    $('sField').innerHTML = field.map(p => {
      const pd = pend.find(s => s.out === p);
      return `<button class="prow ${this.sel === p ? 'sel' : ''} ${pd ? 'pend' : ''}" data-id="${G.players.indexOf(p)}"><b>${p.info.num}</b><span>${p.name}${p.yellow ? '<i class="yc"></i>' : ''}${pd ? ' <span class="tg">→ ' + pd.info.last + '</span>' : ''}</span><span class="tg">${p.tag}</span><span class="st"><i style="width:${Math.round(p.stamina * 100)}%"></i></span></button>`;
    }).join('');
    const bench = t.bench.slice().sort((a, b) => ['GK', 'DF', 'MF', 'FW'].indexOf(a.role) - ['GK', 'DF', 'MF', 'FW'].indexOf(b.role));
    const ROLE = { GK: 'ARQ', DF: 'DEF', MF: 'MED', FW: 'DEL' };
    $('sBench').innerHTML = bench.map(i => {
      const pd = pend.find(s => s.info === i);
      return `<button class="prow ${pd ? 'pend' : ''}" data-b="${t.bench.indexOf(i)}"><b>${i.num}</b><span>${i.last}</span><span class="tg">${ROLE[i.role]}</span><span class="ov">${i.ovr}</span></button>`;
    }).join('') + (t.benchOut && t.benchOut.length ? `<p class="cnote">Ya salieron: ${t.benchOut.map(i => i.last).join(', ')}</p>` : '');
    $('sField').querySelectorAll('.prow').forEach(b => b.onclick = () => {
      const p = G.players[Number(b.dataset.id)]; AU.ui();
      if (this.sel && this.sel !== p) { // intercambiar posiciones
        const s = this.sel.slot; this.sel.slot = p.slot; p.slot = s;
        if (this.sel.isGK !== p.isGK) { p.slot = this.sel.slot; this.sel.slot = s; $('sHint').textContent = 'El arquero solo se puede cambiar por otro arquero.'; }
        for (const x of [this.sel, p]) { x.tag = t.form[x.slot].tag; x.brain.sup = null; x.brain.tx = null; }
        this.sel = null;
      } else this.sel = this.sel === p ? null : p;
      this.draw();
    });
    $('sBench').querySelectorAll('.prow').forEach(b => b.onclick = () => {
      AU.ui();
      const info = t.bench[Number(b.dataset.b)];
      if (!this.sel) { $('sHint').textContent = 'Primero tocá al jugador que sale.'; return; }
      if (t.subsLeft <= 0) { $('sHint').textContent = 'Ya no te quedan cambios.'; return; }
      if ((info.role === 'GK') !== this.sel.isGK) { $('sHint').textContent = 'El arquero solo se puede cambiar por otro arquero.'; return; }
      if (m.queueSub(t, this.sel, info)) {
        $('sHint').textContent = m.state === 'play' ? 'Listo: el cambio se hace en la próxima pelota parada.' : 'Cambio hecho.';
        this.sel = null; this.draw();
      }
    });
  },
};
