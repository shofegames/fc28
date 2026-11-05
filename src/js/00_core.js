// ===== Constantes, utilidades y estado global =====
// Cancha: eje X a lo largo (105 m), eje Z a lo ancho (68 m), Y hacia arriba. La camara de TV esta del lado +Z.
const PITCH = { L: 105, W: 68, HL: 52.5, HW: 34, goalHW: 3.66, goalH: 2.44, goalD: 2.0, postR: 0.06,
  boxX: 16.5, boxHW: 20.16, sixX: 5.5, sixHW: 9.16, penX: 11, circR: 9.15 };
const BALL_R = 0.11, GRAV = 9.81, DT = 1 / 60, SUB = 4;
const TAU = Math.PI * 2;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const randn = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
const angWrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const $ = id => document.getElementById(id);

function seeded(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }
function segDist(ax, az, bx, bz, px, pz) {
  const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz;
  let t = l ? ((px - ax) * dx + (pz - az) * dz) / l : 0; t = clamp(t, 0, 1);
  return Math.hypot(ax + dx * t - px, az + dz * t - pz);
}
// interpolacion por claves: keys = [[u, valor], ...] ordenadas por u
function keyf(u, keys) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (u <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; return lerp(a[1], b[1], smooth((u - a[0]) / (b[0] - a[0]))); }
  }
  return keys[keys.length - 1][1];
}

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};

// Esquemas de teclas. "flechas" es el clasico de los juegos de futbol en PC: flechas para moverse y todo lo demas
// al lado, con la otra mano (S pase, D disparo, W filtrado, A centro). Defendiendo, el pase es entrada y el disparo barrida.
const SCHEMES = {
  flechas: { name: 'Flechas + A S D W', keys: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', sprint: 'KeyE', pass: 'KeyS', through: 'KeyW',
    shoot: 'KeyD', lob: 'KeyA', switch: 'KeyQ', tackle: 'KeyF', action: 'Space' }, alt: {} },
  wasd: { name: 'WASD + mouse', keys: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', sprint: 'ShiftLeft', pass: 'Space', through: 'KeyR',
    shoot: 'KeyF', lob: 'KeyX', switch: 'KeyQ', tackle: 'KeyE', action: 'KeyV' }, alt: { pass: 'Mouse0', shoot: 'Mouse2', through: 'Mouse1' } },
  jkl: { name: 'WASD + J K L I', keys: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', sprint: 'ShiftLeft', pass: 'KeyJ', through: 'KeyK',
    shoot: 'KeyL', lob: 'KeyI', switch: 'KeyQ', tackle: 'KeyE', action: 'Space' }, alt: {} },
};
const DEFAULT_KEYS = SCHEMES.flechas.keys;
const KEY_NAMES = { up: 'Avanzar', down: 'Retroceder', left: 'Izquierda', right: 'Derecha', sprint: 'Correr', pass: 'Pase corto (defendiendo: entrada)',
  through: 'Pase filtrado', shoot: 'Disparar (defendiendo: barrida)', lob: 'Centro / pase largo', switch: 'Cambiar de jugador', tackle: 'Entrada', action: 'Barrida / pique' };

const CFG = Object.assign({ quality: null, showFps: false, volume: 0.8, cam: 0 }, store.get('fc28_cfg', {}));
if (!CFG.scheme || !SCHEMES[CFG.scheme] && CFG.scheme !== 'custom') CFG.scheme = 'flechas';
CFG.keys = CFG.scheme === 'custom' ? Object.assign({}, DEFAULT_KEYS, CFG.keys || {}) : Object.assign({}, SCHEMES[CFG.scheme].keys);
const altKeys = () => CFG.scheme === 'custom' ? {} : SCHEMES[CFG.scheme].alt;
function saveCfg() { store.set('fc28_cfg', CFG); }

// Estado global del juego
const G = {
  scene: null, renderer: null, camera: null,
  ball: null, teams: [], players: [],
  owner: null, lastTouch: null, passInfo: null, kickSeq: 0,
  match: null, human: null, mode: 'menu', paused: false, time: 0, frame: 0,
  setup: store.get('fc28_setup', { home: 'rasing', away: 'barchelona', homeKit: 'home', awayKit: 'auto', diff: 1, halfMin: 3, night: false, cloudy: false, formation: '4-3-3', tactic: 'equilibrado' })
};
