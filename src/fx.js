// 铸剑大师 - 粒子特效：火花、彩虹碎屑、余烬、碎片物理
import * as THREE from 'three';

const MAX = 1400;

export class Sparks {
  constructor(scene) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 600 } },
      vertexShader: `
        attribute float size; attribute vec3 color; varying vec3 vC;
        uniform float scale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        varying vec3 vC;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if(r>0.5) discard;
          float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(vC * (1.5 + 2.0*a), a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.p = [];
    this.floorY = 0;
  }

  /** 撞击火花 */
  burst(at, n, color, opts = {}) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n && this.p.length < MAX; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = 0.6 + Math.random() * 2.8 * (opts.power || 1);
      const out = 0.6 + Math.random() * 2.4 * (opts.power || 1);
      const cc = opts.rainbow ? new THREE.Color().setHSL(Math.random(), 1, 0.6) : c.clone().offsetHSL((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.15);
      this.p.push({
        x: at.x + (Math.random() - 0.5) * 0.08, y: at.y, z: at.z + (Math.random() - 0.5) * 0.08,
        vx: Math.cos(a) * out, vy: up, vz: Math.sin(a) * out * 0.6,
        life: 0.35 + Math.random() * 0.7, max: 1.0, c: cc, s: (opts.size || 0.012) * (0.6 + Math.random()), g: 9.8, drag: 0.985, floor: opts.floor ?? 0.95,
      });
    }
  }

  /** 缓慢上升的余烬 / 入神彩色光点 */
  ember(at, spread, color, opts = {}) {
    if (this.p.length >= MAX) return;
    const c = opts.rainbow ? new THREE.Color().setHSL(Math.random(), 1, 0.6) : new THREE.Color(color);
    this.p.push({
      x: at.x + (Math.random() - 0.5) * spread.x, y: at.y + (Math.random() - 0.5) * spread.y, z: at.z + (Math.random() - 0.5) * spread.z,
      vx: (Math.random() - 0.5) * 0.15, vy: 0.2 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.15,
      life: 1 + Math.random() * 1.5, max: 2.5, c, s: (opts.size || 0.01) * (0.5 + Math.random()), g: -0.05, drag: 0.995, floor: -10,
    });
  }

  /** 灰尘：极慢的漂浮微粒，暗淡的暖白色 */
  mote(at) {
    if (this.p.length >= MAX - 200) return;
    const c = new THREE.Color(0xffe2b8).multiplyScalar(0.18 + Math.random() * 0.22);
    const o = { x: at.x, y: at.y, z: at.z, vx: (Math.random() - 0.5) * 0.04, vy: (Math.random() - 0.4) * 0.03, vz: (Math.random() - 0.5) * 0.04,
      life: 0, l0: 4 + Math.random() * 5, max: 9, c, s: 0.004 + Math.random() * 0.004, g: 0, drag: 1, floor: -10, dust: true };
    o.life = o.l0; this.p.push(o);
  }

  update(dt) {
    const arr = this.p;
    for (let i = arr.length - 1; i >= 0; i--) {
      const q = arr[i];
      q.life -= dt;
      if (q.life <= 0) { arr[i] = arr[arr.length - 1]; arr.pop(); continue; }
      q.vy -= q.g * dt;
      q.vx *= q.drag; q.vz *= q.drag;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.y < q.floor && q.vy < 0) { q.y = q.floor; q.vy *= -0.3; q.vx *= 0.5; q.vz *= 0.5; }
    }
    const n = arr.length;
    for (let i = 0; i < n; i++) {
      const q = arr[i];
      const k = q.dust ? Math.max(0, Math.min(1, q.life / 1.5, (q.l0 - q.life) / 1.5)) * 0.55 : Math.min(1, q.life / 0.4);
      if (q.dust) { q.x += Math.sin(q.life * 0.7 + i) * 0.0006; }
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      this.col[i * 3] = q.c.r * k; this.col[i * 3 + 1] = q.c.g * k; this.col[i * 3 + 2] = q.c.b * k;
      this.size[i] = q.s;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }

  setScale(h) { this.mat.uniforms.scale.value = h * 0.9; }
}

/** 碎片物理 */
export class Shards {
  constructor(scene) { this.scene = scene; this.list = []; }

  spawn(meshes, parentMatrix, impact) {
    meshes.forEach(m => {
      m.applyMatrix4(parentMatrix);
      m.castShadow = true;
      this.scene.add(m);
      const dir = m.position.clone().sub(impact);
      dir.y = 0;
      dir.normalize();
      this.list.push({
        m, life: 4 + Math.random(),
        v: new THREE.Vector3(dir.x * (1 + Math.random() * 2), 1.5 + Math.random() * 3, dir.z * (1 + Math.random() * 2) + (Math.random() - 0.5) * 2),
        w: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14),
      });
    });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.life -= dt;
      s.v.y -= 9.8 * dt;
      s.m.position.addScaledVector(s.v, dt);
      s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt; s.m.rotation.z += s.w.z * dt;
      if (s.m.position.y < 0.03) { s.m.position.y = 0.03; s.v.y *= -0.25; s.v.x *= 0.6; s.v.z *= 0.6; s.w.multiplyScalar(0.6); }
      if (s.life < 0.6) s.m.scale.setScalar(Math.max(0.001, s.life / 0.6));
      if (s.life <= 0) { this.scene.remove(s.m); this.list.splice(i, 1); }
    }
  }
}
