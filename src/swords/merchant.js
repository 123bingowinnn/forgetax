// 幽灵商人特殊剑线：世界树 100–110、鱼刃 200–210、葬仪 3000–3010
// 建模方式：按参考图 ref/wiki/swords/<id>.webp（360×360）的像素坐标直接建模：
//   图像 x → +Z，图像向上 → +X，正面（朝观者）→ +Y；原点 = org(x,y) 指定的护手/握柄交界像素。
//   所有几何在“像素空间”中构建，最后 inner 组按目标总长统一缩放到米。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI, TAU = PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const AX = V3(1, 0, 0), AY = V3(0, 1, 0), AZ = V3(0, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------------------
// 图像坐标
// ---------------------------------------------------------------------------
let OX = 180, OY = 180;
const org = (x, y) => { OX = x; OY = y; };
const I = (x, y, d = 0) => V3(OY - y, d, x - OX);
const IP = (arr) => arr.map((a) => I(a[0], a[1], a[2] || 0));

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 材质 / 贴图（模块级缓存）
// ---------------------------------------------------------------------------
const _mats = new Map();
function mat(color, o = {}) {
  const key = color + '|' + JSON.stringify(o);
  let m = _mats.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    color, roughness: o.r ?? 0.75, metalness: o.m ?? 0.05,
    flatShading: !!o.flat, vertexColors: !!o.vc,
    emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1,
    side: o.ds ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (o.map) m.map = tex(o.map);
  if (o.op != null) { m.transparent = true; m.opacity = o.op; m.depthWrite = false; }
  _mats.set(key, m);
  return m;
}
const glowM = (color, ei = 1.6) => {
  const c = new THREE.Color(color).multiplyScalar(0.35);
  return mat(c.getHex(), { e: color, ei, r: 0.5 });
};

const _tex = new Map();
function tex(name) {
  if (_tex.has(name)) return _tex.get(name);
  if (typeof document === 'undefined') { _tex.set(name, null); return null; }
  const W = 128, H = 128;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d');
  const img = cx.createImageData(W, H);
  const put = (i, c) => { img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255; };
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H, i = (y * W + x) * 4;
    const dors = (Math.cos(TAU * (u - 0.75)) + 1) / 2; // 1=背 0=腹
    let c;
    if (name === 'fishSilver') {
      c = mix([176, 200, 218], [48, 86, 126], Math.pow(dors, 1.1));
      const sh = Math.max(0, Math.cos(TAU * (u - 0.08))) ** 6 * 30;
      c = c.map((k) => k + sh);
    } else if (name === 'fishGrill') {
      c = mix([238, 120, 62], [178, 58, 22], dors);
      const s = (v * 6.2 + 0.12 * Math.cos(u * TAU)) % 1;
      if (s < 0.16) c = mix(c, [92, 30, 10], 0.85);
    } else if (name === 'tuna') {
      c = mix([200, 222, 236], [96, 140, 178], Math.pow(dors, 1.5));
      const a = (u * 48 + v * 40) % 1, b = (u * 48 - v * 40 + 10) % 1;
      if (Math.min(a, b) < 0.09) c = c.map((k) => k * 0.86);
    } else if (name === 'bark') {
      const n = Math.sin(u * 61 + Math.sin(v * 9) * 2) * 0.5 + Math.sin(u * 23 + 1.3) * 0.5;
      c = [255, 255, 255].map((k) => k * (0.86 + 0.14 * n));
    }
    put(i, c.map((k) => clamp(k, 0, 255)));
  }
  cx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  _tex.set(name, t);
  return t;
}

// ---------------------------------------------------------------------------
// 几何工具（像素空间）
// ---------------------------------------------------------------------------
/** rings: Vector3[][]，每圈点按 “从 N 到 T×N” 逆时针排列；T 为前进方向 */
function loft(rings, o = {}) {
  const n = rings.length, m = rings[0].length;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const p = rings[i][j]; pos.push(p.x, p.y, p.z); uv.push(j / m, i / (n - 1));
  }
  const closed = o.closed !== false;
  const jm = closed ? m : m - 1;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < jm; j++) {
    const a = i * m + j, b = (i + 1) * m + j, c = (i + 1) * m + (j + 1) % m, d = i * m + (j + 1) % m;
    idx.push(a, c, b, a, d, c);
  }
  const cap = (ring, base, start) => {
    const c = V3(); ring.forEach((p) => c.add(p)); c.divideScalar(ring.length);
    const ci = pos.length / 3; pos.push(c.x, c.y, c.z); uv.push(0.5, start ? 0 : 1);
    for (let j = 0; j < m; j++) {
      const a = base + j, b = base + (j + 1) % m;
      if (start) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  };
  if (closed && o.cap0 !== false) cap(rings[0], 0, true);
  if (closed && o.cap1 !== false) cap(rings[n - 1], (n - 1) * m, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(o.flip ? idx.reverse() : idx);
  g.computeVertexNormals();
  return g;
}

function radFn(r) {
  if (typeof r === 'function') return r;
  if (Array.isArray(r)) return (s) => {
    const f = s * (r.length - 1), i = Math.min(r.length - 2, Math.floor(f));
    return lerp(r[i], r[i + 1], f - i);
  };
  return () => r;
}

/** 管道：pts Vector3[]，r 数值/数组/函数(s)，o.seg 边数，o.sy 截面在 N(≈+Y) 方向压扁 */
function tube(pts, r, o = {}) {
  const seg = o.seg || 6, n = pts.length, R = radFn(r);
  const L = [0];
  for (let i = 1; i < n; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const tot = L[n - 1] || 1;
  const T = pts.map((p, i) => V3().subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize());
  const up = o.up || (Math.abs(T[0].y) < 0.9 ? AY : AZ);
  let N = up.clone().sub(T[0].clone().multiplyScalar(up.dot(T[0]))).normalize();
  const rings = [];
  for (let i = 0; i < n; i++) {
    N.sub(T[i].clone().multiplyScalar(N.dot(T[i]))).normalize();
    const B = V3().crossVectors(T[i], N);
    const rr = R(L[i] / tot), ring = [];
    for (let j = 0; j < seg; j++) {
      const a = j / seg * TAU + (o.rot || 0);
      const c = Math.cos(a) * (o.sy || 1), s = Math.sin(a);
      ring.push(pts[i].clone().addScaledVector(N, c * rr).addScaledVector(B, s * rr));
    }
    rings.push(ring);
  }
  return loft(rings, o);
}

const spline = (pts, n = 16, tension) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', tension ?? 0.5).getPoints(n);
const tubeI = (arr, r, n = 12, o = {}) => tube(spline(IP(arr), n), r, o);

/** 回转体：c 起点、T 轴、N 参考法向；prof [[s, r]]（s 沿轴递增） */
function lathe(c, T, N, prof, seg = 12, o = {}) {
  const B = V3().crossVectors(T, N);
  const rings = prof.map(([s, r]) => {
    const ring = [];
    for (let j = 0; j < seg; j++) {
      const a = j / seg * TAU + (o.rot || 0);
      ring.push(c.clone().addScaledVector(T, s).addScaledVector(N, Math.cos(a) * r * (o.sy || 1)).addScaledVector(B, Math.sin(a) * r * (o.sz || 1)));
    }
    return ring;
  });
  return loft(rings, o);
}
/** 沿图像竖直轴（cx）的回转体：prof [[y, r]] 从下（y 大）到上 */
const latheI = (cx, prof, seg = 12, o = {}) =>
  lathe(I(cx, 0, o.d || 0).setX(0), AX, AY, prof.map(([y, r]) => [OY - y, r]), seg, o);

function profR(prof, y) { // prof [[y,r]] y 递减
  if (y >= prof[0][0]) return prof[0][1];
  for (let i = 0; i < prof.length - 1; i++) {
    const [y0, r0] = prof[i], [y1, r1] = prof[i + 1];
    if (y <= y0 && y >= y1) return lerp(r0, r1, (y0 - y) / ((y0 - y1) || 1));
  }
  return prof[prof.length - 1][1];
}
const surfD = (prof, cx, sy, x, y) => sy * Math.sqrt(Math.max(0, profR(prof, y) ** 2 - (x - cx) ** 2));

function edgeX(pts, y) { // pts [[x,y]] y 递减（从下到上）
  if (y >= pts[0][1]) return pts[0][0];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if (y <= y0 && y >= y1) return lerp(x0, x1, (y0 - y) / ((y0 - y1) || 1));
  }
  return pts[pts.length - 1][0];
}
/** 由左右边缘轮廓放样的棱面剑身。left/right [[x,y]] 从根部到剑尖；o.t 脊厚(半)、o.te 刃厚(半)、o.rf 脊位置 0..1 */
function bladeE(left, right, o = {}) {
  const y0 = Math.max(left[0][1], right[0][1]), y1 = Math.min(left.at(-1)[1], right.at(-1)[1]);
  const n = o.n || 10, rings = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, y = lerp(y0, y1, s);
    const xl = edgeX(left, y), xr = edgeX(right, y);
    const xc = lerp(xl, xr, typeof o.rf === 'function' ? o.rf(s) : (o.rf ?? 0.5));
    const t = (o.t ?? 6) * (o.tf ? o.tf(s) : 1 - 0.5 * s), te = o.te ?? 0.8;
    const d = o.d || 0;
    rings.push([I(xc, y, d + t), I(xr, y, d + te), I(xr, y, d - te), I(xc, y, d - t * (o.back ?? 1)), I(xl, y, d - te), I(xl, y, d + te)]);
  }
  return loft(rings);
}

/** 图像多边形挤出（厚度沿 Y，居中于 d） */
function extI(pts, depth, o = {}) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(OY - y, x - OX)));
  const b = o.bevel ?? 0;
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: Math.max(0.01, depth - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * (o.bs ?? 1),
    bevelSegments: 1, curveSegments: 4,
  });
  g.rotateX(PI / 2);
  g.translate(0, (depth - 2 * b) / 2 + (o.d || 0), 0);
  return g;
}

const _q = new THREE.Quaternion();
function orient(g, dir, pos) { _q.setFromUnitVectors(AY, dir.clone().normalize()); g.applyQuaternion(_q); g.translate(pos.x, pos.y, pos.z); return g; }
function segG(a, b, r0, r1 = r0, sides = 6) {
  const d = V3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r1, r0, d.length(), sides, 1);
  return orient(g, d, a.clone().add(b).multiplyScalar(0.5));
}
function coneG(p, dir, len, r, sides = 5) {
  const g = new THREE.ConeGeometry(r, len, sides, 1); g.translate(0, len / 2, 0);
  return orient(g, dir, p);
}
function sph(p, rx, ry = rx, rz = rx, ws = 10, hs = 7) {
  const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); g.translate(p.x, p.y, p.z); return g;
}
function torusG(p, axis, R, r, rs = 5, ts = 14, arc = TAU) {
  const g = new THREE.TorusGeometry(R, r, rs, ts, arc);
  _q.setFromUnitVectors(AZ, axis.clone().normalize()); g.applyQuaternion(_q); g.translate(p.x, p.y, p.z); return g;
}
/** 图像方块：中心(x,y)，宽 w（Z）、高 h（X）、厚 dd（Y） */
function boxI(x, y, w, h, dd, d = 0) { const g = new THREE.BoxGeometry(h, dd, w); g.translate(OY - y, d, x - OX); return g; }
function octa(p, r, sx = 1, sy = 1, sz = 1) { const g = new THREE.OctahedronGeometry(r, 0); g.scale(sx, sy, sz); g.translate(p.x, p.y, p.z); return g; }

/** 叶片批：非索引几何 + 顶点色 */
class Leaves {
  constructor() { this.p = []; this.c = []; }
  add(pos, dir, up, len, wid, color) {
    const x = dir.clone().normalize();
    const z = V3().crossVectors(x, up).normalize();
    if (z.lengthSq() < 1e-6) z.set(0, 0, 1);
    const y = V3().crossVectors(z, x);
    const P = (a, b, c) => pos.clone().addScaledVector(x, a * len).addScaledVector(y, b * wid).addScaledVector(z, c * wid);
    const B = P(0, 0, 0), T = P(1, 0, 0), C = P(0.5, 0.14, 0), Lp = P(0.42, -0.12, -0.5), Rp = P(0.42, -0.12, 0.5);
    for (const tri of [[B, C, Lp], [C, T, Lp], [B, Rp, C], [C, Rp, T]]) for (const v of tri) { this.p.push(v.x, v.y, v.z); this.c.push(color.r, color.g, color.b); }
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(this.p.length / 3 * 2), 2));
    g.computeVertexNormals();
    return g;
  }
}

/** 给几何体上一种顶点色 */
function tint(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// ---------------------------------------------------------------------------
// 模型容器：按材质收集几何 → 合并；最后整体缩放到目标长度（米）
// ---------------------------------------------------------------------------
class Model {
  constructor() { this.inner = new THREE.Group(); this.parts = new Map(); this.fx = []; }
  add(g, m) { if (!this.parts.has(m)) this.parts.set(m, []); this.parts.get(m).push(g); return g; }
  obj(o, noBounds = false) { if (noBounds) o.traverse((c) => { c.userData.noBounds = true; }); this.inner.add(o); return o; }
  static prep(g, vc) {
    g = g.index ? g.toNonIndexed() : g;
    g.clearGroups();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (vc && !g.attributes.color) tint(g, 0xffffff);
    if (!vc && g.attributes.color) g.deleteAttribute('color');
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    return g;
  }
  static mesh(list, m) {
    const g = mergeGeometries(list.map((x) => Model.prep(x, m.vertexColors)), false);
    return new THREE.Mesh(g, m);
  }
  finish(L, o = {}) {
    for (const [m, list] of this.parts) this.inner.add(Model.mesh(list, m));
    this.inner.updateMatrixWorld(true);
    const bb = new THREE.Box3();
    this.inner.traverse((c) => {
      if (!c.isMesh || c.userData.noBounds) return;
      c.geometry.computeBoundingBox();
      bb.union(c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld));
    });
    const k = L / (bb.max.x - bb.min.x);
    const zs = o.maxW ? Math.min(1, o.maxW / ((bb.max.z - bb.min.z) * k)) : 1;
    const ys = o.maxT ? Math.min(1, o.maxT / ((bb.max.y - bb.min.y) * k)) : 1;
    this.inner.scale.set(k, k * ys, k * zs);
    const g = new THREE.Group();
    g.add(this.inner);
    g.userData = {
      length: L, bladeLength: bb.max.x * k, gripLength: -bb.min.x * k,
      width: (bb.max.z - bb.min.z) * k * zs, thickness: (bb.max.y - bb.min.y) * k * ys,
    };
    if (this.fx.length) {
      const fx = this.fx;
      g.userData.update = (dt, t) => { for (const f of fx) f(dt, t); };
    }
    return g;
  }
}

