// ===== Cesped y lineas reglamentarias (105 x 68 m) =====
const Pitch = {
  flags: [],
  build() {
    const scene = G.scene;
    // cesped con franjas, variaciones de tono y zonas gastadas (arcos y centro)
    const W = Q().grass, H = W / 2, AW = 124, AH = 84; // el area pintada cubre 124 x 84 m (4096 px en Alta/Ultra)
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const px = m => (m + AW / 2) / AW * W, pz = m => (m + AH / 2) / AH * H;
    c.fillStyle = '#336f2c'; c.fillRect(0, 0, W, H);
    const stripes = 20, sw = PITCH.L / stripes;
    for (let i = 0; i < stripes; i++) {
      c.fillStyle = i % 2 ? '#2c6a27' : '#3a8433'; // franjas del corte de pasto
      c.fillRect(px(-PITCH.HL + i * sw), pz(-PITCH.HW - 4), px(-PITCH.HL + (i + 1) * sw) - px(-PITCH.HL + i * sw) + 1, pz(PITCH.HW + 4) - pz(-PITCH.HW - 4));
    }
    // fuera de la cancha un poco mas oscuro
    c.fillStyle = 'rgba(20,45,18,0.35)';
    c.fillRect(0, 0, W, pz(-PITCH.HW - 4)); c.fillRect(0, pz(PITCH.HW + 4), W, H);
    c.fillRect(0, 0, px(-PITCH.HL - 4), H); c.fillRect(px(PITCH.HL + 4), 0, W, H);
    // ruido de cesped
    const img = c.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 14;
      d[i] += n * 0.6; d[i + 1] += n; d[i + 2] += n * 0.4;
    }
    c.putImageData(img, 0, 0);
    // manchones suaves y desgaste
    for (let i = 0; i < 380; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = 10 + Math.random() * 60;
      const gr = c.createRadialGradient(x, y, 0, x, y, r);
      const dark = Math.random() < 0.5;
      gr.addColorStop(0, dark ? 'rgba(20,60,20,0.10)' : 'rgba(140,190,90,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const wear = (x, z, rx, rz, a) => {
      c.save(); c.translate(px(x), pz(z)); c.scale(rx / AW * W, rz / AH * H);
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, `rgba(150,140,80,${a})`); gr.addColorStop(0.6, `rgba(130,140,70,${a * 0.5})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill(); c.restore();
    };
    wear(-PITCH.HL + 2.5, 0, 4, 5, 0.45); wear(PITCH.HL - 2.5, 0, 4, 5, 0.45);
    wear(-PITCH.HL + 8, 0, 8, 10, 0.18); wear(PITCH.HL - 8, 0, 8, 10, 0.18); wear(0, 0, 6, 6, 0.15);
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = Math.min(Q().aniso, G.renderer.capabilities.getMaxAnisotropy());
    // textura de detalle (hojitas de pasto) que se repite muchas veces: de cerca el cesped se ve definido
    const dc = document.createElement('canvas'); dc.width = dc.height = 256; const d2 = dc.getContext('2d');
    d2.fillStyle = 'rgb(128,128,128)'; d2.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5200; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, l = 2 + Math.random() * 5, v = 70 + Math.random() * 130;
      d2.strokeStyle = `rgb(${v},${v + (Math.random() * 40 - 20)},${v})`; d2.lineWidth = 1;
      d2.beginPath(); d2.moveTo(x, y); d2.lineTo(x + (Math.random() - 0.5) * 2, y - l); d2.stroke();
    }
    const det = new THREE.CanvasTexture(dc); det.wrapS = det.wrapT = THREE.RepeatWrapping;
    det.anisotropy = tex.anisotropy; LINTEX.add(det);
    const gm = Q().std ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0, envMapIntensity: 0.35 }) : new THREE.MeshLambertMaterial({ map: tex });
    gm.userData.keep = true;
    gm.onBeforeCompile = sh => {
      sh.uniforms.uDetail = { value: det };
      sh.fragmentShader = 'uniform sampler2D uDetail;\n' + sh.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\n  float gd = texture2D(uDetail, vUv * 110.0).g; float gb = texture2D(uDetail, vUv * 9.0).r;\n  diffuseColor.rgb *= (0.78 + 0.44 * gd) * (0.94 + 0.12 * gb);');
    };
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(AW, AH), gm);
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; scene.add(grass);
    // tierra/cemento alrededor
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(360, 300), new THREE.MeshLambertMaterial({ color: 0x2c3a2a }));
    apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02; scene.add(apron);

    // lineas como geometria (siempre nitidas)
    const lm = new THREE.MeshBasicMaterial({ color: 0xeef1ea, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const lw = 0.12, y = 0.012;
    const lines = new THREE.Group(); scene.add(lines);
    const rect = (x1, z1, x2, z2) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x2 - x1) || lw, Math.abs(z2 - z1) || lw), lm);
      m.rotation.x = -Math.PI / 2; m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); lines.add(m);
    };
    const hl = PITCH.HL, hw = PITCH.HW;
    rect(-hl - lw / 2, -hw, hl + lw / 2, -hw); rect(-hl - lw / 2, hw, hl + lw / 2, hw);
    rect(-hl, -hw, -hl, hw); rect(hl, -hw, hl, hw); rect(0, -hw, 0, hw);
    for (const s of [-1, 1]) {
      const gx = s * hl;
      // area grande
      rect(gx - s * PITCH.boxX, -PITCH.boxHW, gx - s * PITCH.boxX, PITCH.boxHW);
      rect(gx, -PITCH.boxHW, gx - s * PITCH.boxX, -PITCH.boxHW); rect(gx, PITCH.boxHW, gx - s * PITCH.boxX, PITCH.boxHW);
      // area chica
      rect(gx - s * PITCH.sixX, -PITCH.sixHW, gx - s * PITCH.sixX, PITCH.sixHW);
      rect(gx, -PITCH.sixHW, gx - s * PITCH.sixX, -PITCH.sixHW); rect(gx, PITCH.sixHW, gx - s * PITCH.sixX, PITCH.sixHW);
      // punto penal y medialuna
      const sp = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), lm); sp.rotation.x = -Math.PI / 2; sp.position.set(gx - s * PITCH.penX, y, 0); lines.add(sp);
      const a0 = Math.acos((PITCH.boxX - PITCH.penX) / PITCH.circR); // angulo donde la medialuna toca el area
      const arc = new THREE.Mesh(new THREE.RingGeometry(PITCH.circR - lw / 2, PITCH.circR + lw / 2, 48, 1, -a0, a0 * 2), lm);
      arc.rotation.x = -Math.PI / 2; arc.rotation.z = s > 0 ? Math.PI : 0;
      arc.position.set(gx - s * PITCH.penX, y, 0); lines.add(arc);
      // corners
      for (const t of [-1, 1]) {
        const ca = new THREE.Mesh(new THREE.RingGeometry(1 - lw / 2, 1 + lw / 2, 12, 1, 0, Math.PI / 2), lm);
        ca.rotation.x = -Math.PI / 2; ca.position.set(gx, y, t * hw);
        // orientar el cuarto de circulo hacia adentro de la cancha
        ca.rotation.z = s > 0 ? (t > 0 ? Math.PI / 2 : Math.PI) : (t > 0 ? 0 : -Math.PI / 2);
        lines.add(ca);
        this.addFlag(gx, t * hw);
      }
    }
    const cc = new THREE.Mesh(new THREE.RingGeometry(PITCH.circR - lw / 2, PITCH.circR + lw / 2, 64), lm);
    cc.rotation.x = -Math.PI / 2; cc.position.y = y; lines.add(cc);
    const cs = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), lm); cs.rotation.x = -Math.PI / 2; cs.position.y = y; lines.add(cs);
  },
  addFlag(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), new THREE.MeshLambertMaterial({ color: 0xffe14d }));
    pole.position.y = 0.8; pole.castShadow = true; g.add(pole);
    const geo = new THREE.PlaneGeometry(0.42, 0.3, 6, 1); geo.translate(0.21, 0, 0);
    const flag = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xff3b30, side: THREE.DoubleSide }));
    flag.position.y = 1.45; g.add(flag);
    G.scene.add(g); this.flags.push({ flag, geo, base: geo.attributes.position.array.slice(), ph: Math.random() * 6 });
  },
  update(t) {
    for (const f of this.flags) {
      const p = f.geo.attributes.position, b = f.base;
      for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.array[i * 3 + 2] = Math.sin(t * 6 + f.ph - x * 9) * 0.05 * (x / 0.42); }
      p.needsUpdate = true;
    }
  },
};
