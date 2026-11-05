// ===== Equipo en el partido: plantel, formacion, uniformes, lado de la cancha =====
const GK_KITS = [K('#1f9e4a', '#16793a', 'plain', '#1f9e4a', '#1f9e4a', '#111111'), K('#ff8a00', '#ff8a00', 'plain', '#111111', '#ff8a00', '#111111'),
  K('#7b2cff', '#7b2cff', 'plain', '#7b2cff', '#7b2cff'), K('#f2e600', '#111111', 'plain', '#111111', '#f2e600', '#111111'), K('#e6007a', '#111111', 'plain', '#111111', '#e6007a')];
class Team {
  constructor(side, club, kitKey, formKey, tactic, human) {
    this.side = side; this.club = club; this.kitKey = kitKey; this.kit = club[kitKey];
    this.formKey = FORMATIONS[formKey] ? formKey : club.form; this.form = FORMATIONS[this.formKey];
    this.tactic = TACTICS[tactic] ? tactic : 'equilibrado';
    this.attackDir = side === 0 ? 1 : -1;
    this.human = !!human; this.score = 0;
    this.crestImg = crestCanvas(club, 64);
    this.players = []; this.bench = [];
    this.stats = { shots: 0, onTarget: 0, passes: 0, passOk: 0, fouls: 0, corners: 0, offsides: 0, yellow: 0, red: 0, poss: 0, tackles: 0, saves: 0 };
    this.subsLeft = 5;
    this.chaser = null; this.presser = null; this.cover = null; this.support = [];
  }
  get opp() { return G.teams[1 - this.side]; }
  get ownGoalX() { return -this.attackDir * PITCH.HL; }
  get oppGoalX() { return this.attackDir * PITCH.HL; }
  get gk() { return this.players[0]; }
  // arma los 11 titulares segun la formacion
  build(otherKit) {
    const roster = buildRoster(this.club).slice();
    const used = new Set();
    // uniforme del arquero que no choque con nada
    const avoid = [this.kit.shirt, otherKit ? otherKit.shirt : '#000000'];
    this.gkKit = GK_KITS.find(k => avoid.every(a => colorDist(a, k.shirt) > 0.45)) || GK_KITS[0];
    this.gkKit = Object.assign({}, this.gkKit, { gloves: '#f4f4f4' });
    const lineup = this.form.map(slot => {
      let best = null;
      for (const r of roster) { if (used.has(r) || r.role !== slot.role) continue; if (!best || r.ovr > best.ovr) best = r; }
      if (!best) for (const r of roster) { if (!used.has(r) && r.role !== 'GK' && (!best || r.ovr > best.ovr)) best = r; }
      used.add(best); return best;
    });
    this.bench = roster.filter(r => !used.has(r));
    this.players = lineup.map((info, i) => new Player(this, info, i));
    for (const p of this.players) p.tag = this.form[p.slot].tag;
  }
  setFormation(key) {
    if (!FORMATIONS[key]) return;
    this.formKey = key; this.form = FORMATIONS[key];
    for (const p of this.players) { p.tag = this.form[p.slot].tag; p.brain.sup = null; }
  }
  // posicion base en la cancha (metros, coordenadas del mundo) para el saque del medio
  kickoffPos(i, kicking) {
    const s = this.form[i], ad = this.attackDir;
    if (i === 0) return { x: -ad * (PITCH.HL - 1.5), z: 0 };
    let x = (s.x + 0.3) * 34 - 20, z = s.z * 26;
    x = Math.min(x, -1.2);
    if (Math.hypot(x, z) < PITCH.circR + 0.5 && !(kicking && s.role === 'FW')) { const d = Math.hypot(x, z) || 1; x = x / d * (PITCH.circR + 0.8); z = z / d * (PITCH.circR + 0.8); x = Math.min(x, -1.2); }
    return { x: x * ad, z };
  }
  dispose() { for (const p of this.players) p.rig.dispose(); this.players = []; }
}
