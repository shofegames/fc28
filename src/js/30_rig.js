// ===== Futbolista 3D: modelo provisional con esqueleto (jerarquia de huesos) y animacion procedural =====
// Los huesos usan nombres estilo Mixamo (Hips, Spine, Head, LeftArm, LeftUpLeg...). Para cambiar a modelos GLB/GLTF
// con SkinnedMesh basta con crear otra clase con el mismo metodo animate(dt, player) que copie las rotaciones
// de this.j.* a los huesos del modelo (ver NOTAS.md). El resto del juego no cambia.
const _geoCache = {};
function capsuleGeo(rTop, rBot, len, seg) {
  const key = rTop + '|' + rBot + '|' + len + '|' + (seg || 10);
  if (_geoCache[key]) return _geoCache[key];
  const pts = [], hs = 4, c = len / 2;
  for (let i = 0; i <= hs; i++) { const a = -Math.PI / 2 + i / hs * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * rBot), -c + Math.sin(a) * rBot)); }
  for (let i = 0; i <= hs; i++) { const a = i / hs * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * rTop), c + Math.sin(a) * rTop)); }
  return (_geoCache[key] = new THREE.LatheGeometry(pts, seg || 10));
}
function latheGeo(key, profile, seg) {
  if (_geoCache[key]) return _geoCache[key];
  return (_geoCache[key] = new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(p[0], p[1])), seg || 16));
}
const _matCache = {};
function put(parent, mesh, y) { mesh.position.y = y; parent.add(mesh); return mesh; }
function bootMat(color) { return lam(color); }
// sombra de contacto bajo los pies (en calidad Baja es la unica sombra)
let _blob = null;
function blobMat() {
  if (_blob) return _blob;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); LINTEX.add(t);
  _blob = new THREE.MeshBasicMaterial({ map: t, color: 0x000000, transparent: true, opacity: Q().shadow ? 0.32 : 0.6, depthWrite: false });
  _blob.userData.lin = true; return _blob;
}
function lam(color) { if (!_matCache[color]) { _matCache[color] = new THREE.MeshLambertMaterial({ color }); _matCache[color].userData.hex = color; } return _matCache[color]; }

// textura de la camiseta (lathe: u=0 adelante, u=0.5 espalda; v=0 cintura, v=1 cuello)
function shirtTexture(kit, num, name, crest) {
  const W = 256, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H + 16; const c = cv.getContext('2d');
  c.fillStyle = '#ffffff'; c.fillRect(0, H, W, 16);
  c.fillStyle = kit.shirt; c.fillRect(0, 0, W, H);
  c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();
  c.fillStyle = kit.shirt2;
  const p = kit.pattern;
  if (p === 'stripes') for (let x = 0; x < W; x += 32) c.fillRect(x + 8, 0, 16, H);
  else if (p === 'hoops') for (let y = 20; y < H; y += 44) c.fillRect(0, y, W, 20);
  else if (p === 'band') { c.fillRect(0, H * 0.42, W, H * 0.2); }
  else if (p === 'sash') { c.save(); c.beginPath(); c.moveTo(0, H * 0.15); c.lineTo(W * 0.12, 0); c.lineTo(W * 0.36, 0); c.lineTo(W * 0.04, H * 0.72); c.lineTo(0, H * 0.72); c.closePath(); c.fill(); c.beginPath(); c.moveTo(W, H * 0.15); c.lineTo(W * 0.86, 0); c.lineTo(W * 0.62, 0); c.lineTo(W * 0.96, H * 0.72); c.lineTo(W, H * 0.72); c.closePath(); c.fill(); c.restore(); }
  else if (p === 'vee') { c.beginPath(); c.moveTo(W * 0.9, 0); c.lineTo(W, H * 0.4); c.lineTo(W, H * 0.25); c.lineTo(W * 0.95, 0); c.fill(); c.beginPath(); c.moveTo(W * 0.1, 0); c.lineTo(0, H * 0.4); c.lineTo(0, H * 0.25); c.lineTo(W * 0.05, 0); c.fill(); }
  else if (p === 'half') c.fillRect(W * 0.5, 0, W * 0.5, H);
  else if (p === 'diagonal') { c.beginPath(); c.moveTo(0, H); c.lineTo(W * 0.25, 0); c.lineTo(W * 0.75, 0); c.lineTo(W * 0.5, H); c.fill(); }
  else if (p === 'center') { c.fillRect(W * 0.94, 0, W * 0.06, H); c.fillRect(0, 0, W * 0.06, H); c.fillRect(W * 0.44, 0, W * 0.12, H); }
  // cuello
  c.fillStyle = kit.shirt2 !== kit.shirt ? kit.shirt2 : kit.num; c.fillRect(0, 0, W, 10);
  // numero y nombre en la espalda
  c.fillStyle = kit.num; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 3;
  c.font = '900 92px Arial Black, Arial'; c.strokeText(String(num), W / 2, H * 0.47); c.fillText(String(num), W / 2, H * 0.47);
  c.font = '800 22px Arial Narrow, Arial'; c.fillText(name.toUpperCase(), W / 2, H * 0.17, 110);
  // numero chico adelante y escudo
  c.font = '900 34px Arial Black, Arial'; c.fillText(String(num), W * 0.93, H * 0.36); c.fillText(String(num), W * 0.93 - W, H * 0.36);
  if (crest) c.drawImage(crest, W * 0.03, H * 0.22, 26, 26);
  c.restore();
  const t = new THREE.CanvasTexture(cv); return t;
}