// ---------------------------------------------------------------------------
// 共享小部件
// ---------------------------------------------------------------------------
/** 铜绳圈（绕 X 轴的若干圈） */
function ropeRings(m, x, ys, R, r = 1.6, mt = mat(0xb26a38, { r: 0.55, m: 0.25 })) {
  for (const y of ys) m.add(torusG(I(x, y), AX, R, r, 4, 14), mt);
}
/** 挂灯：top 像素（x,y），s 尺寸；返回发光网格 */
function lantern(m, x, y, s, d = 0) {
  const dark = mat(0x262c34, { r: 0.7, flat: true, m: 0.2 }), cop = mat(0xb8743c, { r: 0.5, m: 0.3, flat: true });
  m.add(coneG(I(x, y + s * 0.42, d), AX, s * 0.42, s * 0.62, 4).rotateX(0), dark);
  m.add(boxI(x, y + s * 0.47, s * 0.86, s * 0.08, s * 0.86, d), dark);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.add(boxI(x + a * s * 0.36, y + s * 0.8, s * 0.09, s * 0.62, s * 0.09, d + b * s * 0.36), dark);
  m.add(boxI(x, y + s * 1.14, s * 0.84, s * 0.12, s * 0.84, d), cop);
  const g = new THREE.Mesh(boxI(x, y + s * 0.8, s * 0.64, s * 0.6, s * 0.64, d), glowM(0x46d8ff, 0.9));
  m.add(segG(I(x, y, d), I(x, y + s * 0.1, d), s * 0.05, s * 0.05, 4), dark);
  return m.obj(g);
}
/** 链条：沿折线放置交替方向的环 */
function chain(m, pts, R, mt = mat(0x3a424c, { r: 0.6, m: 0.3, flat: true })) {
  const P = spline(IP(pts), 30);
  const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
  const step = R * 1.7; let k = 0;
  for (let s = R; s < L.at(-1) - R * 0.5; s += step, k++) {
    let i = 1; while (i < P.length - 1 && L[i] < s) i++;
    const t = (s - L[i - 1]) / (L[i] - L[i - 1] || 1);
    const p = P[i - 1].clone().lerp(P[i], t), dir = V3().subVectors(P[i], P[i - 1]).normalize();
    const g = new THREE.TorusGeometry(R, R * 0.3, 4, 8); g.scale(0.75, 1.25, 1); // 环沿 Y 拉长
    const side = k % 2 ? AZ : AY;
    const nrm = side.clone().sub(dir.clone().multiplyScalar(side.dot(dir))).normalize();
    const mtx = new THREE.Matrix4().makeBasis(V3().crossVectors(dir, nrm), dir, nrm).setPosition(p);
    g.applyMatrix4(mtx);
    m.add(g, mt);
  }
}
/** 漂浮光点（游魂/气泡），返回更新函数 */
function motes(m, n, box, color, size, seed, o = {}) {
  const r = rng(seed), mt = glowM(color, o.ei ?? 2);
  const geo = new THREE.OctahedronGeometry(size, 0);
  const list = [];
  for (let i = 0; i < n; i++) {
    const me = new THREE.Mesh(geo, mt);
    const b = { x: lerp(box[0], box[2], r()), y: lerp(box[1], box[3], r()), d: (r() - 0.5) * (box[4] || 40), ph: r() * TAU, sp: 0.5 + r() };
    me.userData.b = b;
    m.obj(me, true); list.push(me);
  }
  m.fx.push((dt, t) => {
    for (const me of list) {
      const b = me.userData.b;
      const rise = o.rise ? ((t * o.rise * b.sp + b.ph * 10) % (box[3] - box[1])) : 0;
      me.position.copy(I(b.x + Math.sin(t * b.sp + b.ph) * 4, b.y - rise + Math.cos(t * 0.7 * b.sp + b.ph) * 3, b.d));
      me.rotation.set(t * b.sp, t * 0.6, 0);
      const s = 0.6 + 0.4 * Math.sin(t * 3 * b.sp + b.ph);
      me.scale.setScalar(s);
    }
  });
  m.fx.at(-1)(0, 0);
}
/** 发光体闪烁（缩放微动，不碰材质，避免和核心的 heat 冲突） */
function flicker(m, mesh, amp = 0.06, sp = 5, ph = 0) {
  const s0 = mesh.scale.clone();
  m.fx.push((dt, t) => { const k = 1 + amp * Math.sin(t * sp + ph) + amp * 0.5 * Math.sin(t * sp * 2.3 + ph); mesh.scale.copy(s0).multiplyScalar(k); });
}
/** 让一个子组绕 pivot（像素坐标 Vector3）摆动 */
function sway(m, parts, pivot, axis, amp, sp, ph = 0) {
  const grp = new THREE.Group(); grp.position.copy(pivot);
  for (const p of parts) { p.position.sub(pivot); grp.add(p); }
  m.obj(grp);
  m.fx.push((dt, t) => { grp.setRotationFromAxisAngle(axis, amp * Math.sin(t * sp + ph)); });
  return grp;
}

// =====================================================================
// 世界树线 100–110
// =====================================================================
const TREE = {
  bark: () => mat(0x4e3b29, { r: 0.85, map: 'bark' }),
  barkL: () => mat(0x6b5236, { r: 0.8, map: 'bark' }),
  knot: () => mat(0x9c7a50, { r: 0.8 }),
  stave: () => mat(0x6d573a, { r: 0.75, map: 'bark' }),
  root: () => mat(0x9a7c56, { r: 0.75 }),
  grip: () => mat(0x6a4a2e, { r: 0.8, flat: true }),
  leaf: () => mat(0xffffff, { r: 0.7, vc: true, ds: true, flat: true }),
};
const LEAF_COLS = [0x2f7d31, 0x3d9a3c, 0x4bb048, 0x2a6a2c, 0x5cbd52, 0x35873a].map((c) => new THREE.Color(c));

function branchForm(c) {
  org(c.ox, c.oy);
  const m = new Model();
  m.add(tube(spline(IP(c.main), 28), c.r, { seg: 9 }), TREE.bark());
  for (const t of c.twigs) m.add(tube(spline(IP(t.p), 8), t.r, { seg: 6 }), TREE.bark());
  for (const k of c.knots) m.add(sph(I(k[0], k[1], k[3] || 0), k[2] * 1.2, k[2] * 0.8, k[2] * 0.85, 7, 5), TREE.knot());
  if (c.extra) c.extra(m);
  return m.finish(c.L);
}

function f100() {
  return branchForm({
    L: 0.55, ox: 172, oy: 255,
    main: [[166, 342], [171, 290], [176, 230], [179, 170], [182, 115], [190, 60], [206, 18]],
    r: [9, 9, 8.5, 8, 7.5, 6.5, 5],
    twigs: [{ p: [[179, 127], [162, 108], [142, 92], [121, 82]], r: [4.5, 2] },
      { p: [[184, 193], [204, 177], [221, 164], [237, 155]], r: [4.5, 2] }],
    knots: [[188, 170, 6, 3], [166, 258, 10, 1]],
  });
}
function f101() {
  return branchForm({
    L: 0.64, ox: 176, oy: 255,
    main: [[168, 343], [173, 285], [178, 215], [182, 150], [186, 95], [194, 48], [206, 18]],
    r: [11, 11, 10.5, 10, 9, 8, 6],
    twigs: [{ p: [[181, 110], [160, 99], [133, 91]], r: [4.5, 2] },
      { p: [[187, 183], [206, 171], [226, 162]], r: [4.5, 2] }],
    knots: [[197, 85, 8, 2], [170, 143, 12, 2], [195, 127, 9, 4], [199, 236, 10, 3]],
  });
}
/** 棍棒（102/103）主体 */
function clubBody(m, o) {
  const trunk = spline(IP(o.trunk), 26);
  m.add(tube(trunk, o.r, { seg: 10 }), TREE.bark());
  const r = rng(o.seed || 3);
  for (const [x, y, s, d, light] of o.lumps) {
    m.add(sph(I(x, y, d), s * (0.9 + r() * 0.3), s * 0.85, s * (0.9 + r() * 0.2), 7, 5), light ? TREE.knot() : TREE.barkL());
  }
  m.add(tube(spline(IP(o.stub), 6), o.stubR, { seg: 8 }), TREE.bark());
}
function f102() {
  org(188, 245);
  const m = new Model();
  clubBody(m, {
    trunk: [[188, 342], [192, 290], [192, 230], [186, 160], [180, 110], [183, 60]],
    r: [15, 18, 22, 26, 29, 27],
    lumps: [[140, 102, 15, 6, 1], [178, 62, 13, 18, 1], [207, 92, 12, 10, 1], [214, 58, 8, 4, 1], [160, 50, 10, 6, 0],
      [148, 75, 11, 2, 0], [200, 120, 12, 6, 0], [168, 92, 10, 26, 0], [193, 45, 9, 12, 0], [205, 70, 10, -12, 0], [160, 120, 10, -10, 0]],
    stub: [[188, 55], [190, 35], [193, 18]], stubR: [12, 11, 10],
  });
  m.add(tube(IP([[205, 182], [214, 170]]), [4, 2.5], { seg: 6 }), TREE.bark());
  return m.finish(0.73);
}
/** 树根爪：从 p0 出发的弯曲圆锥 */
function claw(m, pts, r0, mt = TREE.root(), seg = 7) { m.add(tube(spline(IP(pts), 12), (s) => r0 * (1 - s * 0.88), { seg }), mt); }
/** 小枝 + 叶片 */
function sprout(m, lv, pts, leaves, r0 = 3) {
  m.add(tube(spline(IP(pts), 8), [r0, r0 * 0.5], { seg: 5 }), TREE.bark());
  for (const [x, y, ang, sz, d] of leaves) {
    const a = ang * PI / 180;
    lv.add(I(x, y, d || 0), V3(Math.cos(a), 0.15, Math.sin(a)), V3(0, 1, 0.2).normalize(), sz, sz * 0.55, LEAF_COLS[(x + y) % 4]);
  }
}
function f103() {
  org(180, 212);
  const m = new Model(), lv = new Leaves();
  clubBody(m, {
    seed: 7,
    trunk: [[180, 342], [182, 280], [180, 215], [177, 150], [175, 100], [178, 55]],
    r: [15, 19, 23, 26, 28, 26],
    lumps: [[143, 80, 15, 4, 0], [170, 52, 13, 16, 0], [205, 85, 13, 8, 0], [150, 105, 12, 8, 0], [200, 60, 11, 2, 0],
      [158, 62, 10, 16, 0], [190, 110, 10, 18, 0], [212, 110, 10, -6, 0], [140, 55, 9, -4, 0]],
    stub: [[180, 50], [181, 32], [182, 18]], stubR: [13, 12, 11],
  });
  // 发光叶脉
  m.add(tubeI([[173, 128, 28], [171, 105, 32], [172, 80, 30], [175, 58, 24]], 1.8, 10, { seg: 5 }), glowM(0x34f080, 1.4));
  // 新芽
  sprout(m, lv, [[188, 52, 6], [205, 45, 6], [225, 38, 4], [246, 32, 2]], [[222, 36, -40, 18, 6], [233, 44, 60, 15, 4], [212, 47, 120, 12, 6], [240, 30, 10, 13, 2]]);
  // 香蕉皮一样的根爪
  claw(m, [[168, 196], [140, 212], [122, 240], [118, 268], [124, 292]], 14);
  claw(m, [[192, 196], [220, 212], [236, 240], [240, 268], [234, 292]], 14);
  claw(m, [[178, 200, 14], [168, 230, 26], [166, 262, 26], [170, 300, 18]], 13);
  claw(m, [[182, 200, -14], [190, 232, -24], [194, 270, -20]], 11);
  m.add(lv.geo(), TREE.leaf());
  return m.finish(0.82);
}

