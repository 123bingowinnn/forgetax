// 隐藏家族 · 冰霜剑 frost（魔力线 C 的隐藏分支）：50 51 52 53 54 55（+10 … +20）
// 原创形态：半透明冰晶剑身 + 发光冰核、棱柱冰晶簇、环绕冰晶、极光带（userData.update 驱动动画）。
import {
  THREE, C, M, mat, glow, box, bevelBox, cylX, cylY, gem, torus, plate, blade, XS, hwAt, grip, pommel, rng, finish, PI,
  mergeGeometries,
} from './kit.js';

// ---------------------------------------------------------------------------
// 材质
// ---------------------------------------------------------------------------
const ICE = () => mat(0x9cd6ff, { r: 0.18, m: 0.1, e: 0x1a7cc0, ei: 0.55, opacity: 0.8 });
const ICE_D = () => mat(0x5aa4e8, { r: 0.22, m: 0.1, e: 0x10509a, ei: 0.55, opacity: 0.82 });
const ICE_DEEP = () => mat(0x3a78c8, { r: 0.25, m: 0.15, e: 0x103c80, ei: 0.6, opacity: 0.85 });
const FROST = () => mat(0xeef8ff, { r: 0.85, m: 0, e: 0x80c0e0, ei: 0.25 });
const CORE = () => glow(0x8ff8ff, 2.4);
const CORE_W = () => glow(0xe8ffff, 2.8);
const SILVER = () => mat(0xc8d6e4, { r: 0.35, m: 0.35 });
const SILVER_D = () => mat(0x8a9cb0, { r: 0.4, m: 0.35 });
const GRIP = () => mat(0x22304a, { r: 0.75, m: 0.15 });
const GRIP_W = () => mat(0x6a8cb0, { r: 0.6, m: 0.2 });
const FUR = () => mat(0xe8eef4, { r: 0.95, m: 0 });
const STONE = () => mat(0x6c7884, { r: 0.85, m: 0.05 });

