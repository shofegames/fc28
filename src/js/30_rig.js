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
  // (el apellido va sobre la parte plana de la espalda, no sobre el hombro, para que se lea desde la camara)
  c.font = '900 84px Arial Black, Arial'; c.strokeText(String(num), W / 2, H * 0.58); c.fillText(String(num), W / 2, H * 0.58);
  c.lineWidth = 2; c.font = '900 25px Arial Black, Arial'; c.strokeText(name.toUpperCase(), W / 2, H * 0.33, 120); c.fillText(name.toUpperCase(), W / 2, H * 0.33, 120);
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
      // el arquero usa guantes (mas grandes, con puño de otro color)
      const hand = j[L + 'Hand'] = new THREE.Mesh(new THREE.SphereGeometry(info.gk ? 0.055 : 0.042, 8, 6), info.gk ? lam(kit.gloves || '#f2f2f2') : skin); hand.scale.set(0.75, 1.15, 0.55); hand.position.y = info.gk ? -0.28 : -0.27; el.add(hand);
      if (info.gk) put(el, new THREE.Mesh(capsuleGeo(0.04, 0.04, 0.05, 8), lam('#1a1a1a')), -0.215);
      // piernas
      const hip = j[L + 'UpLeg'] = new THREE.Bone(); hip.position.set(s * 0.093, -0.06, 0); hips.add(hip);
      put(hip, cast(new THREE.Mesh(capsuleGeo(0.088, 0.08, 0.14, 10), shorts)), -0.07);
      put(hip, cast(new THREE.Mesh(capsuleGeo(0.072, 0.056, 0.3, 10), skin)), -0.23);
      const kn = j[L + 'Leg'] = new THREE.Bone(); kn.position.y = -0.43; hip.add(kn);
      put(kn, cast(new THREE.Mesh(capsuleGeo(0.056, 0.04, 0.32, 10), socks)), -0.2);
      const ft = j[L + 'Foot'] = new THREE.Bone(); ft.position.y = -0.44; kn.add(ft);
      // botin: capellada (capsula acostada), talon y suela oscura con tapones; ~27 cm de largo
      const upper = cast(new THREE.Mesh(capsuleGeo(0.04, 0.043, 0.15, 10), boots)); upper.rotation.x = Math.PI / 2; upper.scale.set(0.95, 1, 0.78); upper.position.set(0, -0.035, 0.055); ft.add(upper);
      const heel = new THREE.Mesh(capsuleGeo(0.045, 0.045, 0.03, 10), boots); heel.scale.set(0.95, 1, 0.9); heel.position.set(0, -0.025, -0.03); ft.add(heel);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.018, 0.24), lam('#20232a')); sole.position.set(0, -0.061, 0.052); ft.add(sole);
      const swoosh = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.012, 0.09), lam('#f4f4f4')); swoosh.position.set(0, -0.04, 0.07); ft.add(swoosh); // franja lateral (sin marca)
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
  // ================= ANIMACION =================
  // Capas: 1) locomocion (paso segun la velocidad, inclinacion en curvas, jockey)  2) accion (patada, recepcion, etc.)
  // mezclada con la locomocion con entrada/salida suave  3) cabeza que mira la pelota  4) IK de piernas: el pie apoyado
  // queda clavado en el pasto y la cadera y la rodilla se calculan para llegar (no patina).
  animate(dt, p) {
    const T = this.tgt, L = this.loco || (this.loco = {}), j = this.j;
    const sp = Math.hypot(p.vel.x, p.vel.z);
    const a = clamp(sp / 7.5, 0, 1), w = clamp(sp / 1.0, 0, 1);
    const ph = p.phase, s = Math.sin(ph), c = Math.cos(ph);
    const swing = (0.22 + 0.78 * a) * w;
    const t = G.time;
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    const vf = sp > 0.05 ? (p.vel.x * fx + p.vel.z * fz) / sp : 1;
    const vl = sp > 0.05 ? (p.vel.x * fz - p.vel.z * fx) / sp : 0;
    const kf = Math.abs(vf), dir = vf < -0.15 ? -1 : 1;
    const cc = c * dir; // >0: pierna izquierda en el aire yendo hacia adelante
    const ac = p.action;
    const jockey = !!p.jockey && sp < 4.5;
    // ---------- 1) locomocion ----------
    // rodillas un poco flexionadas (mas al correr): asi las piernas llegan al piso sin estirarse de mas
    T.bodyY = 0.95 - 0.1 * a - (jockey ? 0.07 : 0) + Math.abs(s) * 0.03 * a * w * kf;
    T.bodyRX = 0; T.bodyRY = 0; T.bodyX = 0;
    // inclinarse hacia adentro en las curvas (angulo = aceleracion lateral / gravedad)
    T.bodyRZ = clamp(-Math.atan2(p.latA || 0, 9.81) * 0.9 - vl * 0.1 * a, -0.38, 0.38);
    // piernas animadas (se usan si el IK esta apagado, por ejemplo en el aire)
    T.hipLX = -s * 0.95 * swing * vf; T.hipRX = s * 0.95 * swing * vf;
    T.hipLZ = 0.04 + vl * swing * 0.34 * (0.5 + 0.5 * s); T.hipRZ = -0.04 + vl * swing * 0.34 * (0.5 - 0.5 * s);
    const kneeAmp = w * (0.15 + 1.3 * a * Math.max(0.35, kf));
    T.knL = 0.06 + kneeAmp * Math.pow(Math.max(0, cc), 0.8) + 0.16 * a * w;
    T.knR = 0.06 + kneeAmp * Math.pow(Math.max(0, -cc), 0.8) + 0.16 * a * w;
    T.ftL = 0; T.ftR = 0;
    // brazos: mas fuertes cuanto mas rapido
    const armK = (0.45 + 0.55 * kf) * (0.8 + 0.5 * a);
    T.shLX = s * 0.75 * swing * armK * dir; T.shRX = -s * 0.75 * swing * armK * dir;
    T.shLZ = 0.1 + 0.08 * a + Math.max(0, vl) * 0.25 * a; T.shRZ = -0.1 - 0.08 * a + Math.min(0, vl) * 0.25 * a;
    T.elL = -(0.25 + 1.15 * a * w) - Math.max(0, -s) * 0.3 * a; T.elR = -(0.25 + 1.15 * a * w) - Math.max(0, s) * 0.3 * a;
    // inclinacion: adelante al correr y acelerar (mas en sprint), atras al frenar o retroceder
    T.spX = 0.04 + 0.26 * a * Math.max(0, vf) - 0.12 * a * Math.max(0, -vf) + clamp((p.accelV || 0) * 0.03, -0.25, 0.1) + (jockey ? 0.2 : 0);
    T.spY = s * 0.14 * swing * kf; T.spZ = 0;
    T.hdX = -T.spX * 0.6; T.hdY = 0;
    if (jockey) { T.shLZ = 0.45; T.shRZ = -0.45; T.shLX = T.shRX = -0.3; T.elL = T.elR = -0.7; }
    if (w < 0.3 && !jockey) { // quieto: respira y pasa el peso de un pie al otro
      T.spX += Math.sin(t * 1.6 + ph) * 0.015; T.bodyRZ += Math.sin(t * 0.7 + ph) * 0.025;
      T.elL -= 0.1; T.elR -= 0.1;
      if (p.isGK && G.mode !== 'menu') { // arquero en guardia: piernas abiertas, manos adelante
        T.bodyY = 0.84; T.spX = 0.32; T.hdX = -0.25;
        T.shLX = T.shRX = -0.6; T.shLZ = 0.4; T.shRZ = -0.4; T.elL = T.elR = -0.75;
      }
    }
    if (p.askT > t) { T.shRX = -2.75; T.shRZ = -0.3; T.elR = -0.1; } // pide la pelota
    if (p.celebrateWith && p.team && G.match && G.match.state === 'goal' && Math.hypot(p.celebrateWith.pos.x - p.pos.x, p.celebrateWith.pos.z - p.pos.z) < 1.8) {
      T.shLX = T.shRX = -1.25; T.shLZ = 0.15; T.shRZ = -0.15; T.elL = T.elR = -1.1; // abrazo
    }
    for (const k of Rig.CH) L[k] = T[k];
    // ---------- 2) acciones ----------
    let wA = 0;
    if (ac) {
      const u = clamp(ac.t / ac.dur, 0, 1), uc = clamp(ac.contact / ac.dur, 0, 1);
      const bl = Rig.BLEND[ac.type] || [0.08, 0.15];
      wA = Math.min(1, ac.t / bl[0], Math.max(0, ac.dur - ac.t) / bl[1]);
      const R = ac.foot !== 'L';
      const ty = ac.type;
      if (ty === 'kick') {
        const P = Rig.KICKS[ac.kind] || Rig.KICKS.pass;
        const after = Math.min(1, uc + 0.22);
        const thigh = keyf(u, [[0, 0], [uc * 0.72, P.back], [uc, -0.15], [after, P.fwd], [1, P.fwd * 0.35]]);
        const knee = keyf(u, [[0, 0.25], [uc * 0.72, P.knee], [uc, 0.12], [after, 0.18], [1, 0.3]]);
        const out = keyf(u, [[0, 0], [uc * 0.6, 1], [uc + 0.05, 1], [1, 0]]) * P.out; // pase con el borde interno: la pierna gira para afuera
        const hop = keyf(u, [[0, 0], [uc, 0], [after, P.hop || 0], [1, 0]]);
        if (R) { T.hipRX = thigh; T.knR = knee; T.hipRZ = -0.06 - out; T.ftR = -0.2 + out * 0.3; T.knL = 0.3; }
        else { T.hipLX = thigh; T.knL = knee; T.hipLZ = 0.06 + out; T.ftL = -0.2 + out * 0.3; T.knR = 0.3; }
        // brazo contrario abierto para equilibrar; cuerpo encima de la pelota (remate) o hacia atras (pase largo, vaselina)
        T.shLX = R ? -0.35 : 0.45; T.shRX = R ? 0.45 : -0.35; T.shLZ = R ? 0.3 + P.arms : 0.3; T.shRZ = R ? -0.3 : -0.3 - P.arms; T.elL = T.elR = -0.5;
        T.spX = P.lean; T.spY = (R ? 0.28 : -0.28) * keyf(u, [[0, 0], [uc, 1], [1, 0.2]]);
        T.bodyY = 0.9 + hop; T.hdX = 0.25;
      } else if (ty === 'gkthrow') { // saque con la mano por arriba
        T.shRX = keyf(u, [[0, -0.9], [uc * 0.8, 0.85], [uc, -2.5], [1, -1.2]]); T.elR = keyf(u, [[0, -1.2], [uc * 0.8, -1.4], [uc, -0.15], [1, -0.4]]); T.shRZ = -0.35;
        T.shLX = -1.4; T.shLZ = 0.35; T.elL = -0.3; T.spY = keyf(u, [[0, 0], [uc * 0.8, -0.45], [uc, 0.4], [1, 0.1]]); T.spX = keyf(u, [[0, 0], [uc * 0.8, -0.15], [uc, 0.25], [1, 0.1]]);
      } else if (ty === 'gkvolley') { // la suelta y le pega de volea
        const k = keyf(u, [[0, 0], [uc * 0.5, 0], [uc * 0.75, 1], [uc, 0], [1, 0]]);
        T.shLX = T.shRX = keyf(u, [[0, -0.9], [uc * 0.5, -0.9], [uc, -0.3], [1, -0.2]]); T.shLZ = 0.3 + k * 0.6; T.shRZ = -0.3 - k * 0.6;
        T.hipRX = keyf(u, [[0, 0], [uc * 0.75, 1.0], [uc, -0.3], [Math.min(1, uc + 0.2), -1.5], [1, -0.3]]); T.knR = keyf(u, [[0, 0.2], [uc * 0.75, 1.4], [uc, 0.1], [1, 0.3]]);
        T.spX = -0.15; T.bodyY = 0.92;
      } else if (ty === 'throw') {
        T.shLX = T.shRX = keyf(u, [[0, -2.9], [uc * 0.8, -3.05], [uc, -1.9], [1, -1.1]]);
        T.shLZ = 0.25; T.shRZ = -0.25; T.elL = T.elR = keyf(u, [[0, -1.2], [uc * 0.8, -1.4], [uc, -0.2], [1, -0.3]]);
        T.spX = keyf(u, [[0, -0.2], [uc * 0.8, -0.35], [uc, 0.25], [1, 0.1]]); T.hdX = -T.spX * 0.5;
      } else if (ty === 'tackle') { // entrada de pie: pone el cuerpo y estira la pierna
        const k = keyf(u, [[0, 0], [uc, 1], [0.75, 1], [1, 0]]);
        T.hipRX = -1.1 * k; T.knR = 0.15; T.hipRZ = -0.25 * k; T.bodyY = 0.95 - 0.16 * k; T.spX = 0.3 * k;
        T.shLZ = 0.6 * k; T.shRZ = -0.5 * k;
      } else if (ty === 'slide') { // barrida: se desliza con una pierna estirada y la otra doblada
        const k = keyf(u, [[0, 0], [0.12, 1], [0.8, 1], [1, 0.85]]);
        T.bodyRX = -1.15 * k; T.bodyY = lerp(0.95, 0.32, k); T.hipRX = -1.45 * k; T.knR = 0.1; T.hipLX = -0.35 * k; T.knL = 1.7 * k;
        T.shLX = T.shRX = 0.7 * k; T.shLZ = 0.7 * k; T.shRZ = -0.7 * k; T.elL = T.elR = -0.3; T.spX = 0.35 * k; T.hdX = 0.5 * k;
      } else if (ty === 'getup') { // se levanta despues de la barrida
        const e = smooth(u);
        T.bodyRX = -0.9 * (1 - e); T.bodyY = lerp(0.36, 0.93, e); T.knL = T.knR = 1.5 * (1 - e) + 0.2; T.hipLX = T.hipRX = -0.9 * (1 - e);
        T.shLX = T.shRX = 0.6 * (1 - e); T.spX = 0.5 * (1 - e) + 0.1;
      } else if (ty === 'trap') {
        // recepcion segun como viene: suela, borde interno, muslo o pecho
        const k = keyf(u, [[0, 0], [0.35, 1], [1, 0]]), kind = ac.kind || (ac.hi ? 'chest' : 'inside');
        const hx = kind === 'sole' ? -0.55 : kind === 'thigh' ? -1.15 : kind === 'inside' ? -0.35 : -0.1;
        const kn = kind === 'sole' ? 0.35 : kind === 'thigh' ? 1.3 : kind === 'inside' ? 0.45 : 0.3;
        const ftp = kind === 'sole' ? -0.7 : 0, out = kind === 'inside' ? 0.45 : 0;
        if (kind === 'chest') { T.spX = lerp(T.spX, -0.35, k); T.shLZ = lerp(T.shLZ, 0.9, k); T.shRZ = lerp(T.shRZ, -0.9, k); T.shLX = T.shRX = -0.4 * k; T.knL = T.knR = 0.3 * k; T.hdX = 0.35 * k; }
        else if (R) { T.hipRX = lerp(T.hipRX, hx, k); T.knR = lerp(T.knR, kn, k); T.ftR = ftp * k; T.hipRZ = lerp(T.hipRZ, -out, k); T.hdX = 0.4 * k; }
        else { T.hipLX = lerp(T.hipLX, hx, k); T.knL = lerp(T.knL, kn, k); T.ftL = ftp * k; T.hipLZ = lerp(T.hipLZ, out, k); T.hdX = 0.4 * k; }
      } else if (ty === 'card' || ty === 'flag') {
        T.shRX = -3.0; T.shRZ = -0.08; T.elR = -0.05; T.hdX = -0.2;
        if (ty === 'flag') T.shLX = -0.2;
      } else if (ty === 'point') {
        T.shRX = -1.55; T.elR = -0.05; T.shRZ = -0.15;
      } else if (ty === 'header' || ty === 'jump') {
        // cabezazo con salto de verdad: se agacha, salta, golpe de cuello y cae flexionando
        const tk = 0.25, air = smooth(clamp((u - tk) / (0.85 - tk), 0, 1));
        const up = u < tk ? 0 : Math.sin(Math.PI * clamp((u - tk) / (0.85 - tk), 0, 1));
        T.bodyY = (u < tk ? lerp(0.95, 0.82, u / tk) : 0.95 + up * 0.42 * (ac.jump || 1)) - (u > 0.85 ? (1 - u) / 0.15 * 0.1 : 0);
        T.knL = T.knR = u < tk ? 0.9 * (u / tk) : 0.25 + up * 0.5; T.hipLX = T.hipRX = u < tk ? -0.5 * (u / tk) : -0.15 - up * 0.25;
        T.spX = keyf(u, [[0, 0.15], [uc * 0.75, -0.4], [uc, 0.45], [1, 0.15]]); T.hdX = keyf(u, [[0, 0], [uc * 0.75, -0.35], [uc, 0.45], [1, 0]]);
        T.shLX = T.shRX = -1.3 * air; T.shLZ = 0.7 * air; T.shRZ = -0.7 * air; T.elL = T.elR = -0.9 * air;
      } else if (ty === 'dive') {
        const k = keyf(u, [[0, 0], [0.18, 1], [0.8, 1], [1, 0.6]]);
        const hgt = ac.hgt || 0;
        T.bodyRZ = -ac.side * 1.3 * k; T.bodyY = lerp(0.86, 0.32 + hgt * 1.0, k); T.bodyX = ac.side * 0.3 * k;
        T.shLX = T.shRX = lerp(-0.5, -2.95, k); T.shLZ = 0.15; T.shRZ = -0.15; T.elL = T.elR = -0.15;
        T.hipLX = T.hipRX = -0.2 * k; T.knL = ac.side > 0 ? 0.2 : 0.9 * k; T.knR = ac.side > 0 ? 0.9 * k : 0.2; T.spX = 0.05; T.hdX = 0;
      } else if (ty === 'punch') { // rechazo con los puños
        T.shLX = T.shRX = keyf(u, [[0, -1.2], [0.4, -2.4], [1, -1.6]]); T.shLZ = 0.12; T.shRZ = -0.12; T.elL = T.elR = keyf(u, [[0, -1.3], [0.4, -0.05], [1, -0.5]]); T.spX = 0.1; T.bodyY = 0.95 + Math.sin(Math.PI * u) * 0.15;
      } else if (ty === 'catch') {
        T.shLX = T.shRX = -0.9; T.shLZ = 0.25; T.shRZ = -0.25; T.elL = T.elR = -1.25; T.spX = 0.25;
      } else if (ty === 'fall') {
        const k = keyf(u, [[0, 0], [0.2, 1], [0.75, 1], [1, 0]]);
        T.bodyRX = 1.35 * k; T.bodyY = lerp(T.bodyY, 0.28, k); T.shLX = T.shRX = -1.3 * k; T.shLZ = 0.4 * k; T.shRZ = -0.4 * k; T.knL = T.knR = 0.4 * k; T.hipLX = T.hipRX = 0.2 * k;
      } else if (ty === 'frustrate') { // se agarra la cabeza
        T.shLX = T.shRX = -2.45; T.shLZ = 0.95; T.shRZ = -0.95; T.elL = T.elR = -2.25; T.hdX = 0.25; T.spX = 0.1;
      } else if (ty === 'protest') { // protesta al arbitro: brazos abiertos
        T.shLX = T.shRX = -0.75; T.shLZ = 0.85; T.shRZ = -0.85; T.elL = T.elR = -0.35; T.spX = -0.08; T.hdX = -0.1;
      } else if (ty === 'celebrate') {
        const st = ac.style || 'fist';
        if (st === 'airplane') { T.shLX = T.shRX = -0.15; T.shLZ = 1.5; T.shRZ = -1.5; T.elL = T.elR = -0.05; T.bodyRZ = Math.sin(t * 2.2) * 0.3; T.hdX = -0.3; }
        else if (st === 'knees' && ac.t > 1.3) { // se tira de rodillas
          T.bodyY = 0.5; T.hipLX = T.hipRX = 0.05; T.knL = T.knR = 1.6; T.ftL = T.ftR = 0.6; T.spX = -0.3; T.hdX = -0.45;
          T.shLX = T.shRX = -2.7; T.shLZ = 0.5; T.shRZ = -0.5; T.elL = T.elR = -0.2;
        } else {
          T.shLX = T.shRX = -2.7 + Math.sin(t * 8) * 0.25; T.shLZ = 0.45; T.shRZ = -0.45; T.elL = T.elR = -0.3; T.spX = -0.2; T.hdX = -0.35;
          if (sp < 1) T.bodyY = 0.95 + Math.max(0, Math.sin(t * 9)) * 0.18;
        }
      }
      for (const k of Rig.CH) T[k] = lerp(L[k], T[k], wA);
    }
    if (G.ball && G.ball.held === p && !(ac && (ac.type === 'gkthrow' || ac.type === 'gkvolley' || ac.type === 'throw'))) { T.shLX = T.shRX = -0.95; T.shLZ = 0.22; T.shRZ = -0.22; T.elL = T.elR = -1.25; }
    if (this.card) { const show = !!(ac && ac.type === 'card'); this.card.visible = show; if (show) this.card.material.color.set(ac.color === 'red' ? 0xe8101c : 0xffe000).convertSRGBToLinear(); }
    // ---------- 3) cabeza: sigue la pelota; cada tanto mira alrededor (escanea) ----------
    const b = G.ball;
    if (b && !(ac && (ac.type === 'dive' || ac.type === 'slide' || ac.type === 'fall' || ac.type === 'getup'))) {
      if (G.owner === p) T.hdX += 0.3;
      else {
        if (!p.isOfficial && !ac && p.scanT < t - 2 && Math.random() < dt * 0.35 && Math.hypot(b.px - p.pos.x, b.pz - p.pos.z) > 10) { p.scanT = t + 0.55; p.scanDir = (Math.random() < 0.5 ? -1 : 1) * rand(0.6, 1.0); }
        let yaw;
        if (p.scanT > t) yaw = p.scanDir;
        else yaw = angWrap(Math.atan2(b.px - p.pos.x, b.pz - p.pos.z) - p.facing - this.cur.spY);
        T.hdY = clamp(yaw, -1.15, 1.15) * 0.85;
        const bd = Math.hypot(b.px - p.pos.x, b.pz - p.pos.z);
        T.hdX += clamp((b.py - 1.6) / -Math.max(bd, 1), -0.5, 0.5);
      }
    }
    // ---------- suavizado y huesos ----------
    const C = this.cur, f = 1 - Math.exp(-20 * dt);
    for (const k of Rig.CH) C[k] += ((T[k] || 0) - C[k]) * f;
    j.Body.position.y = C.bodyY; j.Body.position.x = C.bodyX; j.Body.rotation.set(C.bodyRX, C.bodyRY, C.bodyRZ);
    j.Spine.rotation.set(C.spX, C.spY, C.spZ); j.Head.rotation.set(C.hdX, C.hdY, 0);
    j.LeftArm.rotation.set(C.shLX, 0, C.shLZ); j.RightArm.rotation.set(C.shRX, 0, C.shRZ);
    j.LeftForeArm.rotation.x = C.elL; j.RightForeArm.rotation.x = C.elR;
    j.LeftUpLeg.rotation.set(C.hipLX, 0, C.hipLZ); j.RightUpLeg.rotation.set(C.hipRX, 0, C.hipRZ);
    j.LeftLeg.rotation.x = C.knL; j.RightLeg.rotation.x = C.knR; j.LeftFoot.rotation.x = C.ftL; j.RightFoot.rotation.x = C.ftR;
    // ---------- 4) IK de piernas ----------
    if (dt > 0) this.legIK(dt, p, sp, ac);
  }
  // pies que no patinan: cada pie tiene un punto de apoyo en el mundo; mientras esta apoyado no se mueve
  legIK(dt, p, sp, ac) {
    const root = this.root, j = this.j, rp = root.position;
    if (!this.legs) this.legs = [1, -1].map(side => ({ side, plant: null, lift: new THREE.Vector3(), land: new THREE.Vector3(), cur: null, w: 0, step: null, prevSt: false }));
    const sc = root.scale.y;
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing), lx = fz, lz = -fx; // lx,lz: hacia la izquierda del jugador
    // teletransporte (saque del medio, cambio): los pies se reacomodan de una
    if (this._rp && Math.hypot(rp.x - this._rp.x, rp.z - this._rp.z) > 1.5) for (const Lg of this.legs) { Lg.plant = null; Lg.cur = null; }
    (this._rp || (this._rp = new THREE.Vector3())).copy(rp);
    let allow = 1, sup = 0;
    if (ac) {
      const ty = ac.type;
      if (ty === 'slide' || ty === 'dive' || ty === 'fall' || ty === 'header' || ty === 'jump' || ty === 'getup' || (ty === 'celebrate' && ac.style === 'knees' && ac.t > 1.2)) allow = 0;
      else if (ty === 'kick' || ty === 'trap' || ty === 'tackle' || ty === 'gkvolley') sup = ac.foot === 'L' ? -1 : 1; // solo la pierna de apoyo (la otra patea)
    }
    const duty = gaitDuty(sp), cyc = gaitLen(sp) / Math.max(sp, 0.01), stanceT = duty * cyc, swingT = (1 - duty) * cyc;
    const ux = sp > 0.05 ? p.vel.x / sp : fx, uz = sp > 0.05 ? p.vel.z / sp : fz;
    const ankle = 0.068 * sc, width = (p.isGK && sp < 1 ? 0.17 : p.jockey ? 0.15 : 0.1) * sc;
    const moving = sp > 0.45, reach = 0.87 * 0.98 * sc;
    j.Body.position.y -= (this.drop || 0) / sc;
    root.updateMatrixWorld(true);
    const inv = this._inv || (this._inv = new THREE.Matrix4()); inv.copy(j.Hips.matrixWorld).invert();
    let need = -0.04 * sc; // si no hace falta, el cuerpo vuelve a subir de a poco
    const hw = this._hw || (this._hw = new THREE.Vector3());
    for (const Lg of this.legs) {
      const name = Lg.side > 0 ? 'Left' : 'Right';
      const wt = allow && (!sup || sup === Lg.side) ? 1 : 0;
      Lg.w = damp(Lg.w, wt, wt > Lg.w ? 9 : 16, dt);
      const hx = rp.x + lx * Lg.side * width, hz = rp.z + lz * Lg.side * width; // lugar natural del pie
      const psi = ((p.phase / TAU + (Lg.side > 0 ? 0 : 0.5)) % 1 + 1) % 1;
      let tx, ty = ankle, tz, planted = true;
      if (sup === Lg.side && ac.plant && ac.t < ac.contact + 0.15) {
        // pie de apoyo al costado de la pelota (20-30 cm) antes de patear
        if (!Lg.plant) Lg.plant = new THREE.Vector3();
        Lg.plant.set(ac.plant.x, 0, ac.plant.z); tx = ac.plant.x; tz = ac.plant.z; Lg.prevSt = true;
      } else if (moving) {
        const st = psi < duty;
        if (st) {
          if (!Lg.plant || !Lg.prevSt) { Lg.plant = Lg.plant || new THREE.Vector3(); if (Lg.prevSt === false && Lg.land.lengthSq() > 0) Lg.plant.copy(Lg.land); else Lg.plant.set(hx + ux * stanceT * sp * 0.38, 0, hz + uz * stanceT * sp * 0.38); }
          tx = Lg.plant.x; tz = Lg.plant.z;
          // al final del apoyo se levanta el talon (despegue)
          const behind = -((tx - hx) * ux + (tz - hz) * uz);
          ty = ankle + clamp((behind - 0.12 * sc) * 0.5, 0, 0.2 * sc);
        } else {
          if (Lg.prevSt) Lg.lift.set(Lg.cur ? Lg.cur.x : hx, 0, Lg.cur ? Lg.cur.z : hz);
          const s2 = (psi - duty) / (1 - duty), tl = (1 - s2) * swingT;
          Lg.land.set(hx + ux * (tl * sp + stanceT * sp * 0.38), 0, hz + uz * (tl * sp + stanceT * sp * 0.38));
          const e = smooth(s2);
          tx = lerp(Lg.lift.x, Lg.land.x, e); tz = lerp(Lg.lift.z, Lg.land.z, e);
          ty = ankle + Math.sin(Math.PI * s2) * (0.06 + 0.16 * clamp(sp / 7.5, 0, 1)) * sc;
          planted = false;
        }
        Lg.prevSt = st;
      } else {
        // quieto: el pie se queda donde esta; si quedo lejos de su lugar, da un pasito (de a un pie)
        if (!Lg.plant) Lg.plant = new THREE.Vector3(hx, 0, hz);
        if (Lg.step) {
          Lg.step.t += dt; const u = clamp(Lg.step.t / 0.22, 0, 1);
          tx = lerp(Lg.step.fx, hx, smooth(u)); tz = lerp(Lg.step.fz, hz, smooth(u)); ty = ankle + Math.sin(Math.PI * u) * 0.05 * sc;
          planted = false; if (u >= 1) { Lg.plant.set(hx, 0, hz); Lg.step = null; }
        } else {
          tx = Lg.plant.x; tz = Lg.plant.z;
          const other = this.legs[0] === Lg ? this.legs[1] : this.legs[0];
          if (Math.hypot(tx - hx, tz - hz) > 0.2 * sc && !other.step) Lg.step = { t: 0, fx: tx, fz: tz };
        }
        Lg.prevSt = true;
      }
      // el pie no se teletransporta: si el objetivo salta, va hasta ahi rapido
      if (!Lg.cur) Lg.cur = new THREE.Vector3(tx, ty, tz);
      const ddx = tx - Lg.cur.x, ddz = tz - Lg.cur.z, dd = Math.hypot(ddx, ddz), mx = (planted ? 9 : 16) * dt;
      if (dd > mx) { Lg.cur.x += ddx / dd * mx; Lg.cur.z += ddz / dd * mx; ty += 0.04 * sc; planted = false; } else { Lg.cur.x = tx; Lg.cur.z = tz; }
      Lg.cur.y = ty;
      // si el pie apoyado quedo muy lejos de la cadera, lo vuelve a apoyar (evita estirar la pierna de mas)
      j[name + 'UpLeg'].getWorldPosition(hw);
      if (planted && Math.hypot(Lg.cur.x - hw.x, Lg.cur.y - hw.y, Lg.cur.z - hw.z) > reach * 1.04) { if (moving) Lg.prevSt = false; else Lg.step = Lg.step || { t: 0, fx: Lg.cur.x, fz: Lg.cur.z }; }
      Lg.planted = planted;
      if (planted && Lg.w > 0.5) need = Math.max(need, Math.hypot(Lg.cur.x - hw.x, Lg.cur.y - hw.y, Lg.cur.z - hw.z) - reach * 0.97);
      if (Lg.w > 0.01) this.solveLeg(Lg, name, Lg.cur.x, Lg.cur.y, Lg.cur.z, planted, inv);
    }
    this.drop = clamp(damp(this.drop || 0, (this.drop || 0) + need * 1.5, 30, dt), 0, 0.25 * sc);
  }
  // IK de 2 huesos (muslo + pierna): calcula cadera y rodilla para que el tobillo llegue al punto
  solveLeg(Lg, name, tx, ty, tz, planted, inv) {
    const j = this.j, up = j[name + 'UpLeg'], kn = j[name + 'Leg'], ft = j[name + 'Foot'];
    const v = this._v || (this._v = new THREE.Vector3()), q = this._q || (this._q = new THREE.Vector3());
    v.set(tx, ty, tz).applyMatrix4(inv); // objetivo en el espacio de la cadera (sin escala)
    const gx = v.x, gy = v.y, gz = v.z; let ax = gx, ay = gy, az = gz;
    const l1 = 0.43, l2 = 0.44, maxD = (l1 + l2) * 0.995, w = Lg.w;
    let rx = 0, rz = 0, kneeA = 0;
    // se resuelve y se corrige 2 veces midiendo donde quedo el tobillo de verdad (asi el pie apoyado no tiembla)
    const iters = Q().std ? 6 : 3; // en calidad Baja (celulares viejos) menos pasadas
    for (let it = 0; it < iters; it++) {
      let dx = ax - up.position.x, dy = ay - up.position.y, dz = az - up.position.z, D = Math.hypot(dx, dy, dz);
      if (D > maxD) { const k = maxD / D; dx *= k; dy *= k; dz *= k; D = maxD; }
      if (D < 0.3) { const k = 0.3 / (D || 1); dx *= k; dy *= k; dz *= k; D = 0.3; }
      const ux = dx / D, uy = dy / D, uz = dz / D;
      kneeA = Math.PI - Math.acos(clamp((l1 * l1 + l2 * l2 - D * D) / (2 * l1 * l2), -1, 1));
      const al = Math.acos(clamp((l1 * l1 + D * D - l2 * l2) / (2 * l1 * D), -1, 1));
      let kx = -ux * uz, ky = -uy * uz, kz = 1 - uz * uz; const kl = Math.hypot(kx, ky, kz) || 1; kx /= kl; ky /= kl; kz /= kl;
      const cA = Math.cos(al), sA = Math.sin(al);
      const tX = ux * cA + kx * sA, tY = uy * cA + ky * sA, tZ = uz * cA + kz * sA;
      rz = Math.asin(clamp(tX, -1, 1)); rx = Math.atan2(-tZ, -tY);
      up.rotation.x = rx; up.rotation.z = rz; kn.rotation.x = kneeA;
      if (it === iters - 1) break;
      up.updateMatrixWorld(true);
      ft.getWorldPosition(q).applyMatrix4(inv);
      const ex = gx - q.x, ey = gy - q.y, ez = gz - q.z;
      if (ex * ex + ey * ey + ez * ez < 1e-8) break; // ya esta a menos de 0,1 mm
      ax += ex; ay += ey; az += ez;
    }
    // mezcla con la pose animada segun el peso del IK
    if (w < 0.999) { const C = this.cur, s = name === 'Left' ? 'L' : 'R'; up.rotation.x = lerp(C['hip' + s + 'X'], rx, w); up.rotation.z = lerp(C['hip' + s + 'Z'], rz, w); kn.rotation.x = lerp(C['kn' + s], kneeA, w); }
    // pie plano en el piso al apoyar; con el talon levantado, punta abajo; en el aire, punta un poco abajo
    const heel = clamp((ty - 0.068 * this.root.scale.y) * 4, 0, 0.9);
    const fr = -(rx + kneeA) + (planted ? heel : 0.35);
    ft.rotation.x = w < 0.999 ? lerp(this.cur[name === 'Left' ? 'ftL' : 'ftR'], fr, w) : fr;
  }
}// entrada y salida de cada animacion (segundos): las poses se mezclan, nada pega saltos
Rig.BLEND = { kick: [0.06, 0.16], trap: [0.05, 0.14], tackle: [0.05, 0.16], slide: [0.08, 0.2], getup: [0.05, 0.18], header: [0.06, 0.2], jump: [0.06, 0.2],
  dive: [0.05, 0.25], punch: [0.05, 0.16], catch: [0.1, 0.16], fall: [0.06, 0.22], celebrate: [0.25, 0.3], card: [0.15, 0.2], flag: [0.15, 0.2], point: [0.15, 0.2],
  frustrate: [0.2, 0.25], protest: [0.2, 0.25], gkthrow: [0.08, 0.16], gkvolley: [0.08, 0.16], throw: [0.1, 0.16] };