/** 种子/花苞（104–106） */
function bulbForm(c) {
  org(180, c.oy);
  const m = new Model(), lv = new Leaves();
  const cx = 180, prof = c.prof, N = c.n || 8, K = 4, sy = c.sy || 0.75;
  const y0 = prof[0][0], y1 = prof.at(-1)[0];
  // 木片（带 S 形扭转）
  for (let s = 0; s < N; s++) {
    const a0 = s / N * TAU + c.gap / 2, a1 = (s + 1) / N * TAU - c.gap / 2;
    const rings = prof.map(([y, r]) => {
      const t = (y0 - y) / (y0 - y1), tw = c.tw * Math.sin(PI * t) * (s % 2 ? 1 : 0.85);
      const ring = [];
      for (let k = 0; k <= K; k++) { const a = lerp(a0, a1, k / K) + tw; ring.push(V3(OY - y, Math.cos(a) * r * sy, Math.sin(a) * r + (cx - OX))); }
      for (let k = K; k >= 0; k--) { const a = lerp(a0, a1, k / K) + tw; const ri = Math.max(1, r - c.th); ring.push(V3(OY - y, Math.cos(a) * ri * sy, Math.sin(a) * ri + (cx - OX))); }
      return ring;
    });
    m.add(loft(rings), TREE.stave());
  }
  // 发光内核
  const core = new THREE.Mesh(latheI(cx, prof.map(([y, r]) => [y, Math.max(0.5, Math.min(r * 0.9, r - c.th - 2))]), 14, { sy }), glowM(0x2ee8e0, 0.75));
  m.obj(core); flicker(m, core, 0.015, 2.2);
  // 颈部
  m.add(tubeI([[cx, y0 - 4], [cx, c.oy - 10], [cx, c.oy + 6]], [c.neck * 0.8, c.neck, c.neck * 1.1], 6, { seg: 9 }), TREE.stave());
  for (const a of c.arms) { m.add(tubeI(a, c.armR, 12, { seg: 6 }), TREE.root()); m.add(tubeI(a.map(([x, y, d]) => [360 - x, y, d]), c.armR, 12, { seg: 6 }), TREE.root()); }
  for (const r of c.roots) { claw(m, r.p, r.r); if (!r.solo) claw(m, r.p.map(([x, y, d]) => [360 - x, y, d]), r.r); }
  threadGrip(m, cx, c.oy + 6, c.gripEnd, c.gripR, c.collar);
  for (const s of c.sprouts) sprout(m, lv, s.p, s.l, s.r || 3);
  for (const [x, y, ang, sz, d] of c.leaves) {
    const a = ang * PI / 180;
    lv.add(I(x, y, d || 0), V3(Math.cos(a), 0.2, Math.sin(a)), V3(0.2, 1, 0).normalize(), sz, sz * 0.55, LEAF_COLS[(x * 3 + y) % 5]);
  }
  if (c.vine) {
    m.add(tubeI(c.vine, 1.6, 16, { seg: 4 }), mat(0x3f7a30, { r: 0.8 }));
    const P = spline(IP(c.vine), 10);
    P.forEach((p, i) => { if (i % 2 === 0) lv.add(p, V3(0.3, 0.2, i % 4 ? 1 : -1), AY, 9, 6, LEAF_COLS[i % 5]); });
  }
  const lm = new THREE.Mesh(Model.prep(lv.geo(), true), TREE.leaf());
  sway(m, [lm], I(cx, y1 + 10), AY, 0.02, 1.3);
  return m.finish(c.L, { maxT: 0.34 });
}
/** 螺纹木柄 */
function threadGrip(m, cx, yTop, yBot, r, collar) {
  const prof = [];
  for (let y = yBot, k = 0; y >= yTop; y -= 3, k++) prof.push([y, k % 2 ? r : r * 0.85]);
  prof.unshift([yBot + 2, r * 0.7]);
  m.add(latheI(cx, prof, 10), TREE.grip());
  if (collar) m.add(torusG(I(cx, yTop + 3), AX, r * 1.05, 2.4, 5, 14), mat(0xa0663a, { r: 0.5, m: 0.3 }));
  m.add(latheI(cx, [[yBot + 6, 0.1], [yBot + 5, r * 0.9], [yBot, r]], 10), mat(0x8a6040, { r: 0.6, flat: true }));
}

function f104() {
  return bulbForm({
    L: 0.91, oy: 240, gap: 0.3, tw: 0.4, th: 7, neck: 16,
    prof: [[220, 14], [208, 36], [192, 56], [172, 69], [148, 75], [122, 73], [98, 64], [78, 48], [64, 28], [55, 8]],
    arms: [[[127, 175], [121, 200], [134, 222], [160, 236]]], armR: [5, 4],
    roots: [{ p: [[172, 234], [148, 238], [132, 256], [130, 280], [136, 296]], r: 9 },
      { p: [[176, 242, 6], [164, 260, 10], [160, 282, 10], [163, 296, 8]], r: 7 }],
    gripEnd: 335, gripR: 13,
    sprouts: [{ p: [[180, 58], [184, 40], [190, 22]], l: [[187, 34, -60, 13], [192, 26, 30, 12], [178, 45, -130, 11, 4], [186, 70, 40, 13, 30], [174, 76, -60, 11, 30]] }],
    leaves: [[258, 140, 40, 14, 6]],
  });
}
function f105() {
  return bulbForm({
    L: 1.0, oy: 240, gap: 0.24, tw: 0.62, th: 8, neck: 16,
    prof: [[218, 14], [205, 40], [190, 62], [170, 82], [145, 93], [118, 92], [92, 82], [70, 62], [55, 36], [45, 10]],
    arms: [[[118, 188], [110, 214], [128, 234], [160, 240]]], armR: [5, 4],
    roots: [{ p: [[172, 236], [148, 240], [134, 256], [132, 280], [138, 294]], r: 9 },
      { p: [[176, 244, 6], [166, 262, 10], [162, 284, 10], [166, 298, 8]], r: 7 }],
    gripEnd: 332, gripR: 12,
    sprouts: [{ p: [[180, 48], [183, 35], [188, 22]], l: [[186, 30, -70, 13], [192, 24, 40, 12], [176, 40, -140, 12, 4], [196, 40, 80, 11, 4], [175, 70, -50, 12, 36]] }],
    leaves: [[90, 95, -150, 16, 0], [268, 135, 50, 14, 0], [110, 70, -120, 12, 10]],
  });
}
function f106() {
  return bulbForm({
    L: 1.1, oy: 256, gap: 0.22, tw: 0.62, th: 9, neck: 16,
    prof: [[220, 16], [208, 45], [192, 70], [170, 95], [142, 107], [115, 106], [90, 95], [70, 75], [55, 45], [48, 14]],
    arms: [[[112, 170], [98, 212], [112, 250], [150, 262]], [[140, 205, -10], [122, 235, -10], [140, 255, -6], [168, 256, 0]]], armR: [5, 4],
    roots: [{ p: [[172, 255], [146, 252], [124, 262], [118, 284], [124, 296]], r: 9 },
      { p: [[174, 258, 8], [154, 270, 12], [144, 288, 12], [148, 300, 10]], r: 8 },
      { p: [[177, 262, 12], [168, 280, 16], [166, 298, 14]], r: 7 },
      { p: [[180, 262, 14], [181, 282, 22], [179, 298, 22]], r: 7, solo: true }],
    gripEnd: 334, gripR: 11, collar: true,
    sprouts: [{ p: [[180, 50], [183, 35], [188, 22]], l: [[186, 30, -70, 13], [194, 24, 40, 12], [176, 40, -140, 12, 4], [196, 42, 80, 11, 4]] },
      { p: [[150, 75, 40], [130, 62, 40], [112, 58, 30]], l: [[128, 60, -100, 13, 40], [112, 56, -160, 12, 30], [140, 66, 160, 11, 44]], r: 2 },
      { p: [[215, 70, 40], [240, 58, 30], [258, 50, 20]], l: [[240, 56, 60, 13, 30], [258, 48, 20, 12, 20], [228, 62, 120, 11, 36]], r: 2 }],
    leaves: [[82, 92, -150, 15, 10], [276, 135, 40, 13, 0], [248, 74, 30, 13, 20]],
    vine: [[200, 240, 40], [214, 222, 34], [220, 205, 28], [234, 192, 18], [244, 178, 6]],
  });
}

/** 叶片喷雾：沿小枝的羽状叶 */
function spray(lv, m, pts, nPairs, size, seed, o = {}) {
  const r = rng(seed);
  const P = spline(IP(pts), 16);
  m.add(tube(P, [o.r0 ?? 3, 1], { seg: 4 }), TREE.bark());
  for (let i = 2; i <= 16; i += Math.max(1, Math.round(16 / nPairs))) {
    const p = P[Math.min(16, i)], d = V3().subVectors(P[Math.min(16, i + 1)] || p, P[i - 1]).normalize();
    for (const side of [-1, 1]) {
      const perp = V3().crossVectors(d, AY).multiplyScalar(side).normalize();
      const dir = d.clone().multiplyScalar(0.6).add(perp).normalize();
      dir.y += (r() - 0.5) * 0.6;
      const up = V3((r() - 0.5) * 0.6, 1, (r() - 0.5) * 0.6).normalize();
      lv.add(p, dir, up, size * (0.8 + r() * 0.4), size * 0.5, LEAF_COLS[Math.floor(r() * LEAF_COLS.length)]);
      if (r() < 0.6) lv.add(p, dir.clone().add(V3(0.3, side * 0.7, 0)).normalize(), V3(0, 0.3, 1), size * 0.8, size * 0.45, LEAF_COLS[Math.floor(r() * LEAF_COLS.length)]);
    }
  }
  const tip = P[16], d = V3().subVectors(P[16], P[15]).normalize();
  lv.add(tip, d, AY, size, size * 0.5, LEAF_COLS[1]);
}

/** 古树（107/108）：木条束成的花瓶状树干 + 横展叶枝 */
function vaseForm(c) {
  org(c.cx, c.oy);
  const m = new Model(), lv = new Leaves(), r = rng(c.seed);
  const prof = c.prof, M = c.n || 11, sy = 0.62;
  for (let s = 0; s < M; s++) {
    const a = s / M * TAU + 0.15;
    const top = prof.at(-1)[0] + (r() - 0.3) * 18;
    const pts = prof.map(([y, R], i) => {
      const yy = i === prof.length - 1 ? top : y;
      const tw = 0.12 * Math.sin(i * 0.8 + s);
      return V3(OY - yy, Math.cos(a + tw) * R * sy, Math.sin(a + tw) * R + (c.cx - OX));
    });
    const wR = TAU * prof[3][1] / M * 0.5;
    m.add(tube(spline(pts, 16), (t) => wR * (0.55 + 0.45 * Math.sin(Math.min(1, t * 1.15) * PI * 0.5 + 0.2)), { seg: 6 }), s % 3 ? TREE.stave() : TREE.barkL());
  }
  const yt = prof.at(-1)[0] + 10;
  m.add(latheI(c.cx, [[yt + 30, 0.1], [yt + 8, prof.at(-1)[1] * 0.9], [yt, prof.at(-1)[1] * 0.88], [yt - 1, 0.1]], 12, { sy }), mat(0x2a1c12, { r: 0.9 }));
  if (c.glow) {
    const gm = new THREE.Mesh(sph(I(c.cx, yt - 2, 0), 8, 6, 16, 8, 6), glowM(0x4cff6a, 1.1));
    m.obj(gm); flicker(m, gm, 0.1, 3);
    m.add(tubeI([[c.cx + 2, yt + 40, 36], [c.cx + 4, yt + 15, 34], [c.cx + 2, yt, 30]], 1.6, 8, { seg: 4 }), glowM(0x4cff6a, 1.6));
  }
  // 树根爪
  const yb = prof[0][0];
  for (let i = 0; i < c.roots; i++) {
    const a = (i + 0.5) / c.roots * TAU;
    const R0 = prof[1][1] * 0.8, cz = Math.sin(a), cy = Math.cos(a);
    const p0 = V3(OY - prof[1][0], cy * R0 * sy, cz * R0 + c.cx - OX);
    const p1 = V3(OY - yb - 8, cy * (R0 + 14) * sy, cz * (R0 + 14) + c.cx - OX);
    const p2 = V3(OY - yb - 24, cy * (R0 + 16) * sy, cz * (R0 + 14) + c.cx - OX);
    const p3 = V3(OY - yb - 34, cy * (R0 + 10) * sy, cz * (R0 + 10) + c.cx - OX);
    m.add(tube(spline([p0, p1, p2, p3], 10), (t) => 8 * (1 - t * 0.85), { seg: 6 }), TREE.root());
  }
  threadGrip(m, c.cx, c.oy, c.gripEnd, 9, false);
  // 叶枝
  const sprays = [];
  for (const s of c.sprays) {
    const sub = new Leaves(), subM = new Model();
    spray(sub, subM, s.p, Math.round(s.n * 1.4), (s.size || 15) * 1.35, c.seed + s.p[0][0]);
    const g = new THREE.Group();
    for (const [mm, list] of subM.parts) g.add(Model.mesh(list, mm));
    g.add(new THREE.Mesh(Model.prep(sub.geo(), true), TREE.leaf()));
    const piv = I(s.p[0][0], s.p[0][1], s.p[0][2] || 0);
    sway(m, [g], piv, V3(0.3, 1, 0).normalize(), 0.025, 1.1 + r(), r() * 6);
  }
  m.add(lv.geo(), TREE.leaf());
  return m.finish(c.L, { maxT: 0.36, maxW: c.maxW });
}
function f107() {
  return vaseForm({
    L: 1.2, cx: 172, oy: 262, seed: 107, roots: 9, gripEnd: 310,
    prof: [[255, 16], [240, 34], [215, 46], [175, 51], [130, 50], [95, 46], [68, 42]], maxW: 0.8,
    sprays: [
      { p: [[140, 120, 10], [110, 132, 14], [82, 142, 10], [52, 150, 6]], n: 7 },
      { p: [[140, 95, 10], [112, 100, 12], [80, 98, 10], [55, 104, 6]], n: 6 },
      { p: [[205, 110, 10], [235, 120, 14], [262, 138, 12], [300, 150, 8]], n: 7 },
      { p: [[205, 85, 10], [238, 78, 12], [270, 70, 10], [306, 66, 6]], n: 7 },
      { p: [[158, 72, 20], [138, 58, 22], [112, 52, 18]], n: 4, size: 13 },
      { p: [[188, 70, 22], [214, 58, 22], [232, 50, 16]], n: 4, size: 13 },
      { p: [[178, 92, 40], [200, 112, 44], [222, 140, 40]], n: 5, size: 14 },
      { p: [[160, 100, 40], [140, 125, 44], [130, 150, 36]], n: 4, size: 13 },
    ],
  });
}
function f108() {
  return vaseForm({
    L: 1.3, cx: 172, oy: 268, seed: 108, roots: 10, gripEnd: 300, glow: true,
    prof: [[262, 16], [246, 34], [220, 45], [180, 50], [135, 49], [100, 45], [80, 41]], maxW: 0.8,
    sprays: [
      { p: [[138, 130, 10], [108, 142, 14], [76, 152, 10], [44, 160, 6]], n: 8 },
      { p: [[138, 108, 10], [108, 110, 12], [72, 104, 10], [42, 100, 6]], n: 8 },
      { p: [[140, 92, 14], [116, 80, 16], [86, 70, 12], [56, 70, 6]], n: 7 },
      { p: [[206, 125, 10], [236, 138, 14], [266, 152, 12], [304, 160, 8]], n: 8 },
      { p: [[206, 100, 10], [238, 98, 12], [272, 92, 10], [312, 90, 6]], n: 8 },
      { p: [[206, 86, 14], [234, 72, 16], [262, 62, 12], [298, 60, 6]], n: 7 },
      { p: [[160, 85, 20], [140, 68, 22], [118, 60, 18]], n: 4, size: 13 },
      { p: [[190, 82, 22], [214, 70, 22], [234, 62, 16]], n: 4, size: 13 },
      { p: [[178, 100, 40], [204, 122, 44], [226, 150, 40]], n: 5, size: 14 },
      { p: [[160, 112, 40], [140, 138, 44], [126, 165, 36]], n: 5, size: 13 },
    ],
  });
}

