// ===== Renderizado: renderer, escena, luces y calidad grafica =====
const QUALITY = {
  baja: { name: 'Baja', pr: 0.75, shadow: 0, crowd: 0.25, aa: false, aniso: 2 },
  media: { name: 'Media', pr: 1, shadow: 1024, crowd: 0.5, aa: true, aniso: 4 },
  alta: { name: 'Alta', pr: 1.5, shadow: 2048, crowd: 0.8, aa: true, aniso: 8 },
  ultra: { name: 'Ultra', pr: 2, shadow: 4096, crowd: 1, aa: true, aniso: 16 },
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

const R = {
  sun: null, hemi: null, glows: [],
  init() {
    const q = Q();
    const renderer = G.renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: q.aa, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = q.shadow > 0;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = G.scene = new THREE.Scene();
    G.camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 900);
    G.camera.position.set(0, 30, 60);
    this.hemi = new THREE.HemisphereLight(0xdcecff, 0x3b5a2a, 0.75); scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 0.95);
    sun.position.set(-30, 70, 40); sun.target.position.set(0, 0, 0);
    if (q.shadow) {
      sun.castShadow = true; sun.shadow.mapSize.set(q.shadow, q.shadow);
      const c = sun.shadow.camera; c.left = -66; c.right = 66; c.top = 48; c.bottom = -48; c.near = 10; c.far = 170;
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    }
    scene.add(sun); scene.add(sun.target);
    addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight);
      G.camera.aspect = innerWidth / innerHeight; G.camera.updateProjectionMatrix();
    });
  },
  // dia/noche y nublado
  setEnv(night, cloudy) {
    const s = G.scene;
    if (night) {
      s.background = new THREE.Color(0x070b16); s.fog = new THREE.Fog(0x070b16, 160, 420);
      this.hemi.color.set(0x9fb4d8); this.hemi.groundColor.set(0x1e2e18); this.hemi.intensity = 0.55;
      this.sun.color.set(0xf4f6ff); this.sun.intensity = 1.0; this.sun.position.set(-10, 90, 25);
    } else if (cloudy) {
      s.background = new THREE.Color(0xa9b4c0); s.fog = new THREE.Fog(0xa9b4c0, 180, 520);
      this.hemi.color.set(0xe6ecf2); this.hemi.groundColor.set(0x4a5e3a); this.hemi.intensity = 0.95;
      this.sun.color.set(0xf2f2f2); this.sun.intensity = 0.55; this.sun.position.set(-20, 80, 30);
    } else {
      s.background = new THREE.Color(0x86bdf0); s.fog = new THREE.Fog(0x9cc8f0, 200, 600);
      this.hemi.color.set(0xdcecff); this.hemi.groundColor.set(0x3b5a2a); this.hemi.intensity = 0.72;
      this.sun.color.set(0xfff3dc); this.sun.intensity = 0.98; this.sun.position.set(-35, 75, 45);
    }
    for (const g of this.glows) g.visible = !!night;
  },
};
