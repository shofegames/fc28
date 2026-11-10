// ===== Post-procesado propio (sin librerias): antialiasing (MSAA en WebGL2 o FXAA), bloom suave en las luces,
// corrección de color tipo TV y viñeta leve. Por calidad: Baja nada · Media color+viñeta+AA · Alta/Ultra + bloom =====
const Post = {
  rt: null, bA: null, bB: null, w: 0, h: 0, scene: null, cam: null, mats: null,
  level() { return Q().post || 0; },
  make() {
    const r = G.renderer, q = Q();
    const ms = r.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget;
    if (this.rt) this.rt.dispose();
    this.rt = ms ? new THREE.WebGLMultisampleRenderTarget(this.w, this.h, { samples: q.post >= 2 ? 4 : 2 }) : new THREE.WebGLRenderTarget(this.w, this.h);
    this.rt.texture.encoding = THREE.sRGBEncoding; this.fxaa = !ms;
    const bw = Math.max(1, this.w >> 2), bh = Math.max(1, this.h >> 2);
    if (this.bA) { this.bA.dispose(); this.bB.dispose(); }
    this.bA = new THREE.WebGLRenderTarget(bw, bh); this.bB = new THREE.WebGLRenderTarget(bw, bh);
    if (!this.scene) {
      this.scene = new THREE.Scene(); this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
      const bright = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, th: { value: 0.86 } }, vertexShader: vs, depthTest: false, depthWrite: false,
        fragmentShader: 'uniform sampler2D t; uniform float th; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb; float l = dot(c, vec3(0.299,0.587,0.114)); gl_FragColor = vec4(c * smoothstep(th, 1.0, l), 1.0); }' });
      const blur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, d: { value: new THREE.Vector2() } }, vertexShader: vs, depthTest: false, depthWrite: false,
        fragmentShader: `uniform sampler2D t; uniform vec2 d; varying vec2 vUv;
          void main(){ vec3 c = texture2D(t, vUv).rgb * 0.227;
            c += (texture2D(t, vUv + d * 1.385).rgb + texture2D(t, vUv - d * 1.385).rgb) * 0.316;
            c += (texture2D(t, vUv + d * 3.231).rgb + texture2D(t, vUv - d * 3.231).rgb) * 0.070;
            gl_FragColor = vec4(c, 1.0); }` });
      const fin = new THREE.ShaderMaterial({
        uniforms: { tS: { value: null }, tB: { value: null }, rcp: { value: new THREE.Vector2() }, uFx: { value: 0 }, uBl: { value: 0 }, uVig: { value: 0.22 }, uGr: { value: 1 } },
        vertexShader: vs, depthTest: false, depthWrite: false,
        fragmentShader: `uniform sampler2D tS, tB; uniform vec2 rcp; uniform float uFx, uBl, uVig, uGr; varying vec2 vUv;
          const vec3 LU = vec3(0.299, 0.587, 0.114);
          vec3 fxaa(vec2 uv){
            vec3 nw = texture2D(tS, uv + vec2(-1.0,-1.0) * rcp).rgb, ne = texture2D(tS, uv + vec2(1.0,-1.0) * rcp).rgb;
            vec3 sw = texture2D(tS, uv + vec2(-1.0, 1.0) * rcp).rgb, se = texture2D(tS, uv + vec2(1.0, 1.0) * rcp).rgb, m = texture2D(tS, uv).rgb;
            float a = dot(nw,LU), b = dot(ne,LU), c = dot(sw,LU), e = dot(se,LU), lm = dot(m,LU);
            float mn = min(lm, min(min(a,b), min(c,e))), mx = max(lm, max(max(a,b), max(c,e)));
            vec2 dir = vec2(-((a + b) - (c + e)), (a + c) - (b + e));
            float red = max((a + b + c + e) * 0.03125, 0.0078125), rmin = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
            dir = clamp(dir * rmin, -8.0, 8.0) * rcp;
            vec3 A = 0.5 * (texture2D(tS, uv + dir * (-0.1667)).rgb + texture2D(tS, uv + dir * 0.1667).rgb);
            vec3 B = A * 0.5 + 0.25 * (texture2D(tS, uv - dir * 0.5).rgb + texture2D(tS, uv + dir * 0.5).rgb);
            float lb = dot(B, LU); return (lb < mn || lb > mx) ? A : B; }
          void main(){
            vec3 c = uFx > 0.5 ? fxaa(vUv) : texture2D(tS, vUv).rgb;
            if (uBl > 0.0) c += texture2D(tB, vUv).rgb * uBl;
            float l = dot(c, LU);
            c = mix(vec3(l), c, 1.0 + 0.1 * uGr);                       // un poco mas de color
            c = mix(c, c * c * (3.0 - 2.0 * c), 0.16 * uGr);            // contraste suave (curva en S)
            c *= vec3(1.01, 1.0, 0.985);                                // apenas calido, como la tele
            vec2 dv = vUv - 0.5; c *= 1.0 - uVig * dot(dv, dv) * 1.5;   // viñeta leve
            gl_FragColor = vec4(c, 1.0); }` });
      this.mats = { bright, blur, fin };
      this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fin); this.quad.frustumCulled = false; this.scene.add(this.quad);
    }
  },
  pass(mat, target) { this.quad.material = mat; G.renderer.setRenderTarget(target); G.renderer.render(this.scene, this.cam); },
  render(scene, camera) {
    const r = G.renderer, L = this.level();
    if (!L) { r.setRenderTarget(null); r.render(scene, camera); return; }
    const v = r.getDrawingBufferSize(this._v || (this._v = new THREE.Vector2()));
    if (!this.rt || v.x !== this.w || v.y !== this.h || this.lastL !== L) { this.w = v.x; this.h = v.y; this.lastL = L; this.make(); }
    r.setRenderTarget(this.rt); r.render(scene, camera);
    const M = this.mats, bloom = L >= 2;
    if (bloom) {
      M.bright.uniforms.t.value = this.rt.texture; this.pass(M.bright, this.bA);
      for (let i = 0; i < 2; i++) {
        M.blur.uniforms.t.value = this.bA.texture; M.blur.uniforms.d.value.set(1 / this.bA.width, 0); this.pass(M.blur, this.bB);
        M.blur.uniforms.t.value = this.bB.texture; M.blur.uniforms.d.value.set(0, 1 / this.bA.height); this.pass(M.blur, this.bA);
      }
    }
    const U = M.fin.uniforms;
    U.tS.value = this.rt.texture; U.tB.value = this.bA.texture; U.rcp.value.set(1 / this.w, 1 / this.h);
    U.uFx.value = this.fxaa ? 1 : 0; U.uBl.value = bloom ? (R.env && R.env.tod === 'noche' ? 0.55 : 0.32) : 0;
    this.pass(M.fin, null);
  },
};