/** 世界树（109/110） */
function worldTree(c) {
  org(c.cx, c.oy);
  const m = new Model(), r = rng(c.seed);
  const cx = c.cx, yB = c.oy - 4, yT = c.forkY;
  // 拧成一股的树干
  const strands = 3;
  for (let s = 0; s < strands; s++) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, y = lerp(yB + 6, yT - 6, t), a = s / strands * TAU + t * PI * 1.3;
      const R = lerp(c.trunkR * 0.75, c.trunkR * 0.35, t);
      pts.push(I(cx + Math.sin(a) * R + c.lean * t * t, y, Math.cos(a) * R * 0.7));
    }
    m.add(tube(pts, (t) => lerp(c.trunkR * 0.62, c.trunkR * 0.42, t), { seg: 8 }), s ? TREE.bark() : TREE.barkL());
  }
  // 发光纹路（黄 + 绿）
  for (const [col, ph] of [[0xf6e23a, -0.35], [0x40f080, 0.55]]) {
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18, y = lerp(yB + 2, yT - 4, t), a = ph + Math.sin(t * PI * 1.6) * 0.6;
      const R = lerp(c.trunkR * 1.05, c.trunkR * 0.75, t);
      pts.push(I(cx + Math.sin(a) * R * 0.55 + c.lean * t * t, y, Math.cos(a) * R * 0.75 + 2));
    }
    m.add(tube(pts, 2.0, { seg: 5 }), glowM(col, 0.9));
  }
  // 树根
  for (let i = 0; i < c.roots; i++) {
    const a = (i + 0.5) / c.roots * TAU, cz = Math.sin(a), cy = Math.cos(a);
    const R0 = c.trunkR * 0.6;
    const pts = [[R0, 0, -4], [R0 + 18, 8, -2], [R0 + 34, 14, 4], [R0 + 44, 18, 14], [R0 + 42, 16, 22]].map(([rr, h, dy]) =>
      V3(OY - (yB + dy), cy * rr * 0.65, cz * rr + cx - OX).add(V3(0, 0, 0)));
    m.add(tube(spline(pts, 8), (t) => 7 * (1 - t * 0.85), { seg: 5 }), TREE.root());
  }
  threadGrip(m, cx, c.oy, c.gripEnd, 8, true);
  // 枝 + 冠
  const leafMat = TREE.leaf();
  const fruitMat = glowM(0xffa21e, 0.9);
  for (const b of c.branches) {
    m.add(tubeI(b.p, [b.r || 6, 2.5], 9, { seg: 5 }), TREE.bark());
  }
  for (const pd of c.pads) {
    const lv = new Leaves(), fr = [];
    const [x, y, w, h, n0, dd] = pd, n = Math.round(n0 * (c.leafK || 1));
    for (let i = 0; i < n; i++) {
      // 椭球内采样，偏向表面与上沿
      let u, v, q;
      do { u = r() * 2 - 1; v = r() * 2 - 1; q = r() * 2 - 1; } while (u * u + v * v + q * q > 1);
      const rr = Math.sqrt(u * u + v * v + q * q) || 1, f = Math.pow(rr, 0.35) / rr;
      u *= f; v *= f; q *= f;
      const p = I(x + u * w / 2, y - Math.abs(v) * h * 0.35 + v * h * 0.25, q * (dd || 40));
      const out = V3(-v * 0.3 + 0.3, q * 0.6, u).normalize();
      const up = V3((r() - 0.5) * 0.8, 1, (r() - 0.5) * 0.8).normalize();
      if (up.dot(V3(0, Math.sign(q) || 1, 0)) < 0) up.y *= -1;
      lv.add(p, out.add(V3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.8)), up, c.leafS * (0.8 + r() * 0.4), c.leafS * 0.5, LEAF_COLS[Math.floor(r() * LEAF_COLS.length)]);
      if (c.fruit && r() < c.fruit) fr.push(new THREE.TetrahedronGeometry(3 + r() * 1.6).translate(...p.clone().add(V3(r() * 2, (Math.sign(q) || 1) * 3, r() * 2)).toArray()));
    }
    const parts = [new THREE.Mesh(Model.prep(lv.geo(), true), leafMat)];
    if (fr.length) parts.push(Model.mesh(fr, fruitMat));
    sway(m, parts, I(x, y + h * 0.4, 0), V3(0.2, 1, 0.3).normalize(), 0.018, 0.9 + r() * 0.6, r() * 6);
  }
  // 飘落的叶子
  const fall = [];
  const fg = new THREE.PlaneGeometry(7, 4);
  for (let i = 0; i < c.falling; i++) {
    const me = new THREE.Mesh(fg, mat(i % 2 ? 0xe2902a : 0xd06a20, { r: 0.7, ds: true, e: 0x804010, ei: 0.4 }));
    me.userData.b = { x: lerp(c.fallBox[0], c.fallBox[2], r()), y0: lerp(c.fallBox[1], c.fallBox[3], r()), ph: r() * 10, d: (r() - 0.5) * 50 };
    m.obj(me, true); fall.push(me);
  }
  const span = c.fallBox[3] - c.fallBox[1];
  m.fx.push((dt, t) => {
    for (const me of fall) {
      const b = me.userData.b, k = ((b.y0 - c.fallBox[1] + t * 6 + b.ph * 13) % span);
      me.position.copy(I(b.x + Math.sin(t + b.ph) * 8, c.fallBox[1] + k, b.d));
      me.rotation.set(t * 1.3 + b.ph, t * 0.8, b.ph);
    }
  });
  m.fx.at(-1)(0, 0);
  return m.finish(c.L, { maxW: c.maxW, maxT: 0.38 });
}
function f109() {
  return worldTree({
    L: 1.4, cx: 190, oy: 262, seed: 109, trunkR: 24, forkY: 140, lean: -6, roots: 9, gripEnd: 300, leafS: 17, leafK: 0.85, maxW: 0.8,
    branches: [
      { p: [[186, 150], [170, 128], [150, 112], [120, 104], [70, 104]], r: 7 },
      { p: [[184, 160], [160, 150], [140, 165], [112, 175]], r: 6 },
      { p: [[190, 140], [196, 115], [205, 95], [215, 80]], r: 7 },
      { p: [[192, 142], [218, 130], [240, 112], [270, 95]], r: 6 },
      { p: [[194, 160], [220, 160], [246, 150], [280, 148]], r: 6 },
      { p: [[188, 145], [176, 115], [168, 90], [160, 76]], r: 5 },
    ],
    pads: [[205, 95, 150, 50, 300, 46], [90, 108, 110, 38, 160, 36], [270, 150, 110, 40, 150, 36], [118, 170, 70, 30, 70, 26], [285, 100, 50, 30, 50, 24], [155, 78, 80, 34, 110, 36]],
    falling: 7, fallBox: [100, 190, 140, 230],
  });
}
function f110() {
  return worldTree({
    L: 1.5, cx: 168, oy: 262, seed: 110, trunkR: 22, forkY: 150, lean: 0, roots: 9, gripEnd: 292, leafS: 15.5, leafK: 0.72, maxW: 0.82, fruit: 0.22,
    branches: [
      { p: [[166, 160], [150, 150], [120, 160], [80, 165]], r: 6 },
      { p: [[166, 152], [150, 128], [128, 110], [100, 102]], r: 6 },
      { p: [[168, 150], [168, 120], [175, 95], [180, 78]], r: 6 },
      { p: [[170, 152], [190, 130], [215, 112], [250, 100]], r: 6 },
      { p: [[172, 160], [200, 158], [235, 160], [270, 155]], r: 6 },
      { p: [[168, 175], [140, 190], [110, 205]], r: 5 },
      { p: [[170, 175], [196, 190], [228, 200]], r: 5 },
    ],
    pads: [[170, 92, 130, 42, 230, 44], [115, 120, 110, 36, 170, 36], [235, 115, 100, 36, 150, 36], [95, 175, 100, 40, 160, 36],
      [255, 168, 100, 40, 150, 34], [160, 145, 90, 30, 110, 40], [205, 195, 70, 26, 70, 30], [130, 210, 60, 22, 50, 24]],
    falling: 9, fallBox: [60, 120, 280, 230],
  });
}

// =====================================================================
// 鱼刃线 200–210
// =====================================================================
const FISH = {
  wood: () => mat(0x4a2a1e, { r: 0.8 }),
  rope: () => mat(0xb26a38, { r: 0.55, m: 0.25 }),
  bone: () => mat(0xe8c890, { r: 0.6 }),
  ivory: () => mat(0xf3e6c6, { r: 0.55 }),
  teal: () => mat(0x2f6f78, { r: 0.55, m: 0.25, flat: true }),
  tealD: () => mat(0x1d3a44, { r: 0.6, m: 0.25, flat: true }),
  kelp: () => mat(0x2c4a22, { r: 0.6, ds: true }),
  gem: () => glowM(0x48e8ff, 2.2),
};
/** 木柄 */
function woodHandle(m, x, yTop, yBot, r, rings = []) {
  m.add(tubeI([[x, yBot], [x, yTop]], r, 2, { seg: 10 }), FISH.wood());
  if (rings.length) ropeRings(m, x, rings, r + 0.8, 1.5);
}
/** 海带：扭转的扁带（双面） */
function kelp(m, pts, w, seed, mt = FISH.kelp()) {
  const r = rng(seed), P = spline(IP(pts), 18), rings = [];
  for (let i = 0; i < P.length; i++) {
    const t = i / (P.length - 1);
    const d = V3().subVectors(P[Math.min(i + 1, P.length - 1)], P[Math.max(i - 1, 0)]).normalize();
    const tw = t * 2.2 + r();
    const side = V3().crossVectors(d, AY).normalize().applyAxisAngle(d, Math.sin(tw) * 0.9);
    const ww = w * Math.sin(PI * Math.min(1, t * 1.1 + 0.08));
    rings.push([P[i].clone().addScaledVector(side, ww / 2), P[i].clone().addScaledVector(side, -ww / 2)]);
  }
  m.add(loft(rings, { closed: false }), mt);
}