// ---------------------------------------------------------------------------
// 冰晶棱柱（六棱柱 + 尖顶），沿 +Y，底在 y=0；缓存
// ---------------------------------------------------------------------------
const _cr = new Map();
function crystalGeom(r = 1, h = 4, tip = 1.4) {
  const k = `${r},${h},${tip}`;
  if (_cr.has(k)) return _cr.get(k);
  const body = new THREE.CylinderGeometry(r * 0.92, r, h, 6, 1).translate(0, h / 2, 0);
  const cap = new THREE.ConeGeometry(r * 0.92, tip, 6, 1).translate(0, h + tip / 2, 0);
  const g = mergeGeometries([body.toNonIndexed(), cap.toNonIndexed()]);
  g.computeVertexNormals();
  _cr.set(k, g);
  return g;
}
/** 冰晶：底部 (x,y,z)，方向 dir（Vector3），长度 len，粗 r */
function crystal(p, x, y, z, dir, len, r, m) {
  const mesh = new THREE.Mesh(crystalGeom(1, 3, 1.4), m);
  mesh.position.set(x, y, z);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  mesh.scale.set(r, len / 4.4, r);
  mesh.castShadow = true;
  p.add(mesh);
  return mesh;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// 冰晶簇（在 x,z 处朝 dir 方向张开的若干晶体）
function cluster(p, x, z, dirs, size, mats, r0 = 0.012) {
  dirs.forEach(([dx, dy, dz, s], i) => crystal(p, x, 0, z, V(dx, dy, dz), size * (s ?? 1), r0 * (s ?? 1), mats[i % mats.length]));
}

// ---------------------------------------------------------------------------
// 极光带：一条沿 X 的半透明彩带，顶点色渐变，顶点随时间波动
// ---------------------------------------------------------------------------
function aurora(p, A, { x0, x1, y = 0.08, z = 0, h = 0.06, amp = 0.025, seg = 28, ph = 0, side = 1, colors = [0x4affb0, 0x5ae8ff, 0xb070ff] }) {
  const g = new THREE.PlaneGeometry(1, 1, seg, 1);
  const pos = g.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const cA = new THREE.Color(), cB = new THREE.Color(), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5, top = pos.getY(i) > 0;
    const k = u * (colors.length - 1), j = Math.min(colors.length - 2, Math.floor(k));
    cA.set(colors[j]); cB.set(colors[j + 1]);
    tmp.copy(cA).lerp(cB, k - j).multiplyScalar(top ? 0.25 : 1.0);
    cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const mesh = new THREE.Mesh(g, m);
  Object.assign(mesh.userData, { keepFx: true, noBounds: true, noBreak: true, noHeat: true, noVariant: true });
  mesh.frustumCulled = false;
  p.add(mesh);
  const base = [];
  for (let i = 0; i < pos.count; i++) base.push(pos.getX(i) + 0.5, pos.getY(i) > 0 ? 1 : 0);
  const L = x1 - x0;
  const upd = (t) => {
    for (let i = 0; i < pos.count; i++) {
      const u = base[i * 2], top = base[i * 2 + 1];
      const x = x0 + u * L;
      const env = Math.sin(u * PI); // 两端收窄
      const w = Math.sin(u * 7 + t * 1.3 + ph) * amp + Math.sin(u * 13 - t * 0.9 + ph) * amp * 0.4;
      const hh = h * (0.4 + 0.6 * env);
      pos.setXYZ(i, x, y + top * hh * 0.45 + Math.sin(u * 5 + t + ph) * 0.012, z + w * env + side * top * hh);
    }
    pos.needsUpdate = true;
    m.opacity = 0.55 + 0.25 * Math.sin(t * 0.8 + ph);
  };
  upd(0);
  A.push((dt, t) => upd(t));
  return mesh;
}

// 环绕冰晶（水平面内绕 Y 旋转，悬浮在剑面上方）
function orbiters(p, A, { cx, n, rx, rz, y = 0.05, size = 0.05, speed = 0.4, seed = 1, mats }) {
  const piv = new THREE.Group();
  piv.position.x = cx;
  p.add(piv);
  const r = rng(seed);
  const items = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2 + r() * 0.3;
    const holder = new THREE.Group();
    holder.position.set(Math.cos(a) * rx, y + r() * 0.03, Math.sin(a) * rz);
    piv.add(holder);
    const s = size * (0.7 + r() * 0.6);
    const c1 = crystal(holder, 0, -s * 0.5, 0, V(r() - 0.5, 1, r() - 0.5), s, s * 0.16, mats[i % mats.length]);
    const c2 = crystal(holder, 0, -s * 0.5, 0, V(-r() - 0.2, -1, r() - 0.5), s * 0.6, s * 0.12, mats[(i + 1) % mats.length]);
    for (const c of [c1, c2]) c.userData.noBounds = true;
    items.push({ holder, y0: holder.position.y, ph: r() * 6, sp: 0.5 + r() });
  }
  A.push((dt, t) => {
    piv.rotation.y = t * speed;
    for (const it of items) { it.holder.position.y = it.y0 + Math.sin(t * 1.5 + it.ph) * 0.012; it.holder.rotation.y = t * it.sp; }
  });
  return piv;
}