// patada segun el tipo: back = pierna atras, knee = rodilla, fwd = golpe, out = borde interno, lean = cuerpo (+ encima, - atras), arms = brazo contrario, hop = saltito
Rig.KICKS = {
  pass: { back: 0.45, knee: 1.0, fwd: -0.6, out: 0.4, lean: 0.08, arms: 0.45 },
  through: { back: 0.6, knee: 1.15, fwd: -0.75, out: 0.25, lean: 0.1, arms: 0.55 },
  lob: { back: 1.0, knee: 1.5, fwd: -1.35, out: 0.05, lean: -0.2, arms: 1.0 },
  cross: { back: 1.0, knee: 1.5, fwd: -1.3, out: 0.15, lean: -0.18, arms: 1.05 },
  clear: { back: 1.05, knee: 1.55, fwd: -1.45, out: 0, lean: -0.12, arms: 0.95, hop: 0.04 },
  shot: { back: 1.2, knee: 1.75, fwd: -1.2, out: 0, lean: 0.22, arms: 1.1, hop: 0.07 },
  chip: { back: 0.55, knee: 1.2, fwd: -0.7, out: 0.1, lean: -0.18, arms: 0.7 },
  knock: { back: 0.2, knee: 0.6, fwd: -0.45, out: 0.1, lean: 0.1, arms: 0.3 },
};
Rig.CH = ['bodyY', 'bodyX', 'bodyRX', 'bodyRY', 'bodyRZ', 'spX', 'spY', 'spZ', 'hdX', 'hdY', 'shLX', 'shLZ', 'shRX', 'shRZ', 'elL', 'elR', 'hipLX', 'hipLZ', 'hipRX', 'hipRZ', 'knL', 'knR', 'ftL', 'ftR'];