function f200() {
  org(178, 187);
  const m = new Model();
  woodHandle(m, 178, 175, 343, 12, [284, 289, 294, 299]);
  ropeRings(m, 178, [183, 189], 20, 1.8);
  const slate = mat(0x5b7896, { r: 0.6, flat: true }), slate2 = mat(0x6e8aa6, { r: 0.6, flat: true }), stone = mat(0x6b7672, { r: 0.8, flat: true });
  m.add(extI([[150, 214], [154, 120], [160, 62], [238, 18], [224, 92], [212, 116], [202, 210]], 12, { bevel: 4, bs: 0.8 }), slate);
  m.add(extI([[160, 64], [238, 18], [222, 96], [196, 108]], 4, { d: 7 }), slate2);
  m.add(extI([[196, 210], [194, 104], [218, 92], [232, 108], [230, 196]], 18, { bevel: 4, d: -2 }), stone);
  const kel = [[[150, 196, 8], [130, 170, 10], [126, 140, 8], [140, 112, 6], [138, 96, 4]],
    [[165, 192, 10], [160, 160, 14], [168, 130, 12], [160, 108, 10]],
    [[178, 192, 12], [184, 160, 14], [178, 130, 12], [190, 104, 10]],
    [[195, 190, 12], [205, 160, 14], [200, 130, 12], [214, 110, 10]],
    [[206, 196, 8], [228, 176, 10], [232, 146, 8], [224, 125, 6]],
    [[140, 192, 4], [112, 182, 4], [104, 162, 4]]];
  kel.forEach((k, i) => kelp(m, k, 17, 200 + i, mat(i % 2 ? 0x2f5226 : 0x3c5e2a, { r: 0.6, ds: true })));
  return m.finish(0.55);
}
/** 弯角刺（骨刺）：从 a 沿曲线到尖 */
function hornI(m, pts, r0, mt, seg = 6) { m.add(tube(spline(IP(pts), 8), (s) => r0 * (1 - s * 0.95), { seg }), mt); }
function f201() {
  org(162, 240);
  const m = new Model();
  woodHandle(m, 160, 240, 345, 11, [290, 296, 302, 308]);
  ropeRings(m, 162, [237, 243], 18, 1.6);
  const left = [[136, 240], [129, 200], [131, 150], [144, 100], [166, 58], [190, 30], [206, 18]];
  const right = [[190, 240], [205, 210], [212, 160], [213, 110], [211, 60], [208, 30], [206, 18]];
  m.add(bladeE(left, right, { t: 9, te: 1.2, rf: (s) => 0.62 - 0.1 * s, n: 14 }), FISH.bone());
  m.add(tubeI([[152, 232, 8], [150, 180, 9], [158, 120, 8], [175, 70, 5], [196, 32, 3]], 1.4, 12, { seg: 4 }), mat(0xf6e2b6, { r: 0.5 }));
  for (const y of [92, 120, 148, 178, 207]) hornI(m, [[205, y + 10], [220, y + 2], [234, y - 8]], 7, FISH.ivory());
  return m.finish(0.64);
}
function f202() {
  org(165, 262);
  const m = new Model();
  woodHandle(m, 163, 262, 345, 10, [300, 306, 312, 318]);
  m.add(boxI(165, 261, 62, 7, 14), FISH.bone());
  const left = [[140, 255], [138, 150], [150, 80], [176, 40], [207, 18]], right = [[195, 255], [200, 150], [210, 70], [212, 40], [207, 18]];
  m.add(bladeE(left, right, { t: 6, te: 1, n: 10 }), FISH.bone());
  const red = mat(0xd8443a, { r: 0.6, flat: true }), redD = mat(0xb02e2a, { r: 0.65, flat: true });
  const dots = [];
  for (let i = 0; i < 6; i++) {
    const yc = 78 + i * 30, w = 46 + (i === 5 ? 2 : 0), cx = 172 + (i % 2 ? 4 : 0);
    // 每节：八边形菱锥壳
    const ring = [[-w, 0], [-w * 0.8, -15], [0, -22], [w * 0.8, -15], [w, 0], [w * 0.8, 18], [0, 22], [-w * 0.8, 18]];
    const front = I(cx, yc, 18 + i), back = I(cx, yc, -8);
    const pts = ring.map(([dx, dy]) => I(cx + dx, yc + dy, 4));
    const pos = [];
    for (let j = 0; j < 8; j++) {
      const a = pts[j], b = pts[(j + 1) % 8];
      pos.push(front.x, front.y, front.z, b.x, b.y, b.z, a.x, a.y, a.z);
      pos.push(back.x, back.y, back.z, a.x, a.y, a.z, b.x, b.y, b.z);
    }
    // 中间棱线（左右两半）
    const mid = I(cx, yc - 4, 14 + i);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    m.add(g, i % 2 ? redD : red);
    m.add(octa(mid, 1, w * 0.55, 6, 12), red);
    hornI(m, [[cx - w + 4, yc + 4], [cx - w - 14, yc - 2], [cx - w - 24, yc - 20]], 7, red);
    hornI(m, [[cx + w - 4, yc + 4, -2], [cx + w + 16, yc - 2], [cx + w + 30, yc - 12]], 5.5, FISH.ivory());
    for (const dx of [-22, 0, 22]) dots.push(sph(I(cx + dx, yc + (dx ? 4 : -6), 13 + i - Math.abs(dx) * 0.3), 1.8, 1.8, 1.8, 5, 4));
  }
  m.add(mergeGeometries(dots.map((d) => Model.prep(d))), mat(0xf0d8b0, { r: 0.5 }));
  m.add(tubeI([[160, 140, 22], [168, 150, 23], [162, 165, 23], [170, 185, 22]], 0.9, 8, { seg: 3 }), mat(0xf2e2c8, { r: 0.5 }));
  return m.finish(0.73);
}
/** 回转鱼身：axis 起点 c、T 指向鼻子，N 为侧面（+Y），prof [[s, r]] */
function fishBody(m, c, T, prof, sy, mt, seg = 14) {
  return m.add(lathe(c, T, AY, prof, seg, { sy }), mt);
}
function f203() {
  org(185, 248);
  const m = new Model();
  woodHandle(m, 185, 248, 345, 9, [300, 306, 312, 318, 324]);
  const prof = [[250, 9], [238, 18], [212, 36], [182, 49], [150, 55], [120, 55], [92, 50], [66, 41], [44, 29], [28, 16], [19, 3]];
  const sy = 0.55;
  m.add(latheI(185, prof, 16, { sy, rot: 0 }), mat(0xffffff, { r: 0.35, m: 0.3, map: 'tuna' }));
  const fin = mat(0x7a9cba, { r: 0.45, m: 0.2, flat: true, ds: true });
  const tri = (a, b, c2) => { const g = new THREE.BufferGeometry().setFromPoints([a, b, c2]); g.computeVertexNormals(); return g; };
  m.add(tri(I(142, 125, 6), I(108, 168), I(152, 170, 6)), fin);
  m.add(tri(I(232, 112, 6), I(256, 165), I(226, 150, 6)), fin);
  m.add(tri(I(180, 244), I(145, 285), I(184, 278)), fin);
  m.add(tri(I(190, 244), I(242, 285), I(186, 278)), fin);
  // 眼睛 + 嘴
  const ed = surfD(prof, 185, sy, 176, 62);
  m.add(sph(I(176, 62, ed - 1), 9, 3, 9, 10, 6), mat(0xf2ecd0, { r: 0.4 }));
  m.add(sph(I(178, 61, ed + 1.6), 4.8, 1.6, 4.8, 8, 4), mat(0x101010, { r: 0.3 }));
  const mouth = [[158, 92], [170, 100], [186, 103], [204, 100], [214, 94]].map(([x, y]) => [x, y, surfD(prof, 185, sy, x, y) + 0.5]);
  m.add(tubeI(mouth, 1.6, 10, { seg: 4 }), mat(0x1a2430, { r: 0.6 }));
  // 冰晶
  const ice = mat(0xa8e0f6, { r: 0.25, m: 0.1, flat: true, e: 0x3a7ea8, ei: 0.35 });
  for (const [x, y, s, a] of [[160, 72, 12, -0.6], [214, 92, 13, 0.5], [158, 116, 11, -0.4], [222, 130, 14, 0.7], [160, 168, 12, -0.5], [214, 190, 13, 0.6], [166, 214, 11, -0.3], [200, 150, 9, 0.2]]) {
    const d = surfD(prof, 185, sy, x, y);
    const g = octa(V3(), s, 1, 0.7, 1); g.rotateX(a); g.rotateZ(a * 0.5);
    g.translate(...I(x, y, d).toArray());
    m.add(g, ice);
  }
  ropeRings(m, 185, [199, 204], 36, 1.8);
  return m.finish(0.82);
}
/** 串鱼（204/205） */
function skewer(L, grilled) {
  org(188, 255);
  const m = new Model();
  m.add(tubeI([[186, 340], [188, 200], [190, 60], [190, 30]], [5, 4.5, 4, 3.5], 6, { seg: 7 }), FISH.wood());
  m.add(coneG(I(190, 31), AX, 14, 3.5, 7), FISH.wood());
  ropeRings(m, 186, [306, 312, 318, 324], 5.6, 1.3);
  const bodyM = mat(0xffffff, grilled ? { r: 0.55, map: 'fishGrill' } : { r: 0.32, m: 0.3, map: 'fishSilver' });
  const finM = mat(grilled ? 0xe0784a : 0x8fb2cc, { r: 0.5, flat: true, ds: true });
  const tri = (a, b, c2) => { const g = new THREE.BufferGeometry().setFromPoints([a, b, c2]); g.computeVertexNormals(); return g; };
  for (const yc of [90, 150, 210]) {
    const prof = [[0, 4], [10, 8], [30, 14], [55, 19], [80, 21], [102, 20], [118, 16], [130, 10], [138, 4], [141, 0.5]];
    const c = I(121, yc);
    m.add(lathe(c, AZ, AY, prof, 14, { sy: 0.62 }), bodyM);
    const rr = (s) => { for (let i = 0; i < prof.length - 1; i++) if (s <= prof[i + 1][0]) return lerp(prof[i][1], prof[i + 1][1], (s - prof[i][0]) / (prof[i + 1][0] - prof[i][0])); return 0; };
    // 尾巴
    m.add(tri(I(124, yc), I(97, yc - 22), I(110, yc)), finM);
    m.add(tri(I(124, yc), I(110, yc), I(97, yc + 22)), finM);
    // 背鳍 / 腹鳍
    m.add(tri(I(162, yc - 17), I(176, yc - 30), I(192, yc - 18)), finM);
    m.add(tri(I(172, yc + 16), I(188, yc + 30), I(196, yc + 16)), finM);
    m.add(tri(I(212, yc + 4, 6), I(196, yc + 14, 9), I(205, yc + 10, 9)), finM);
    // 眼
    const ed = 0.62 * Math.sqrt(Math.max(0, rr(232 - 121) ** 2 - 16));
    m.add(sph(I(232, yc - 4, ed - 0.5), 5.4, 2, 5.4, 10, 5), mat(0xf0e6b0, { r: 0.4 }));
    m.add(sph(I(233, yc - 4, ed + 1), 2.8, 1.2, 2.8, 8, 4), mat(0x101010, { r: 0.3 }));
    // 鳃线
    const gill = [[212, yc - 12], [216, yc - 4], [215, yc + 6], [211, yc + 12]].map(([x, y]) => [x, y, 0.62 * Math.sqrt(Math.max(0, rr(x - 121) ** 2 - (y - yc) ** 2)) + 0.3]);
    m.add(tubeI(gill, 0.9, 6, { seg: 3 }), mat(grilled ? 0x6a2410 : 0x2a4458, { r: 0.6 }));
  }
  return m.finish(L);
}
const f204 = () => skewer(0.91, false);
const f205 = () => skewer(1.0, true);

function f206() {
  org(180, 200);
  const m = new Model();
  woodHandle(m, 180, 196, 336, 8, [312, 318, 324]);
  const cx = 175, cy = 125, R = 75, sy = 0.72;
  // 球身：逐面上色（前下方奶油色脸，其余橙红 + 深色经线）
  const sg = new THREE.SphereGeometry(R, 28, 20).toNonIndexed();
  const pos = sg.attributes.position, col = [];
  const cream = new THREE.Color(0xe2c28c), orange = new THREE.Color(0xd4561e), dark = new THREE.Color(0x8a2c10), spot = new THREE.Color(0xa07040);
  // 球的局部：x→图像上 (X)、y→前 (Y)、z→右 (Z)
  for (let f = 0; f < pos.count; f += 3) {
    let nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < 3; k++) { nx += pos.getX(f + k); ny += pos.getY(f + k); nz += pos.getZ(f + k); }
    const v = V3(nx, ny, nz).normalize();
    // 原始 SphereGeometry：极轴为 Y。转换：up(X)=y, front(Y)=z, right(Z)=x
    const up = v.y, front = v.z, right = v.x;
    let c = orange;
    const face = front > 0.3 && Math.hypot(right * 1.05, up + 0.18) < 0.72;
    if (face) c = cream;
    else { const lon = Math.atan2(right, -up); if (Math.abs(((lon * 5 / PI) % 1 + 1) % 1 - 0.5) < 0.07 && up > -0.3) c = dark; }
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  }
  sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // 轴映射 (x,y,z)->(y,z,x) 后放到中心
  sg.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, sy, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  sg.computeVertexNormals();
  sg.translate(...I(cx, cy).toArray());
  m.add(sg, mat(0xffffff, { r: 0.6, vc: true }));
  // 刺
  const spikeM = mat(0xeed4a2, { r: 0.55 });
  const n = 90, spikes = [];
  for (let i = 0; i < n; i++) {
    const yv = 1 - (i + 0.5) / n * 2, rr = Math.sqrt(1 - yv * yv), th = i * 2.39996;
    const dir = V3(yv, Math.sin(th) * rr, Math.cos(th) * rr); // (X 上, Y 前, Z 右)
    if (dir.y > 0.55 && dir.x < 0.35) continue; // 脸正面不长大刺
    const base = I(cx, cy).add(V3(dir.x * R * 0.97, dir.y * R * sy * 0.97, dir.z * R * 0.97));
    const len = 20 + (i % 3) * 4;
    spikes.push(coneG(base, V3(dir.x, dir.y * 0.8, dir.z).normalize().add(V3(0.15, 0, 0)).normalize(), len, 4.2, 5));
  }
  m.add(mergeGeometries(spikes.map((g) => Model.prep(g))), spikeM);
  // 脸上的小刺点
  for (const [x, y] of [[132, 150], [215, 140], [160, 175], [200, 170], [228, 112], [118, 120]]) {
    const d = sy * Math.sqrt(Math.max(0, R * R - (x - cx) ** 2 - (y - cy) ** 2));
    m.add(coneG(I(x, y, d - 2), V3((cy - y) / R, 0.8, (x - cx) / R).normalize(), 8, 2, 4), mat(0xa8763c, { r: 0.6 }));
  }
  // 眼 + 嘴
  for (const [x, y] of [[140, 106], [190, 108]]) {
    const d = sy * Math.sqrt(R * R - (x - cx) ** 2 - (y - cy) ** 2);
    m.add(sph(I(x, y, d - 2), 11, 5, 11, 12, 6), mat(0xf6f0dc, { r: 0.4 }));
    m.add(sph(I(x + 1, y, d + 2.4), 5, 2, 5, 8, 4), mat(0x121212, { r: 0.3 }));
  }
  const md = sy * Math.sqrt(R * R - 15 * 15 - 8 * 8);
  m.add(torusG(I(160, 133, md), AY, 5.5, 2.6, 6, 12), mat(0xd29a6a, { r: 0.5 }));
  m.add(sph(I(160, 133, md + 0.5), 4, 1.2, 4, 8, 4), mat(0x2a1208, { r: 0.6 }));
  // 侧鳍
  const fin = mat(0x6c8eb0, { r: 0.5, flat: true, ds: true });
  m.add(extI([[103, 118], [68, 95], [72, 140]], 3), fin);
  m.add(extI([[248, 124], [288, 98], [290, 146]], 3), fin);
  return m.finish(1.1, { maxT: 0.34, maxW: 0.7 });
}

/** 珊瑚分枝（递归） */
function coral(m, list, p, dir, len, r, depth, rnd) {
  const end = p.clone().addScaledVector(dir, len);
  const mid = p.clone().lerp(end, 0.5).add(V3((rnd() - 0.5) * len * 0.15, 0, (rnd() - 0.5) * len * 0.15));
  list.push(tube(spline([p, mid, end], 4), [r, r * 0.75], { seg: 5 }));
  if (depth <= 0) { list.push(coneG(end, dir, r * 3, r * 0.75, 5)); return; }
  const k = depth > 1 ? 2 : 1 + (rnd() < 0.6 ? 1 : 0);
  for (let i = 0; i < k + 1; i++) {
    const nd = dir.clone().applyAxisAngle(AY, (i - k / 2) * (0.5 + rnd() * 0.25)).add(V3(0.25, (rnd() - 0.5) * 0.3, 0)).normalize();
    coral(m, list, end, nd, len * (0.6 + rnd() * 0.15), r * 0.7, depth - 1, rnd);
  }
}
/** 青色棱角护手（207/208/209） */
function tealGuard(m, cx, y, w, h, o = {}) {
  const tl = FISH.teal(), td = FISH.tealD();
  const hw = w / 2;
  m.add(extI([[cx - hw, y - h * 0.55], [cx - hw * 0.35, y - h * 0.15], [cx, y - h * 0.3], [cx + hw * 0.35, y - h * 0.15], [cx + hw, y - h * 0.55], [cx + hw * 0.8, y + h * 0.35], [cx + hw * 0.3, y + h * 0.5], [cx - hw * 0.3, y + h * 0.5], [cx - hw * 0.8, y + h * 0.35]], o.t || 22, { bevel: 4 }), td);
  m.add(extI([[cx - hw * 0.92, y - h * 0.45], [cx - hw * 0.35, y - h * 0.05], [cx - hw * 0.25, y + h * 0.42], [cx - hw * 0.75, y + h * 0.3]], 6, { d: (o.t || 22) / 2 + 1 }), tl);
  m.add(extI([[cx + hw * 0.92, y - h * 0.45], [cx + hw * 0.35, y - h * 0.05], [cx + hw * 0.25, y + h * 0.42], [cx + hw * 0.75, y + h * 0.3]], 6, { d: (o.t || 22) / 2 + 1 }), tl);
  const gm = new THREE.Mesh(octa(V3(), o.gem || 7, 1, 0.6, 1), FISH.gem());
  gm.position.copy(I(cx, y + h * 0.18, (o.t || 22) / 2 + 3));
  m.obj(gm); flicker(m, gm, 0.08, 3);
}
/** 骨环柄头 */
function boneRing(m, x, y, R, r) { m.add(torusG(I(x, y), AY, R, r, 6, 16), FISH.ivory()); }

