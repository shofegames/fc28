// ===== Renderizado: renderer, cielo, luces, mapa de entorno y calidad grafica =====
// Igual que en Gran Premio 3D: colores en sRGB, tono de cine (ACES), cielo con degrade y sol, y un mapa de
// entorno (PMREM) hecho con ese cielo para que los materiales tengan reflejos suaves.
const QUALITY = {
  // post: 0 nada, 1 color+viñeta+AA, 2 y 3 ademas bloom
  baja: { name: 'Baja', pr: 1, shadow: 0, crowd: 0.25, aa: false, aniso: 2, std: false, grass: 2048, post: 0 },
  media: { name: 'Media', pr: 1.25, shadow: 1024, crowd: 0.5, aa: true, aniso: 4, std: true, grass: 2048, post: 1 },
  alta: { name: 'Alta', pr: 1.5, shadow: 2048, crowd: 0.8, aa: true, aniso: 8, std: true, grass: 4096, post: 2 },
  ultra: { name: 'Ultra', pr: 2, shadow: 4096, crowd: 1, aa: true, aniso: 16, std: true, grass: 4096, post: 3 },
};
function detectQuality() {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  if (mobile) return 'baja';
  if (cores <= 4) return 'media';
  return 'alta';
}
if (!CFG.quality || !QUALITY[CFG.quality]) CFG.quality = detectQuality();
const Q = () => QUALITY[CFG.quality];
const lin = c => new THREE.Color(c).convertSRGBToLinear();
const LINTEX = new WeakSet(); // texturas ya marcadas (en r128 las texturas no tienen userData)

const SKIES = {
  dia: { top: '#2f6fd0', hor: '#cfe4f7', gnd: '#3b4a33', sun: '#fff1d6', disk: 1, fog: '#bcd6ee', hemiS: '#dcecff', hemiG: '#4a6a33', hemi: 0.75, sunI: 1.75, sunC: '#fff4e2', sunP: [-45, 70, 50], exp: 1.0 },
  nublado: { top: '#7f8c99', hor: '#c9d0d6', gnd: '#3f4a3a', sun: '#e8e8e8', disk: 0, fog: '#b9c1c8', hemiS: '#e6ecf2', hemiG: '#4a5e3a', hemi: 1.05, sunI: 0.8, sunC: '#f2f2f2', sunP: [-20, 80, 30], exp: 1.05 },
  noche: { top: '#02040b', hor: '#0e1a33', gnd: '#05070a', sun: '#ffffff', disk: 0, stars: 1, fog: '#0b1322', hemiS: '#a9bde0', hemiG: '#1b2a18', hemi: 0.55, sunI: 1.9, sunC: '#f4f6ff', sunP: [-8, 95, 22], exp: 1.05 },
  // atardecer: sol bajo y anaranjado, sombras largas
  atardecer: { top: '#2b3f78', hor: '#ffb27a', gnd: '#3a3328', sun: '#ffcf96', disk: 1, fog: '#e7b48e', hemiS: '#ffd9b8', hemiG: '#4d4a2c', hemi: 0.9, sunI: 1.9, sunC: '#ffc488', sunP: [-90, 22, 48], exp: 1.0 },
  // lluvia: cielo gris oscuro, luz pareja
  lluvia: { top: '#4b555f', hor: '#8f99a3', gnd: '#30382f', sun: '#d8dde2', disk: 0, fog: '#7d8892', hemiS: '#cfd8e0', hemiG: '#3c4a36', hemi: 1.0, sunI: 0.55, sunC: '#e6ebf0', sunP: [-20, 80, 30], exp: 1.0 },
};
// dia/atardecer/noche y soleado/nublado/lluvia (acepta el setup o el formato viejo night/cloudy)
function envOf(S) { return { tod: S.tod || (S.night ? 'noche' : 'dia'), weather: S.weather || (S.cloudy ? 'nublado' : 'sol') }; }

