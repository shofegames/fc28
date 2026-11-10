// ===== Clubes (nombres "truchos" a proposito), planteles y escudos originales =====
// Para agregar un club: sumar una entrada a CLUBS. El plantel se genera solo (siempre igual para cada club).
// Para usar un escudo propio: poner crestImg: 'data:image/png;base64,...' (o una ruta relativa) en el club.
const COUNTRIES = { AR: 'Argentina', ES: 'España', EN: 'Inglaterra', IT: 'Italia', DE: 'Alemania', FR: 'Francia', XX: 'Ficticio' };

// kit: shirt, shirt2 (color del dibujo), pattern (plain|stripes|hoops|band|sash|vee|half|diagonal|sleeves|center), shorts, socks, num
const K = (shirt, shirt2, pattern, shorts, socks, num) => ({ shirt, shirt2, pattern, shorts, socks, num: num || '#ffffff' });
const CLUBS = [
  { id: 'rasing', name: 'Rasing Club', short: 'RAC', country: 'AR', ovr: 77, att: 77, mid: 77, def: 76, form: '4-3-3', crest: 'shield',
    home: K('#7cc4f2', '#ffffff', 'stripes', '#15171c', '#ffffff', '#15171c'), away: K('#2b2f6e', '#7cc4f2', 'plain', '#2b2f6e', '#2b2f6e') },
  { id: 'bocay', name: 'Boca Yuniors', short: 'BOY', country: 'AR', ovr: 78, att: 78, mid: 77, def: 77, form: '4-4-2', crest: 'round',
    home: K('#0b2a6f', '#f6c700', 'band', '#0b2a6f', '#0b2a6f', '#f6c700'), away: K('#f6c700', '#0b2a6f', 'plain', '#f6c700', '#f6c700', '#0b2a6f') },
  { id: 'ribel', name: 'Ribel Plei', short: 'RIB', country: 'AR', ovr: 79, att: 79, mid: 79, def: 77, form: '4-3-3', crest: 'diamond',
    home: K('#ffffff', '#d3102a', 'sash', '#15171c', '#ffffff', '#15171c'), away: K('#15171c', '#d3102a', 'sash', '#15171c', '#15171c') },
  { id: 'indepa', name: 'Indepandiente', short: 'IND', country: 'AR', ovr: 75, att: 74, mid: 75, def: 75, form: '4-4-2', crest: 'shield',
    home: K('#d21a1a', '#d21a1a', 'plain', '#14213d', '#d21a1a'), away: K('#ffffff', '#d21a1a', 'plain', '#ffffff', '#ffffff', '#d21a1a') },
  { id: 'sanlo', name: 'San Lorenso', short: 'SLO', country: 'AR', ovr: 75, att: 74, mid: 75, def: 75, form: '4-2-3-1', crest: 'shield',
    home: K('#1c2c6b', '#c8102e', 'stripes', '#1c2c6b', '#1c2c6b'), away: K('#ffffff', '#1c2c6b', 'plain', '#ffffff', '#ffffff', '#1c2c6b') },
  { id: 'belez', name: 'Bélez Sarsfil', short: 'BEL', country: 'AR', ovr: 75, att: 75, mid: 75, def: 74, form: '4-3-3', crest: 'round',
    home: K('#ffffff', '#1a3c8f', 'vee', '#ffffff', '#ffffff', '#1a3c8f'), away: K('#1a3c8f', '#ffffff', 'plain', '#1a3c8f', '#1a3c8f') },
  { id: 'estud', name: 'Estudiantez', short: 'EST', country: 'AR', ovr: 75, att: 74, mid: 75, def: 76, form: '4-4-2', crest: 'shield',
    home: K('#e11f26', '#ffffff', 'stripes', '#15171c', '#e11f26'), away: K('#13233f', '#e11f26', 'plain', '#13233f', '#13233f') },
  { id: 'rosario', name: 'Rosário Sentral', short: 'ROS', country: 'AR', ovr: 75, att: 75, mid: 74, def: 74, form: '4-2-3-1', crest: 'diamond',
    home: K('#0f3d91', '#f6c700', 'stripes', '#0f3d91', '#0f3d91', '#ffffff'), away: K('#f6c700', '#0f3d91', 'plain', '#0f3d91', '#f6c700', '#0f3d91') },

  { id: 'reial', name: 'Reial Madriz', short: 'RMZ', country: 'ES', ovr: 87, att: 88, mid: 87, def: 85, form: '4-3-3', crest: 'crown',
    home: K('#f7f7f7', '#d4af37', 'plain', '#f7f7f7', '#f7f7f7', '#1b1b2f'), away: K('#2a1f4a', '#d4af37', 'plain', '#2a1f4a', '#2a1f4a') },
  { id: 'barchelona', name: 'Barchelona', short: 'BAR', country: 'ES', ovr: 86, att: 87, mid: 87, def: 83, form: '4-3-3', crest: 'shield',
    home: K('#a50044', '#004d98', 'stripes', '#004d98', '#004d98', '#f6c700'), away: K('#f6c700', '#a50044', 'plain', '#f6c700', '#f6c700', '#a50044') },
  { id: 'atletimadriz', name: 'Atlético de Madriz', short: 'ATM', country: 'ES', ovr: 84, att: 83, mid: 84, def: 85, form: '4-4-2', crest: 'shield',
    home: K('#cb3524', '#ffffff', 'stripes', '#272e61', '#cb3524'), away: K('#272e61', '#cb3524', 'plain', '#272e61', '#272e61') },
  { id: 'sebiya', name: 'Sebiya', short: 'SEB', country: 'ES', ovr: 80, att: 79, mid: 80, def: 80, form: '4-2-3-1', crest: 'round',
    home: K('#ffffff', '#d81920', 'plain', '#ffffff', '#ffffff', '#d81920'), away: K('#d81920', '#ffffff', 'plain', '#d81920', '#d81920') },
  { id: 'balencia', name: 'Balencia', short: 'BAL', country: 'ES', ovr: 79, att: 78, mid: 79, def: 79, form: '4-4-2', crest: 'round',
    home: K('#ffffff', '#f37021', 'plain', '#15171c', '#15171c', '#15171c'), away: K('#f37021', '#15171c', 'plain', '#f37021', '#f37021') },

  { id: 'mansiti', name: 'Manchéster Siti', short: 'MCS', country: 'EN', ovr: 88, att: 88, mid: 89, def: 86, form: '4-3-3', crest: 'round',
    home: K('#6cabdd', '#ffffff', 'plain', '#ffffff', '#6cabdd', '#1c2c5b'), away: K('#1c2c5b', '#6cabdd', 'plain', '#1c2c5b', '#1c2c5b') },
  { id: 'manyuna', name: 'Manchéster Yunaited', short: 'MYU', country: 'EN', ovr: 82, att: 82, mid: 82, def: 81, form: '4-2-3-1', crest: 'shield',
    home: K('#da291c', '#da291c', 'plain', '#ffffff', '#15171c'), away: K('#ffffff', '#da291c', 'plain', '#ffffff', '#ffffff', '#da291c') },
  { id: 'liverpul', name: 'Liverpul', short: 'LIV', country: 'EN', ovr: 87, att: 88, mid: 86, def: 86, form: '4-3-3', crest: 'shield',
    home: K('#c8102e', '#c8102e', 'plain', '#c8102e', '#c8102e'), away: K('#f4f4f4', '#0b8f8f', 'plain', '#f4f4f4', '#f4f4f4', '#0b8f8f') },
  { id: 'arsenol', name: 'Arsenol', short: 'ARS', country: 'EN', ovr: 86, att: 85, mid: 86, def: 87, form: '4-3-3', crest: 'shield',
    home: K('#ef0107', '#ffffff', 'sleeves', '#ffffff', '#ffffff'), away: K('#f6d900', '#13233f', 'plain', '#13233f', '#f6d900', '#13233f') },
  { id: 'chelsi', name: 'Chelsi', short: 'CHE', country: 'EN', ovr: 83, att: 83, mid: 84, def: 82, form: '4-2-3-1', crest: 'round',
    home: K('#034694', '#034694', 'plain', '#034694', '#ffffff'), away: K('#ffffff', '#034694', 'plain', '#ffffff', '#ffffff', '#034694') },
  { id: 'totenjam', name: 'Totenjam', short: 'TOT', country: 'EN', ovr: 82, att: 83, mid: 81, def: 80, form: '4-2-3-1', crest: 'round',
    home: K('#ffffff', '#132257', 'plain', '#132257', '#ffffff', '#132257'), away: K('#132257', '#ffffff', 'plain', '#132257', '#132257') },

  { id: 'inder', name: 'Inder', short: 'INR', country: 'IT', ovr: 85, att: 84, mid: 85, def: 86, form: '3-5-2', crest: 'round',
    home: K('#0068a8', '#111111', 'stripes', '#111111', '#111111'), away: K('#ffffff', '#0068a8', 'plain', '#ffffff', '#ffffff', '#0068a8') },
  { id: 'milanno', name: 'Milanno', short: 'MIL', country: 'IT', ovr: 83, att: 83, mid: 83, def: 82, form: '4-2-3-1', crest: 'diamond',
    home: K('#d0021b', '#111111', 'stripes', '#ffffff', '#111111'), away: K('#ffffff', '#d0021b', 'plain', '#ffffff', '#ffffff', '#d0021b') },
  { id: 'yuventus', name: 'Yuventus', short: 'YUV', country: 'IT', ovr: 83, att: 82, mid: 83, def: 84, form: '3-5-2', crest: 'shield',
    home: K('#ffffff', '#111111', 'stripes', '#111111', '#111111', '#d4af37'), away: K('#f6d23c', '#111111', 'plain', '#111111', '#f6d23c', '#111111') },
  { id: 'napoly', name: 'Napoly', short: 'NAP', country: 'IT', ovr: 83, att: 83, mid: 83, def: 82, form: '4-3-3', crest: 'round',
    home: K('#12a0d7', '#12a0d7', 'plain', '#ffffff', '#12a0d7'), away: K('#ffffff', '#12a0d7', 'plain', '#ffffff', '#ffffff', '#12a0d7') },
  { id: 'romma', name: 'Romma', short: 'ROM', country: 'IT', ovr: 80, att: 80, mid: 80, def: 80, form: '3-4-3', crest: 'shield',
    home: K('#8e1f2f', '#f0bc42', 'plain', '#ffffff', '#15171c'), away: K('#ffffff', '#8e1f2f', 'plain', '#ffffff', '#ffffff', '#8e1f2f') },

  { id: 'baiern', name: 'Baiern Múnich', short: 'BAI', country: 'DE', ovr: 87, att: 88, mid: 87, def: 85, form: '4-2-3-1', crest: 'round',
    home: K('#dc052d', '#dc052d', 'plain', '#dc052d', '#dc052d'), away: K('#ffffff', '#0066b2', 'plain', '#ffffff', '#ffffff', '#0066b2') },
  { id: 'dormund', name: 'Borussia Dormund', short: 'BVD', country: 'DE', ovr: 83, att: 84, mid: 83, def: 81, form: '4-2-3-1', crest: 'round',
    home: K('#fde100', '#111111', 'plain', '#111111', '#fde100', '#111111'), away: K('#111111', '#fde100', 'plain', '#111111', '#111111', '#fde100') },
  { id: 'leberkusen', name: 'Bayer Leberkusen', short: 'B04', country: 'DE', ovr: 84, att: 84, mid: 84, def: 83, form: '3-4-3', crest: 'shield',
    home: K('#e32221', '#111111', 'half', '#111111', '#e32221'), away: K('#ffffff', '#e32221', 'plain', '#ffffff', '#ffffff', '#e32221') },

  { id: 'parisy', name: 'París San Yermán', short: 'PSY', country: 'FR', ovr: 86, att: 87, mid: 85, def: 84, form: '4-3-3', crest: 'round',
    home: K('#0b1b48', '#da291c', 'center', '#0b1b48', '#0b1b48'), away: K('#ffffff', '#da291c', 'center', '#ffffff', '#ffffff', '#0b1b48') },
  { id: 'marsel', name: 'Olimpic Marsel', short: 'OMR', country: 'FR', ovr: 80, att: 80, mid: 80, def: 79, form: '4-3-3', crest: 'shield',
    home: K('#ffffff', '#2faee0', 'plain', '#ffffff', '#ffffff', '#2faee0'), away: K('#2faee0', '#ffffff', 'plain', '#2faee0', '#2faee0') },
  { id: 'monako', name: 'Mónako', short: 'MON', country: 'FR', ovr: 80, att: 81, mid: 80, def: 78, form: '4-4-2', crest: 'diamond',
    home: K('#e51b22', '#ffffff', 'diagonal', '#ffffff', '#e51b22', '#ffffff'), away: K('#15171c', '#e51b22', 'plain', '#15171c', '#15171c') },

  { id: 'shofe', name: 'Shofe FC', short: 'SHF', country: 'XX', ovr: 82, att: 83, mid: 82, def: 81, form: '4-3-3', crest: 'shield',
    home: K('#b8ff3c', '#0d1117', 'hoops', '#0d1117', '#0d1117', '#0d1117'), away: K('#0d1117', '#b8ff3c', 'plain', '#0d1117', '#0d1117', '#b8ff3c') },
  { id: 'munecos', name: 'Deportivo Muñecos', short: 'MUÑ', country: 'XX', ovr: 74, att: 75, mid: 74, def: 73, form: '4-4-2', crest: 'round',
    home: K('#ff7a1a', '#3d2bff', 'half', '#3d2bff', '#ff7a1a'), away: K('#3d2bff', '#ff7a1a', 'plain', '#ff7a1a', '#3d2bff') },
];
const clubById = id => CLUBS.find(c => c.id === id) || CLUBS[0];