function f207() {
  org(180, 272);
  const m = new Model(), rnd = rng(207);
  woodHandle(m, 180, 280, 335, 9, []);
  for (const y of [298, 310, 322]) m.add(torusG(I(180, y), AX, 10, 2.2, 4, 12), mat(0x3a2418, { r: 0.7 }));
  m.add(latheI(180, [[346, 0.1], [342, 8], [334, 10], [330, 6]], 8), mat(0x6a3c22, { r: 0.6, flat: true }));
  const bladeM = mat(0xf1e8cc, { r: 0.55, e: 0xfff0c0, ei: 0.07 });
  const left = [[150, 262], [138, 210], [140, 160], [158, 100], [176, 48], [190, 18]];
  const right = [[210, 262], [222, 210], [222, 160], [212, 100], [202, 48], [190, 18]];
  m.add(bladeE(left, right, { t: 10, te: 1.5, n: 12 }), bladeM);
  const stud = mat(0xa89060, { r: 0.4, m: 0.35 });
  for (const [x, y] of [[156, 58], [178, 100], [160, 122], [190, 164], [162, 178], [192, 205], [175, 233], [186, 140], [170, 80], [183, 255]]) {
    m.add(sph(I(x, y, 8 + 3 * (1 - Math.abs(x - 180) / 40)), 3, 2, 3, 6, 4), stud);
  }
  const red = mat(0xd83a2c, { r: 0.6 }), corals = [];
  for (const [x, y, dz, len, d] of [[150, 145, -1, 24, 4], [148, 210, -1, 22, -4], [160, 250, -1, 20, 6], [210, 120, 1, 24, -4], [208, 185, 1, 22, 6], [200, 245, 1, 20, -6]]) {
    const dir = V3(0.75, 0, dz).normalize();
    coral(m, corals, I(x, y, d), dir, len * 1.5, 4.6, 2, rnd);
  }
  m.add(mergeGeometries(corals.map((g) => Model.prep(g))), red);
  tealGuard(m, 180, 270, 120, 46);
  kelp(m, [[128, 254, 8], [134, 270, 12], [128, 288, 10], [140, 305, 6]], 7, 3);
  kelp(m, [[226, 214, 8], [222, 235, 10], [230, 250, 10], [226, 270, 6]], 7, 4);
  motes(m, 6, [100, 30, 270, 260, 50], 0xd8c890, 2.6, 2070, { ei: 0.6 });
  return m.finish(1.2, { maxW: 0.72 });
}
function f208() {
  org(180, 270);
  const m = new Model();
  woodHandle(m, 180, 280, 312, 8, [288, 293, 298, 303]);
  boneRing(m, 181, 322, 12, 4);
  const left = [[160, 266], [146, 220], [138, 160], [132, 100], [128, 50], [128, 18]];
  const right = [[200, 266], [214, 230], [208, 180], [194, 130], [172, 80], [150, 45], [128, 18]];
  m.add(bladeE(left, right, { t: 10, te: 1.4, rf: 0.35, n: 14 }), FISH.bone());
  for (let i = 0; i < 11; i++) {
    const y = 72 + i * 17.5, x = edgeX(right, y) - 3;
    hornI(m, [[x, y + 2, 2], [x + 14, y - 4, 2], [x + 22, y - 18, 1]], 5.2 + i * 0.12, FISH.ivory());
  }
  const bar = mat(0x8a8e88, { r: 0.6 }), hole = mat(0x2a2a26, { r: 0.8 });
  for (const [x, y] of [[172, 215], [186, 220], [178, 230], [192, 236], [170, 240], [184, 246], [174, 254], [196, 252], [160, 228]]) {
    m.add(torusG(I(x, y, 9), AY, 3.4, 1.3, 4, 8), bar);
    m.add(sph(I(x, y, 9.4), 2.2, 0.6, 2.2, 6, 3), hole);
  }
  const tl = FISH.teal();
  m.add(latheI(180, [[284, 16], [266, 22], [262, 20]], 10, { sy: 0.6 }), tl);
  const gm = new THREE.Mesh(octa(V3(), 6, 1, 0.6, 1), FISH.gem()); gm.position.copy(I(180, 276, 14)); m.obj(gm); flicker(m, gm, 0.08, 3);
  kelp(m, [[160, 266, 6], [148, 272, 8], [140, 282, 6]], 6, 5);
  kelp(m, [[200, 266, 6], [212, 272, 8], [218, 284, 6]], 6, 6);
  return m.finish(1.3);
}
function f209() {
  org(187, 270);
  const m = new Model();
  woodHandle(m, 189, 280, 318, 8.5, [288, 293, 298, 303, 308]);
  boneRing(m, 196, 325, 11, 4);
  // 触手中心线
  const cl = spline(IP([[184, 262], [180, 232], [170, 192], [158, 150], [151, 110], [152, 74], [164, 44], [188, 30], [214, 34], [232, 54], [230, 76], [215, 82], [202, 72], [201, 60], [210, 56]]), 64);
  const Rf = (s) => s < 0.62 ? lerp(34, 12, Math.pow(s / 0.62, 0.9)) : lerp(12, 2, (s - 0.62) / 0.38);
  const body = tube(cl, Rf, { seg: 12, sy: 0.85, up: AY });
  // 吸盘（沿正面偏内侧两排）
  const n = cl.length, L = [0];
  for (let i = 1; i < n; i++) L.push(L[i - 1] + cl[i].distanceTo(cl[i - 1]));
  const suck = [];
  const rim = new THREE.Color(0xe08a8c), cen = new THREE.Color(0xc0545e);
  for (let s = 6; s < L[n - 1] - 8;) {
    let i = 1; while (L[i] < s) i++;
    const t = s / L[n - 1], R = Rf(t);
    const p = cl[i], T = V3().subVectors(cl[Math.min(i + 1, n - 1)], cl[i - 1]).normalize();
    const side = V3().crossVectors(T, AY).normalize(); // 曲线内侧
    for (const off of [-0.75, -0.1]) {
      const a = off;
      const nrm = AY.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a)).normalize();
      const pos = p.clone().addScaledVector(AY, Math.cos(a) * R * 0.85).addScaledVector(side, Math.sin(a) * R);
      const sr = Math.max(1.3, R * 0.2);
      const g = lathe(pos.clone().addScaledVector(nrm, -sr * 0.3), nrm, T, [[0, sr * 1.05], [sr * 0.6, sr], [sr * 0.75, sr * 0.55], [sr * 0.5, 0.01]], 6);
      const ng = g.toNonIndexed(), cnt = ng.attributes.position.count, ca = new Float32Array(cnt * 3);
      for (let k = 0; k < cnt; k++) {
        const q = V3().fromBufferAttribute(ng.attributes.position, k).sub(pos);
        const c = q.length() < sr * 0.5 ? cen : rim;
        ca[k * 3] = c.r; ca[k * 3 + 1] = c.g; ca[k * 3 + 2] = c.b;
      }
      ng.setAttribute('color', new THREE.BufferAttribute(ca, 3));
      suck.push(ng);
    }
    s += Math.max(5.5, R * 0.85);
  }
  // 身体顶点色：背深红、正面略亮 + 斑点
  const bn = body.toNonIndexed();
  const bc = new Float32Array(bn.attributes.position.count * 3), top = new THREE.Color(0x7c2430), lo = new THREE.Color(0x9e3a40), c = new THREE.Color();
  const nrm = bn.attributes.normal;
  for (let k = 0; k < bn.attributes.position.count; k++) {
    const f = clamp(nrm.getY(k) * 0.5 + 0.5, 0, 1);
    c.copy(top).lerp(lo, f);
    bc[k * 3] = c.r; bc[k * 3 + 1] = c.g; bc[k * 3 + 2] = c.b;
  }
  bn.setAttribute('color', new THREE.BufferAttribute(bc, 3));
  const tg = mergeGeometries([Model.prep(bn, true), ...suck.map((g) => Model.prep(g, true))]);
  // 每顶点记录沿触手的参数 s（用于摆动）
  const P = tg.attributes.position, sArr = new Float32Array(P.count), rest = new Float32Array(P.array);
  for (let k = 0; k < P.count; k++) {
    const q = V3().fromBufferAttribute(P, k); let best = 1e9, bi = 0;
    for (let i = 0; i < n; i += 2) { const d = q.distanceToSquared(cl[i]); if (d < best) { best = d; bi = i; } }
    sArr[k] = L[bi] / L[n - 1];
  }
  const tm = new THREE.Mesh(tg, mat(0xffffff, { r: 0.55, vc: true }));
  tm.frustumCulled = false;
  m.obj(tm);
  const base = cl[0];
  m.fx.push((dt, t) => {
    const arr = P.array;
    for (let k = 0; k < P.count; k++) {
      const s = sArr[k]; if (s < 0.08) continue;
      const a = 0.07 * Math.sin(t * 1.4 - s * 3.2) * Math.pow(s, 1.6);
      const x = rest[k * 3] - base.x, z = rest[k * 3 + 2] - base.z;
      const ca = Math.cos(a), sa = Math.sin(a);
      arr[k * 3] = base.x + x * ca - z * sa; arr[k * 3 + 2] = base.z + x * sa + z * ca;
    }
    P.needsUpdate = true;
  });
  tealGuard(m, 186, 262, 76, 40, { t: 50, gem: 6 });
  return m.finish(1.4);
}
function f210() {
  org(186, 272);
  const m = new Model();
  m.add(latheI(186, [[302, 7], [298, 9], [295, 7], [291, 9], [288, 7], [284, 9], [281, 7], [276, 9]], 8), mat(0x22282c, { r: 0.6, flat: true }));
  // 爪形柄头
  hornI(m, [[184, 300], [170, 312], [174, 326], [186, 330]], 6, FISH.ivory());
  hornI(m, [[188, 300], [204, 310], [206, 322], [198, 330]], 5, FISH.ivory());
  const pale = mat(0xc9d0bc, { r: 0.5, m: 0.1 }), dark = mat(0x1d3440, { r: 0.55, m: 0.25, flat: true });
  const left = [[160, 262], [145, 220], [140, 170], [146, 125], [170, 80], [215, 45], [266, 20]];
  const right = [[220, 262], [240, 220], [250, 160], [252, 110], [256, 60], [266, 20]];
  m.add(bladeE(left, right, { t: 14, te: 1.6, rf: 0.6, n: 14 }), pale);
  // 左侧深色鳍脊
  const finL = [[120, 262], [104, 222], [100, 175], [108, 130], [130, 92], [165, 62], [214, 42]];
  m.add(bladeE(finL, left.slice(0, 6).concat([[214, 42]]), { t: 8, te: 1.5, rf: 0.7, n: 14, d: -2 }), dark);
  for (const [x, y] of [[116, 250], [108, 228], [104, 205], [104, 180], [110, 158]]) hornI(m, [[x + 14, y, -2], [x - 2, y - 2, -2], [x - 12, y - 8, -2]], 6, dark);
  for (const [x, y] of [[168, 70], [138, 100], [116, 140], [104, 172], [106, 214]]) hornI(m, [[x + 8, y + 4], [x - 4, y - 6], [x - 6, y - 22]], 5.5, FISH.ivory());
  const cy = glowM(0x58e8ff, 1.4);
  m.add(tubeI([[150, 250, 9], [138, 200, 10], [136, 160, 9], [146, 120, 8], [172, 84, 6], [210, 56, 4]], 0.9, 16, { seg: 3 }), cy);
  m.add(tubeI([[126, 240, 6], [116, 200, 6], [118, 150, 5], [132, 116, 4]], 0.8, 12, { seg: 3 }), cy);
  // 护手：两根弯角 + 深色托
  m.add(latheI(188, [[280, 9], [272, 18], [262, 24], [258, 20]], 10, { sy: 0.6 }), dark);
  hornI(m, [[178, 266], [150, 262], [128, 252], [116, 238]], 8, FISH.ivory());
  hornI(m, [[198, 266], [224, 262], [240, 252], [248, 238]], 8, FISH.ivory());
  for (const [x, y] of [[118, 242], [246, 242]]) { const g = new THREE.Mesh(octa(I(x, y, 4), 3.5), FISH.gem()); m.obj(g); }
  return m.finish(1.5, { maxW: 0.7 });
}

