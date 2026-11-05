// ===== Arcos: postes, travesaño y redes que se mueven cuando entra la pelota =====
const Goals = {
  nets: [],
  build() {
    const white = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 60 });
    const grey = new THREE.MeshLambertMaterial({ color: 0xcfd3d8 });
    // textura de red (rombos) con transparencia
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(64, 64); c.moveTo(64, 0); c.lineTo(0, 64); c.stroke();
    const netTex = new THREE.CanvasTexture(cv); netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
    const netMat = (rx, ry) => { const t = netTex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, depthWrite: false }); };
    const R = PITCH.postR, gw = PITCH.goalHW, gh = PITCH.goalH, gd = PITCH.goalD;
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.x = s * PITCH.HL; G.scene.add(g);
      const post = new THREE.CylinderGeometry(R, R, gh + R, 12);
      for (const t of [-1, 1]) { const m = new THREE.Mesh(post, white); m.position.set(0, (gh + R) / 2, t * (gw + R)); m.castShadow = true; g.add(m); }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(R, R, gw * 2 + R * 4, 12), white);
      bar.rotation.x = Math.PI / 2; bar.position.set(0, gh + R, 0); bar.castShadow = true; g.add(bar);
      // soportes de atras
      const sb = new THREE.CylinderGeometry(0.025, 0.025, 1, 6);
      for (const t of [-1, 1]) {
        const top = new THREE.Mesh(sb, grey); top.scale.y = gd; top.rotation.z = Math.PI / 2; top.position.set(s * gd / 2, gh + R, t * (gw + R)); g.add(top);
        const back = new THREE.Mesh(sb, grey); back.scale.y = gh + R; back.position.set(s * gd, (gh + R) / 2, t * (gw + R)); g.add(back);
        const low = new THREE.Mesh(sb, grey); low.scale.y = gd; low.rotation.z = Math.PI / 2; low.position.set(s * gd / 2, 0.03, t * (gw + R)); g.add(low);
      }
      const bb = new THREE.Mesh(sb, grey); bb.scale.y = gw * 2; bb.rotation.x = Math.PI / 2; bb.position.set(s * gd, gh + R, 0); g.add(bb);
      // red del fondo: plano con segmentos para deformarlo
      const back = new THREE.PlaneGeometry(gw * 2, gh, 24, 10);
      back.rotateY(Math.PI / 2);
      const bm = new THREE.Mesh(back, netMat(gw * 2 / 0.25, gh / 0.25)); bm.position.set(s * gd, gh / 2, 0); g.add(bm);
      const roof = new THREE.Mesh(new THREE.PlaneGeometry(gd, gw * 2), netMat(gd / 0.25, gw * 2 / 0.25));
      roof.rotation.x = -Math.PI / 2; roof.position.set(s * gd / 2, gh + R, 0); g.add(roof);
      for (const t of [-1, 1]) {
        const side = new THREE.Mesh(new THREE.PlaneGeometry(gd, gh), netMat(gd / 0.25, gh / 0.25));
        side.position.set(s * gd / 2, gh / 2, t * (gw + R)); g.add(side);
      }
      this.nets.push({ s, geo: back, base: back.attributes.position.array.slice(), hits: [] });
    }
  },
  // la fisica avisa cuando la pelota pega en la red del fondo
  hit(s, z, y, v) {
    const n = this.nets.find(n => n.s === s); if (!n) return;
    n.hits.push({ z, y, a: Math.min(0.55, v * 0.035), t: 0 });
    if (n.hits.length > 4) n.hits.shift();
  },
  update(dt) {
    for (const n of this.nets) {
      if (!n.hits.length && !n.dirty) continue;
      const p = n.geo.attributes.position, b = n.base;
      for (const h of n.hits) h.t += dt;
      n.hits = n.hits.filter(h => h.t < 2.2);
      for (let i = 0; i < p.count; i++) {
        const z = b[i * 3 + 2], y = b[i * 3 + 1] + PITCH.goalH / 2;
        let d = 0;
        for (const h of n.hits) {
          const r2 = (z - h.z) ** 2 + (y - h.y) ** 2;
          d += h.a * Math.exp(-r2 / 0.9) * Math.exp(-h.t * 2.4) * Math.cos(h.t * 11);
        }
        // los bordes estan atados a los caños
        const edge = Math.min(1, (PITCH.goalHW - Math.abs(z)) / 0.6, (PITCH.goalH / 2 - Math.abs(b[i * 3 + 1])) / 0.5);
        p.array[i * 3] = b[i * 3] + n.s * d * Math.max(0, edge);
      }
      p.needsUpdate = true; n.dirty = n.hits.length > 0;
    }
  },
};