// 飘雪（Points）
let _snowTex = null;
function snowTex() {
  if (_snowTex) return _snowTex;
  const S = 32, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(220,245,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  _snowTex = new THREE.CanvasTexture(c);
  return _snowTex;
}
function snow(p, A, { x0, x1, w, n = 40, h = 0.18, seed = 3 }) {
  const r = rng(seed);
  const pos = new Float32Array(n * 3), ph = [];
  for (let i = 0; i < n; i++) { pos[i * 3] = x0 + r() * (x1 - x0); pos[i * 3 + 1] = r() * h; pos[i * 3 + 2] = (r() - 0.5) * w; ph.push(r() * 6); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ map: snowTex(), color: 0xdff6ff, size: 0.018, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  Object.assign(pts.userData, { noBounds: true, noBreak: true, keepFx: true, noHeat: true });
  p.add(pts);
  A.push((dt) => {
    const d = Math.min(0.05, dt || 0.016);
    for (let i = 0; i < n; i++) {
      pos[i * 3 + 1] -= d * 0.04;
      pos[i * 3 + 2] += Math.sin(ph[i] += d * 1.3) * 0.0004;
      if (pos[i * 3 + 1] < -0.01) pos[i * 3 + 1] = h;
    }
    g.attributes.position.needsUpdate = true;
  });
}

// 冰晶剑身：半透明棱形外壳 + 内部发光冰核（先画不透明的核，再画透明的冰）
function iceBlade(p, prof, t, { core = true, deep = false } = {}) {
  const outer = blade(p, prof, XS.diamond(t, t * 0.25), deep ? ICE_DEEP() : ICE(), ICE_D());
  outer.renderOrder = 2;
  if (core) {
    const xs = prof.map((q) => q[0]);
    const x0 = xs[0] + 0.02, x1 = xs[xs.length - 1] * 0.92;
    const cprof = [[x0, 0.004, 1], [(x0 + x1) / 2, Math.max(0.006, hwAt(prof, (x0 + x1) / 2) * 0.12), 1], [x1, 0.0, 1]];
    blade(p, cprof, XS.diamond(t * 0.35, t * 0.2), CORE(), CORE());
  }
  return outer;
}
// 冰霜结晶（剑面上的霜花碎块）
function frostPatches(p, prof, t, n, seed) {
  const r = rng(seed);
  const xs = prof.map((q) => q[0]);
  const xa = xs[0] + 0.03, xb = xs[xs.length - 1] * 0.85;
  for (let i = 0; i < n; i++) {
    const x = xa + r() * (xb - xa), hw = hwAt(prof, x);
    const s = r() > 0.5 ? 1 : -1;
    const z = s * hw * (0.6 + r() * 0.35);
    const g = gem(p, 0.006 + r() * 0.012, 0.003, 0.004 + r() * 0.008, FROST(), x, t * 0.5, z);
    g.rotation.y = r() * PI;
  }
}
// 冰晶护手（两侧向后张开的晶体）+ 银握柄 + 冰晶柄头
function frostHilt(p, { span = 0.08, n = 3, len = 0.06, gripLen = 0.14, r = 0.011, crown = 0, A = null }) {
  bevelBox(p, 0.022, 0.024, 0.05, SILVER(), 0, 0, 0, 0.004);
  gem(p, 0.012, 0.012, 0.012, CORE_W(), 0, 0.012, 0);
  for (const s of [1, -1]) {
    for (let i = 0; i < n; i++) {
      const a = 0.35 + i * 0.32; // 从侧向朝剑柄方向后掠
      crystal(p, 0, 0, s * 0.02, V(-Math.sin(a) * 0.9 + 0.25, 0.12 + i * 0.05, s * Math.cos(a)), len * (1 - i * 0.18) + span * 0.2, 0.0085 - i * 0.001, i % 2 ? ICE_D() : ICE());
    }
  }
  if (crown) {
    // 冰冠：护手处一圈向剑尖与上方张开的冰晶
    for (let i = 0; i < crown; i++) {
      const a = -PI * 0.42 + (i / (crown - 1)) * PI * 0.84;
      crystal(p, 0.01, 0.006, Math.sin(a) * 0.03, V(0.55 + Math.cos(a) * 0.2, 0.55, Math.sin(a) * 1.0), 0.06 + (1 - Math.abs(a) / 1.3) * 0.05, 0.007, i % 2 ? ICE() : ICE_DEEP());
    }
  }
  const xe = grip(p, { x0: -0.011, len: gripLen, r, m: GRIP(), wrap: GRIP_W(), rings: Math.round(gripLen / 0.016) });
  bevelBox(p, 0.012, 0.022, 0.022, SILVER(), xe - 0.006, 0, 0, 0.003);
  crystal(p, xe - 0.012, 0, 0, V(-1, 0, 0), 0.05, 0.011, ICE());
  return xe - 0.062;
}
// 冰环（套在剑身上，带小冰晶，绕自身轴转）
function iceRing(p, A, x, R, tilt, speed, nCr = 6, ph = 0) {
  const outer = new THREE.Group();
  outer.position.x = x;
  outer.rotation.z = -tilt;
  p.add(outer);
  const spin = new THREE.Group();
  outer.add(spin);
  torus(spin, R, 0.006, ICE(), 'x', 4, 36);
  torus(spin, R, 0.0018, CORE(), 'x', 3, 36);
  for (let i = 0; i < nCr; i++) {
    const a = (i / nCr) * PI * 2;
    const c = crystal(spin, 0, Math.sin(a) * R, Math.cos(a) * R, V(0, Math.sin(a), Math.cos(a)), 0.035, 0.006, i % 2 ? ICE() : ICE_DEEP());
    c.userData.noBounds = true;
  }
  A.push((dt, t) => { spin.rotation.x = t * speed + ph; });
}
// 霜花法阵（剑下方的发光六角雪花，缓慢旋转）
function snowflakeSigil(p, A, x, R) {
  const g = new THREE.Group();
  g.position.set(x, -0.012, 0);
  p.add(g);
  const m = new THREE.MeshBasicMaterial({ color: 0x7ef0ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    const arm = new THREE.Group();
    arm.rotation.y = a;
    g.add(arm);
    const b = new THREE.Mesh(new THREE.BoxGeometry(R, 0.001, 0.006), m); b.position.x = R / 2; arm.add(b);
    for (const f of [0.45, 0.7]) {
      for (const s of [1, -1]) {
        const tw = new THREE.Mesh(new THREE.BoxGeometry(R * 0.22, 0.001, 0.004), m);
        tw.position.set(R * f + R * 0.07, 0, s * R * 0.07);
        tw.rotation.y = -s * 0.8;
        arm.add(tw);
      }
    }
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(R * 0.98, R * 1.02, 48).rotateX(-PI / 2), m);
  g.add(ring);
  g.traverse((o) => { if (o.isMesh) Object.assign(o.userData, { keepFx: true, noBounds: true, noBreak: true, noHeat: true, noVariant: true }); });
  A.push((dt, t) => { g.rotation.y = -t * 0.2; m.opacity = 0.4 + 0.2 * Math.sin(t * 1.4); });
}
const done = (g, A, bladeLength, gripLength) => finish(g, { bladeLength, gripLength, update: (dt, t) => { for (const f of A) f(dt, t); } });

// ---------------------------------------------------------------------------
// 50 结霜的魔刃 Frost-Rimed Magic Blade（~1.0m）：魔力剑身覆霜 + 冰晶护手
// ---------------------------------------------------------------------------
function frosted() {
  const g = new THREE.Group(); const A = [];
  const prof = [[0.015, 0.042, 1], [0.5, 0.036, 1], [0.6, 0.026, 0.9], [0.68, 0, 0.4]];
  plate(g, [[0.015, 0.042], [0.5, 0.036], [0.68, 0], [0.5, -0.036], [0.015, -0.042]], 0.016, [M.magicBlue, M.magicBlueD], 0, 0.004);
  box(g, 0.5, 0.002, 0.006, CORE(), 0.29, 0.0085, 0);
  // 霜壳沿两刃
  for (const s of [1, -1]) {
    const r = rng(s > 0 ? 3 : 4);
    for (let i = 0; i < 9; i++) {
      const x = 0.05 + i * 0.065, hw = hwAt(prof, x);
      const c = crystal(g, x, 0.002, s * hw * 0.9, V(0.4 + r() * 0.3, 0.25, s * (0.6 + r() * 0.4)), 0.02 + r() * 0.025, 0.005, i % 2 ? ICE() : FROST());
    }
  }
  frostPatches(g, prof, 0.016, 14, 7);
  gem(g, 0.022, 0.007, 0.012, CORE_W(), 0.17, 0.009, 0);
  const xe = frostHilt(g, { n: 2, len: 0.06, gripLen: 0.15 });
  return done(g, A, 0.68, -xe);
}

// ---------------------------------------------------------------------------
// 51 冰晶之刃 Ice Crystal Blade（~1.08m）：整块冰晶剑身 + 发光冰核
// ---------------------------------------------------------------------------
function iceCrystal() {
  const g = new THREE.Group(); const A = [];
  const prof = [[0.015, 0.03, 1], [0.08, 0.05, 1], [0.42, 0.055, 1], [0.62, 0.042, 0.9], [0.76, 0, 0.35]];
  iceBlade(g, prof, 0.022);
  frostPatches(g, prof, 0.022, 8, 9);
  // 刃根处的小冰晶簇
  for (const s of [1, -1]) cluster(g, 0.04, s * 0.04, [[0.5, 0.4, s * 0.8, 1], [0.8, 0.5, s * 0.4, 0.8], [0.2, 0.6, s * 1, 0.6]], 0.05, [ICE(), ICE_D()], 0.008);
  const xe = frostHilt(g, { n: 3, len: 0.07, gripLen: 0.16 });
  return done(g, A, 0.76, -xe);
}

// ---------------------------------------------------------------------------
// 52 永冻冰棱 Permafrost Icicle（~1.16m）：冰棱锯齿 + 3 枚环绕冰晶
// ---------------------------------------------------------------------------
function permafrost() {
  const g = new THREE.Group(); const A = [];
  const prof = [[0.015, 0.035, 1], [0.1, 0.06, 1], [0.48, 0.064, 1], [0.7, 0.045, 0.9], [0.84, 0, 0.35]];
  iceBlade(g, prof, 0.026);
  // 两刃向外后掠的冰棱
  for (const s of [1, -1]) {
    for (let i = 0; i < 7; i++) {
      const x = 0.1 + i * 0.085, hw = hwAt(prof, x);
      crystal(g, x, 0, s * (hw - 0.006), V(-0.45, 0.08, s), 0.05 + (i % 2) * 0.02 - i * 0.003, 0.008, i % 2 ? ICE_D() : ICE());
    }
  }
  frostPatches(g, prof, 0.026, 10, 12);
  gem(g, 0.03, 0.012, 0.016, CORE_W(), 0.2, 0.014, 0);
  orbiters(g, A, { cx: 0.42, n: 3, rx: 0.36, rz: 0.13, size: 0.08, speed: 0.5, seed: 21, mats: [ICE(), ICE_DEEP()] });
  const xe = frostHilt(g, { n: 3, len: 0.075, gripLen: 0.17 });
  return done(g, A, 0.84, -xe);
}

// ---------------------------------------------------------------------------
// 53 霜巨人的獠牙 Frost Giant's Fang（~1.26m）：弯曲巨牙冰刃 + 石质毛皮柄 + 飘雪
// ---------------------------------------------------------------------------
function giantFang() {
  const g = new THREE.Group(); const A = [];
  // 弯牙轮廓：+Z 侧外弧、-Z 侧内弧，尖端偏向 -Z
  const N = 10, L = 0.92, out = [], inn = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, x = 0.02 + u * L;
    const bend = -0.09 * u * u; // 向 -Z 弯
    const w = 0.085 * Math.pow(1 - u, 0.75) + 0.004;
    out.push([x, bend + w]);
    inn.push([x, bend - w * 0.85]);
  }
  const poly = out.concat(inn.reverse());
  const t = 0.03;
  const fang = plate(g, poly, t, [ICE(), ICE_D()], 0, 0.009);
  fang.renderOrder = 2;
  // 内部冰核（沿弯曲中线的小块）
  for (let i = 1; i < N - 1; i++) {
    const u = i / N, x = 0.02 + u * L, z = -0.09 * u * u + 0.01 * (1 - u);
    const c = box(g, L / N * 0.9, 0.008, 0.012 * (1 - u) + 0.004, CORE(), x, 0, z);
    c.rotation.y = 0.18 * u * 2;
  }
  // 牙根的岩石护套 + 毛皮
  plate(g, [[-0.01, 0.1], [0.07, 0.095], [0.09, 0.0], [0.07, -0.085], [-0.01, -0.095]], 0.05, [STONE(), mat(0x4c5660, { r: 0.9, m: 0 })], 0, 0.008);
  for (let i = 0; i < 7; i++) {
    const a = -0.7 + i * 0.23;
    const f = gem(g, 0.03, 0.03, 0.022, FUR(), -0.005, 0.01, Math.sin(a) * 0.1);
    f.rotation.y = a;
  }
  for (const s of [1, -1]) cluster(g, 0.06, s * 0.08, [[0.3, 0.5, s, 1.1], [0.7, 0.6, s * 0.6, 0.9], [-0.2, 0.7, s, 0.7]], 0.075, [ICE(), ICE_DEEP()], 0.011);
  frostPatches(g, [[0.03, 0.08], [0.9, 0.01]], t, 12, 15);
  orbiters(g, A, { cx: 0.45, n: 5, rx: 0.42, rz: 0.17, size: 0.08, speed: -0.4, seed: 31, mats: [ICE(), ICE_D(), FROST()] });
  snow(g, A, { x0: -0.1, x1: 0.95, w: 0.35, n: 40, seed: 5 });
  const xe = grip(g, { x0: -0.02, len: 0.2, r: 0.016, m: mat(0x3a3028, { r: 0.9, m: 0 }), wrap: FUR(), rings: 7 });
  add(g, new THREE.IcosahedronGeometry(0.03, 0), STONE(), xe - 0.025);
  crystal(g, xe - 0.04, 0, 0, V(-1, 0.2, 0), 0.06, 0.012, ICE());
  return done(g, A, 0.94, -(xe - 0.1));
}
function add(p, geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; }

// ---------------------------------------------------------------------------
// 54 极光冰冠 Aurora Ice Crown（~1.36m）：冰冠护手 + 两条极光带 + 6 枚环绕冰晶
// ---------------------------------------------------------------------------
function auroraCrown() {
  const g = new THREE.Group(); const A = [];
  const prof = [[0.015, 0.04, 1], [0.12, 0.072, 1], [0.55, 0.075, 1], [0.8, 0.05, 0.9], [0.98, 0, 0.35]];
  iceBlade(g, prof, 0.03);
  // 剑脊的冰棱（竖起的小晶体）
  for (let i = 0; i < 6; i++) crystal(g, 0.15 + i * 0.12, 0.012, 0, V(0.5, 1, 0), 0.03 + (i % 2) * 0.015, 0.006, i % 2 ? ICE() : ICE_DEEP());
  for (const s of [1, -1]) {
    for (let i = 0; i < 6; i++) {
      const x = 0.12 + i * 0.12, hw = hwAt(prof, x);
      crystal(g, x, 0, s * (hw - 0.008), V(-0.35, 0.15, s), 0.06 - i * 0.004, 0.009, i % 2 ? ICE_D() : ICE());
    }
  }
  frostPatches(g, prof, 0.03, 12, 17);
  gem(g, 0.035, 0.014, 0.02, CORE_W(), 0.22, 0.016, 0);
  aurora(g, A, { x0: 0.05, x1: 0.95, y: 0.05, z: 0.09, h: 0.09, amp: 0.03, ph: 0, side: 1 });
  aurora(g, A, { x0: 0.0, x1: 0.85, y: 0.07, z: -0.09, h: 0.08, amp: 0.03, ph: 2.2, side: -1, colors: [0x6aa8ff, 0x58ffd0, 0xff7ad8] });
  orbiters(g, A, { cx: 0.5, n: 6, rx: 0.5, rz: 0.2, size: 0.085, speed: 0.35, seed: 41, mats: [ICE(), ICE_DEEP(), ICE_D()] });
  const xe = frostHilt(g, { n: 3, len: 0.08, gripLen: 0.18, r: 0.012, crown: 9 });
  g.scale.setScalar(1.1);
  return done(g, A, 0.98 * 1.1, -xe * 1.1);
}

// ---------------------------------------------------------------------------
// 55 绝对零度·寒渊之心 Absolute Zero · Heart of the Abyss（~1.5m）
// 深渊冰晶剑身 + 冰笼中搏动的寒渊之心 + 三道冰环 + 三条极光 + 双层环绕冰晶 + 霜花法阵 + 飘雪
// ---------------------------------------------------------------------------
function absoluteZero() {
  const g = new THREE.Group(); const A = [];
  const prof = [[0.06, 0.05, 1], [0.18, 0.095, 1], [0.6, 0.1, 1], [0.9, 0.065, 0.9], [1.1, 0, 0.35]];
  iceBlade(g, prof, 0.034, { deep: true });
  // 外层透亮冰壳边
  const shell = blade(g, prof.map(([x, hw, ts], i) => [x, hw > 0 ? hw + 0.012 : 0, ts]), XS.diamond(0.012, 0.004), ICE(), ICE());
  shell.renderOrder = 3;
  for (const s of [1, -1]) {
    for (let i = 0; i < 8; i++) {
      const x = 0.2 + i * 0.1, hw = hwAt(prof, x) + 0.01;
      crystal(g, x, 0, s * (hw - 0.01), V(-0.3, 0.2, s), 0.075 - i * 0.004, 0.011, i % 2 ? ICE_DEEP() : ICE());
    }
  }
  for (let i = 0; i < 7; i++) crystal(g, 0.22 + i * 0.12, 0.014, 0, V(0.4, 1, 0), 0.04 + (i % 2) * 0.02, 0.008, i % 2 ? ICE() : ICE_DEEP());
  frostPatches(g, prof, 0.034, 16, 23);
  // 寒渊之心：冰笼 + 搏动的光核
  const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.042, 1), CORE_W());
  heart.position.set(0.0, 0.03, 0);
  g.add(heart);
  const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), ICE_DEEP());
  inner.position.copy(heart.position);
  inner.renderOrder = 2;
  g.add(inner);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    crystal(g, Math.cos(a) * 0.075, -0.01, Math.sin(a) * 0.075, V(-Math.cos(a) * 0.3, 1, -Math.sin(a) * 0.3), 0.1, 0.009, i % 2 ? ICE() : ICE_D());
  }
  A.push((dt, t) => { const k = 1 + 0.15 * Math.sin(t * 3.2); heart.scale.setScalar(k); inner.rotation.y = t * 0.6; });
  // 冰冠：两侧大冰晶后掠
  for (const s of [1, -1]) cluster(g, 0.0, s * 0.07, [[-0.2, 0.3, s, 1.4], [0.3, 0.4, s, 1.1], [-0.6, 0.4, s * 0.7, 1.0], [0.6, 0.6, s * 0.5, 0.8]], 0.1, [ICE(), ICE_DEEP()], 0.013);
  iceRing(g, A, 0.35, 0.16, 0.45, 0.6, 6, 0);
  iceRing(g, A, 0.62, 0.15, 0.4, -0.5, 6, 1);
  iceRing(g, A, 0.88, 0.11, 0.5, 0.7, 4, 2);
  aurora(g, A, { x0: 0.0, x1: 1.1, y: 0.06, z: 0.13, h: 0.1, amp: 0.035, ph: 0, side: 1 });
  aurora(g, A, { x0: 0.1, x1: 1.05, y: 0.08, z: -0.13, h: 0.1, amp: 0.035, ph: 2.1, side: -1, colors: [0x6aa8ff, 0x58ffd0, 0xff7ad8] });
  aurora(g, A, { x0: -0.2, x1: 0.75, y: 0.12, z: 0.2, h: 0.08, amp: 0.05, ph: 4.0, side: 1, colors: [0xb070ff, 0x4affb0, 0x5ae8ff] });
  orbiters(g, A, { cx: 0.5, n: 6, rx: 0.42, rz: 0.2, size: 0.06, speed: 0.4, seed: 51, mats: [ICE(), ICE_DEEP()] });
  orbiters(g, A, { cx: 0.45, n: 9, rx: 0.68, rz: 0.3, y: 0.08, size: 0.075, speed: -0.25, seed: 52, mats: [ICE(), ICE_D(), ICE_DEEP()] });
  snowflakeSigil(g, A, 0.45, 0.38);
  snow(g, A, { x0: -0.25, x1: 1.1, w: 0.5, n: 60, seed: 9, h: 0.22 });
  // 握柄：深蓝 + 银箍 + 冰晶柄头
  bevelBox(g, 0.03, 0.03, 0.06, SILVER(), -0.05, 0, 0, 0.005);
  const xe = grip(g, { x0: -0.065, len: 0.2, r: 0.014, m: GRIP(), wrap: SILVER_D(), rings: 9 });
  bevelBox(g, 0.014, 0.026, 0.026, SILVER(), xe - 0.007, 0, 0, 0.003);
  crystal(g, xe - 0.014, 0, 0, V(-1, 0, 0), 0.07, 0.014, ICE_DEEP());
  for (const s of [1, -1]) crystal(g, xe - 0.014, 0, 0, V(-0.7, 0.1, s * 0.7), 0.04, 0.008, ICE());
  g.scale.setScalar(1.04);
  return done(g, A, 1.1 * 1.04, -(xe - 0.084) * 1.04);
}

export const FORMS = {
  50: frosted,
  51: iceCrystal,
  52: permafrost,
  53: giantFang,
  54: auroraCrown,
  55: absoluteZero,
};