// =====================================================================
// 葬仪线 3000–3010（硬朗低多边形）
// =====================================================================
const FUN = {
  iron: () => mat(0x262b31, { r: 0.6, m: 0.3, flat: true }),
  ironL: () => mat(0x3e4854, { r: 0.55, m: 0.3, flat: true }),
  steel: () => mat(0x9aaabb, { r: 0.4, m: 0.35, flat: true }),
  steelD: () => mat(0x5a6878, { r: 0.45, m: 0.35, flat: true }),
  copper: () => mat(0xb8743c, { r: 0.45, m: 0.35, flat: true }),
  leather: () => mat(0x5c3a2a, { r: 0.8, flat: true }),
  stone: () => mat(0x8c9298, { r: 0.8, flat: true }),
  stoneD: () => mat(0x7c8288, { r: 0.8, flat: true }),
  panel: () => mat(0x2c3238, { r: 0.75, flat: true }),
  cyan: () => glowM(0x46d6ff, 1.2),
};
/** 葬仪柄：深色箍 + 皮革 + 八角柄头 */
function funGrip(m, x, yTop, yBot, r, o = {}) {
  m.add(latheI(x, [[yBot - 18, r], [yTop, r]], 8), FUN.leather());
  for (let y = yTop + 8; y < yBot - 20; y += 7) m.add(latheI(x, [[y + 2, r + 0.6], [y, r + 0.6]], 8, { cap0: false, cap1: false }), mat(0x4a2c20, { r: 0.8, flat: true }));
  m.add(latheI(x, [[yTop + 8, r + 3], [yTop, r + 3]], 8), o.collar || FUN.iron());
  m.add(latheI(x, [[yBot, 0.1], [yBot - 4, r + 2], [yBot - 14, r + 3], [yBot - 18, r + 2]], 8), FUN.iron());
}
/** 十字（铜或发光） */
function cross(m, x, y, s, d, mt) {
  m.add(boxI(x, y, s * 0.22, s, 4, d), mt);
  m.add(boxI(x, y - s * 0.16, s * 0.8, s * 0.22, 4, d), mt);
}
/** 墓碑：中心 cx，底 yb，顶 yt，宽 w；返回正面 d */
function tombstone(m, cx, yt, yb, w, o = {}) {
  const hw = w / 2, th = o.th || 28, ch = w * 0.24;
  const outline = [[cx - hw, yb], [cx - hw, yt + ch], [cx - hw + ch * 0.5, yt + ch * 0.25], [cx - hw * 0.45, yt], [cx + hw * 0.45, yt], [cx + hw - ch * 0.5, yt + ch * 0.25], [cx + hw, yt + ch], [cx + hw, yb]];
  m.add(extI(outline, th, { bevel: 3 }), FUN.stone());
  const ins = 0.17 * w, pi = [[cx - hw + ins, yb - 8], [cx - hw + ins, yt + ch + ins * 0.4], [cx - hw * 0.35, yt + ins * 0.9], [cx + hw * 0.35, yt + ins * 0.9], [cx + hw - ins, yt + ch + ins * 0.4], [cx + hw - ins, yb - 8]];
  const fd = th / 2;
  m.add(extI(pi, 4, { d: fd }), FUN.panel());
  if (o.broken) m.add(extI([[cx + hw - 2, yb], [cx + hw - 2, yt + ch + 10], [cx + hw + 4, yt + ch + 14], [cx + hw + 4, yb - 6]], th - 4, { bevel: 2 }), mat(0xb39a6c, { r: 0.8, flat: true }));
  const ccol = o.glow ? FUN.cyan() : FUN.copper();
  cross(m, cx, yt + (yb - yt) * 0.3, w * 0.28, fd + 2.5, ccol);
  const lineM = mat(0xd8dce0, { r: 0.6 });
  for (let i = 0; i < 3; i++) { const ww = w * (i === 1 ? 0.36 : 0.3); m.add(boxI(cx, yt + (yb - yt) * (0.56 + i * 0.075), ww, 1.6, 2, fd + 2.2), lineM); }
  return fd;
}

