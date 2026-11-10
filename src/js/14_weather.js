// ===== Clima (lluvia) y sombras de las torres de luz de noche =====
// Lluvia: gotas como segmentos que caen en una caja que sigue a la camara (todo en el shader, 1 dibujo),
// pasto mojado que brilla, pelota que patina mas y pica menos, y niebla.
const Weather = {
  rain: false, mesh: null,
  set(rain, night) {
    this.rain = rain;
    if (rain && !this.mesh) this.build();
    if (this.mesh) { this.mesh.visible = rain; this.mesh.material.uniforms.uCol.value.set(night ? 0xa9bdd8 : 0xd5dde6); }
    if (Pitch.wet) Pitch.wet(rain);
    // pasto mojado: la pelota patina (pierde menos velocidad) y pica un poco menos
    BP.rollK = rain ? 0.27 : 0.36; BP.rollC = rain ? 0.15 : 0.2; BP.eGround = rain ? 0.5 : 0.56;
    if (AU.rain) AU.rain(rain);
  },
  build() {
    const N = { baja: 1800, media: 4000, alta: 7000, ultra: 10000 }[CFG.quality] || 5000;
    const pos = new Float32Array(N * 6), off = new Float32Array(N * 2);
    const BX = 70, BY = 36, BZ = 70;
    for (let i = 0; i < N; i++) {
      const x = Math.random() * BX, y = Math.random() * BY, z = Math.random() * BZ;
      pos.set([x, y, z, x, y, z], i * 6); off[i * 2 + 1] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aOff', new THREE.BufferAttribute(off, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCen: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(BX, BY, BZ) }, uCol: { value: new THREE.Color(0xd5dde6) } },
      vertexShader: `attribute float aOff; uniform float uTime; uniform vec3 uCen, uBox; varying float vA;
        void main(){
          vec3 v = vec3(1.6, -12.0, 0.7);
          vec3 lo = uCen - uBox * 0.5;
          vec3 p = lo + mod(position + v * uTime - lo, uBox);
          p -= normalize(v) * 0.75 * aOff;
          vA = 1.0 - aOff * 0.85;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol, 0.38 * vA); }',
      transparent: true, depthWrite: false,
    });
    const m = this.mesh = new THREE.LineSegments(geo, mat); m.frustumCulled = false; m.renderOrder = 5; G.scene.add(m);
  },
  update() {
    if (!this.mesh || !this.mesh.visible) return;
    const u = this.mesh.material.uniforms, c = G.camera, f = new THREE.Vector3(); c.getWorldDirection(f);
    u.uTime.value = performance.now() / 1000;
    u.uCen.value.copy(c.position).addScaledVector(f, 30); // la caja de gotas va delante de la camara
  },
};
// De noche: cada torre de luz hace su propia sombra (4 sombras suaves y alargadas por jugador, como en la tele)
const NightShadows = {
  on: false, mesh: null,
  set(night) { this.on = night; if (night && !this.mesh) this.build(); if (this.mesh) this.mesh.visible = night; },
  build() {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(32, 64, 30, 62, 0, 0, TAU); c.fill();
    const t = new THREE.CanvasTexture(cv); LINTEX.add(t);
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -0.5); // los pies en el origen, la sombra hacia -z
    const mat = new THREE.MeshBasicMaterial({ map: t, color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    mat.userData.lin = true; mat.userData.keep = true;
    this.mesh = new THREE.InstancedMesh(geo, mat, 4 * 32); this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; G.scene.add(this.mesh);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
  },
  update() {
    if (!this.on || !this.mesh || !Stadium.masts) return;
    let i = 0; const M = this._m, q = this._q, P = this._p, S = this._s, max = this.mesh.instanceMatrix.count;
    const list = G.players.concat(Refs.all || []);
    for (const p of list) {
      const r = p.rig.root; if (!r.visible || !r.parent) continue;
      const x = r.position.x, z = r.position.z, h = 1.85 * (p.info ? p.info.height / 1.86 : 1);
      for (const m of Stadium.masts) {
        if (i >= 4 * 32) break;
        const dx = x - m.x, dz = z - m.z, d = Math.hypot(dx, dz) || 1;
        q.setFromAxisAngle(this._up, Math.atan2(-dx, -dz));
        P.set(x, 0.016, z); S.set(0.65, 1, clamp(h * d / (m.y - h), 1.2, 4.2));
        M.compose(P, q, S); this.mesh.setMatrixAt(i++, M);
      }
    }
    this.mesh.count = i; this.mesh.instanceMatrix.needsUpdate = true;
  },
};