// --- nombres de jugadores (truchos) por pais ---
const NAMES = {
  AR: [['Julián', 'Thiago', 'Santi', 'Facu', 'Lucho', 'Nacho', 'Maxi', 'Enzo', 'Valen', 'Gonza', 'Fede', 'Tomi', 'Rodri', 'Agus', 'Mati', 'Nico', 'Bruno', 'Franco', 'Pipa', 'Tincho', 'Chiqui', 'Lalo'],
    ['Gonzalvez', 'Fernandes', 'Rodriguéz', 'Pereyrra', 'Gimenes', 'Martinés', 'Lópes', 'Sosaa', 'Romeroh', 'Acuñña', 'Benedeto', 'Pavonne', 'Barcco', 'Medinna', 'Zambranno', 'Cabrall', 'Vallejoss', 'Quinterros', 'Galbán', 'Ojedda', 'Batistuto', 'Palermmo', 'Riquelmme', 'Tebés']],
  ES: [['Pau', 'Sergi', 'Iker', 'Álvaro', 'Dani', 'Marcos', 'Rubén', 'Unai', 'Aitor', 'Raúl', 'Jordi', 'Hugo', 'Javi', 'Íñigo', 'Borja', 'Fermín', 'Gavi-to', 'Nacho'],
    ['Garsía', 'Martines', 'Sánches', 'Péres', 'Gomes', 'Fernándes', 'Ruis', 'Morenno', 'Navarrete', 'Castiya', 'Iglesiass', 'Ortís', 'Herrerra', 'Llorentte', 'Busquéts', 'Iniestta', 'Xabí', 'Puyoll', 'Pikké', 'Ramoss']],
  EN: [['Jack', 'Harry', 'Charlie', 'Ollie', 'Alfie', 'Jamie', 'Kyle', 'Reece', 'Mason', 'Archie', 'Tommy', 'Billy', 'Ben', 'Callum', 'Freddie', 'Wayne', 'Stevie', 'Frankie'],
    ['Smiz', 'Jonson', 'Wiliams', 'Braun', 'Teylor', 'Wolker', 'Rait', 'Grin', 'Robinsonn', 'Tompson', 'Kerr-Kerr', 'Hughs', 'Bekkam', 'Stirlin', 'Fodden', 'Jerrard', 'Lampardd', 'Runey', 'Kein', 'Saká']],
  IT: [['Marco', 'Luca', 'Giorgio', 'Matteo', 'Alessio', 'Federico', 'Nicolò', 'Ciro', 'Gigi', 'Pippo', 'Sandro', 'Davide', 'Enrico', 'Fabio', 'Lorenzo', 'Gianni', 'Totò'],
    ['Rossini', 'Bianchetti', 'Ferrarri', 'Esposíto', 'Ricci-Ricci', 'Colomboh', 'Romanno', 'Brunetti', 'Galli', 'Contte', 'Pirlotto', 'Totty', 'Baresini', 'Mancinni', 'Bonucchi', 'Maldinni', 'Buffonne', 'Cannavarro', 'Del Pierro']],
  DE: [['Lukas', 'Jonas', 'Leon', 'Finn', 'Max', 'Felix', 'Timo', 'Niklas', 'Kai', 'Florian', 'Thomas', 'Manni', 'Jupp', 'Uwe', 'Bastian', 'Mats'],
    ['Müllerr', 'Schmitt', 'Fischerr', 'Weberr', 'Wagnerr', 'Beckker', 'Hofmann', 'Schulzz', 'Kahnn', 'Klinsmon', 'Ballakk', 'Neuerr', 'Kimmischt', 'Gnabrí', 'Hummelz', 'Lahmm', 'Kloze', 'Podolskki']],
  FR: [['Antoine', 'Hugo', 'Théo', 'Lucas', 'Jules', 'Ousmane', 'Aurélien', 'Benjamin', 'Olivier', 'Adrien', 'Raphaël', 'Kingsley', 'Moussa', 'Paul', 'Ibrahima', 'Kilian', 'Zizú'],
    ['Dubois', 'Lefebvrre', 'Moreau-u', 'Girouxx', 'Pogbá', 'Griesmon', 'Dembelé', 'Mbapé', 'Kantté', 'Varanne', 'Lloriss', 'Benzemá', 'Camavingá', 'Tchouamenni', 'Zidanne', 'Henrry', 'Ribérry', 'Platinní']],
};
NAMES.XX = [NAMES.AR[0].concat(NAMES.EN[0]).concat(NAMES.IT[0]), NAMES.AR[1].concat(NAMES.FR[1]).concat(NAMES.DE[1])];