class Rig {
  constructor(info, kit, crest) {
    const j = this.j = {};
    const root = this.root = new THREE.Group();
    const sc = info.height / 1.86; root.scale.set(sc * info.build, sc, sc * info.build);
    const skin = lam(info.skin), shorts = lam(kit.shorts), socks = lam(kit.socks), boots = bootMat(info.boots);
    const shirtTex = shirtTexture(kit, info.num, info.last, crest);
    const shirt = this.shirtMat = new THREE.MeshLambertMaterial({ map: shirtTex });
    const sleeve = kit.pattern === 'sleeves' ? lam(kit.shirt2) : lam(kit.shirt);
    const cast = m => { m.castShadow = true; return m; };
    const body = j.Body = new THREE.Bone(); body.position.y = 0.99; root.add(body);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), blobMat()); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; blob.renderOrder = 1; blob.userData.noBake = true; root.add(blob);
    const hips = j.Hips = new THREE.Bone(); body.add(hips);
    const pelvis = cast(new THREE.Mesh(latheGeo('pelvis', [[0.0001, -0.12], [0.13, -0.1], [0.155, -0.02], [0.15, 0.06], [0.0001, 0.07]]), shorts));
    pelvis.scale.set(1.18, 1, 0.85); hips.add(pelvis);
    const spine = j.Spine = new THREE.Bone(); spine.position.y = 0.05; hips.add(spine);
    const torso = cast(new THREE.Mesh(latheGeo('torso', [[0.0001, -0.02], [0.142, 0], [0.148, 0.1], [0.16, 0.24], [0.172, 0.36], [0.168, 0.44], [0.13, 0.51], [0.06, 0.545], [0.0001, 0.55]], 18), shirt));
    torso.scale.set(1.3, 1, 0.78); spine.add(torso);
    const neck = j.Neck = new THREE.Bone(); neck.position.y = 0.53; spine.add(neck);
    put(neck, new THREE.Mesh(capsuleGeo(0.048, 0.055, 0.06, 8), skin), 0.04);
    const head = j.Head = new THREE.Bone(); head.position.y = 0.16; neck.add(head);
    const skull = cast(new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), skin)); skull.scale.set(0.9, 1.1, 1); head.add(skull);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), skin); jaw.scale.set(1, 0.8, 1); jaw.position.set(0, -0.055, 0.02); head.add(jaw);
    const dark = lam('#141416');
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 4), dark); eye.position.set(s * 0.034, 0.012, 0.093); head.add(eye);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 0.01), lam(info.hairColor)); brow.position.set(s * 0.034, 0.034, 0.096); head.add(brow);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), skin); ear.scale.set(0.5, 1, 0.8); ear.position.set(s * 0.094, 0, 0); head.add(ear);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 6), skin); nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.008, 0.106); head.add(nose);
    const hm = lam(info.hairColor);
    if (info.hair !== 'bald') {
      const big = info.hair === 'afro' ? 1.3 : info.hair === 'buzz' ? 1.02 : 1.08;
      const theta = info.hair === 'long' ? 0.62 : info.hair === 'mohawk' ? 0.3 : 0.5;
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.108 * big, 14, 8, 0, TAU, 0, Math.PI * theta), hm);
      hair.scale.set(0.92, 1.05, 1.02); hair.position.set(0, 0.012, -0.008); hair.rotation.x = -0.25; head.add(hair);
      if (info.hair === 'long') { const back = new THREE.Mesh(capsuleGeo(0.08, 0.07, 0.08, 10), hm); back.position.set(0, -0.05, -0.05); back.scale.set(1.1, 1, 0.7); head.add(back); }
      if (info.hair === 'mohawk') { const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.2), hm); m.position.set(0, 0.1, -0.01); head.add(m); }
    }
    if (info.beard) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.078, 10, 6, 0, TAU, Math.PI * 0.45, Math.PI * 0.55), hm); b.position.set(0, -0.045, 0.018); head.add(b); }
    // brazos
    for (const s of [1, -1]) {
      const L = s > 0 ? 'Left' : 'Right';
      const sh = j[L + 'Arm'] = new THREE.Bone(); sh.position.set(s * 0.2, 0.455, 0); spine.add(sh);
      put(sh, cast(new THREE.Mesh(capsuleGeo(0.062, 0.056, 0.1, 10), sleeve)), -0.05);
      put(sh, cast(new THREE.Mesh(capsuleGeo(0.046, 0.04, 0.2, 8), skin)), -0.16);
      const el = j[L + 'ForeArm'] = new THREE.Bone(); el.position.y = -0.29; sh.add(el);
      put(el, cast(new THREE.Mesh(capsuleGeo(0.04, 0.033, 0.19, 8), skin)), -0.12);
      const hand = j[L + 'Hand'] = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), info.gk ? lam(kit.gloves || '#f2f2f2') : skin); hand.scale.set(0.75, 1.15, 0.55); hand.position.y = -0.27; el.add(hand);
      // piernas
      const hip = j[L + 'UpLeg'] = new THREE.Bone(); hip.position.set(s * 0.093, -0.06, 0); hips.add(hip);
      put(hip, cast(new THREE.Mesh(capsuleGeo(0.088, 0.08, 0.14, 10), shorts)), -0.07);
      put(hip, cast(new THREE.Mesh(capsuleGeo(0.072, 0.056, 0.3, 10), skin)), -0.23);
      const kn = j[L + 'Leg'] = new THREE.Bone(); kn.position.y = -0.43; hip.add(kn);
      put(kn, cast(new THREE.Mesh(capsuleGeo(0.056, 0.04, 0.32, 10), socks)), -0.2);
      const ft = j[L + 'Foot'] = new THREE.Bone(); ft.position.y = -0.44; kn.add(ft);
      const boot = cast(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), boots)); boot.scale.set(0.8, 0.68, 2.35); boot.position.set(0, -0.03, 0.05); ft.add(boot);
    }
    this.bake(shirtTex);
    // accesorios de los arbitros: tarjeta (arbitro) y banderin (asistentes) en la mano derecha
    if (info.official === 'ref') {
      this.card = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.105), new THREE.MeshBasicMaterial({ color: 0xffe000, side: THREE.DoubleSide }));
      this.card.position.set(0, -0.33, 0.03); this.card.visible = false; j.RightForeArm.add(this.card);
    } else if (info.official === 'ar') {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 5), lam('#222222')); stick.position.set(0, -0.3, 0.2); stick.rotation.x = Math.PI / 2; j.RightForeArm.add(stick);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), new THREE.MeshLambertMaterial({ color: 0xffd000, side: THREE.DoubleSide }));
      fl.position.set(0, -0.2, 0.32); fl.rotation.y = Math.PI / 2; j.RightForeArm.add(fl);
    }
    // pose actual (se suaviza hacia la pose objetivo)
    this.cur = {}; this.tgt = {};
    for (const k of Rig.CH) this.cur[k] = 0;
    this.cur.bodyY = 0.99;
  }
  // une todas las piezas en UNA malla con esqueleto (SkinnedMesh): 1 dibujo por jugador en vez de ~30
  bake(shirtTex) {
    const root = this.root; root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const bones = []; root.traverse(o => { if (o.isBone) bones.push(o); });
    const parts = []; root.traverse(o => { if (o.isMesh && !o.userData.noBake) parts.push(o); });
    const list = []; let n = 0;
    for (const m of parts) {
      let b = m.parent; while (b && !b.isBone) b = b.parent;
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      const shirt = !!m.material.map;
      list.push({ g, bi: Math.max(0, bones.indexOf(b)), shirt, col: shirt ? new THREE.Color(1, 1, 1) : lin(m.material.userData.hex || '#ffffff') });
      n += g.attributes.position.count;
    }
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    let o = 0; const vb = 16 / 272, vs = 256 / 272;
    for (const e of list) {
      const P = e.g.attributes.position, N = e.g.attributes.normal, U = e.g.attributes.uv, c = P.count;
      pos.set(P.array, o * 3); nor.set(N.array, o * 3);
      for (let i = 0; i < c; i++) {
        const k = o + i;
        if (e.shirt && U) { uv[k * 2] = U.array[i * 2]; uv[k * 2 + 1] = vb + U.array[i * 2 + 1] * vs; } else { uv[k * 2] = 0.5; uv[k * 2 + 1] = vb * 0.4; }
        col[k * 3] = e.col.r; col[k * 3 + 1] = e.col.g; col[k * 3 + 2] = e.col.b;
        si[k * 4] = e.bi; sw[k * 4] = 1;
      }
      o += c; e.g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    shirtTex.encoding = THREE.sRGBEncoding; LINTEX.add(shirtTex);
    shirtTex.anisotropy = Math.min(4, G.renderer.capabilities.getMaxAnisotropy());
    const mat = Q().std ? new THREE.MeshStandardMaterial({ map: shirtTex, vertexColors: true, skinning: true, roughness: 0.72, metalness: 0, envMapIntensity: 0.6 })
      : new THREE.MeshLambertMaterial({ map: shirtTex, vertexColors: true, skinning: true });
    mat.userData.keep = true; mat.userData.lin = true;
    const sm = new THREE.SkinnedMesh(geo, mat); sm.castShadow = true; sm.frustumCulled = false;
    root.add(sm); root.updateMatrixWorld(true);
    sm.bind(new THREE.Skeleton(bones));
    for (const m of parts) m.parent.remove(m);
    this.mesh = sm; this.shirtMat = mat;
  }
  dispose() {
    if (this.mesh) { this.mesh.geometry.dispose(); this.shirtMat.map.dispose(); this.shirtMat.dispose(); this.mesh.skeleton.dispose(); }
    if (this.root.parent) this.root.parent.remove(this.root);
  }
  // calcula y aplica la pose segun el estado del jugador
  animate(dt, p) {
    const T = this.tgt, sp = Math.hypot(p.vel.x, p.vel.z);
    const a = clamp(sp / 7.5, 0, 1), w = clamp(sp / 1.0, 0, 1);
    const ph = p.phase, s = Math.sin(ph), c = Math.cos(ph);
    const swing = (0.22 + 0.78 * a) * w;
    const t = G.time;
    // direccion del movimiento respecto del cuerpo: adelante (vf) y de costado (vl, + = izquierda del jugador)
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    const vf = sp > 0.05 ? (p.vel.x * fx + p.vel.z * fz) / sp : 1;
    const vl = sp > 0.05 ? (p.vel.x * fz - p.vel.z * fx) / sp : 0;
    const kf = Math.abs(vf), dir = vf < -0.15 ? -1 : 1;
    const cc = c * dir; // >0: pierna izquierda en el aire yendo hacia adelante
    // --- locomocion ---
    T.bodyY = 0.99 - 0.04 * a + Math.abs(s) * 0.045 * a * w * kf; T.bodyRX = 0; T.bodyRY = 0; T.bodyX = 0;
    T.bodyRZ = clamp(-p.turnRate * sp * 0.012 - vl * 0.12 * a, -0.32, 0.32);
    T.hipLX = -s * 0.95 * swing * vf; T.hipRX = s * 0.95 * swing * vf;
    T.hipLZ = 0.04 + vl * swing * 0.34 * (0.5 + 0.5 * s); T.hipRZ = -0.04 + vl * swing * 0.34 * (0.5 - 0.5 * s);
    const kneeAmp = w * (0.15 + 1.3 * a * Math.max(0.35, kf));
    T.knL = 0.06 + kneeAmp * Math.pow(Math.max(0, cc), 0.8) + 0.16 * a * w;
    T.knR = 0.06 + kneeAmp * Math.pow(Math.max(0, -cc), 0.8) + 0.16 * a * w;
    // pie apoyado plano en el piso; en el aire, punta hacia abajo
    const stL = clamp(0.5 - cc * 1.6, 0, 1), stR = clamp(0.5 + cc * 1.6, 0, 1);
    T.ftL = w * lerp(0.35, -(T.hipLX + T.knL), stL); T.ftR = w * lerp(0.35, -(T.hipRX + T.knR), stR);
    const armK = 0.45 + 0.55 * kf;
    T.shLX = s * 0.78 * swing * armK * dir; T.shRX = -s * 0.78 * swing * armK * dir; T.shLZ = 0.1 + 0.08 * a + Math.max(0, vl) * 0.25 * a; T.shRZ = -0.1 - 0.08 * a + Math.min(0, vl) * 0.25 * a;
    T.elL = -(0.2 + 1.1 * a * w) - Math.max(0, -s) * 0.3 * a; T.elR = -(0.2 + 1.1 * a * w) - Math.max(0, s) * 0.3 * a;
    // inclinacion: hacia adelante al correr y acelerar, hacia atras al frenar o retroceder
    T.spX = 0.03 + 0.22 * a * Math.max(0, vf) - 0.1 * a * Math.max(0, -vf) + clamp((p.accelV || 0) * 0.025, -0.2, 0.08);
    T.spY = s * 0.14 * swing * kf; T.spZ = 0;
    T.hdX = -T.spX * 0.6 + (G.owner === p ? 0.22 : 0); T.hdY = clamp(p.turnRate * 0.06, -0.45, 0.45);
    if (w < 0.3) { // quieto: respiracion y peso de un pie al otro
      const br = Math.sin(t * 1.6 + ph);
      T.spX += br * 0.015; T.bodyRZ += Math.sin(t * 0.7 + ph) * 0.025; T.hipLZ += 0.03; T.hipRZ -= 0.03; T.knL += 0.08; T.knR += 0.08;
      T.elL -= 0.1; T.elR -= 0.1; T.ftL = -0.08; T.ftR = -0.08;
      if (p.isGK && G.mode !== 'menu') { // arquero en guardia
        T.bodyY = 0.86; T.hipLX = T.hipRX = -0.45; T.knL = T.knR = 0.85; T.ftL = T.ftR = -0.35; T.spX = 0.32; T.hdX = -0.25;
        T.shLX = T.shRX = -0.55; T.shLZ = 0.45; T.shRZ = -0.45; T.elL = T.elR = -0.7; T.hipLZ = 0.12; T.hipRZ = -0.12;
      }
    }    // --- acciones ---
    let rate = 22;
    const ac = p.action;
    if (ac) {
      rate = 30;
      const u = ac.t / ac.dur, uc = ac.contact / ac.dur;
      const env = Math.min(1, ac.t / 0.06, (ac.dur - ac.t) / 0.12);
      if (ac.type === 'kick') {
        const R = ac.foot !== 'L'; // pierna que patea
        const big = ac.kind === 'shot' || ac.kind === 'clear' || ac.kind === 'cross' || ac.kind === 'lob' ? 1 : ac.kind === 'chip' ? 0.8 : 0.6;
        const thigh = keyf(u, [[0, 0], [uc * 0.7, 0.55 + 0.5 * big], [uc, -0.2], [uc + 0.18, -0.8 - 0.75 * big], [1, -0.1]]);
        const knee = keyf(u, [[0, 0.2], [uc * 0.7, 1.5], [uc, 0.15], [uc + 0.2, 0.25], [1, 0.3]]);
        if (R) { T.hipRX = thigh; T.knR = knee; T.hipLX = -0.12; T.knL = 0.35; T.hipRZ = -0.08; }
        else { T.hipLX = thigh; T.knL = knee; T.hipRX = -0.12; T.knR = 0.35; T.hipLZ = 0.08; }
        T.shLX = R ? -0.4 : 0.5; T.shRX = R ? 0.5 : -0.4; T.shLZ = R ? 0.75 : 0.3; T.shRZ = R ? -0.3 : -0.75; T.elL = T.elR = -0.5;
        T.spX = (ac.kind === 'lob' || ac.kind === 'chip' || ac.kind === 'cross' ? -0.12 : 0.14) * big; T.spY = (R ? 0.25 : -0.25) * keyf(u, [[0, 0], [uc, 1], [1, 0]]);
        T.bodyY = 0.96;
      } else if (ac.type === 'throw') {
        T.shLX = T.shRX = keyf(u, [[0, -2.9], [uc * 0.8, -3.05], [uc, -1.9], [1, -1.1]]);
        T.shLZ = 0.25; T.shRZ = -0.25; T.elL = T.elR = keyf(u, [[0, -1.2], [uc * 0.8, -1.4], [uc, -0.2], [1, -0.3]]);
        T.spX = keyf(u, [[0, -0.2], [uc * 0.8, -0.35], [uc, 0.25], [1, 0.1]]); T.hdX = -T.spX * 0.5;
        T.hipLX = -0.2; T.hipRX = 0.15; T.knL = 0.25; T.knR = 0.2;
      } else if (ac.type === 'tackle') {
        const k = keyf(u, [[0, 0], [uc, 1], [0.75, 1], [1, 0]]);
        T.hipRX = -1.1 * k; T.knR = 0.15; T.hipRZ = -0.25 * k; T.hipLX = 0.2 * k; T.knL = 0.7 * k; T.bodyY = 0.99 - 0.18 * k; T.spX = 0.25 * k;
        T.shLZ = 0.6 * k; T.shRZ = -0.5 * k;
      } else if (ac.type === 'slide') {
        const k = keyf(u, [[0, 0], [0.12, 1], [0.75, 1], [1, 0]]);
        T.bodyRX = -1.15 * k; T.bodyY = lerp(0.99, 0.32, k); T.hipRX = lerp(T.hipRX, -1.45, k); T.knR = lerp(T.knR, 0.1, k); T.hipLX = lerp(T.hipLX, -0.35, k); T.knL = lerp(T.knL, 1.7, k);
        T.shLX = T.shRX = 0.7 * k; T.shLZ = 0.7 * k; T.shRZ = -0.7 * k; T.elL = T.elR = -0.3; T.spX = 0.35 * k; T.hdX = 0.5 * k;
      } else if (ac.type === 'trap') {
        // recepcion: levanta apenas el pie (o pone el pecho) para amortiguar
        const k = keyf(u, [[0, 0], [0.35, 1], [1, 0]]), R = ac.foot !== 'L';
        if (ac.hi) { T.spX = lerp(T.spX, -0.18, k); T.shLZ = lerp(T.shLZ, 0.55, k); T.shRZ = lerp(T.shRZ, -0.55, k); }
        if (R) { T.hipRX = lerp(T.hipRX, -0.5, k); T.knR = lerp(T.knR, 0.65, k); T.ftR = lerp(T.ftR, -0.35, k); T.hipRZ = lerp(T.hipRZ, -0.15, k); T.knL = lerp(T.knL, 0.3, k); }
        else { T.hipLX = lerp(T.hipLX, -0.5, k); T.knL = lerp(T.knL, 0.65, k); T.ftL = lerp(T.ftL, -0.35, k); T.hipLZ = lerp(T.hipLZ, 0.15, k); T.knR = lerp(T.knR, 0.3, k); }
        T.bodyY = lerp(T.bodyY, 0.95, k);
      } else if (ac.type === 'card' || ac.type === 'flag') {
        const k = keyf(u, [[0, 0], [0.15, 1], [0.85, 1], [1, 0]]);
        T.shRX = lerp(T.shRX, -3.0, k); T.shRZ = -0.08; T.elR = -0.05; T.hdX = -0.2 * k;
        if (ac.type === 'flag') { T.shLX = -0.2; }
      } else if (ac.type === 'point') {
        const k = keyf(u, [[0, 0], [0.15, 1], [0.85, 1], [1, 0]]);
        T.shRX = lerp(T.shRX, -1.55, k); T.elR = -0.05; T.shRZ = -0.15;
      } else if (ac.type === 'header' || ac.type === 'jump') {
        const k = keyf(u, [[0, 0], [uc, 1], [1, 0]]);
        T.bodyY = 0.99 + Math.sin(Math.PI * clamp(u, 0, 1)) * 0.42 * (ac.jump || 1);
        T.spX = keyf(u, [[0, 0], [uc * 0.7, -0.35], [uc, 0.45], [1, 0.1]]); T.hdX = keyf(u, [[0, 0], [uc * 0.7, -0.3], [uc, 0.4], [1, 0]]);
        T.shLX = T.shRX = -1.2 * k; T.shLZ = 0.6 * k; T.shRZ = -0.6 * k; T.elL = T.elR = -0.9 * k; T.knL = T.knR = 0.7 * k; T.hipLX = T.hipRX = -0.3 * k;
      } else if (ac.type === 'dive') {
        const k = keyf(u, [[0, 0], [0.18, 1], [0.8, 1], [1, 0.6]]);
        const hgt = ac.hgt || 0;
        T.bodyRZ = -ac.side * 1.3 * k; T.bodyY = lerp(0.86, 0.32 + hgt * 1.0, k); T.bodyX = ac.side * 0.3 * k;
        T.shLX = T.shRX = lerp(-0.5, -2.95, k); T.shLZ = 0.15; T.shRZ = -0.15; T.elL = T.elR = -0.15;
        T.hipLX = T.hipRX = -0.2 * k; T.knL = ac.side > 0 ? 0.2 : 0.9 * k; T.knR = ac.side > 0 ? 0.9 * k : 0.2; T.spX = 0.05; T.hdX = 0;
      } else if (ac.type === 'catch') {
        T.shLX = T.shRX = -0.9; T.shLZ = 0.25; T.shRZ = -0.25; T.elL = T.elR = -1.25; T.spX = 0.25;
      } else if (ac.type === 'fall') {
        const k = keyf(u, [[0, 0], [0.2, 1], [0.75, 1], [1, 0]]);
        T.bodyRX = 1.35 * k; T.bodyY = lerp(T.bodyY, 0.28, k); T.shLX = T.shRX = -1.3 * k; T.shLZ = 0.4 * k; T.shRZ = -0.4 * k; T.knL = T.knR = 0.4 * k; T.hipLX = T.hipRX = 0.2 * k;
      } else if (ac.type === 'celebrate') {
        const k = Math.min(1, ac.t / 0.3);
        T.shLX = T.shRX = lerp(T.shLX, -2.7 + Math.sin(t * 8) * 0.25, k); T.shLZ = 0.45; T.shRZ = -0.45; T.elL = T.elR = -0.3; T.spX = lerp(T.spX, -0.2, k); T.hdX = -0.35 * k;
        if (sp < 1) T.bodyY = 0.99 + Math.max(0, Math.sin(t * 9)) * 0.18;
      }
    }
    if (G.ball && G.ball.held === p && !ac) { T.shLX = T.shRX = -0.95; T.shLZ = 0.22; T.shRZ = -0.22; T.elL = T.elR = -1.25; }
    if (this.card) { const show = !!(ac && ac.type === 'card'); this.card.visible = show; if (show) this.card.material.color.set(ac.color === 'red' ? 0xe8101c : 0xffe000).convertSRGBToLinear(); }
    // aplicar suavizado y escribir rotaciones en los huesos
    const C = this.cur, f = 1 - Math.exp(-rate * dt);
    for (const k of Rig.CH) C[k] += ((T[k] || 0) - C[k]) * f;
    const j = this.j;
    j.Body.position.y = C.bodyY; j.Body.position.x = C.bodyX; j.Body.rotation.set(C.bodyRX, C.bodyRY, C.bodyRZ);
    j.Spine.rotation.set(C.spX, C.spY, C.spZ); j.Head.rotation.set(C.hdX, C.hdY, 0);
    j.LeftArm.rotation.set(C.shLX, 0, C.shLZ); j.RightArm.rotation.set(C.shRX, 0, C.shRZ);
    j.LeftForeArm.rotation.x = C.elL; j.RightForeArm.rotation.x = C.elR;
    j.LeftUpLeg.rotation.set(C.hipLX, 0, C.hipLZ); j.RightUpLeg.rotation.set(C.hipRX, 0, C.hipRZ);
    j.LeftLeg.rotation.x = C.knL; j.RightLeg.rotation.x = C.knR; j.LeftFoot.rotation.x = C.ftL; j.RightFoot.rotation.x = C.ftR;
  }
}
Rig.CH = ['bodyY', 'bodyX', 'bodyRX', 'bodyRY', 'bodyRZ', 'spX', 'spY', 'spZ', 'hdX', 'hdY', 'shLX', 'shLZ', 'shRX', 'shRZ', 'elL', 'elR', 'hipLX', 'hipLZ', 'hipRX', 'hipRZ', 'knL', 'knR', 'ftL', 'ftR'];
