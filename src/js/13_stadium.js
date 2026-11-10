// ===== Estadio: tribunas de dos bandejas, techo con estructura, publico (instancing), banderas, bengalas,
// carteles LED que cambian, pantalla, torres de luz, bancos con suplentes, tecnicos, alcanzapelotas y fotografos =====
const Stadium = {
  crowdMat: null, uniforms: { uTime: { value: 0 }, uAmp: { value: 0.05 } }, screen: null, screenCtx: null, leds: [], smoke: null, lastT: 0,
  build() {
    const scene = G.scene, q = Q();
    this.boards();
    const concrete = new THREE.MeshLambertMaterial({ color: 0x5a616b });
    const concrete2 = new THREE.MeshLambertMaterial({ color: 0x4d545e });
    const dark = new THREE.MeshLambertMaterial({ color: 0x22262d });
    const steel = new THREE.MeshLambertMaterial({ color: 0x8b939e });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x30353d });
    // tribuna escalonada: perfil (profundidad, altura) extruido a lo largo
    const RD = 0.85, RH = 0.42, L1 = 15, L2 = 13;
    const stairGeo = (rows, len) => {
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0, RH);
      for (let i = 0; i < rows; i++) { sh.lineTo(i * RD + RD, (i + 1) * RH); if (i < rows - 1) sh.lineTo(i * RD + RD, (i + 2) * RH); }
      sh.lineTo(rows * RD, 0); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2); return g;
    };
    const sides = [
      { n: [0, 1], dist: 41.5, len: 126, tv: true }, { n: [0, -1], dist: 41.5, len: 126 },
      { n: [1, 0], dist: 61, len: 82, away: true }, { n: [-1, 0], dist: 61, len: 82, barra: true },
    ];
    const T1 = { d0: 0, y0: 0.6, rows: L1 }, up0 = L1 * RD - 3.5, T2 = { d0: up0 + 0.3, y0: L1 * RH + 2.9, rows: L2 };
    const back = T2.d0 + L2 * RD, top = T2.y0 + L2 * RH, roofY = top + 5.5;
    const seats = [], flags = [];
    const dens = q.crowd;
    const stand = this.standGroup = new THREE.Group(); scene.add(stand);
    this.fan = { barra: null, away: null };
    for (const sd of sides) {
      const phi = Math.atan2(-sd.n[1], sd.n[0]); // rota el +x local hacia la normal
      const cos = Math.cos(phi), sin = Math.sin(phi);
      const toW = (lx, lz) => [lx * cos + lz * sin + sd.n[0] * sd.dist, -lx * sin + lz * cos + sd.n[1] * sd.dist];
      const place = (m, d, y) => { m.rotation.y = phi; m.position.set(sd.n[0] * (sd.dist + d), y, sd.n[1] * (sd.dist + d)); stand.add(m); return m; };
      // bandeja baja y bandeja alta
      const s1 = new THREE.Mesh(stairGeo(L1, sd.len), concrete); s1.receiveShadow = true; place(s1, T1.d0, T1.y0);
      const s2 = new THREE.Mesh(stairGeo(L2, sd.len), concrete2); s2.receiveShadow = true; place(s2, T2.d0, T2.y0);
      // frente de la bandeja alta (con carteles LED) y el techo de la bandeja baja
      place(new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.3, sd.len), dark), up0, T2.y0 - 0.85);
      place(new THREE.Mesh(new THREE.BoxGeometry(L1 * RD - up0 + 0.4, 0.3, sd.len), dark), (up0 + L1 * RD) / 2, T2.y0 - 0.1);
      this.ledBand(sd, phi, up0 - 0.22, T2.y0 - 0.85, sd.len);
      // pared del fondo
      place(new THREE.Mesh(new THREE.BoxGeometry(1, roofY + 0.5, sd.len), dark), back + 0.5, (roofY + 0.5) / 2);
      // techo con vigas reticuladas (la tribuna de la camara de TV no lleva techo: taparia la cancha)
      if (!sd.tv) {
        const rd = 17.5, rc = back - rd / 2 + 0.5;
        place(new THREE.Mesh(new THREE.BoxGeometry(rd, 0.35, sd.len), roofMat), rc, roofY);
        place(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, sd.len), steel), back - rd + 0.6, roofY - 0.45); // viga del frente
        for (let s = -sd.len / 2 + 4; s <= sd.len / 2 - 4; s += 9) {
          const beam = new THREE.Group();
          const chord = new THREE.Mesh(new THREE.BoxGeometry(rd, 0.18, 0.18), steel); chord.position.y = -1.6; beam.add(chord);
          for (let k = 0; k < 6; k++) { const dg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.75, 0.12), steel); dg.position.set(-rd / 2 + 1.4 + k * (rd - 2.8) / 5, -0.8, 0); dg.rotation.z = k % 2 ? 0.55 : -0.55; beam.add(dg); }
          beam.rotation.y = phi; const [wx, wz] = toW(rc, s); beam.position.set(wx, roofY - 0.1, wz); stand.add(beam);
        }
      }
      // butacas para el publico (dos bandejas)
      for (const T of [T1, T2]) {
        const upper = T === T2;
        for (let r = 0; r < T.rows; r++) {
          for (let s = -sd.len / 2 + 1; s < sd.len / 2 - 1; s += 0.62) {
            const barra = sd.barra && !upper && Math.abs(s) < 26, awaySec = sd.away && !upper && s > 14;
            if (Math.random() > dens * (barra ? 1.1 : r < 3 ? 0.7 : 0.95)) continue;
            const lx = T.d0 + r * RD + RD * 0.55, ly = T.y0 + (r + 1) * RH, lz = s + (Math.random() - 0.5) * 0.1;
            const [wx, wz] = toW(lx, lz);
            const standUp = barra || awaySec || Math.random() < 0.06;
            seats.push({ x: wx, y: ly, z: wz, phi, stand: standUp, zone: barra ? 1 : awaySec ? 2 : 0 });
            // banderas: muchas en la barra, algunas sueltas
            if ((barra && Math.random() < 0.07) || (awaySec && Math.random() < 0.05) || Math.random() < 0.003 * dens) flags.push({ x: wx, y: ly + 1.75, z: wz, phi, zone: barra ? 1 : awaySec ? 2 : 0 });
          }
        }
      }
      // de donde salen las bengalas en un gol
      const mid = (a, b) => toW(T1.d0 + L1 * RD * 0.5, a);
      if (sd.barra) this.fan.barra = { c: mid(0), r: 20, y: 4 };
      if (sd.away) this.fan.away = { c: toW(T1.d0 + L1 * RD * 0.5, 27), r: 10, y: 4 };
    }
    // tunel de salida (lado de enfrente, en el medio)
    const tunnel = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 3), new THREE.MeshLambertMaterial({ color: 0x0b0d10 }));
    tunnel.position.set(0, 1.6, -42.5); scene.add(tunnel);
    const tframe = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 3.2), new THREE.MeshLambertMaterial({ color: 0xb8ff3c, emissive: 0x2a4a00 }));
    tframe.position.set(0, 3.4, -42.5); scene.add(tframe);
    for (const s of [-1, 1]) {
      const bench = new THREE.Group(); bench.position.set(s * 9, 0, -37.2);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.8), new THREE.MeshLambertMaterial({ color: 0x1b2636 })); seat.position.y = 0.25; bench.add(seat);
      const bk = new THREE.Mesh(new THREE.BoxGeometry(7.4, 2.1, 0.15), new THREE.MeshLambertMaterial({ color: 0x1b2636 })); bk.position.set(0, 1.05, -0.6); bench.add(bk);
      const dome = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.1, 1.6), new THREE.MeshPhongMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.35 })); dome.position.set(0, 2.1, 0.1); bench.add(dome);
      scene.add(bench);
    }
    this.people();
    // torres de luz
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mastMat = new THREE.MeshLambertMaterial({ color: 0x3a4048 });
    this.masts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * 66, z = sz * 50;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 42, 8), mastMat); mast.position.set(x, 21, z); scene.add(mast);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 0.6), new THREE.MeshLambertMaterial({ color: 0x2a2f36 }));
      panel.position.set(x, 43, z); panel.lookAt(0, 0, 0); scene.add(panel);
      const lamps = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.4), lightMat);
      lamps.position.copy(panel.position).add(new THREE.Vector3(-x, -43, -z).normalize().multiplyScalar(0.35)); lamps.lookAt(0, 0, 0); scene.add(lamps);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff6e0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(30, 30, 1); glow.position.copy(lamps.position); scene.add(glow); R.glows.push(glow);
      this.masts.push(new THREE.Vector3(x, 43, z));
    }
    // pantalla gigante colgada del techo, detras de un arco
    const sc = document.createElement('canvas'); sc.width = 512; sc.height = 192; this.screenCtx = sc.getContext('2d');
    this.screenTex = new THREE.CanvasTexture(sc);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(20, 7.5), new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false }));
    scr.position.set(-(61 + back - 17.5 + 1.2), roofY - 5, 0); scr.rotation.y = Math.PI / 2; scene.add(scr);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8.3, 20.8), dark); frame.position.set(scr.position.x - 0.4, scr.position.y, 0); scene.add(frame);
    this.drawScreen();
    this.mergeStand();
    this.crowd(seats);
    this.makeFlags(flags);
    this.makeSmoke();
  },
  // une las ~300 piezas de las tribunas (escalones, paredes, techos, vigas) en una malla por material
  mergeStand() {
    const g = this.standGroup; g.updateMatrixWorld(true);
    const byMat = new Map();
    g.traverse(o => { if (o.isMesh) { if (!byMat.has(o.material)) byMat.set(o.material, []); byMat.get(o.material).push(o); } });
    const old = []; g.traverse(o => { if (o !== g) old.push(o); });
    for (const o of old) if (o.parent) o.parent.remove(o);
    for (const [mat, list] of byMat) {
      const geos = list.map(m => { const gg = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()); gg.applyMatrix4(m.matrixWorld); return gg; });
      const merged = mergeGeos(geos); geos.forEach(x => x.dispose()); list.forEach(m => m.geometry.dispose());
      const mesh = new THREE.Mesh(merged, mat); mesh.receiveShadow = true; g.add(mesh);
    }
  },
  // ---- publico: UNA malla instanciada (torso + cabeza), cabeza color piel con un atributo propio ----
  crowd(seats) {
    const n = seats.length; if (!n) return;
    const torso = new THREE.CylinderGeometry(0.2, 0.15, 0.62, 5); torso.scale(1.2, 1, 0.75); torso.translate(0, 0.31, 0);
    const head = new THREE.SphereGeometry(0.115, 6, 4); head.scale(0.95, 1.1, 1); head.translate(0, 0.76, 0);
    const geo = mergeGeos([torso, head]);
    const tc = (torso.index ? torso.toNonIndexed() : torso).attributes.position.count;
    const isHead = new Float32Array(geo.attributes.position.count); for (let i = tc; i < isHead.length; i++) isHead[i] = 1;
    geo.setAttribute('aHead', new THREE.BufferAttribute(isHead, 1));
    const ph = new Float32Array(n), spd = new Float32Array(n), skin = new Float32Array(n * 3), st = new Float32Array(n);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      ph[i] = Math.random() * TAU; spd[i] = 5 + Math.random() * 5; st[i] = seats[i].stand ? 1 : 0;
      col.set(SKINS[Math.floor(Math.random() * SKINS.length)]).convertSRGBToLinear(); if (Math.random() < 0.18) col.set(HAIRS[Math.floor(Math.random() * 4)]).convertSRGBToLinear(); // de espaldas o con gorro
      skin[i * 3] = col.r; skin[i * 3 + 1] = col.g; skin[i * 3 + 2] = col.b;
    }
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1)); geo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(spd, 1));
    geo.setAttribute('aSkin', new THREE.InstancedBufferAttribute(skin, 3)); geo.setAttribute('aStand', new THREE.InstancedBufferAttribute(st, 1));
    const mat = this.crowdMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const U = this.uniforms;
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.uTime; sh.uniforms.uAmp = U.uAmp;
      sh.vertexShader = 'uniform float uTime; uniform float uAmp; attribute float aPhase; attribute float aSpeed; attribute float aHead; attribute float aStand; attribute vec3 aSkin;\n' + sh.vertexShader
        .replace('#include <color_vertex>', 'vColor = mix(instanceColor.xyz, aSkin, aHead);')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.y += max(0.0, sin(uTime * aSpeed + aPhase)) * uAmp * (0.5 + 0.5 * sin(aPhase * 3.1)) * (1.0 + aStand * 1.2);');
    };
    const mesh = this.crowdMesh = new THREE.InstancedMesh(geo, mat, n);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    this.zones = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const s = seats[i]; this.zones[i] = s.zone;
      pos.set(s.x, s.y + (s.stand ? 0.42 : 0), s.z);
      qq.setFromAxisAngle(up, s.phi + Math.PI / 2);
      const k = 0.9 + Math.random() * 0.2; sc.set(k, k * (s.stand ? 1.15 : 1), k);
      m4.compose(pos, qq, sc); mesh.setMatrixAt(i, m4);
      col.set(0x777777); mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    G.scene.add(mesh);
    const hc = CLUBS[0].home; this.paintCrowd(hc.shirt, hc.shirt2, '#ffffff', '#ffffff');
  },
  // banderas (instancing): dos colores, flamean con el viento
  makeFlags(list) {
    const n = list.length; if (!n) return;
    const geo = new THREE.PlaneGeometry(1.3, 0.85, 6, 2); geo.translate(0.65, 0, 0);
    const ph = new Float32Array(n), c2 = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) ph[i] = Math.random() * TAU;
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1)); geo.setAttribute('aCol2', new THREE.InstancedBufferAttribute(c2, 3));
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const U = this.uniforms;
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.uTime;
      sh.vertexShader = 'uniform float uTime; attribute float aPhase; attribute vec3 aCol2; varying vec3 vC2; varying float vFV;\n' + sh.vertexShader
        .replace('#include <color_vertex>', '#include <color_vertex>\n vC2 = aCol2; vFV = uv.y;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n float fk = position.x / 1.3; transformed.z += sin(uTime * 5.0 + aPhase + position.x * 4.0) * 0.16 * fk; transformed.y += sin(uTime * 2.3 + aPhase) * 0.12;');
      sh.fragmentShader = 'varying vec3 vC2; varying float vFV;\n' + sh.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.rgb *= (fract(vFV * 1.5) > 0.5 ? vColor : vC2);');
    };
    const mesh = this.flagMesh = new THREE.InstancedMesh(geo, mat, n);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color(1, 1, 1);
    this.flagZones = list.map(f => f.zone);
    list.forEach((f, i) => { pos.set(f.x, f.y, f.z); qq.setFromAxisAngle(up, f.phi + Math.PI / 2); m4.compose(pos, qq, one); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, col); });
    mesh.instanceMatrix.needsUpdate = true; G.scene.add(mesh);
  },
  // pinta la hinchada con los colores de los equipos (mas del local; la barra casi toda del local, un sector visitante)
  paintCrowd(h1, h2, a1, a2) {
    const mesh = this.crowdMesh; if (!mesh) return;
    const col = new THREE.Color(), shirts = ['#2b2f3a', '#e8e8e8', '#4a5260', '#1c1f26', '#6b4a3a', '#8a8f99'];
    const R = seeded(1234);
    for (let i = 0; i < mesh.count; i++) {
      const r = R(), z = this.zones[i];
      const c = z === 1 ? (r < 0.6 ? h1 : r < 0.92 ? h2 : '#1c1f26') : z === 2 ? (r < 0.6 ? a1 : r < 0.92 ? a2 : '#1c1f26')
        : r < 0.38 ? h1 : r < 0.56 ? h2 : r < 0.68 ? a1 : r < 0.74 ? a2 : shirts[Math.floor(R() * shirts.length)];
      col.set(c).convertSRGBToLinear(); const k = 0.75 + R() * 0.35; col.r *= k; col.g *= k; col.b *= k;
      mesh.setColorAt(i, col);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.teamCols = { home: [h1, h2], away: [a1, a2] };
    const fm = this.flagMesh;
    if (fm) {
      const c2 = fm.geometry.attributes.aCol2;
      for (let i = 0; i < fm.count; i++) {
        const away = this.flagZones[i] === 2 || (this.flagZones[i] === 0 && R() < 0.3);
        const [p, s] = away ? [a1, a2] : [h1, h2];
        col.set(p).convertSRGBToLinear(); fm.setColorAt(i, col);
        col.set(s === p ? '#ffffff' : s).convertSRGBToLinear(); c2.setXYZ(i, col.r, col.g, col.b);
      }
      fm.instanceColor.needsUpdate = true; c2.needsUpdate = true;
    }
  },
  // gente alrededor de la cancha (todo en una sola malla estatica con colores por vertice):
  // suplentes y cuerpo tecnico en los bancos, tecnicos parados, alcanzapelotas, fotografos y camaras de TV
  people() {
    const parts = [];
    const add = (g, color, m) => { const gg = g.index ? g.toNonIndexed() : g.clone(); gg.applyMatrix4(m); parts.push({ g: gg, c: new THREE.Color(color).convertSRGBToLinear() }); };
    const M = (x, y, z, ry, rx) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), headG = new THREE.SphereGeometry(0.11, 7, 5);
    // persona: base en (x,z) mirando hacia ry; pose stand/sit/crouch
    const person = (x, z, ry, pose, shirt, pants, extra) => {
      const base = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
      const P = (g, c, lx, ly, lz, rx) => add(g, c, base.clone().multiply(M(lx, ly, lz, 0, rx)));
      const skin = SKINS[Math.floor(Math.random() * SKINS.length)];
      if (pose === 'sit') {
        P(box(0.36, 0.55, 0.22), shirt, 0, 0.82, 0); P(headG, skin, 0, 1.22, 0.02);
        for (const s of [-1, 1]) { P(box(0.13, 0.13, 0.42), pants, s * 0.1, 0.55, 0.2); P(box(0.12, 0.5, 0.12), pants, s * 0.1, 0.27, 0.4); P(box(0.11, 0.07, 0.22), '#15171b', s * 0.1, 0.035, 0.46); }
      } else if (pose === 'crouch') {
        P(box(0.36, 0.5, 0.22), shirt, 0, 0.7, 0.05, 0.35); P(headG, skin, 0, 1.06, 0.18);
        for (const s of [-1, 1]) { P(box(0.13, 0.13, 0.4), pants, s * 0.11, 0.45, 0.18); P(box(0.12, 0.42, 0.12), pants, s * 0.11, 0.22, 0.36); }
      } else {
        P(box(0.38, 0.6, 0.22), shirt, 0, 1.2, 0); P(headG, skin, 0, 1.66, 0);
        for (const s of [-1, 1]) { P(box(0.14, 0.88, 0.14), pants, s * 0.1, 0.45, 0); P(box(0.1, 0.55, 0.1), shirt, s * 0.25, 1.15, 0); }
      }
      if (extra === 'camera') { P(box(0.2, 0.18, 0.32), '#1a1a1a', 0, pose === 'crouch' ? 1.07 : 1.6, 0.36); P(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 8), '#111111', 0, pose === 'crouch' ? 1.07 : 1.6, 0.66, Math.PI / 2); }
    };
    // bancos: 5 suplentes con pechera y 2 del cuerpo tecnico por banco; tecnico parado adelante
    for (const s of [-1, 1]) {
      const bib = s < 0 ? '#ff7a1a' : '#d6ff3a';
      for (let i = 0; i < 7; i++) person(s * 9 - 3 + i, -37.05, 0, 'sit', i < 5 ? bib : '#1d2433', i < 5 ? '#1d2433' : '#1d2433');
      person(s * 9 + s * 1.5, -35.6, 0.2 * -s, 'stand', '#22252c', '#22252c'); // el tecnico, de traje
    }
    // alcanzapelotas (pechera amarilla)
    for (const [x, z, ry] of [[-55.6, -20, Math.PI / 2], [55.6, 20, -Math.PI / 2], [-55.6, 20, Math.PI / 2], [55.6, -20, -Math.PI / 2], [-30, 36.6, Math.PI], [30, 36.6, Math.PI], [-30, -36.4, 0], [30, -36.4, 0]]) person(x, z, ry, 'stand', '#ffd400', '#202020');
    // fotografos agachados detras de los arcos, y camaras de TV
    for (const sx of [-1, 1]) {
      for (const z of [-11, -9.4, -7.8, 7.8, 9.4, 11]) person(sx * 55.4, z + (Math.random() - 0.5) * 0.4, -sx * Math.PI / 2, 'crouch', '#2b2f3a', '#1c1f26', 'camera');
      person(sx * 55.8, -14, -sx * Math.PI / 2, 'stand', '#14161a', '#14161a', 'camera');
    }
    for (const x of [-20, 20]) person(x, 37.4, Math.PI, 'stand', '#14161a', '#14161a', 'camera');
    // une todo
    let n = 0; for (const p of parts) n += p.g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
    for (const p of parts) { const c = p.g.attributes.position.count; pos.set(p.g.attributes.position.array, o * 3); nor.set(p.g.attributes.normal.array, o * 3); for (let i = 0; i < c; i++) { col[(o + i) * 3] = p.c.r; col[(o + i) * 3 + 1] = p.c.g; col[(o + i) * 3 + 2] = p.c.b; } o += c; p.g.dispose(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true }); mat.userData.keep = true; mat.userData.lin = true;
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = !!Q().shadow; G.scene.add(mesh);
  },
  // carteles LED: una textura con todas las publicidades; cada 6 s pasan a la siguiente con un deslizamiento
  ledTex() {
    if (this._ledCanvas) return this._ledCanvas;
    const texts = ['SHOFE GAMES', 'FC 28', 'TURBO COLA', 'MATECITO', 'CARBONITA', 'PANCHO\'S', 'GRAN PREMIO 3D', 'SÚPER BOTÍN', 'ALFAJOR NORTE', 'KAVANAGH'];
    const cols = [['#b8ff3c', '#0b0f14'], ['#0b0f14', '#b8ff3c'], ['#e8202a', '#ffffff'], ['#1a7a3a', '#ffe14d'], ['#111827', '#3cf0ff'], ['#ffd23c', '#1a1a1a'], ['#ff3b30', '#0b0f14'], ['#2a62ff', '#ffffff'], ['#5a2a12', '#ffd9a0'], ['#0b0f14', '#ffffff']];
    const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 64; const c = cv.getContext('2d');
    const w = 2048 / texts.length;
    texts.forEach((t, i) => {
      c.fillStyle = cols[i][0]; c.fillRect(i * w, 0, w, 64);
      c.fillStyle = cols[i][1]; c.font = '900 italic 38px Arial Black, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(t, i * w + w / 2, 34, w - 16);
    });
    this.nAds = texts.length;
    return (this._ledCanvas = cv);
  },
  ledMat(rep) {
    const t = new THREE.CanvasTexture(this.ledTex()); t.wrapS = THREE.RepeatWrapping; t.repeat.set(rep, 1);
    t.anisotropy = Math.min(Q().aniso, G.renderer.capabilities.getMaxAnisotropy());
    const base = Math.floor(Math.random() * this.nAds) / this.nAds; t.offset.x = base;
    this.leds.push({ t, base, ph: Math.random() * 6 });
    return new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); // carteles LED: colores vivos
  },
  boards() {
    const mk = (len, x, z, ry, rep) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), this.ledMat(rep));
      m.position.set(x, 0.45, z); m.rotation.y = ry; G.scene.add(m);
      const back = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.1), new THREE.MeshLambertMaterial({ color: 0x15181d }));
      back.position.set(x, 0.45, z); back.rotation.y = ry; back.translateZ(-0.07); G.scene.add(back);
    };
    mk(112, 0, -38.6, 0, 2.2); mk(112, 0, 38.6, Math.PI, 2.2);
    mk(78, -57.6, 0, Math.PI / 2, 1.5); mk(78, 57.6, 0, -Math.PI / 2, 1.5);
  },
  // anillo LED entre las dos bandejas
  ledBand(sd, phi, d, y, len) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.6), this.ledMat(len / 50));
    m.rotation.y = phi - Math.PI / 2; m.position.set(sd.n[0] * (sd.dist + d), y, sd.n[1] * (sd.dist + d)); G.scene.add(m);
  },
  // humo de colores (bengalas) desde la tribuna del que hizo el gol
  makeSmoke() {
    const N = Q().crowd >= 0.5 ? 900 : 350;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), a = new Float32Array(N), sz = new Float32Array(N);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(a, 1)); geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: glowTexture() }, uScale: { value: 1 } },
      vertexShader: 'attribute float aAlpha; attribute float aSize; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;\nvoid main(){ vC = color; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D uTex; varying vec3 vC; varying float vA;\nvoid main(){ float t = texture2D(uTex, gl_PointCoord).a; if (t * vA < 0.01) discard; gl_FragColor = vec4(vC, t * vA * 0.55); }',
      transparent: true, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.visible = false; G.scene.add(pts);
    this.smoke = { pts, N, life: new Float32Array(N), vel: new Float32Array(N * 3), t: 0, on: 0 };
  },
  celebrate(home, cols) {
    const S = this.smoke, src = home ? this.fan.barra : this.fan.away; if (!S || !src) return;
    const c1 = new THREE.Color(cols[0]), c2 = new THREE.Color(cols[1] === cols[0] ? '#ffffff' : cols[1]);
    const g = S.pts.geometry, P = g.attributes.position.array, C = g.attributes.color.array;
    for (let i = 0; i < S.N; i++) {
      const ang = Math.random() * TAU, r = Math.sqrt(Math.random());
      P[i * 3] = src.c[0] + (Math.random() - 0.5) * (Math.abs(src.c[0]) > 50 ? 6 : src.r * 2) ; P[i * 3 + 1] = src.y + Math.random() * 2; P[i * 3 + 2] = src.c[1] + (Math.random() - 0.5) * (Math.abs(src.c[0]) > 50 ? src.r * 2 : 6);
      const c = Math.random() < 0.55 ? c1 : c2; C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b;
      S.life[i] = -Math.random() * 6; // aparecen de a poco
      S.vel[i * 3] = Math.cos(ang) * 0.4 * r + 0.3; S.vel[i * 3 + 1] = 1.4 + Math.random() * 1.6; S.vel[i * 3 + 2] = Math.sin(ang) * 0.4 * r;
    }
    g.attributes.color.needsUpdate = true; S.on = 14; S.pts.visible = true;
  },
  updateSmoke(dt) {
    const S = this.smoke; if (!S || S.on <= 0) return;
    S.on -= dt; if (S.on <= 0) { S.pts.visible = false; return; }
    const g = S.pts.geometry, P = g.attributes.position.array, A = g.attributes.aAlpha.array, Z = g.attributes.aSize.array;
    for (let i = 0; i < S.N; i++) {
      const l = S.life[i] += dt;
      if (l < 0) { A[i] = 0; continue; }
      P[i * 3] += S.vel[i * 3] * dt; P[i * 3 + 1] += S.vel[i * 3 + 1] * dt; P[i * 3 + 2] += S.vel[i * 3 + 2] * dt;
      S.vel[i * 3 + 1] *= 1 - 0.25 * dt;
      A[i] = clamp(l / 0.6, 0, 1) * clamp((8 - l) / 3, 0, 1) * clamp(S.on / 2, 0, 1);
      Z[i] = 3 + l * 1.6;
    }
    S.pts.material.uniforms.uScale.value = G.renderer.domElement.height / 2 / Math.tan(G.camera.fov * Math.PI / 360);
    g.attributes.position.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  },
  // de noche las tribunas quedan en penumbra (la luz de las torres va a la cancha)
  // (se llama despues de R.prep, con los materiales ya definitivos y en espacio lineal)
  nightLights(night) {
    const list = [this.crowdMesh, this.flagMesh]; if (this.standGroup) this.standGroup.traverse(o => { if (o.isMesh) list.push(o); });
    const done = new Set();
    for (const o of list) {
      const m = o && o.material; if (!m || !m.color || done.has(m)) continue; done.add(m);
      if (!m.userData.dayCol) m.userData.dayCol = m.color.clone();
      m.color.copy(m.userData.dayCol).multiplyScalar(night ? 0.5 : 1);
    }
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
    const dt = clamp(t - this.lastT, 0, 0.1); this.lastT = t;
    this.uniforms.uTime.value = t;
    this.uniforms.uAmp.value = damp(this.uniforms.uAmp.value, 0.03 + excite * 0.4, 3, 1 / 60);
    // carteles LED: cambian de publicidad cada 6 s (desliza en 0,6 s)
    for (const L of this.leds) { const k = (t + L.ph) / 6, seg = Math.floor(k), u = smooth(clamp((k - seg) * 10, 0, 1)); L.t.offset.x = L.base + (seg + u) / this.nAds; }
    this.updateSmoke(dt);
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