const SKINS = ['#f2d0b4', '#e8b896', '#d9a27c', '#c68660', '#a86b45', '#8a5431', '#6b3f22', '#4e2c18'];
const HAIRS = ['#15110e', '#2b1d14', '#4a3020', '#6b4a2b', '#a3753f', '#d9b46a', '#e8d6a8', '#7a2a12', '#9aa0a8'];
const HAIR_STYLES = ['short', 'short', 'buzz', 'long', 'afro', 'bald', 'short', 'mohawk'];
const BOOTS = ['#111111', '#f4f4f4', '#ff3b30', '#b8ff3c', '#3cf0ff', '#ffd23c', '#ff5fd2', '#2a62ff'];

// Plantel de 18: 2 arqueros, 6 defensores, 6 medios, 4 delanteros. Siempre el mismo para cada club.
function buildRoster(club) {
  if (club._roster) return club._roster;
  const R = seeded(hashStr(club.id + '#fc28'));
  const pick = a => a[Math.floor(R() * a.length)];
  const pool = NAMES[club.country] || NAMES.XX;
  const used = new Set();
  const roles = ['GK', 'GK', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW', 'FW'];
  const nums = { GK: [1, 12], DF: [2, 3, 4, 6, 13, 15], MF: [5, 8, 10, 14, 16, 20], FW: [7, 9, 11, 19] };
  const ni = { GK: 0, DF: 0, MF: 0, FW: 0 };
  const star = 14 + Math.floor(R() * 4); // un delantero crack
  const out = roles.map((role, i) => {
    let last; do { last = pick(pool[1]); } while (used.has(last) && used.size < pool[1].length); used.add(last);
    const first = pick(pool[0]);
    const base = role === 'GK' ? club.def : role === 'DF' ? club.def : role === 'MF' ? club.mid : club.att;
    const q = base + Math.round((R() - 0.6) * 9) + (i === star ? 5 : 0) - (i === 1 ? 4 : 0);
    const v = d => clamp(Math.round(q + d + (R() - 0.5) * 10), 35, 97);
    const a = role === 'GK' ? { pac: v(-25), sho: v(-45), pas: v(-18), dri: v(-30), def: v(-30), phy: v(-6), gk: v(3) }
      : role === 'DF' ? { pac: v(-6), sho: v(-25), pas: v(-8), dri: v(-12), def: v(4), phy: v(2), gk: 15 }
        : role === 'MF' ? { pac: v(-4), sho: v(-6), pas: v(4), dri: v(2), def: v(-12), phy: v(-6), gk: 15 }
          : { pac: v(3), sho: v(4), pas: v(-6), dri: v(2), def: v(-38), phy: v(-4), gk: 15 };
    const ovr = role === 'GK' ? a.gk : role === 'DF' ? Math.round(a.def * 0.5 + a.phy * 0.2 + a.pac * 0.15 + a.pas * 0.15)
      : role === 'MF' ? Math.round(a.pas * 0.35 + a.dri * 0.25 + a.sho * 0.15 + a.pac * 0.15 + a.def * 0.1)
        : Math.round(a.sho * 0.35 + a.pac * 0.25 + a.dri * 0.25 + a.phy * 0.15);
    const skin = SKINS[Math.floor(R() * SKINS.length)];
    const dark = SKINS.indexOf(skin) >= 5;
    return {
      first, last, name: first + ' ' + last, role, num: nums[role][ni[role]++], attrs: a, ovr,
      skin, hairColor: dark ? HAIRS[Math.floor(R() * 3)] : pick(HAIRS), hair: pick(HAIR_STYLES),
      height: role === 'GK' ? 1.86 + R() * 0.1 : 1.70 + R() * 0.18, build: 0.92 + R() * 0.18, boots: pick(BOOTS), beard: R() < 0.3
    };
  });
  for (const r of out) {
    const h = hashStr(r.name);
    r.foot = h % 5 === 0 ? 'L' : 'R'; // 1 de cada 5 es zurdo
    // personalidad: que no todos jueguen igual
    const a = r.attrs, field = r.role !== 'GK';
    r.dribbler = field && a.dri >= a.pas + 3;               // prefiere encarar
    r.passer = field && !r.dribbler && a.pas >= 60;          // prefiere tocar
    r.longShot = field && r.role !== 'DF' && a.sho >= 68 && (h >> 3) % 3 === 0; // se anima a patear de lejos
  }
  club._roster = out;
  return out;
}

// --- escudos originales dibujados en canvas ---
function crestCanvas(club, size) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d'); const s = size / 100;
  const k = club.home, c1 = k.shirt, c2 = k.shirt2 === k.shirt ? (k.shorts !== k.shirt ? k.shorts : '#ffffff') : k.shirt2;
  c.save(); c.scale(s, s);
  const path = () => {
    c.beginPath();
    if (club.crest === 'round') c.arc(50, 50, 44, 0, TAU);
    else if (club.crest === 'diamond') { c.moveTo(50, 4); c.lineTo(94, 50); c.lineTo(50, 96); c.lineTo(6, 50); c.closePath(); }
    else { c.moveTo(12, 10); c.lineTo(88, 10); c.lineTo(88, 48); c.quadraticCurveTo(86, 80, 50, 96); c.quadraticCurveTo(14, 80, 12, 48); c.closePath(); }
  };
  if (club.crest === 'crown') { // corona arriba + escudo
    c.fillStyle = '#d4af37'; c.beginPath(); c.moveTo(26, 22); c.lineTo(30, 4); c.lineTo(40, 14); c.lineTo(50, 2); c.lineTo(60, 14); c.lineTo(70, 4); c.lineTo(74, 22); c.closePath(); c.fill();
    c.beginPath(); c.arc(50, 60, 36, 0, TAU); c.fillStyle = '#d4af37'; c.fill();
    c.beginPath(); c.arc(50, 60, 31, 0, TAU); c.fillStyle = '#ffffff'; c.fill();
    c.fillStyle = '#2a1f4a'; c.font = '900 26px Arial Black, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(club.short, 50, 62);
    c.restore(); return cv;
  }
  path(); c.fillStyle = '#ffffff'; c.fill();
  c.save(); path(); c.clip();
  c.fillStyle = c1; c.fillRect(0, 0, 100, 100);
  c.fillStyle = c2;
  const pt = k.pattern;
  if (pt === 'stripes') for (let x = 14; x < 100; x += 22) c.fillRect(x, 0, 11, 100);
  else if (pt === 'hoops') for (let y = 8; y < 100; y += 20) c.fillRect(0, y, 100, 10);
  else if (pt === 'band') c.fillRect(0, 40, 100, 20);
  else if (pt === 'sash' || pt === 'diagonal') { c.beginPath(); c.moveTo(0, pt === 'sash' ? 20 : 0); c.lineTo(pt === 'sash' ? 20 : 100, 0); c.lineTo(100, pt === 'sash' ? 80 : 100); c.lineTo(pt === 'sash' ? 80 : 0, 100); c.closePath(); if (pt === 'diagonal') { c.beginPath(); c.moveTo(0, 100); c.lineTo(100, 0); c.lineTo(100, 100); c.closePath(); } c.fill(); }
  else if (pt === 'vee') { c.beginPath(); c.moveTo(10, 0); c.lineTo(50, 45); c.lineTo(90, 0); c.lineTo(76, 0); c.lineTo(50, 28); c.lineTo(24, 0); c.closePath(); c.fill(); }
  else if (pt === 'half') c.fillRect(50, 0, 50, 100);
  else if (pt === 'center') c.fillRect(38, 0, 24, 100);
  else { c.fillRect(0, 62, 100, 38); }
  c.restore();
  path(); c.lineWidth = 6; c.strokeStyle = '#ffffff'; c.stroke();
  path(); c.lineWidth = 2; c.strokeStyle = 'rgba(0,0,0,.35)'; c.stroke();
  // franja con siglas
  c.fillStyle = 'rgba(8,10,14,.86)'; c.fillRect(16, 38, 68, 24);
  c.fillStyle = '#ffffff'; c.font = '900 19px Arial Black, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(club.short, 50, 51);
  c.restore();
  return cv;
}
const _crestCache = {};
function crestURL(club) {
  if (club.crestImg) return club.crestImg;
  if (!_crestCache[club.id]) _crestCache[club.id] = crestCanvas(club, 128).toDataURL();
  return _crestCache[club.id];
}

