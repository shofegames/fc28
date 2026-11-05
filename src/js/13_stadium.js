// ===== Estadio: tribunas, publico animado, carteles, torres de luz, pantalla y bancos =====
const Stadium = {
  crowdMat: null, uniforms: { uTime: { value: 0 }, uAmp: { value: 0.05 } }, screen: null, screenCtx: null,
  build() {
    const scene = G.scene;
    this.boards();
    const concrete = new THREE.MeshLambertMaterial({ color: 0x5a616b });
    const dark = new THREE.MeshLambertMaterial({ color: 0x22262d });
    // tribuna escalonada: perfil (profundidad, altura) extruido a lo largo
    const ROWS = 24, RD = 0.85, RH = 0.42;
    const stairGeo = (len) => {
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0, RH);
      for (let i = 0; i < ROWS; i++) { sh.lineTo(i * RD + RD, (i + 1) * RH); if (i < ROWS - 1) sh.lineTo(i * RD + RD, (i + 2) * RH); }
      sh.lineTo(ROWS * RD, 0); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2); return g;
    };
    const sides = [
      { n: [0, 1], dist: 41.5, len: 126 }, { n: [0, -1], dist: 41.5, len: 126 },
      { n: [1, 0], dist: 61, len: 82 }, { n: [-1, 0], dist: 61, len: 82 },
    ];
    const seats = [];
    const dens = Q().crowd;
    const stand = new THREE.Group(); scene.add(stand);
    for (const sd of sides) {
      const phi = Math.atan2(-sd.n[1], sd.n[0]); // rota el +x local hacia la normal
      const m = new THREE.Mesh(stairGeo(sd.len), concrete);
      m.rotation.y = phi; m.position.set(sd.n[0] * sd.dist, 0.6, sd.n[1] * sd.dist); m.receiveShadow = true;
      stand.add(m);
      // pared del fondo y techo
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1, ROWS * RH + 6, sd.len), dark);
      wall.rotation.y = phi; wall.position.set(sd.n[0] * (sd.dist + ROWS * RD + 0.5), (ROWS * RH + 6) / 2, sd.n[1] * (sd.dist + ROWS * RD + 0.5)); stand.add(wall);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(ROWS * RD * 0.75, 0.4, sd.len), new THREE.MeshLambertMaterial({ color: 0x30353d }));
      roof.rotation.y = phi; const rd = sd.dist + ROWS * RD * 0.62;
      roof.position.set(sd.n[0] * rd, ROWS * RH + 6, sd.n[1] * rd);
      if (sd.n[1] !== 1) stand.add(roof); // la tribuna de la camara de TV no lleva techo (taparia la cancha)
      // butacas para el publico
      const cos = Math.cos(phi), sin = Math.sin(phi);
      for (let r = 0; r < ROWS; r++) {
        for (let s = -sd.len / 2 + 1; s < sd.len / 2 - 1; s += 0.62) {
          if (Math.random() > dens * (r < 3 ? 0.7 : 0.95)) continue;
          const lx = r * RD + RD * 0.55, ly = 0.6 + (r + 1) * RH, lz = s + (Math.random() - 0.5) * 0.1;
          // local -> mundo (rotacion en Y)
          const wx = lx * cos + lz * sin + sd.n[0] * sd.dist, wz = -lx * sin + lz * cos + sd.n[1] * sd.dist;
          seats.push(wx, ly, wz, phi);
        }
      }
    }
    // tunel de salida (lado de enfrente, en el medio) y bancos de suplentes
    const tunnel = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 3), new THREE.MeshLambertMaterial({ color: 0x0b0d10 }));
    tunnel.position.set(0, 1.6, -42.5); scene.add(tunnel);
    const tframe = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 3.2), new THREE.MeshLambertMaterial({ color: 0xb8ff3c, emissive: 0x2a4a00 }));
    tframe.position.set(0, 3.4, -42.5); scene.add(tframe);
    for (const s of [-1, 1]) {
      const bench = new THREE.Group(); bench.position.set(s * 9, 0, -37.2);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.8), new THREE.MeshLambertMaterial({ color: 0x1b2636 })); seat.position.y = 0.45; bench.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(7.4, 2.1, 0.15), new THREE.MeshLambertMaterial({ color: 0x1b2636 })); back.position.set(0, 1.05, -0.6); bench.add(back);
      const dome = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.1, 1.6), new THREE.MeshPhongMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.35 })); dome.position.set(0, 2.1, 0.1); bench.add(dome);
      scene.add(bench);
    }
    // torres de luz
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mastMat = new THREE.MeshLambertMaterial({ color: 0x3a4048 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * 66, z = sz * 50;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 42, 8), mastMat); mast.position.set(x, 21, z); scene.add(mast);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 0.6), new THREE.MeshLambertMaterial({ color: 0x2a2f36 }));
      panel.position.set(x, 43, z); panel.lookAt(0, 0, 0); scene.add(panel);
      const lamps = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.4), lightMat);
      lamps.position.copy(panel.position).add(new THREE.Vector3(-x, -43, -z).normalize().multiplyScalar(0.35)); lamps.lookAt(0, 0, 0); scene.add(lamps);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff6e0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(30, 30, 1); glow.position.copy(lamps.position); scene.add(glow); R.glows.push(glow);
    }
    // pantalla gigante detras de un arco
    const sc = document.createElement('canvas'); sc.width = 512; sc.height = 192; this.screenCtx = sc.getContext('2d');
    this.screenTex = new THREE.CanvasTexture(sc);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(20, 7.5), new THREE.MeshBasicMaterial({ map: this.screenTex }));
    scr.position.set(-80.5, 19, 0); scr.rotation.y = Math.PI / 2; scene.add(scr);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8.3, 20.8), dark); frame.position.set(-80.9, 19, 0); scene.add(frame);
    this.drawScreen();
    this.crowd(seats);
  },
  crowd(seats) {
    const n = seats.length / 4; if (!n) return;
    // persona: torso + cabeza (dos cajas unidas)
    const torso = new THREE.BoxGeometry(0.44, 0.6, 0.32); torso.translate(0, 0.3, 0);
    const head = new THREE.BoxGeometry(0.22, 0.24, 0.22); head.translate(0, 0.74, 0);
    const geo = mergeGeos([torso, head]);
    const ph = new Float32Array(n), spd = new Float32Array(n);
    for (let i = 0; i < n; i++) { ph[i] = Math.random() * TAU; spd[i] = 5 + Math.random() * 5; }
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
    geo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(spd, 1));
    const mat = this.crowdMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const U = this.uniforms;
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.uTime; sh.uniforms.uAmp = U.uAmp;
      sh.vertexShader = 'uniform float uTime; uniform float uAmp; attribute float aPhase; attribute float aSpeed;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n transformed.y += max(0.0, sin(uTime * aSpeed + aPhase)) * uAmp * (0.5 + 0.5 * sin(aPhase * 3.1));');
    };
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    const col = new THREE.Color();
    const hc = CLUBS[0].home;
    this.crowdMesh = mesh;
    for (let i = 0; i < n; i++) {
      pos.set(seats[i * 4], seats[i * 4 + 1], seats[i * 4 + 2]);
      q.setFromAxisAngle(up, seats[i * 4 + 3] - Math.PI / 2 + Math.PI);
      const s = 0.9 + Math.random() * 0.2; sc.set(s, s, s);
      m4.compose(pos, q, sc); mesh.setMatrixAt(i, m4);
      col.set(0x777777); mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    G.scene.add(mesh);
    this.paintCrowd(hc.shirt, hc.shirt2, '#ffffff', '#ffffff');
  },
  // pinta la hinchada con los colores de los equipos (mas del local)
  paintCrowd(h1, h2, a1, a2) {
    const mesh = this.crowdMesh; if (!mesh) return;
    const col = new THREE.Color(), shirts = ['#2b2f3a', '#e8e8e8', '#4a5260', '#1c1f26', '#6b4a3a', '#8a8f99'];
    const R = seeded(1234);
    for (let i = 0; i < mesh.count; i++) {
      const r = R();
      const c = r < 0.38 ? h1 : r < 0.56 ? h2 : r < 0.68 ? a1 : r < 0.74 ? a2 : shirts[Math.floor(R() * shirts.length)];
      col.set(c); const k = 0.8 + R() * 0.3; col.r *= k; col.g *= k; col.b *= k;
      mesh.setColorAt(i, col);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  },
  boards() {
    const texts = ['SHOFE GAMES', 'FC 28', 'TURBO COLA', 'MATECITO', 'CARBONITA', 'PANCHO\'S', 'GRAN PREMIO 3D', 'SÚPER BOTÍN', 'ALFAJOR NORTE', 'KAVANAGH'];
    const cols = [['#b8ff3c', '#0b0f14'], ['#0b0f14', '#b8ff3c'], ['#e8202a', '#ffffff'], ['#1a7a3a', '#ffe14d'], ['#111827', '#3cf0ff'], ['#ffd23c', '#1a1a1a'], ['#ff3b30', '#0b0f14'], ['#2a62ff', '#ffffff'], ['#5a2a12', '#ffd9a0'], ['#0b0f14', '#ffffff']];
    const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 64; const c = cv.getContext('2d');
    const w = 2048 / texts.length;
    texts.forEach((t, i) => {
      c.fillStyle = cols[i][0]; c.fillRect(i * w, 0, w, 64);
      c.fillStyle = cols[i][1]; c.font = '900 italic 38px Arial Black, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(t, i * w + w / 2, 34, w - 16);
    });
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = THREE.RepeatWrapping;
    tex.anisotropy = Math.min(Q().aniso, G.renderer.capabilities.getMaxAnisotropy());
    const mk = (len, x, z, ry, rep) => {
      const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rep, 1); t.offset.x = Math.random();
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), new THREE.MeshBasicMaterial({ map: t }));
      m.position.set(x, 0.45, z); m.rotation.y = ry; G.scene.add(m);
      const back = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.1), new THREE.MeshLambertMaterial({ color: 0x15181d }));
      back.position.set(x, 0.45, z); back.rotation.y = ry; back.translateZ(-0.07); G.scene.add(back);
    };
    mk(112, 0, -38.6, 0, 2.2); mk(112, 0, 38.6, Math.PI, 2.2);
    mk(78, -57.6, 0, Math.PI / 2, 1.5); mk(78, 57.6, 0, -Math.PI / 2, 1.5);
  },
  drawScreen(text) {
    const c = this.screenCtx; if (!c) return;
    c.fillStyle = '#05070a'; c.fillRect(0, 0, 512, 192);
    c.fillStyle = '#b8ff3c'; c.fillRect(0, 0, 512, 8); c.fillRect(0, 184, 512, 8);
    c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (text) { c.font = '900 64px Arial Black, Arial'; c.fillText(text, 256, 100, 490); }
    else { c.font = '900 italic 92px Arial Black, Arial'; c.fillText('FC', 200, 100); c.fillStyle = '#b8ff3c'; c.fillText('28', 330, 100); }
    this.screenTex.needsUpdate = true;
  },
  update(t, excite) {
    this.uniforms.uTime.value = t;
    this.uniforms.uAmp.value = damp(this.uniforms.uAmp.value, 0.03 + excite * 0.4, 3, 1 / 60);
  },
};
function mergeGeos(list) {
  const geos = list.map(g => g.index ? g.toNonIndexed() : g);
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}
let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,250,230,0.5)'); g.addColorStop(1, 'rgba(255,240,200,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128); _glowTex = new THREE.CanvasTexture(cv); return _glowTex;
}