const R = {
  sun: null, hemi: null, glows: [], sky: null, skyMat: null, envRT: null, pmrem: null,
  init() {
    const q = Q();
    // con post-procesado el antialiasing lo hace Post (MSAA en la textura o FXAA): el lienzo no lo necesita
    const renderer = G.renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: q.aa && !q.post, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = q.shadow > 0;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = G.scene = new THREE.Scene();
    G.camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 1200);
    G.camera.position.set(0, 30, 60);
    this.hemi = new THREE.HemisphereLight(0xdcecff, 0x3b5a2a, 0.75); scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(-30, 70, 40); sun.target.position.set(0, 0, 0);
    // (se configura siempre: la calidad automatica puede prender o apagar las sombras sin recargar)
    sun.castShadow = !!q.shadow; sun.shadow.mapSize.set(q.shadow || 1024, q.shadow || 1024);
    { const c = sun.shadow.camera; c.left = -64; c.right = 64; c.top = 44; c.bottom = -44; c.near = 10; c.far = 200; }
    sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025; sun.shadow.radius = 2;
    scene.add(sun); scene.add(sun.target);
    // cielo: degrade + sol + estrellas de noche
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGnd: { value: new THREE.Color() }, uSun: { value: new THREE.Color() }, uDir: { value: new THREE.Vector3(0, 1, 0) }, uDisk: { value: 1 }, uStars: { value: 0 } },
      vertexShader: 'varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `uniform vec3 uTop,uHor,uGnd,uSun,uDir;uniform float uDisk,uStars;varying vec3 vD;
        float h3(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
        void main(){vec3 d=normalize(vD);float h=d.y;vec3 c;
          if(h>0.0){c=mix(uHor,uTop,pow(h,0.5));}else{c=mix(uHor,uGnd,clamp(pow(-h*3.0,0.6),0.0,1.0));}
          float s=max(dot(d,normalize(uDir)),0.0);
          c+=uSun*(pow(s,600.0)*6.0*uDisk+pow(s,12.0)*0.35*uDisk);
          if(uStars>0.0&&h>0.05){vec3 q=floor(d*420.0);float st=step(0.9975,h3(q));c+=vec3(st)*uStars*smoothstep(0.05,0.4,h);}
          gl_FragColor=vec4(c,1.0);}`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), this.skyMat);
    this.sky.frustumCulled = false; this.sky.renderOrder = -1; scene.add(this.sky);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight);
      G.camera.aspect = innerWidth / innerHeight; G.camera.updateProjectionMatrix();
    });
  },
  // hora del dia y clima
  setEnv(a, b) {
    const E = typeof a === 'object' ? envOf(a) : { tod: a ? 'noche' : 'dia', weather: b ? 'nublado' : 'sol' };
    const night = E.tod === 'noche', rain = E.weather === 'lluvia';
    this.env = E;
    const key = night ? 'noche' : rain ? 'lluvia' : E.weather === 'nublado' ? 'nublado' : E.tod === 'atardecer' ? 'atardecer' : 'dia';
    const s = G.scene, S = Object.assign({}, SKIES[key]), u = this.skyMat.uniforms;
    if (night && rain) { S.sunI *= 0.8; S.fog = '#121a26'; }
    if (E.tod === 'atardecer' && E.weather !== 'sol') { S.hor = '#c9a48c'; S.sunC = '#f0c8a0'; }
    u.uTop.value.copy(lin(S.top)); u.uHor.value.copy(lin(S.hor)); u.uGnd.value.copy(lin(S.gnd)); u.uSun.value.copy(lin(S.sun));
    u.uDisk.value = S.disk; u.uStars.value = S.stars || 0;
    s.background = null; s.fog = new THREE.Fog(lin(S.fog), rain ? 70 : 220, rain ? 420 : 900); // con lluvia, algo de niebla
    this.hemi.color.copy(lin(S.hemiS)); this.hemi.groundColor.copy(lin(S.hemiG)); this.hemi.intensity = S.hemi;
    this.sun.color.copy(lin(S.sunC)); this.sun.intensity = S.sunI;
    this.sunOff = new THREE.Vector3(...S.sunP); this.fitShadow(0, 0, 70);
    u.uDir.value.set(...S.sunP).normalize();
    G.renderer.toneMappingExposure = S.exp;
    for (const g of this.glows) g.visible = !!night;
    Weather.set(rain, night);
    NightShadows.set(night);
    this.prep(G.scene); Stadium.nightLights(night);
    // mapa de entorno para los reflejos
    if (Q().std) { if (this.envRT) this.envRT.dispose(); const sky = this.skyCanvas(S); this.envRT = this.pmrem.fromEquirectangular(sky); sky.dispose(); s.environment = this.envRT.texture; }
  },
  // la camara de sombras sigue a lo que se ve (en vez de cubrir toda la cancha): sombras mas nitidas con el mismo mapa
  fitShadow(x, z, half) {
    const sun = this.sun, o = this.sunOff; if (!o) return;
    const h = half || 34, c = sun.shadow.camera;
    sun.target.position.set(x, 0, z); sun.position.set(x + o.x, o.y, z + o.z);
    if (c.right !== h) { c.left = -h; c.right = h; c.top = h * 0.75; c.bottom = -h * 0.75; c.updateProjectionMatrix(); }
    sun.target.updateMatrixWorld();
  },
  // imagen equirectangular del cielo (para el mapa de entorno): degrade, suelo verde y el resplandor del sol
  skyCanvas(S) {
    const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, S.top); g.addColorStop(0.47, S.hor); g.addColorStop(0.5, S.hor); g.addColorStop(0.53, '#3d5a32'); g.addColorStop(1, S.gnd);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // tribunas alrededor: franja oscura con puntos de color (publico)
    c.fillStyle = 'rgba(40,44,52,0.85)'; c.fillRect(0, H * 0.4, W, H * 0.1);
    for (let i = 0; i < 900; i++) { c.fillStyle = `hsl(${Math.random() * 360},45%,${35 + Math.random() * 30}%)`; c.fillRect(Math.random() * W, H * (0.4 + Math.random() * 0.1), 2, 2); }
    if (S.disk || S.stars) {
      const [x, y, z] = S.sunP, len = Math.hypot(x, y, z), el = Math.asin(y / len), az = Math.atan2(z, x);
      const sx = (az / TAU + 0.5) * W, sy = (0.5 - el / Math.PI) * H;
      const r = c.createRadialGradient(sx, sy, 0, sx, sy, S.disk ? 60 : 30);
      r.addColorStop(0, S.disk ? 'rgba(255,250,235,1)' : 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,250,235,0)');
      c.fillStyle = r; c.fillRect(0, 0, W, H);
    }
    const tx = new THREE.CanvasTexture(cv); tx.mapping = THREE.EquirectangularReflectionMapping; tx.encoding = THREE.sRGBEncoding;
    return tx;
  },
  // pasa colores y texturas a sRGB lineal y cambia Lambert/Phong por materiales PBR (MeshStandard) si la calidad lo permite
  _up: new Map(),
  prep(root) {
    const std = Q().std;
    root.traverse(o => {
      if (!o.material) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const out = list.map(m => {
        if (this._up.has(m)) return this._up.get(m);
        let n = m;
        if (!m.userData.lin) {
          m.userData.lin = true;
          if (m.color && !m.isShaderMaterial) m.color.convertSRGBToLinear();
          if (m.emissive) m.emissive.convertSRGBToLinear();
          if (m.map && !LINTEX.has(m.map)) { m.map.encoding = THREE.sRGBEncoding; LINTEX.add(m.map); m.map.needsUpdate = true; }
          m.needsUpdate = true;
        }
        if (std && !m.userData.keep && !m.onBeforeCompile.toString().includes('uTime') && (m.isMeshLambertMaterial || m.isMeshPhongMaterial)) {
          const ud = m.userData;
          n = new THREE.MeshStandardMaterial({
            color: m.color, map: m.map, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side, depthWrite: m.depthWrite,
            emissive: m.emissive, roughness: ud.rough != null ? ud.rough : m.isMeshPhongMaterial ? 0.35 : 0.82, metalness: ud.metal || 0,
            envMapIntensity: ud.env != null ? ud.env : 0.6, polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits,
          });
          n.userData = Object.assign({}, ud, { lin: true });
          this._up.set(m, n);
        }
        return n;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
  },
};