// mini camiseta para elegir uniforme
function kitIcon(kit, size) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const c = cv.getContext('2d'); const s = size / 40;
  c.scale(s, s);
  const shape = () => { c.beginPath(); c.moveTo(13, 4); c.lineTo(27, 4); c.lineTo(37, 11); c.lineTo(33, 18); c.lineTo(29, 15); c.lineTo(29, 36); c.lineTo(11, 36); c.lineTo(11, 15); c.lineTo(7, 18); c.lineTo(3, 11); c.closePath(); };
  shape(); c.fillStyle = kit.shirt; c.fill();
  c.save(); shape(); c.clip(); c.fillStyle = kit.shirt2;
  if (kit.pattern === 'stripes') for (let x = 12; x < 30; x += 6) c.fillRect(x, 0, 3, 40);
  else if (kit.pattern === 'hoops') for (let y = 8; y < 40; y += 7) c.fillRect(0, y, 40, 3.5);
  else if (kit.pattern === 'band') c.fillRect(0, 16, 40, 7);
  else if (kit.pattern === 'sash') { c.beginPath(); c.moveTo(10, 8); c.lineTo(16, 8); c.lineTo(32, 36); c.lineTo(26, 36); c.fill(); }
  else if (kit.pattern === 'vee') { c.beginPath(); c.moveTo(13, 4); c.lineTo(20, 16); c.lineTo(27, 4); c.lineTo(24, 4); c.lineTo(20, 11); c.lineTo(16, 4); c.fill(); }
  else if (kit.pattern === 'half') c.fillRect(20, 0, 20, 40);
  else if (kit.pattern === 'diagonal') { c.beginPath(); c.moveTo(0, 40); c.lineTo(40, 0); c.lineTo(40, 40); c.fill(); }
  else if (kit.pattern === 'center') c.fillRect(17, 0, 6, 40);
  else if (kit.pattern === 'sleeves') { c.fillRect(0, 0, 11, 40); c.fillRect(29, 0, 11, 40); }
  c.restore();
  shape(); c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,.4)'; c.stroke();
  return cv;
}

function colorDist(a, b) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return Math.hypot(ca.r - cb.r, ca.g - cb.g, ca.b - cb.b);
}
// elige el uniforme del visitante para que no se confunda con el local
function pickAwayKit(home, homeKit, away) {
  const hk = home[homeKit];
  const d = k => Math.min(colorDist(k.shirt, hk.shirt), colorDist(k.shirt2, hk.shirt) + 0.25) + colorDist(k.shorts, hk.shorts) * 0.3;
  return d(away.home) >= d(away.away) || d(away.home) > 0.55 ? 'home' : 'away';
}
