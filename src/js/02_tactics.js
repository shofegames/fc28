// ===== Formaciones y tacticas =====
// Posiciones relativas al equipo que ataca hacia +x: x de -1 (arco propio) a 1 (arco rival), z de -1 a 1 (ancho).
// Son la "forma defensiva base"; la IA las corre segun la pelota, si ataca o defiende y la tactica.
const S = (role, x, z, tag) => ({ role, x, z, tag });
const FORMATIONS = {
  '4-3-3': [S('GK', -1, 0, 'ARQ'), S('DF', -0.6, 0.72, 'LI'), S('DF', -0.66, 0.24, 'DFC'), S('DF', -0.66, -0.24, 'DFC'), S('DF', -0.6, -0.72, 'LD'),
    S('MF', -0.4, 0, 'MCD'), S('MF', -0.28, 0.42, 'MC'), S('MF', -0.28, -0.42, 'MC'), S('FW', -0.02, 0.68, 'EI'), S('FW', 0.04, 0, 'DC'), S('FW', -0.02, -0.68, 'ED')],
  '4-4-2': [S('GK', -1, 0, 'ARQ'), S('DF', -0.6, 0.72, 'LI'), S('DF', -0.66, 0.24, 'DFC'), S('DF', -0.66, -0.24, 'DFC'), S('DF', -0.6, -0.72, 'LD'),
    S('MF', -0.3, 0.72, 'MI'), S('MF', -0.34, 0.22, 'MC'), S('MF', -0.34, -0.22, 'MC'), S('MF', -0.3, -0.72, 'MD'), S('FW', 0.02, 0.2, 'DC'), S('FW', 0.02, -0.2, 'DC')],
  '4-2-3-1': [S('GK', -1, 0, 'ARQ'), S('DF', -0.6, 0.72, 'LI'), S('DF', -0.66, 0.24, 'DFC'), S('DF', -0.66, -0.24, 'DFC'), S('DF', -0.6, -0.72, 'LD'),
    S('MF', -0.42, 0.2, 'MCD'), S('MF', -0.42, -0.2, 'MCD'), S('MF', -0.16, 0.62, 'MI'), S('MF', -0.14, 0, 'MCO'), S('MF', -0.16, -0.62, 'MD'), S('FW', 0.05, 0, 'DC')],
  '4-1-4-1': [S('GK', -1, 0, 'ARQ'), S('DF', -0.6, 0.72, 'LI'), S('DF', -0.66, 0.24, 'DFC'), S('DF', -0.66, -0.24, 'DFC'), S('DF', -0.6, -0.72, 'LD'),
    S('MF', -0.45, 0, 'MCD'), S('MF', -0.24, 0.7, 'MI'), S('MF', -0.26, 0.22, 'MC'), S('MF', -0.26, -0.22, 'MC'), S('MF', -0.24, -0.7, 'MD'), S('FW', 0.04, 0, 'DC')],
  '3-5-2': [S('GK', -1, 0, 'ARQ'), S('DF', -0.64, 0.45, 'DFC'), S('DF', -0.68, 0, 'DFC'), S('DF', -0.64, -0.45, 'DFC'),
    S('MF', -0.32, 0.8, 'CRI'), S('MF', -0.38, 0.25, 'MC'), S('MF', -0.42, 0, 'MCD'), S('MF', -0.38, -0.25, 'MC'), S('MF', -0.32, -0.8, 'CRD'), S('FW', 0.02, 0.2, 'DC'), S('FW', 0.02, -0.2, 'DC')],
  '3-4-3': [S('GK', -1, 0, 'ARQ'), S('DF', -0.64, 0.45, 'DFC'), S('DF', -0.68, 0, 'DFC'), S('DF', -0.64, -0.45, 'DFC'),
    S('MF', -0.32, 0.76, 'MI'), S('MF', -0.38, 0.2, 'MC'), S('MF', -0.38, -0.2, 'MC'), S('MF', -0.32, -0.76, 'MD'), S('FW', -0.02, 0.6, 'EI'), S('FW', 0.04, 0, 'DC'), S('FW', -0.02, -0.6, 'ED')],
  '5-3-2': [S('GK', -1, 0, 'ARQ'), S('DF', -0.54, 0.8, 'CRI'), S('DF', -0.64, 0.4, 'DFC'), S('DF', -0.68, 0, 'DFC'), S('DF', -0.64, -0.4, 'DFC'), S('DF', -0.54, -0.8, 'CRD'),
    S('MF', -0.34, 0.36, 'MC'), S('MF', -0.38, 0, 'MCD'), S('MF', -0.34, -0.36, 'MC'), S('FW', 0.02, 0.2, 'DC'), S('FW', 0.02, -0.2, 'DC')],
};
// push: cuanto sube el bloque al atacar; press: cuanto sube al defender; width: ancho; dribble/pass: preferencias de la IA
const TACTICS = {
  equilibrado: { name: 'Equilibrado', push: 0, press: 0, width: 1, widthD: 1, lenA: 1, lenD: 1, dribble: 0, pass: 0, direct: 0, pressK: 1 },
  presion_alta: { name: 'Presión alta', push: 3, press: 9, width: 1, widthD: 1.05, lenA: 1, lenD: 0.9, dribble: 0, pass: 0, direct: 0, pressK: 1.35 },
  presion_media: { name: 'Presión media', push: 0, press: 3, width: 1, widthD: 1, lenA: 1, lenD: 0.95, dribble: 0, pass: 0, direct: 0, pressK: 1.1 },
  bloque_bajo: { name: 'Bloque bajo', push: -4, press: -10, width: 0.95, widthD: 0.85, lenA: 0.95, lenD: 0.8, dribble: -0.05, pass: 0.05, direct: 0.1, pressK: 0.75 },
  contraataque: { name: 'Contraataque', push: 4, press: -6, width: 1.05, widthD: 0.9, lenA: 1.15, lenD: 0.85, dribble: 0.1, pass: -0.05, direct: 0.3, pressK: 0.9 },
  posesion: { name: 'Posesión', push: 1, press: 2, width: 1, widthD: 1, lenA: 0.85, lenD: 0.95, dribble: -0.15, pass: 0.2, direct: -0.25, pressK: 1.1 },
  bandas: { name: 'Juego por bandas', push: 1, press: 0, width: 1.15, widthD: 1, lenA: 1, lenD: 1, dribble: 0.05, pass: 0, direct: 0, pressK: 1, cross: 0.25 },
  directo: { name: 'Ataque directo', push: 3, press: 0, width: 1, widthD: 1, lenA: 1.15, lenD: 1, dribble: 0, pass: -0.05, direct: 0.45, pressK: 1 },
};
// Dificultad: cambia como piensa la IA (reaccion, decisiones, precision), no la velocidad de los jugadores.
const DIFFS = [
  { name: 'Fácil', decide: 0.75, passErr: 1.7, shotErr: 1.6, tackle: -0.15, press: 0.55, gkReact: 0.34, gkReach: 0.8, noise: 0.4, cover: false, intercept: 0.6 },
  { name: 'Normal', decide: 0.45, passErr: 1.25, shotErr: 1.25, tackle: -0.06, press: 0.8, gkReact: 0.25, gkReach: 0.9, noise: 0.24, cover: true, intercept: 0.8 },
  { name: 'Difícil', decide: 0.3, passErr: 1.0, shotErr: 1.0, tackle: 0.02, press: 1.0, gkReact: 0.19, gkReach: 0.98, noise: 0.13, cover: true, intercept: 0.95 },
  { name: 'Profesional', decide: 0.18, passErr: 0.82, shotErr: 0.88, tackle: 0.07, press: 1.18, gkReact: 0.14, gkReach: 1.04, noise: 0.06, cover: true, intercept: 1.05 },
];
// los compañeros del jugador humano juegan siempre en nivel "Difícil"; el rival usa la dificultad elegida
const teamDiff = team => team.human ? DIFFS[2] : DIFFS[G.setup.diff];