function f3000() {
  org(180, 230);
  const m = new Model();
  const iron = mat(0x343a42, { r: 0.6, m: 0.3, flat: true });
  // 方钉帽
  m.add(extI([[135, 48], [138, 24], [232, 24], [235, 48]], 80, { bevel: 5 }), iron);
  m.add(latheI(180, [[52, 26], [40, 32]], 4, { rot: PI / 4 }), iron);
  // 四棱锥钉身
  m.add(latheI(180, [[342, 0.5], [300, 6], [200, 14], [120, 20], [52, 25]], 4, { rot: PI / 4 }), iron);
  const rust = mat(0x8a4632, { r: 0.85, flat: true });
  const rd = (x, y) => (25 - (y - 52) * 0.11) * 0.7 - Math.abs(x - 180) * 0.7 + 1;
  for (const [a, b] of [[[166, 62], [172, 136]], [[184, 62], [176, 130]], [[192, 70], [190, 112]]]) {
    m.add(segG(I(a[0], a[1], rd(...a) + 0.5), I(b[0], b[1], rd(...b) + 0.5), 2.2, 1.2, 4), rust);
  }
  return m.finish(0.55);
}
function f3001() {
  org(180, 188);
  const m = new Model();
  const left = [[150, 180], [134, 150], [140, 100], [165, 50], [192, 18]];
  const right = [[210, 180], [222, 150], [233, 116], [214, 60], [192, 18]];
  m.add(bladeE(left, right, { t: 12, te: 1.2, rf: 0.42, n: 4 }), FUN.steel());
  m.add(bladeE(left.map(([x, y]) => [x + 6, y]), [[176, 180], [178, 120], [180, 60], [192, 18]], { t: 12.5, te: 6, rf: 0.6, n: 4 }), FUN.steelD());
  m.add(tubeI([[211, 178, 1], [222, 150, 1], [233, 116, 1], [214, 60, 1], [192, 18, 1]], 1.4, 12, { seg: 4 }), FUN.copper());
  m.add(boxI(180, 186, 104, 12, 34), FUN.iron());
  m.add(boxI(180, 194, 80, 6, 30), FUN.ironL());
  const cloth = mat(0xd8c49c, { r: 0.85, flat: true });
  const prof = []; for (let y = 274, k = 0; y >= 198; y -= 5, k++) prof.push([y, k % 2 ? 29 : 27]);
  m.add(latheI(180, prof, 10), cloth);
  m.add(latheI(180, [[292, 31], [278, 32], [276, 30]], 8), FUN.iron());
  m.add(latheI(180, [[300, 29], [292, 30]], 8), cloth);
  m.add(latheI(180, [[338, 0.1], [326, 22], [316, 28], [302, 30], [300, 28]], 8), FUN.iron());
  return m.finish(0.64);
}
function f3002() {
  org(180, 145);
  const m = new Model();
  const head = [[124, 20], [238, 18], [253, 44], [214, 128], [180, 136], [146, 128], [112, 46]];
  m.add(extI(head, 16, { bevel: 5 }), mat(0x7e8c9c, { r: 0.5, m: 0.35, flat: true }));
  m.add(extI(head.map(([x, y]) => [180 + (x - 180) * 0.88, 76 + (y - 76) * 0.86]), 4, { d: 8 }), mat(0x485868, { r: 0.55, m: 0.3, flat: true }));
  m.add(extI([[173, 128], [174, 52], [180, 38], [186, 52], [187, 128]], 5, { d: 10, bevel: 1.5 }), mat(0xc0d6ee, { r: 0.35, m: 0.3, flat: true, e: 0x2a4058, ei: 0.4 }));
  m.add(latheI(180, [[152, 12], [130, 14], [126, 10]], 8), FUN.iron());
  m.add(latheI(180, [[252, 10], [150, 11]], 8), mat(0x4a2c22, { r: 0.8, flat: true }));
  m.add(latheI(180, [[252, 14], [244, 15], [236, 14]], 8), FUN.iron());
  funGrip(m, 180, 252, 336, 11);
  return m.finish(0.73);
}
function f3003() {
  org(180, 238);
  const m = new Model();
  const fd = tombstone(m, 178, 18, 222, 146, { broken: true, th: 30 });
  m.add(extI([[98, 238], [98, 222], [258, 222], [258, 238]], 40, { bevel: 3 }), FUN.stone());
  // 铁箍
  m.add(boxI(176, 194, 128, 7, 6, fd + 1), mat(0x3a4c5c, { r: 0.5, m: 0.35, flat: true }));
  for (const x of [118, 234]) m.add(sph(I(x, 194, fd + 3), 3, 2, 3, 6, 4), FUN.copper());
  m.add(boxI(104, 100, 4, 50, 8, 12), FUN.ironL());
  // 裂痕
  m.add(tubeI([[124, 145, fd + 2], [140, 140, fd + 2], [155, 136, fd + 2], [162, 130, fd + 2]], 0.9, 8, { seg: 3 }), mat(0x9aa0a8, { r: 0.6 }));
  m.add(boxI(250, 150, 10, 4, 34), mat(0x3c3a36, { r: 0.8, flat: true }));
  funGrip(m, 180, 240, 335, 10);
  return m.finish(0.82);
}
function f3004() {
  org(175, 248);
  const m = new Model();
  const out = [[135, 18], [230, 18], [246, 78], [224, 246], [126, 246], [104, 78]];
  m.add(extI(out, 34, { bevel: 3 }), mat(0x8a5a38, { r: 0.75, flat: true }));
  m.add(extI(out, 6, { d: 15, bevel: 1 }), FUN.iron());
  const inner = out.map(([x, y]) => [175 + (x - 175) * 0.86, 132 + (y - 132) * 0.92]);
  m.add(extI(inner, 6, { d: 17 }), mat(0x6c4232, { r: 0.8, flat: true }));
  const pl = mat(0x7a4c38, { r: 0.8, flat: true });
  for (const dx of [-30, 0, 30]) {
    const x0 = 175 + dx - 13, x1 = 175 + dx + 13;
    m.add(extI([[x0, 236], [x0, 30], [x1, 30], [x1, 236]].map(([x, y]) => [x, y]), 3, { d: 21 }), pl);
  }
  cross(m, 175, 70, 38, 24, FUN.copper());
  const strap = mat(0x34404c, { r: 0.5, m: 0.35, flat: true });
  for (const y of [96, 210]) {
    const w = (edgeX([[126, 246], [104, 78]], y) - 175) * -2 + 6;
    m.add(boxI(175, y, w, 7, 5, 24), strap);
    for (const s of [-1, 1]) m.add(sph(I(175 + s * (w / 2 - 6), y, 27), 2.6, 1.6, 2.6, 6, 4), FUN.copper());
  }
  chain(m, [[106, 112, 10], [100, 132, 12], [104, 152, 12], [110, 166, 10]], 4);
  funGrip(m, 175, 248, 336, 10);
  return m.finish(0.91);
}
function f3005() {
  org(180, 216);
  const m = new Model();
  const bronze = mat(0xc08032, { r: 0.35, m: 0.35, flat: true });
  m.add(latheI(180, [[216, 8], [20, 8]], 8), FUN.iron());
  m.add(latheI(180, [[24, 9.5], [16, 9.5], [14, 7]], 8), FUN.ironL());
  const bell = [[194, 80], [186, 84], [178, 70], [165, 63], [140, 58], [100, 52], [72, 48], [60, 44], [56, 24], [52, 12]];
  m.add(latheI(180, bell, 16, { sy: 0.72 }), bronze);
  m.add(latheI(180, [[194, 80], [196, 30]], 16, { sy: 0.72, cap0: false }), mat(0x3a2410, { r: 0.9, ds: true }));
  const band = mat(0x2a2a2c, { r: 0.5, m: 0.3, flat: true });
  for (const [y, r] of [[73, 48.6], [170, 66], [188, 84.5]]) {
    const g = latheI(180, [[y + 2.5, r + 0.6], [y - 2.5, r + 0.6]], 16, { sy: 0.72, cap0: false, cap1: false });
    m.add(g, band);
  }
  const chev = mat(0xe6b070, { r: 0.4, m: 0.3 });
  for (const x of [120, 155, 200]) {
    const d = surfD(bell, 180, 0.72, x, 140) + 0.6;
    m.add(segG(I(x - 5, 144, d), I(x, 138, d), 1, 1, 3), chev); m.add(segG(I(x + 5, 144, d), I(x, 138, d), 1, 1, 3), chev);
  }
  chain(m, [[196, 56, 2], [214, 62, 2], [232, 78, 2], [246, 96, 2], [254, 116, 2]], 5.5);
  const lg = lantern(m, 255, 118, 38, 2);
  flicker(m, lg, 0.05, 6);
  m.add(latheI(180, [[244, 12], [237, 12]], 8), FUN.copper());
  m.add(latheI(180, [[237, 9], [196, 9]], 8), FUN.iron());
  funGrip(m, 180, 244, 336, 9, { collar: FUN.copper() });
  return m.finish(1.0, { maxT: 0.34 });
}
function f3006() {
  org(180, 268);
  const m = new Model();
  const iron = FUN.iron(), ironL = FUN.ironL();
  const sy = 0.85;
  for (const [y, R] of [[40, 54], [90, 46]]) {
    const g = torusG(V3(), AX, R, 3.2, 4, 16); g.scale(1, sy, 1); g.translate(...I(180, y).toArray()); m.add(g, ironL);
  }
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * TAU;
    const P = (y, R) => V3(OY - y, Math.cos(a) * R * sy, Math.sin(a) * R);
    m.add(tube([P(112, 24), P(90, 46), P(40, 54), P(20, 56)], [3, 3, 2.6, 0.4], { seg: 4 }), iron);
  }
  m.add(latheI(180, [[126, 10], [118, 20], [104, 42], [96, 48], [94, 44]], 12, { sy }), FUN.copper());
  m.add(latheI(180, [[102, 40], [100, 0.1]], 12, { sy }), mat(0x1a1410, { r: 0.9 }));
  m.add(latheI(180, [[268, 7], [124, 7]], 8), FUN.iron());
  m.add(latheI(180, [[273, 10], [265, 10]], 8), FUN.copper());
  funGrip(m, 180, 273, 336, 8.5);
  motes(m, 9, [120, 30, 240, 210, 40], 0x5ad8ff, 2.4, 3006, { rise: 6 });
  return m.finish(1.1, { maxT: 0.32 });
}
function f3007() {
  org(118, 290);
  const m = new Model();
  m.add(latheI(118, [[290, 7], [30, 7]], 8), FUN.iron());
  for (const [y, mt] of [[100, FUN.copper()], [232, FUN.iron()], [290, FUN.copper()]]) m.add(latheI(118, [[y + 4, 9], [y - 4, 9]], 8), mt);
  funGrip(m, 118, 290, 338, 7.5);
  m.add(extI([[94, 62], [92, 44], [102, 26], [128, 18], [150, 30], [146, 66], [118, 76]], 30, { bevel: 4 }), mat(0x34404e, { r: 0.55, m: 0.3, flat: true }));
  // 镰刃
  const outer = [[128, 20], [180, 30], [226, 50], [258, 80], [276, 110], [290, 160]];
  const inner = [[140, 62], [190, 64], [228, 86], [254, 112], [270, 132], [290, 160]];
  const rings = [];
  const N = 16;
  const sp = (pts) => new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y))).getSpacedPoints(N);
  const O = sp(outer), Q = sp(inner);
  for (let i = 0; i <= N; i++) {
    const t = i / N, th = 10 * (1 - t * 0.85);
    const o = O[i], q = Q[i], mid = o.clone().lerp(q, 0.35);
    rings.push([I(mid.x, mid.y, th), I(q.x, q.y, 0.6), I(q.x, q.y, -0.6), I(mid.x, mid.y, -th), I(o.x, o.y, -th * 0.6), I(o.x, o.y, th * 0.6)]);
  }
  m.add(loft(rings, { flip: false }), mat(0x2c3846, { r: 0.7, m: 0.15, flat: true }));
  // 刃口银边
  const edge = [];
  for (let i = 0; i <= N; i++) { const q = Q[i], o = O[i]; const e = q.clone().lerp(o, 0.18); edge.push([[q.x, q.y], [e.x, e.y]]); }
  const er = edge.map(([q, e], i) => { const t = i / N, th = 10 * (1 - t * 0.85) * 0.3; return [I(e[0], e[1], th + 0.4), I(q[0], q[1], 0.9), I(q[0], q[1], -0.9), I(e[0], e[1], -th - 0.4)]; });
  m.add(loft(er), mat(0xc8d2dc, { r: 0.5, m: 0.2, flat: true }));
  // 发光嵌条
  const strip = [];
  for (let i = 1; i < N - 1; i++) {
    const o = O[i], q = Q[i], t = i / N, th = 10 * (1 - t * 0.85);
    const a = o.clone().lerp(q, 0.25), b = o.clone().lerp(q, 0.48);
    strip.push([I(a.x, a.y, th * 0.85 + 0.6), I(b.x, b.y, th * 0.95 + 0.6)]);
  }
  m.add(loft(strip, { closed: false }), mat(0x48c8ff, { e: 0x48c8ff, ei: 0.9, ds: true, r: 0.5 }));
  chain(m, [[96, 64, 2], [92, 80, 2], [88, 96, 2], [86, 108, 2]], 4);
  const lg = lantern(m, 84, 108, 26, 2); flicker(m, lg, 0.06, 6);
  motes(m, 8, [70, 20, 200, 260, 30], 0x5ad8ff, 2.2, 3007);
  return m.finish(1.2, { maxW: 0.66 });
}
/** 浮空土块 */
function islandRock(m, cx, yTop, yTip, R, seed, nSpikes) {
  const r = rng(seed), seg = 9, sy = 0.62;
  const rings = [];
  const prof = [[yTip, 0.1], [yTip - (yTip - yTop) * 0.45, R * 0.55], [yTop + 8, R * 1.0], [yTop, R * 0.95], [yTop - 1, 0.1]];
  const jit = Array.from({ length: seg }, () => 0.85 + r() * 0.25);
  for (const [y, rr] of prof) {
    const ring = [];
    for (let j = 0; j < seg; j++) { const a = j / seg * TAU + 0.2; const k = rr * (y === yTip ? 1 : jit[j]); ring.push(V3(OY - y, Math.cos(a) * k * sy, Math.sin(a) * k + cx - OX)); }
    rings.push(ring);
  }
  m.add(loft(rings), mat(0x252a32, { r: 0.8, flat: true }));
  const stake = mat(0x5a3a2a, { r: 0.85, flat: true });
  for (let i = 0; i < nSpikes; i++) {
    const a = (i + 0.3) / nSpikes * TAU, y = yTop + 14 + r() * 26, rr = R * 0.8;
    const p = V3(OY - y, Math.cos(a) * rr * sy * 0.9, Math.sin(a) * rr + cx - OX);
    const dir = V3(-0.8, Math.cos(a) * 0.5, Math.sin(a) * 0.7).normalize();
    m.add(coneG(p, dir, 26 + r() * 10, 3.5, 4), stake);
  }
}
/** 铜横杆 + 链 + 灯 */
function hangLantern(m, x0, x1, y, yl, s) {
  m.add(segG(I(x0, y), I(x1, y), 2.6, 2.6, 6), FUN.copper());
  chain(m, [[x1, y + 2], [x1, (y + yl) / 2], [x1, yl]], 3.6);
  const lg = lantern(m, x1, yl, s); flicker(m, lg, 0.06, 6, x1);
}
/** 墓碑里的金色根须 */
function goldRoots(m, cx, y, w, d) {
  const g = mat(0xb88a4a, { r: 0.5, m: 0.3 });
  for (const s of [-1, 1]) {
    m.add(tubeI([[cx + s * w * 0.1, y, d], [cx + s * w * 0.25, y - 12, d], [cx + s * w * 0.32, y - 28, d]], [2.2, 0.8], 8, { seg: 4 }), g);
    m.add(tubeI([[cx + s * w * 0.18, y - 6, d], [cx + s * w * 0.1, y - 20, d], [cx + s * w * 0.14, y - 32, d]], [1.8, 0.6], 8, { seg: 4 }), g);
    m.add(tubeI([[cx + s * w * 0.26, y - 16, d], [cx + s * w * 0.4, y - 20, d]], [1.5, 0.5], 4, { seg: 4 }), g);
  }
}
function f3008() {
  org(180, 292);
  const m = new Model();
  islandRock(m, 180, 150, 230, 84, 3008, 6);
  const fd = tombstone(m, 180, 32, 152, 96, { glow: true, th: 24 });
  goldRoots(m, 180, 140, 96, fd + 2);
  m.add(tubeI([[146, 95, fd + 2], [166, 92, fd + 2], [186, 86, fd + 2]], 0.9, 6, { seg: 3 }), FUN.cyan());
  hangLantern(m, 134, 108, 102, 172, 18);
  hangLantern(m, 226, 252, 102, 172, 18);
  m.add(latheI(180, [[292, 7], [222, 7]], 8), FUN.iron());
  m.add(latheI(180, [[296, 9.5], [288, 9.5]], 8), FUN.copper());
  funGrip(m, 180, 296, 338, 7.5);
  motes(m, 7, [100, 20, 260, 160, 40], 0x5ad8ff, 2, 3008);
  return m.finish(1.3, { maxW: 0.66, maxT: 0.34 });
}
function f3009() {
  org(180, 292);
  const m = new Model();
  islandRock(m, 180, 175, 246, 96, 3009, 7);
  // 铁栅栏尖 + 尖拱
  const iron = FUN.iron();
  for (const [x, ty] of [[118, 72], [140, 56], [163, 40], [186, 22], [208, 40], [230, 56], [252, 72]]) {
    m.add(latheI(x, [[150, 2.5], [ty + 10, 2.5]], 5, { d: -16 }), iron);
    m.add(latheI(x, [[ty + 12, 2], [ty + 8, 5], [ty, 0.1]], 4, { d: -16 }), FUN.copper());
  }
  for (const cx of [128, 236]) {
    const P = [[cx - 22, 150], [cx - 22, 106], [cx - 12, 88], [cx, 80], [cx + 12, 88], [cx + 22, 106], [cx + 22, 150]];
    m.add(tubeI(P, 3, 14, { seg: 4 }), mat(0x6a4a3a, { r: 0.7, flat: true }));
  }
  const fd = tombstone(m, 180, 62, 178, 70, { glow: true, th: 22 });
  goldRoots(m, 180, 168, 70, fd + 2);
  const fl = tombstone(m, 124, 112, 184, 50, { th: 18 });
  goldRoots(m, 124, 178, 50, fl + 2);
  const fr = tombstone(m, 230, 106, 184, 52, { th: 18 });
  goldRoots(m, 230, 178, 52, fr + 2);
  hangLantern(m, 104, 92, 156, 198, 16);
  hangLantern(m, 256, 268, 160, 205, 16);
  chain(m, [[176, 222, 10], [174, 232, 12]], 3);
  const lg = lantern(m, 172, 232, 14, 14); flicker(m, lg, 0.05, 5);
  m.add(latheI(180, [[292, 7], [238, 7]], 8), FUN.iron());
  for (const y of [262, 292]) m.add(latheI(180, [[y + 4, 9.5], [y - 4, 9.5]], 8), FUN.copper());
  funGrip(m, 180, 296, 340, 7.5);
  motes(m, 7, [90, 20, 270, 190, 40], 0x5ad8ff, 2, 3009);
  return m.finish(1.4, { maxW: 0.72, maxT: 0.34 });
}
function f3010() {
  org(180, 296);
  const m = new Model();
  const cx = 182, cy = 126, R = 88, sy = 0.7;
  // 八边形环
  const oct = (r, k = 8, a0 = PI / 8) => Array.from({ length: k }, (_, i) => { const a = a0 + i / k * TAU; return [cx + Math.sin(a) * r, cy - Math.cos(a) * r * 1.02]; });
  const ringGeo = (r0, r1, th, d, bv = 3) => {
    const sh = new THREE.Shape(oct(r1).map(([x, y]) => new THREE.Vector2(OY - y, x - OX)));
    sh.holes.push(new THREE.Path(oct(r0).reverse().map(([x, y]) => new THREE.Vector2(OY - y, x - OX))));
    const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv, bevelSegments: 1 });
    g.rotateX(PI / 2); g.translate(0, th / 2 + d, 0); return g;
  };
  m.add(ringGeo(R - 16, R, 20, 0), mat(0x2a3646, { r: 0.5, m: 0.3, flat: true }));
  m.add(ringGeo(R - 24, R - 15, 14, -2), mat(0x8e9cac, { r: 0.4, m: 0.35, flat: true }));
  m.add(ringGeo(R - 9.5, R - 7, 2, 13, 0), glowM(0x46d6ff, 0.7));
  for (const i of [0, 3, 5]) { const [x, y] = oct(R - 8)[i]; m.add(boxI(x, y, 12, 12, 26), FUN.copper()); }
  // 角
  const hornM = mat(0x2a3442, { r: 0.5, m: 0.3, flat: true });
  m.add(tubeI([[124, 56], [112, 42], [108, 26]], [9, 0.5], 6, { seg: 4 }), hornM);
  m.add(tubeI([[240, 56], [252, 42], [256, 26]], [9, 0.5], 6, { seg: 4 }), hornM);
  // 浮空的锁匣
  const lock = new THREE.Group();
  const lm = new Model();
  lm.add(extI([[146, 160], [146, 118], [180, 88], [214, 118], [214, 160]], 40, { bevel: 4 }), mat(0x2e3844, { r: 0.55, m: 0.3, flat: true }));
  lm.add(extI([[184, 150], [184, 112], [206, 124], [206, 152]], 4, { d: 21 }), mat(0x8a96a2, { r: 0.45, m: 0.3, flat: true }));
  lm.add(boxI(180, 162, 76, 8, 44), FUN.copper());
  lm.add(boxI(162, 136, 14, 18, 4, 21), mat(0x101418, { r: 0.8 }));
  for (const [mt, list] of lm.parts) lock.add(Model.mesh(list, mt));
  const piv = I(180, 130);
  for (const c of lock.children) c.position.sub(piv);
  lock.position.copy(piv);
  m.obj(lock);
  // 青色魔法弧
  const arcs = new THREE.Group(); arcs.position.copy(I(180, 128));
  for (const [r0, a0, tilt] of [[58, 0.3, 0.3], [64, 3.6, -0.25]]) {
    const g = new THREE.Mesh(torusG(V3(), AX, r0, 1, 3, 20, 2.2), FUN.cyan());
    g.rotation.set(a0, tilt, 0); arcs.add(g);
  }
  m.obj(arcs, true);
  m.fx.push((dt, t) => { lock.position.x = piv.x + Math.sin(t * 1.6) * 3; lock.rotation.x = Math.sin(t * 0.8) * 0.12; arcs.rotation.x = t * 0.5; });
  chain(m, [[98, 140], [92, 160], [86, 180]], 4);
  chain(m, [[266, 140], [272, 160], [278, 180]], 4);
  for (const x of [84, 280]) { const lg = lantern(m, x, 180, 18); flicker(m, lg, 0.06, 6, x); }
  // 钥匙杆 + 齿
  m.add(extI([[168, 296], [168, 210], [192, 210], [192, 296]], 18, { bevel: 3 }), mat(0x34404e, { r: 0.5, m: 0.3, flat: true }));
  m.add(boxI(180, 252, 4, 80, 2, 9.5), glowM(0x46d6ff, 0.8));
  const bit = [[190, 206], [234, 206], [234, 216], [256, 216], [256, 228], [266, 228], [266, 252], [244, 252], [244, 242], [222, 242], [222, 252], [190, 252]];
  m.add(extI(bit, 16, { bevel: 2 }), mat(0x2e3a48, { r: 0.5, m: 0.3, flat: true }));
  m.add(boxI(230, 234, 60, 3, 2, 9), glowM(0x46d6ff, 0.8));
  m.add(latheI(180, [[300, 16], [290, 16]], 8), FUN.copper());
  funGrip(m, 180, 300, 340, 8);
  motes(m, 6, [110, 50, 250, 200, 30], 0x5ad8ff, 2, 3010);
  return m.finish(1.5, { maxW: 0.72, maxT: 0.3 });
}

export const FORMS = {
  100: f100, 101: f101, 102: f102, 103: f103, 104: f104, 105: f105, 106: f106, 107: f107, 108: f108, 109: f109, 110: f110,
  200: f200, 201: f201, 202: f202, 203: f203, 204: f204, 205: f205, 206: f206, 207: f207, 208: f208, 209: f209, 210: f210,
  3000: f3000, 3001: f3001, 3002: f3002, 3003: f3003, 3004: f3004, 3005: f3005, 3006: f3006, 3007: f3007, 3008: f3008, 3009: f3009, 3010: f3010,
};
