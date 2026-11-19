// 幽灵商人第二批剑线（原创形态，SPEC3）：星辰线 400–410、机关线 500–510
// 建模单位：设计单位（剑尖 +X，原点 = 护手中心，正面 +Y，右侧 +Z），最后整体缩放到目标长度（米）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { galaxyTexture } from './kit.js';

const PI = Math.PI, TAU = PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const AX = V3(1, 0, 0), AY = V3(0, 1, 0), AZ = V3(0, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LEN = (i) => +(0.55 + i * 0.095).toFixed(3);

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
// 贴图（模块级缓存，只读共享）
// ---------------------------------------------------------------------------
const _tex = new Map();
function canvasTex(name, S, draw, o = {}) {
  if (_tex.has(name)) return _tex.get(name);
  if (typeof document === 'undefined') { _tex.set(name, null); return null; }
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  draw(cv.getContext('2d'), S);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (o.wrap !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  _tex.set(name, t);
  return t;
}
function tex(name) {
  if (name === 'galaxy') return typeof document === 'undefined' ? null : galaxyTexture();
  if (name === 'stars') return canvasTex('stars', 256, (g, S) => {
    const r = rng(41);
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 230; i++) {
      const b = r(), x = r() * S, y = r() * S;
      const hue = r() < 0.2 ? '255,214,140' : r() < 0.3 ? '170,200,255' : '235,235,255';
      g.fillStyle = `rgba(${hue},${0.35 + 0.65 * b})`;
      const s = b > 0.9 ? 2.4 : b > 0.6 ? 1.6 : 1;
      g.fillRect(x, y, s, s);
      if (b > 0.96) { g.fillRect(x - 3, y + 0.7, 8, 1); g.fillRect(x + 0.7, y - 3, 1, 8); }
    }
  });
  if (name === 'nebula') return canvasTex('nebula', 256, (g, S) => {
    const r = rng(52);
    g.fillStyle = '#0a0820'; g.fillRect(0, 0, S, S);
    const cols = ['120,50,200', '40,90,220', '220,70,170', '60,170,230', '160,60,230'];
    for (let i = 0; i < 26; i++) {
      const x = r() * S, y = r() * S, rad = 20 + r() * 70, c = cols[i % cols.length];
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
        gr.addColorStop(0, `rgba(${c},0.45)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, S, S);
      }
    }
    for (let i = 0; i < 160; i++) {
      const b = r(); g.fillStyle = `rgba(255,245,255,${0.4 + 0.6 * b})`;
      const s = b > 0.85 ? 2 : 1; g.fillRect(r() * S, r() * S, s, s);
    }
  });
  if (name === 'dial') return canvasTex('dial', 256, (g, S) => {
    const c = S / 2;
    g.fillStyle = '#efe2bf'; g.beginPath(); g.arc(c, c, c, 0, TAU); g.fill();
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 8; g.beginPath(); g.arc(c, c, c - 6, 0, TAU); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(c, c, c - 40, 0, TAU); g.stroke();
    g.fillStyle = '#2a1e14';
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * TAU, big = i % 5 === 0, r0 = c - 14, r1 = big ? c - 30 : c - 20;
      g.lineWidth = big ? 5 : 2; g.strokeStyle = '#2a1e14';
      g.beginPath(); g.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0); g.lineTo(c + Math.sin(a) * r1, c - Math.cos(a) * r1); g.stroke();
    }
    const R = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    g.font = 'bold 22px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    R.forEach((t, i) => { const a = i / 12 * TAU; g.fillText(t, c + Math.sin(a) * (c - 54), c - Math.cos(a) * (c - 54)); });
    g.fillStyle = '#b8862c'; g.beginPath(); g.arc(c, c, 10, 0, TAU); g.fill();
  }, { wrap: false });
  if (name === 'disk') return canvasTex('disk', 256, (g, S) => {
    const c = S / 2, r = rng(9);
    g.clearRect(0, 0, S, S);
    const gr = g.createRadialGradient(c, c, c * 0.38, c, c, c);
    gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(0.12, 'rgba(255,200,110,1)');
    gr.addColorStop(0.4, 'rgba(255,110,50,0.85)'); gr.addColorStop(0.7, 'rgba(170,50,190,0.5)'); gr.addColorStop(1, 'rgba(40,10,80,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, c, 0, TAU); g.arc(c, c, c * 0.38, 0, TAU, true); g.fill();
    g.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const rad = c * (0.42 + r() * 0.55), a = r() * TAU, len = 0.3 + r() * 0.9;
      g.strokeStyle = `rgba(255,${(200 + r() * 55) | 0},${(150 + r() * 100) | 0},${0.15 + r() * 0.35})`;
      g.lineWidth = 1 + r() * 2.5; g.beginPath(); g.arc(c, c, rad, a, a + len); g.stroke();
    }
  }, { wrap: false });
  return null;
}

// ---------------------------------------------------------------------------
// 材质
// ---------------------------------------------------------------------------
const _mats = new Map();
function mat(color, o = {}) {
  const key = color + '|' + JSON.stringify(o);
  let m = _mats.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    color, roughness: o.r ?? 0.6, metalness: Math.min(0.35, o.m ?? 0.1),
    flatShading: o.flat ?? true, vertexColors: !!o.vc,
    emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1,
    side: o.ds ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (o.map) m.map = tex(o.map);
  if (o.emap) m.emissiveMap = tex(o.emap);
  if (o.op != null) { m.transparent = true; m.opacity = o.op; m.depthWrite = false; }
  if (o.add) { m.transparent = true; m.blending = THREE.AdditiveBlending; m.depthWrite = false; }
  _mats.set(key, m);
  return m;
}
const glowM = (color, ei = 1.4, o = {}) => {
  const c = new THREE.Color(color).multiplyScalar(0.35);
  return mat(c.getHex(), { e: color, ei, r: 0.5, flat: false, ...o });
};
// 色板
const K = {
  steel: () => mat(0xa2aebb, { r: 0.52, m: 0.3 }),
  silver: () => mat(0xbcc2d4, { r: 0.5, m: 0.3 }),
  gold: () => mat(0xe0ac4a, { r: 0.38, m: 0.35 }),
  brass: () => mat(0xc8943e, { r: 0.42, m: 0.35 }),
  copper: () => mat(0xbc6a3e, { r: 0.45, m: 0.35 }),
  iron: () => mat(0x3c4249, { r: 0.55, m: 0.3 }),
  ironL: () => mat(0x5c646e, { r: 0.5, m: 0.3 }),
  dark: () => mat(0x202328, { r: 0.6, m: 0.25 }),
  wood: () => mat(0x5a3622, { r: 0.8 }),
  leather: () => mat(0x4a2c20, { r: 0.8 }),
  navyGrip: () => mat(0x2a2450, { r: 0.75 }),
  starry: (ei = 1.25) => mat(0x1d1a4a, { r: 0.45, m: 0.2, emap: 'stars', e: 0xffffff, ei }),
  nebula: () => mat(0xffffff, { r: 0.45, m: 0.15, map: 'nebula', emap: 'nebula', e: 0xffffff, ei: 0.85 }),
};

// ---------------------------------------------------------------------------
// 几何
// ---------------------------------------------------------------------------
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
      ring.push(pts[i].clone().addScaledVector(N, Math.cos(a) * rr * (o.sy || 1)).addScaledVector(B, Math.sin(a) * rr));
    }
    rings.push(ring);
  }
  return loft(rings, o);
}
const spline = (pts, n = 16) => new THREE.CatmullRomCurve3(pts.map((p) => Array.isArray(p) ? V3(...p) : p)).getPoints(n);
const tubeS = (arr, r, n = 12, o = {}) => tube(spline(arr, n), r, o);
/** 回转体：c 起点、T 轴、N 参考；prof [[s, r]] */
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
/** 沿 X 轴的回转体（握柄、柄头等），prof [[x, r]] x 递增 */
const latheX = (prof, seg = 8, o = {}) => lathe(V3(0, o.y || 0, o.z || 0), AX, AY, prof, seg, o);
/** 沿 Y 轴（朝观者）的回转体，中心 (x,z)，prof [[y, r]] y 递增 */
const latheY = (x, z, prof, seg = 16, o = {}) => lathe(V3(x, 0, z), AY, AX, prof, seg, o);

/** XZ 平面多边形沿 Y 挤出（以 y 为中心） */
function extXZ(pts, depth, o = {}) {
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  if (o.holes) for (const h of o.holes) sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  const b = o.bevel ?? 0;
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, depth - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * (o.bs ?? 1), bevelSegments: 1, curveSegments: 4 });
  g.rotateX(-PI / 2);
  g.translate(0, (o.y || 0) - (depth - 2 * b) / 2, 0);
  return g;
}
const circ = (cx, cz, r, n = 12, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + i / n * TAU; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });

/** 剑身：prof [[x, zl, zr]] 从根到尖；o.t 脊厚(半) o.te 刃厚 o.rf 脊位置 o.y 中心高 */
function bladeX(prof, o = {}) {
  const n = prof.length, rings = [];
  prof.forEach(([x, zl, zr], i) => {
    const s = i / (n - 1);
    const zc = lerp(zl, zr, o.rf ?? 0.5);
    const t = (o.t ?? 2) * (o.tf ? o.tf(s) : 1 - 0.55 * s), te = o.te ?? 0.35, y0 = o.y ?? 0;
    rings.push([V3(x, y0 + t, zc), V3(x, y0 + te, zr), V3(x, y0 - te, zr), V3(x, y0 - t * (o.back ?? 1), zc), V3(x, y0 - te, zl), V3(x, y0 + te, zl)]);
  });
  const g = loft(rings, o);
  if (o.uv) planarUV(g, o.uv);
  return g;
}
/** 剑身表面高度（与 bladeX 同参数） */
function surf(P, o, x, z = 0) {
  const n = P.length; let i = 0;
  while (i < n - 2 && P[i + 1][0] < x) i++;
  const f = clamp((x - P[i][0]) / ((P[i + 1][0] - P[i][0]) || 1), 0, 1);
  const zl = lerp(P[i][1], P[i + 1][1], f), zr = lerp(P[i][2], P[i + 1][2], f);
  const s = (i + f) / (n - 1);
  const zc = lerp(zl, zr, o.rf ?? 0.5), t = (o.t ?? 2) * (o.tf ? o.tf(s) : 1 - 0.55 * s), te = o.te ?? 0.35;
  const e = z >= zc ? zr : zl, k = clamp(Math.abs(z - zc) / (Math.abs(e - zc) || 1), 0, 1);
  return (o.y ?? 0) + lerp(t, te, k);
}
/** 规则剑形：x0..x1，半宽 hw(s)，中线 zc(s) */
const prof = (x0, x1, n, hw, zc = () => 0) => Array.from({ length: n + 1 }, (_, i) => {
  const s = i / n, c = zc(s), h = Math.max(0, hw(s)); return [lerp(x0, x1, s), c - h, c + h];
});
const inl = (P, k, cut = 0) => P.slice(0, P.length - cut).map(([x, zl, zr]) => { const c = (zl + zr) / 2, h = (zr - zl) / 2 * k; return [x, c - h, c + h]; });
/** 常见剑尖：直到 s0 保持 w0→w1，然后线性收尖 */
const hwTip = (w0, w1, s0) => (s) => s < s0 ? lerp(w0, w1, s / s0) : w1 * (1 - (s - s0) / (1 - s0));

function planarUV(g, s) {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) * s; uv[i * 2 + 1] = p.getZ(i) * s; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
const _q = new THREE.Quaternion();
function orient(g, dir, pos) { _q.setFromUnitVectors(AY, dir.clone().normalize()); g.applyQuaternion(_q); g.translate(pos.x, pos.y, pos.z); return g; }
function coneG(p, dir, len, r, sides = 5) { const g = new THREE.ConeGeometry(r, len, sides, 1); g.translate(0, len / 2, 0); return orient(g, dir, p); }
function cylG(a, b, r0, r1 = r0, sides = 8) {
  const d = V3().subVectors(b, a);
  return orient(new THREE.CylinderGeometry(r1, r0, d.length(), sides, 1), d, a.clone().add(b).multiplyScalar(0.5));
}
function sph(p, r, d = 1, sx = 1, sy = 1, sz = 1) { const g = new THREE.IcosahedronGeometry(r, d); g.scale(sx, sy, sz); g.translate(p.x, p.y, p.z); return g; }
function octa(p, r, sx = 1, sy = 1, sz = 1) { const g = new THREE.OctahedronGeometry(r, 0); g.scale(sx, sy, sz); g.translate(p.x, p.y, p.z); return g; }
function boxG(x, y, z, sx, sy, sz) { const g = new THREE.BoxGeometry(sx, sy, sz); g.translate(x, y, z); return g; }
function torusG(p, axis, R, r, rs = 5, ts = 16, arc = TAU) {
  const g = new THREE.TorusGeometry(R, r, rs, ts, arc);
  _q.setFromUnitVectors(AZ, axis.clone().normalize()); g.applyQuaternion(_q); g.translate(p.x, p.y, p.z); return g;
}
/** 朝 +Y 的平面圆/环（贴图上方 → +X） */
function faceUp(g) { g.rotateX(-PI / 2); g.rotateY(-PI / 2); return g; }
/** 四角星（平放，朝 +Y） */
function star4(R, r, th) {
  const pts = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr = i % 2 ? r : R; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  return extXZ(pts, th, { bevel: th * 0.3, bs: 0.4 });
}
/** 齿轮（XZ 平面，厚度沿 Y，居中原点） */
const _gears = new Map();
function gearGeo(R, N, th, o = {}) {
  const key = [R, N, th, JSON.stringify(o)].join('|');
  if (_gears.has(key)) return _gears.get(key);
  const tooth = o.tooth ?? Math.max(0.6, R * 0.18), rr = R - tooth, s = TAU / N;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = i * s;
    for (const [f, r] of [[0, rr], [0.22, R], [0.5, R], [0.72, rr]]) pts.push([Math.cos(a + f * s) * r, Math.sin(a + f * s) * r]);
  }
  const holes = [];
  if (o.hole) holes.push(circ(0, 0, o.hole, 8));
  if (o.win) {
    const r1 = (o.hole || R * 0.15) + R * 0.12, r2 = rr - R * 0.14;
    for (let k = 0; k < o.win; k++) {
      const a0 = k / o.win * TAU + 0.12, a1 = (k + 1) / o.win * TAU - 0.38;
      const h = [];
      for (let j = 0; j <= 3; j++) { const a = lerp(a0, a1, j / 3); h.push([Math.cos(a) * r2, Math.sin(a) * r2]); }
      for (let j = 2; j >= 0; j--) { const a = lerp(a0, a1, j / 2); h.push([Math.cos(a) * r1, Math.sin(a) * r1]); }
      holes.push(h);
    }
  }
  const g = extXZ(pts, th, { bevel: th * 0.18, bs: 0.6, holes });
  _gears.set(key, g);
  return g;
}

// ---------------------------------------------------------------------------
// 模型容器
// ---------------------------------------------------------------------------
class Model {
  constructor() { this.inner = new THREE.Group(); this.parts = new Map(); this.fx = []; }
  add(g, m) { if (!this.parts.has(m)) this.parts.set(m, []); this.parts.get(m).push(g); return g; }
  /** 独立网格（动画/特殊材质） */
  mesh(g, m, parent = this.inner, o = {}) {
    const me = new THREE.Mesh(g, m);
    if (o.noBounds) me.userData.noBounds = true;
    if (o.keepFx) me.userData.keepFx = true;
    parent.add(me); return me;
  }
  group(pos = V3(), parent = this.inner) { const g = new THREE.Group(); g.position.copy(pos); parent.add(g); return g; }
  static prep(g) {
    g = g.index ? g.toNonIndexed() : g.clone();
    g.clearGroups();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    return g;
  }
  finish(L, o = {}) {
    for (const [m, list] of this.parts) this.inner.add(new THREE.Mesh(mergeGeometries(list.map(Model.prep), false), m));
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
      g.userData.update(0, 0.8);
    }
    return g;
  }
}
/** 自转动画 */
function spin(m, o, axis, speed, ph = 0) { m.fx.push((dt, t) => { o.rotation[axis] = ph + speed * t; }); return o; }
/** 缩放脉动 */
function pulse(m, o, amp = 0.08, sp = 3, ph = 0) { const s0 = o.scale.clone(); m.fx.push((dt, t) => { o.scale.copy(s0).multiplyScalar(1 + amp * Math.sin(t * sp + ph)); }); return o; }
/** 漂浮光点：box [x0,x1,z0,z1,y0,y1] */
function motes(m, n, box, color, size, seed, o = {}) {
  const r = rng(seed), mt = glowM(color, o.ei ?? 2.2), geo = new THREE.OctahedronGeometry(size, 0), list = [];
  for (let i = 0; i < n; i++) {
    const me = m.mesh(geo, mt, m.inner, { noBounds: true });
    me.userData.noBreak = true;
    me.userData.b = { x: lerp(box[0], box[1], r()), z: lerp(box[2], box[3], r()), y: lerp(box[4] ?? 2, box[5] ?? 8, r()), ph: r() * TAU, sp: 0.5 + r() };
    list.push(me);
  }
  const span = box[1] - box[0];
  m.fx.push((dt, t) => {
    for (const me of list) {
      const b = me.userData.b;
      const x = o.flow ? box[0] + ((b.x - box[0] + t * o.flow * b.sp) % span) : b.x + Math.sin(t * b.sp + b.ph) * 2;
      me.position.set(x, b.y + Math.sin(t * 1.3 * b.sp + b.ph) * 1.2, b.z + Math.cos(t * 0.8 * b.sp + b.ph) * 1.5);
      me.rotation.set(t * b.sp, t * 0.7, 0);
      me.scale.setScalar(0.55 + 0.45 * Math.sin(t * 3 * b.sp + b.ph));
    }
  });
}
/** 蒸汽团 */
function steam(m, origin, dir, n, seed, size = 1.6) {
  const r = rng(seed), mt = mat(0xe8eef2, { op: 0.42, r: 0.9, flat: false }), geo = new THREE.IcosahedronGeometry(size, 0), list = [];
  for (let i = 0; i < n; i++) {
    const me = m.mesh(geo, mt, m.inner, { noBounds: true });
    me.userData.noBreak = true; me.userData.keepFx = true;
    me.userData.b = { ph: i / n + r() * 0.1, j: V3(r() - 0.5, 0, r() - 0.5) };
    list.push(me);
  }
  m.fx.push((dt, t) => {
    for (const me of list) {
      const b = me.userData.b, f = (t * 0.55 + b.ph) % 1;
      me.position.copy(origin).addScaledVector(dir, f * 10).addScaledVector(b.j, f * 6).add(V3(0, f * 7, 0));
      me.scale.setScalar(Math.sin(PI * f) * (0.6 + f * 1.8) + 0.01);
      me.rotation.set(f * 3, f * 2, 0);
    }
  });
}
/** 握柄：从 x0 向 -X 延伸 len，带缠绕环 */
function gripX(m, x0, len, r, o = {}) {
  m.add(latheX([[x0 - len, r], [x0, r]], o.seg || 8), o.m || K.leather());
  const wm = o.wrap || K.gold(), n = o.rings ?? 3;
  for (let i = 0; i < n; i++) m.add(torusG(V3(x0 - len * (i + 0.5) / n, 0, 0), AX, r + 0.15, o.wr ?? 0.45, 4, 10), wm);
  return x0 - len;
}
/** 表盘 + 指针（朝 +Y） */
function clockFace(m, x, z, y, r, o = {}) {
  m.mesh(faceUp(new THREE.CircleGeometry(r, 28)).translate(x, y, z), mat(0xffffff, { map: 'dial', r: 0.6, flat: false, e: o.lit ? 0x806040 : 0, ei: 0.5 }));
  const hands = m.group(V3(x, y + 0.15, z));
  const hm = mat(0x1a1410, { r: 0.5 });
  const hr = new THREE.Group(), mn = new THREE.Group(), sc = new THREE.Group();
  hands.add(hr, mn, sc);
  hr.add(new THREE.Mesh(boxG(r * 0.25, 0.25, 0, r * 0.55, 0.3, r * 0.09), hm));
  mn.add(new THREE.Mesh(boxG(r * 0.36, 0.45, 0, r * 0.78, 0.3, r * 0.06), hm));
  sc.add(new THREE.Mesh(boxG(r * 0.3, 0.65, 0, r * 0.85, 0.2, r * 0.03), mat(0xc03020, { r: 0.5 })));
  const sp = o.speed ?? 1;
  m.fx.push((dt, t) => { sc.rotation.y = -t * sp * 1.6; mn.rotation.y = -t * sp * 0.25 - 1.1; hr.rotation.y = -t * sp * 0.03 - 2.4; });
  return hands;
}
/** 旋转齿轮（独立网格） */
function gear(m, x, z, y, R, N, th, mt, speed, o = {}) {
  const me = m.mesh(gearGeo(R, N, th, o), mt);
  me.position.set(x, y, z);
  spin(m, me, 'y', speed, o.ph || 0);
  return me;
}
/** 活塞：沿 dir 的套筒 + 伸缩杆 */
function piston(m, a, dir, lenH, rH, ext, ph = 0, o = {}) {
  const d = dir.clone().normalize();
  const b = a.clone().addScaledVector(d, lenH);
  m.add(cylG(a, b, rH, rH, 8), o.hm || K.copper());
  m.add(torusG(b, d, rH * 1.05, rH * 0.25, 4, 10), K.brass());
  m.add(torusG(a.clone().addScaledVector(d, lenH * 0.3), d, rH * 1.05, rH * 0.2, 4, 10), K.brass());
  const rod = m.group(b);
  const rl = lenH * 0.9;
  rod.add(new THREE.Mesh(cylG(V3().addScaledVector(d, -rl * 0.6), V3().addScaledVector(d, rl * 0.4), rH * 0.45, rH * 0.45, 6), K.steel()));
  rod.add(new THREE.Mesh(cylG(V3().addScaledVector(d, rl * 0.4), V3().addScaledVector(d, rl * 0.4 + rH * 0.8), rH * 0.8, rH * 0.8, 6), o.cm || K.iron()));
  m.fx.push((dt, t) => { rod.position.copy(b).addScaledVector(d, ext * (0.5 + 0.5 * Math.sin(t * (o.sp || 3) + ph))); });
  return rod;
}
/** 链节 */
function chainG(pts, R, n) {
  const P = spline(pts, 40), L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
  const out = [], step = L.at(-1) / n;
  for (let k = 0; k < n; k++) {
    const s = (k + 0.5) * step; let i = 1; while (i < P.length - 1 && L[i] < s) i++;
    const p = P[i - 1].clone().lerp(P[i], (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1)), d = V3().subVectors(P[i], P[i - 1]).normalize();
    const g = new THREE.TorusGeometry(R, R * 0.32, 4, 8); g.scale(1, 1.5, 1);
    const side = k % 2 ? AY : V3().crossVectors(d, AY).normalize();
    const mtx = new THREE.Matrix4().makeBasis(V3().crossVectors(d, side), d, side).setPosition(p);
    g.applyMatrix4(mtx); out.push(g);
  }
  return out;
}

// =====================================================================
// 星辰线 400–410
// =====================================================================
/** 星空剑：银边 + 星空嵌板，返回 {P,o,Pi,oi} 方便放装饰 */
function starBlade(m, P, o = {}) {
  const ob = { t: o.t ?? 1.6, te: 0.3, ...(o.ob || {}) };
  m.add(bladeX(P, ob), o.edge || K.silver());
  const Pi = inl(P, o.k ?? 0.66);
  const oi = { t: ob.t * 1.22, te: 0.75 * ob.t / 1.6, uv: 1 / 34, ...(o.oi || {}) };
  m.add(bladeX(Pi, oi), o.core || K.starry());
  return { P, o: ob, Pi, oi };
}
/** 星座：nodes [[x,z]] 放在嵌板表面；links [[i,j]] */
function constellation(m, B, nodes, links, o = {}) {
  const gm = o.lm || glowM(0xffcf5a, 0.9);
  const Y = ([x, z]) => surf(B.Pi, B.oi, x, z) + 0.12;
  for (const [i, j] of links) {
    const a = nodes[i], b = nodes[j], pts = [];
    for (let k = 0; k <= 4; k++) { const x = lerp(a[0], b[0], k / 4), z = lerp(a[1], b[1], k / 4); pts.push(V3(x, Y([x, z]), z)); }
    m.add(tube(pts, o.lr ?? 0.28, { seg: 4 }), gm);
  }
  const sm = glowM(o.sc ?? 0xfff0b0, 2.2);
  nodes.forEach(([x, z], i) => {
    const s = (o.size ?? 1) * (i % 3 === 0 ? 1.5 : 1);
    const me = m.mesh(octa(V3(), s, 1, 0.5, 1), sm); me.position.set(x, Y([x, z]) + 0.3, z);
    pulse(m, me, 0.3, 2.5 + i * 0.7, i * 1.7);
  });
}
const glowStar = (m, p, s, color, ei = 2.4) => { const me = m.mesh(octa(V3(), s, 1, 0.55, 1), glowM(color, ei)); me.position.copy(p); return me; };

function f400() {
  const m = new Model(), r = rng(400);
  const P = [];
  for (let i = 0; i <= 8; i++) {
    const s = i / 8, x = 3 + s * 56;
    const hw = s < 0.2 ? lerp(7, 9, s / 0.2) : 9 * Math.pow(1 - (s - 0.2) / 0.8, 0.8);
    P.push([x, -hw + (r() - 0.5) * 3 * (1 - s), hw + (r() - 0.5) * 3 * (1 - s)]);
  }
  const o = { t: 4, te: 1.2, rf: 0.45 };
  const rock = mat(0x2c2638, { r: 0.85 }), rockL = mat(0x463c52, { r: 0.85 });
  m.add(bladeX(P, o), rock);
  m.add(sph(V3(1, 0, 0), 7, 0, 0.75, 0.7, 1.15), rockL);
  const lava = glowM(0xff7a34, 1.8);
  for (const c of [[[6, 0], [14, 2], [22, -1.5], [30, 1.5], [38, -1], [46, 0.5]], [[14, 2], [18, 5]], [[30, 1.5], [34, -3]], [[4, -3], [10, -5]]]) {
    m.add(tube(c.map(([x, z]) => V3(x, surf(P, o, x, z) + 0.1, z)), [0.6, 0.25], { seg: 4 }), lava);
  }
  const cr = m.mesh(octa(V3(), 2.4, 1.6, 1, 1), glowM(0xb070ff, 1.8)); cr.position.set(22, surf(P, o, 22, -4) + 0.4, -4); cr.rotation.y = 0.5;
  pulse(m, cr, 0.12, 2.2);
  const e = gripX(m, -3, 23, 2.6, { m: mat(0x5a4636, { r: 0.85 }), wrap: mat(0x8a6a48, { r: 0.8 }), rings: 4 });
  m.add(sph(V3(e - 2.5, 0, 0), 3.4, 0, 1.1, 0.9, 1), rock);
  motes(m, 5, [0, 60, -12, 12, 3, 8], 0xffb070, 0.6, 400);
  return m.finish(LEN(0));
}
function f401() {
  const m = new Model();
  const P = prof(0, 58, 8, (s) => s < 0.1 ? 4.2 : 4.7 * Math.pow(1 - (s - 0.1) / 0.9, 0.75));
  starBlade(m, P, { k: 0.6 });
  m.add(extXZ([[-1.6, -10], [1.6, -9], [1.6, 9], [-1.6, 10]], 3, { bevel: 0.6 }), K.gold());
  for (const z of [-11.5, 11.5]) m.add(octa(V3(0, 0, z), 2.2, 0.7, 0.6, 1), K.gold());
  glowStar(m, V3(0, 1.8, 0), 1.6, 0x9a7cff);
  const e = gripX(m, -1.6, 21, 2.1, { m: K.navyGrip(), rings: 3 });
  const pm = glowStar(m, V3(e - 3.2, 0, 0), 3.2, 0xffe08a, 1.8);
  spin(m, pm, 'y', 1.4);
  motes(m, 7, [4, 56, -6, 6, 2, 5], 0xffd27a, 0.5, 401, { flow: 6 });
  return m.finish(LEN(1));
}
function f402() {
  const m = new Model();
  const P = prof(0, 66, 9, hwTip(5.6, 5, 0.7));
  const B = starBlade(m, P, { k: 0.64 });
  // 流星：头 + 拖尾
  const hx = 46, hy = surf(B.Pi, B.oi, hx, 0) + 1.4;
  const head = m.mesh(sph(V3(), 2.4, 1), glowM(0xffd9a0, 2.6)); head.position.set(hx, hy, 0);
  pulse(m, head, 0.12, 6);
  const tails = [[0, 0.9, 0xffb050], [-1.8, 0.55, 0x8fd8ff], [1.8, 0.55, 0xff8a50]];
  for (const [dz, r0, c] of tails) {
    const pts = [];
    for (let k = 0; k <= 6; k++) { const x = lerp(hx - 1, 10, k / 6), z = dz * (k / 6) * 1.4; pts.push(V3(x, surf(B.Pi, B.oi, x, z) + 0.25 + (1 - k / 6) * 1.0, z)); }
    m.add(tube(pts, [r0 * 1.6, 0.08], { seg: 4 }), glowM(c, 1.5));
  }
  // 后掠护手
  for (const s of [-1, 1]) m.add(tubeS([[1, 0, s * 3], [-1, 0, s * 9], [-5, 0.5, s * 13]], [2, 0.4], 8, { seg: 5 }), K.gold());
  m.add(sph(V3(0, 0, 0), 3.2, 0, 1, 0.8, 1.3), K.gold());
  glowStar(m, V3(0, 2.2, 0), 1.5, 0xff9a50);
  const e = gripX(m, -2, 22, 2.3, { m: K.navyGrip(), rings: 3 });
  m.add(coneG(V3(e, 0, 0), V3(-1, 0, 0), 5, 3, 6), K.gold());
  motes(m, 6, [12, 64, -7, 7, 2, 6], 0xffc890, 0.55, 402, { flow: 12 });
  return m.finish(LEN(2));
}
function f403() {
  const m = new Model();
  const P = [];
  for (let i = 0; i <= 12; i++) {
    const s = i / 12, x = 72 * s, c = 11 * s * s;
    const hl = 3.6 * Math.pow(1 - s, 0.8), hr = (3.8 + 5.5 * Math.sin(PI * Math.min(1, s * 1.05))) * Math.pow(1 - s, 0.55);
    P.push([x, c - hl, c + hr]);
  }
  P[12] = [72, 11, 11];
  const B = starBlade(m, P, { k: 0.58, ob: { rf: 0.4 } });
  // 新月护手
  const cres = [];
  for (let i = 0; i <= 12; i++) { const a = lerp(-2.5, 2.5, i / 12); cres.push([-Math.cos(a) * 10, Math.sin(a) * 10]); }
  for (let i = 12; i >= 0; i--) { const a = lerp(-2.2, 2.2, i / 12); cres.push([-Math.cos(a) * 8 - 3.2, Math.sin(a) * 7.6]); }
  m.add(extXZ(cres, 3, { bevel: 0.6 }), glowM(0xffe7a0, 0.75, { flat: true }));
  m.add(extXZ([[-2, -5], [2, -4], [2, 4], [-2, 5]], 2.6, { bevel: 0.5 }), K.silver());
  const orb = m.group(V3(-2, 0, 0));
  const st = glowStar(m, V3(13, 1.5, 0), 1.3, 0xbfe0ff); orb.add(st);
  spin(m, orb, 'y', 1.2);
  const e = gripX(m, -2, 24, 2.3, { m: K.navyGrip(), wrap: K.silver(), rings: 3 });
  m.add(sph(V3(e - 2, 0, 0), 2.8, 0), K.silver());
  glowStar(m, V3(e - 2, 2.4, 0), 1.1, 0xbfe0ff);
  motes(m, 6, [6, 70, -6, 18, 2, 6], 0xcfe4ff, 0.55, 403);
  return m.finish(LEN(3));
}
function f404() {
  const m = new Model();
  const P = prof(0, 86, 10, hwTip(5.6, 4.8, 0.8));
  const B = starBlade(m, P, { k: 0.62, t: 1.7 });
  const hx = 72, hy = surf(B.Pi, B.oi, hx, 0) + 1.6;
  const head = m.mesh(sph(V3(), 3.2, 1), glowM(0xc8f4ff, 2.6)); head.position.set(hx, hy, 0); pulse(m, head, 0.1, 5);
  const halo = m.mesh(torusG(V3(), AY, 4.6, 0.35, 4, 20), glowM(0x7ad8ff, 1.6), m.inner, { noBounds: true }); halo.position.copy(head.position);
  pulse(m, halo, 0.15, 3);
  // 彗尾飘带（半透明叠加）
  const tail = m.group(V3(hx, hy, 0));
  [[0, 5.5, 0x8fe0ff], [-2.4, 3.6, 0x9c8cff], [2.4, 3.6, 0x6ab8ff]].forEach(([dz, w, c], i) => {
    const rings = [];
    for (let k = 0; k <= 10; k++) {
      const f = k / 10, x = -f * 58, z = dz * f * 1.6 + Math.sin(f * 5 + i) * f * 1.5, ww = w * (1 - f * 0.75) * (k === 0 ? 0.3 : 1);
      rings.push([V3(x, -f * 1.2 + 0.2 * i, z - ww / 2), V3(x, -f * 1.2 + 0.2 * i, z + ww / 2)]);
    }
    const me = new THREE.Mesh(loft(rings, { closed: false }), mat(c, { e: c, ei: 0.55, add: true, op: 0.4, ds: true, flat: false }));
    me.userData.noBounds = true; me.userData.keepFx = true; me.userData.noBreak = true;
    tail.add(me);
  });
  m.fx.push((dt, t) => { tail.rotation.x = 0.06 * Math.sin(t * 1.7); tail.rotation.y = 0.025 * Math.sin(t * 1.3); });
  // 护手：星形中心 + 前弯尖角
  m.add(extXZ([[-1.8, -11], [1.8, -10], [1.8, 10], [-1.8, 11]], 3, { bevel: 0.6 }), K.gold());
  for (const s of [-1, 1]) m.add(tubeS([[0, 0, s * 10], [3, 0, s * 13], [7, 0, s * 13.5]], [1.4, 0.3], 6, { seg: 5 }), K.gold());
  m.add(star4(5, 1.8, 2.2).translate(0, 1.4, 0), K.gold());
  glowStar(m, V3(0, 2.8, 0), 1.6, 0x7ad8ff);
  const e = gripX(m, -1.8, 25, 2.4, { m: K.navyGrip(), rings: 4 });
  glowStar(m, V3(e - 3, 0, 0), 2.8, 0x7ad8ff, 1.8);
  motes(m, 7, [10, 84, -7, 7, 2, 6], 0xbfeaff, 0.55, 404, { flow: 14 });
  return m.finish(LEN(4));
}
function f405() {
  const m = new Model();
  const P = prof(0, 92, 10, hwTip(7.4, 7, 0.76));
  const B = starBlade(m, P, { k: 0.72, t: 1.9 });
  constellation(m, B, [[10, -2], [22, 2.6], [33, -1.6], [45, 3.2], [56, 0], [66, -2.8], [76, 1.5], [44, -3.6]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [2, 7]]);
  m.add(star4(15, 4, 3), K.gold());
  m.add(star4(8, 2.6, 3.8).rotateY(PI / 4), mat(0x2a2458, { r: 0.4, m: 0.3 }));
  const core = glowStar(m, V3(0, 2.4, 0), 2.4, 0x6ab0ff); spin(m, core, 'y', 0.8);
  const tipStar = glowStar(m, V3(100, 0, 0), 2.6, 0xfff0b0, 2.6);
  spin(m, tipStar, 'x', 1.5); pulse(m, tipStar, 0.2, 3);
  const e = gripX(m, -3, 25, 2.6, { m: K.navyGrip(), rings: 4 });
  m.add(star4(4.5, 1.6, 2.4).translate(e - 4, 0, 0), K.gold());
  glowStar(m, V3(e - 4, 1.4, 0), 1.2, 0x6ab0ff);
  motes(m, 8, [6, 96, -12, 12, 2, 7], 0xfff0b0, 0.6, 405);
  return m.finish(LEN(5));
}
function f406() {
  const m = new Model();
  const P = prof(0, 96, 10, hwTip(8.6, 8.4, 0.74));
  const B = starBlade(m, P, { k: 0.74, t: 2.1, edge: mat(0xc4bce8, { r: 0.35, m: 0.3 }), core: K.nebula() });
  constellation(m, B, [[16, 1], [30, -3], [44, 2], [58, -2], [70, 2.5]], [[0, 1], [1, 2], [2, 3], [3, 4]], { size: 0.9 });
  // 新月双翼护手
  for (const s of [-1, 1]) {
    m.add(tubeS([[-1, 0, s * 4], [2, 0, s * 12], [9, 0.4, s * 17], [16, 0.8, s * 16]], [2.6, 0.3], 12, { seg: 6 }), K.gold());
    m.add(tubeS([[-2, 0, s * 4], [-5, 0, s * 10], [-9, 0, s * 12]], [1.6, 0.3], 6, { seg: 5 }), K.gold());
  }
  m.add(sph(V3(0, 0, 0), 4.6, 0, 0.9, 0.7, 1.4), K.gold());
  const core = m.mesh(octa(V3(), 3, 1.3, 0.7, 1), glowM(0xc070ff, 2.2)); core.position.set(1, 2.6, 0); pulse(m, core, 0.08, 2);
  // 漂浮晶片
  const r = rng(406);
  [[30, -17], [52, 18], [70, -15], [44, -20], [84, 13]].forEach(([x, z], i) => {
    const sh = m.mesh(octa(V3(), 2, 2.2, 0.8, 0.8), glowM(i % 2 ? 0x8a6aff : 0xd070ff, 1.6));
    const b = { x, z, ph: r() * TAU };
    sh.rotation.y = r() * PI;
    m.fx.push((dt, t) => { sh.position.set(b.x + Math.sin(t * 0.7 + b.ph) * 1.5, 3 + Math.sin(t * 1.4 + b.ph) * 1.5, b.z + Math.cos(t * 0.9 + b.ph)); sh.rotation.x = t * 0.8 + b.ph; });
  });
  const e = gripX(m, -2, 27, 2.6, { m: mat(0x3a2860, { r: 0.75 }), rings: 4 });
  m.add(octa(V3(e - 3.5, 0, 0), 3.6, 1.2, 0.8, 1), K.gold());
  glowStar(m, V3(e - 3.5, 2, 0), 1.4, 0xd070ff);
  motes(m, 9, [0, 100, -16, 16, 2, 8], 0xe0b0ff, 0.6, 4060);
  return m.finish(LEN(6), { maxW: 0.6 });
}
function f407() {
  const m = new Model();
  const P = prof(0, 100, 10, hwTip(8.4, 8, 0.76));
  const B = starBlade(m, P, { k: 0.7, t: 2.1 });
  constellation(m, B, [[24, -2], [38, 2], [70, -2], [84, 1.5]], [[0, 1], [2, 3]], { size: 0.8 });
  // 护手：金环 + 双子星
  m.add(torusG(V3(0, 0, 0), AY, 11, 1.4, 5, 28), K.gold());
  m.add(faceUp(new THREE.CircleGeometry(10, 24)).translate(0, -0.4, 0), mat(0x14123a, { r: 0.5, emap: 'stars', e: 0xffffff, ei: 1 }));
  for (const s of [-1, 1]) m.add(extXZ([[-2, s * 11], [2, s * 11], [1, s * 16], [-1, s * 16]], 2.4, { bevel: 0.5 }), K.gold());
  const twins = m.group(V3(0, 2.2, 0));
  const sa = new THREE.Mesh(sph(V3(4.6, 0, 0), 2.6, 1), glowM(0x6ab8ff, 2.4));
  const sb = new THREE.Mesh(sph(V3(-4.6, 0, 0), 2.1, 1), glowM(0xffa04a, 2.4));
  twins.add(sa, sb);
  spin(m, twins, 'y', 1.6);
  // 环绕剑身的大环（带卫星）
  const ringG = m.group(V3(56, 0, 0));
  const tilt = m.group(V3(), ringG); tilt.rotation.z = 1.0; tilt.rotation.x = 0.3;
  const rot = m.group(V3(), tilt);
  rot.add(new THREE.Mesh(torusG(V3(), AX, 15, 0.7, 4, 36), K.gold()));
  rot.add(new THREE.Mesh(torusG(V3(), AX, 16.6, 0.25, 3, 36), glowM(0xffd070, 1.2)));
  const moon = new THREE.Mesh(sph(V3(0, 0, 15), 2.2, 1), mat(0x4aa0b0, { r: 0.6, flat: true, e: 0x103038 })); rot.add(moon);
  spin(m, rot, 'x', 0.7);
  const e = gripX(m, -2, 28, 2.6, { m: K.navyGrip(), rings: 4 });
  m.add(torusG(V3(e - 4, 0, 0), AY, 3.6, 1, 4, 16), K.gold());
  glowStar(m, V3(e - 4, 0.6, 0), 1.8, 0x6ab8ff);
  motes(m, 9, [0, 100, -16, 16, 2, 8], 0xfff0b0, 0.6, 407);
  return m.finish(LEN(7), { maxW: 0.6 });
}
function f408() {
  const m = new Model();
  const P = prof(0, 106, 10, hwTip(9, 8.6, 0.76));
  const B = starBlade(m, P, { k: 0.72, t: 2.2, edge: mat(0xe8d2b0, { r: 0.35, m: 0.3 }), core: mat(0x2a1630, { r: 0.45, m: 0.2, emap: 'stars', e: 0xffd0a0, ei: 1.3 }) });
  // 裂纹
  const crack = glowM(0xff8a34, 1.6);
  for (const c of [[[8, 0], [20, 2], [32, -1.5], [44, 1]], [[72, -1], [84, 1.5], [96, 0]], [[20, 2], [26, 4.5]], [[84, 1.5], [88, -3]]]) {
    m.add(tube(c.map(([x, z]) => V3(x, surf(B.Pi, B.oi, x, z) + 0.12, z)), [0.5, 0.2], { seg: 4 }), crack);
  }
  // 超新星
  const cx = 58, cy = surf(B.Pi, B.oi, cx, 0) + 2.4;
  const nova = m.group(V3(cx, cy, 0));
  nova.add(new THREE.Mesh(sph(V3(), 4.6, 1), glowM(0xfff2c8, 2.8)));
  const rays = new THREE.Group(); nova.add(rays);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, len = i % 2 ? 9 : 16;
    rays.add(new THREE.Mesh(coneG(V3(), V3(Math.cos(a), 0, Math.sin(a)), len, 1.4, 4), glowM(i % 2 ? 0xffb050 : 0xff7030, 2)));
  }
  for (const a of [0.6, 2.2, 3.8, 5.4]) rays.add(new THREE.Mesh(coneG(V3(), V3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5), 6, 1.2, 4), glowM(0xffd080, 2)));
  m.fx.push((dt, t) => { rays.rotation.y = t * 0.4; rays.scale.setScalar(1 + 0.12 * Math.sin(t * 4)); });
  for (let k = 0; k < 2; k++) {
    const w = new THREE.Mesh(torusG(V3(), AY, 8, 0.45, 3, 32), mat(0xff9a50, { e: 0xff8a40, ei: 1.4, add: true, op: 0.8, flat: false }));
    w.userData.noBounds = true; w.userData.keepFx = true; w.userData.noBreak = true;
    nova.add(w);
    m.fx.push((dt, t) => { const f = (t * 0.45 + k * 0.5) % 1; w.scale.setScalar(0.5 + f * 2.2); w.visible = f < 0.92; });
  }
  // 日轮护手
  m.add(latheY(0, 0, [[-1.6, 9], [1.6, 9], [2.2, 6], [2.4, 0.1]], 16), K.gold());
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU + PI / 12;
    if (Math.abs(Math.cos(a)) > 0.9) continue;
    m.add(coneG(V3(Math.cos(a) * 8, 0, Math.sin(a) * 8), V3(Math.cos(a), 0, Math.sin(a)), i % 2 ? 6 : 9, 1.8, 4), K.gold());
  }
  const sun = glowStar(m, V3(0, 3, 0), 2.4, 0xffa040); pulse(m, sun, 0.1, 3);
  const e = gripX(m, -4, 28, 2.8, { m: mat(0x3a1a20, { r: 0.75 }), rings: 4 });
  m.add(sph(V3(e - 3, 0, 0), 3.4, 0), K.gold());
  glowStar(m, V3(e - 3, 2.6, 0), 1.4, 0xffa040);
  motes(m, 10, [20, 100, -16, 16, 2, 9], 0xffb060, 0.6, 408);
  return m.finish(LEN(8), { maxW: 0.6 });
}
function f409() {
  const m = new Model();
  const P = prof(0, 112, 11, hwTip(10, 9.5, 0.78));
  // 紫光刃缘 + 暗色星空剑身
  m.add(bladeX(P.map(([x, zl, zr]) => [x, zl - 1, zr + 1]), { t: 1, te: 0.4 }), glowM(0xa050ff, 1.4, { flat: true }));
  const B = starBlade(m, P, { k: 0.8, t: 2.2, edge: mat(0x2a2236, { r: 0.4, m: 0.3 }), core: mat(0x0c0a1c, { r: 0.4, m: 0.2, emap: 'stars', e: 0xd0c0ff, ei: 1.3 }) });
  // 黑洞
  const cx = 62, cy = surf(B.Pi, B.oi, cx, 0) + 3;
  const bh = m.group(V3(cx, cy, 0));
  bh.add(new THREE.Mesh(sph(V3(), 5.6, 2), mat(0x000000, { r: 1, flat: false })));
  bh.children[0].renderOrder = 2; bh.children[0].position.y = 1.2;
  bh.add(new THREE.Mesh(torusG(V3(), AY, 6.1, 0.35, 4, 32), glowM(0xffd8a0, 1.4)));
  const disk = new THREE.Mesh(faceUp(new THREE.RingGeometry(6.6, 19, 40, 1)), mat(0x000000, { map: 'disk', emap: 'disk', e: 0xffffff, ei: 0.9, add: true, ds: true, flat: false }));
  disk.userData.keepFx = true; disk.userData.noBreak = true; disk.userData.noBounds = true;
  const tilt = new THREE.Group(); tilt.rotation.z = 0.32; tilt.add(disk); bh.add(tilt);
  spin(m, disk, 'y', -1.1);
  // 吸入碎块
  const r = rng(409), debris = [];
  for (let i = 0; i < 12; i++) {
    const d = new THREE.Mesh(octa(V3(), 0.7 + r() * 0.6), i % 3 ? mat(0x6a5a80, { r: 0.7 }) : glowM(0xffb070, 1.8));
    d.userData.noBounds = true; d.userData.noBreak = true; bh.add(d);
    debris.push({ d, ph: r(), a: r() * TAU });
  }
  m.fx.push((dt, t) => {
    for (const q of debris) {
      const f = (t * 0.18 + q.ph) % 1, rr = lerp(24, 6, f), a = q.a + f * 7;
      q.d.position.set(Math.cos(a) * rr, Math.sin(a * 2) * 0.5 * (1 - f), Math.sin(a) * rr);
      q.d.scale.setScalar(1 - f * 0.8); q.d.rotation.set(a, f * 5, 0);
    }
  });
  // 暗冠护手
  m.add(extXZ([[-2.5, -12], [2.5, -11], [2.5, 11], [-2.5, 12]], 4, { bevel: 0.8 }), mat(0x231c30, { r: 0.4, m: 0.3 }));
  for (let i = -2; i <= 2; i++) m.add(coneG(V3(1.5, 0, i * 5.2), V3(1, 0, i * 0.35).normalize(), i === 0 ? 7 : 9 - Math.abs(i), 1.6, 4), mat(0x231c30, { r: 0.4, m: 0.3 }));
  for (const z of [-7, 0, 7]) glowStar(m, V3(0, 2.4, z), z ? 1.2 : 1.8, 0xb060ff);
  const e = gripX(m, -2.5, 28, 2.8, { m: mat(0x1c1626, { r: 0.75 }), wrap: glowM(0xa050ff, 1.0), rings: 4 });
  m.add(sph(V3(e - 3.6, 0, 0), 3.6, 1), mat(0x000000, { r: 1 }));
  m.add(torusG(V3(e - 3.6, 0, 0), AY, 4.1, 0.4, 4, 16), glowM(0xffd0a0, 2));
  motes(m, 10, [0, 110, -16, 16, 2, 9], 0xc8a0ff, 0.6, 4090);
  return m.finish(LEN(9), { maxW: 0.6 });
}
function f410() {
  const m = new Model();
  const P = prof(0, 120, 12, hwTip(11, 10.5, 0.8));
  const B = starBlade(m, P, { k: 0.74, t: 2.4, edge: mat(0xd8d4ee, { r: 0.35, m: 0.3 }), core: K.nebula() });
  // 金色刃线
  for (const s of [-1, 1]) m.add(tube(P.slice(0, -1).map(([x, zl, zr]) => { const z = (s < 0 ? zl : zr) * 0.78; return V3(x, surf(P, B.o, x, z) + 0.15, z); }), 0.45, { seg: 4 }), K.gold());
  constellation(m, B, [[14, 0], [26, 3.5], [38, -2.5], [52, 3], [66, -3], [80, 2], [92, -1], [100, 0]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [1, 3]], { size: 0.9 });
  // 旋转星系（护手后方）
  const gal = m.mesh(faceUp(new THREE.PlaneGeometry(76, 76)), mat(0x000000, { map: 'galaxy', emap: 'galaxy', e: 0xffffff, ei: 2.2, add: true, ds: true, flat: false }), m.inner, { keepFx: true });
  gal.position.set(-2, -2.6, 0); gal.userData.noBreak = true; gal.userData.noBounds = true;
  spin(m, gal, 'y', 0.35);
  // 护手：金翼 + 主星
  for (const s of [-1, 1]) {
    m.add(tubeS([[0, 0, s * 4], [0, 0.5, s * 13], [6, 1, s * 20], [14, 1.2, s * 21]], [2.8, 0.4], 12, { seg: 6 }), K.gold());
    m.add(tubeS([[0, 0, s * 8], [-4, 0.5, s * 15], [-10, 0.8, s * 18]], [1.8, 0.3], 8, { seg: 5 }), K.gold());
  }
  m.add(star4(9, 3, 4), K.gold());
  const core = glowStar(m, V3(0, 3.2, 0), 3, 0xfff2c8, 2.6); pulse(m, core, 0.1, 2.4); spin(m, core, 'y', 0.6);
  // 行星轨道
  const orbit = (R, tiltZ, tiltX, sp, ph, col, size, ringed) => {
    const g = m.group(V3(60, 0, 0)); g.rotation.set(tiltX, 0, tiltZ);
    const line = new THREE.Mesh(torusG(V3(), AY, R, 0.18, 3, 48), mat(0xffd070, { e: 0xffc060, ei: 0.8, add: true, op: 0.55 }));
    line.userData.noBounds = true; line.userData.keepFx = true; line.userData.noBreak = true; g.add(line);
    const rot = new THREE.Group(); g.add(rot);
    const pl = new THREE.Mesh(sph(V3(R, 0, 0), size, 1), mat(col, { r: 0.6, flat: true, e: col, ei: 0.25 }));
    pl.userData.noBounds = true; rot.add(pl);
    if (ringed) { const rg = new THREE.Mesh(torusG(V3(R, 0, 0), V3(0.3, 1, 0.2), size * 1.7, 0.3, 3, 20), K.gold()); rg.userData.noBounds = true; rot.add(rg); }
    spin(m, rot, 'y', sp, ph);
  };
  orbit(26, 0.12, 0.25, 0.6, 0, 0x4ab0c8, 2.6, false);
  orbit(36, -0.18, -0.3, 0.38, 2, 0xe08a40, 3.2, true);
  orbit(46, 0.06, 0.4, 0.25, 4, 0x9a70e0, 2.2, false);
  const tip = glowStar(m, V3(127, 0, 0), 3.4, 0xfff2c8, 2.8); spin(m, tip, 'x', 1.2); pulse(m, tip, 0.2, 3);
  const e = gripX(m, -3, 30, 3, { m: mat(0x2a2050, { r: 0.75 }), rings: 5 });
  m.add(star4(6, 2, 3).translate(e - 5, 0, 0), K.gold());
  glowStar(m, V3(e - 5, 1.8, 0), 1.8, 0x9ad0ff);
  motes(m, 12, [-20, 120, -22, 22, 2, 10], 0xfff0c0, 0.6, 410);
  return m.finish(LEN(10), { maxW: 0.62, maxT: 0.3 });
}

// =====================================================================
// 机关线 500–510
// =====================================================================
const CORE_C = 0x46e0ff, CORE_O = 0xff8a30;
function f500() {
  const m = new Model();
  const P = [];
  for (let i = 0; i <= 7; i++) { const s = i / 7; P.push([2 + 44 * s, -3.4 + 2.2 * s * s * s, lerp(4, -1.2, Math.pow(s, 1.4))]); }
  P[7] = [46, -1.2, -1.2];
  m.add(bladeX(P, { t: 1.3, te: 0.25, rf: 0.25 }), K.steel());
  m.add(boxG(0.5, 0, 0.3, 3.2, 3.4, 9.4), K.brass());
  for (const z of [-2.6, 3]) m.add(sph(V3(0.5, 1.8, z), 0.6, 0), K.copper());
  const e = gripX(m, -1, 20, 2.5, { m: K.wood(), wrap: K.brass(), rings: 2, wr: 0.6 });
  m.add(latheX([[e - 2, 0.9], [e, 0.9]], 6), K.brass());
  // 发条钥匙
  const key = m.group(V3(e - 5, 0, 0));
  for (const s of [-1, 1]) key.add(new THREE.Mesh(torusG(V3(-1, 0, s * 3.2), AY, 2.6, 0.9, 4, 12), K.brass()));
  key.add(new THREE.Mesh(boxG(0, 0, 0, 3, 1.6, 4.4), K.brass()));
  spin(m, key, 'x', 2.2);
  return m.finish(LEN(0));
}
function f501() {
  const m = new Model();
  const P = prof(2, 56, 8, hwTip(4.8, 4, 0.75));
  const o = { t: 1.5, te: 0.28 };
  m.add(bladeX(P, o), K.steel());
  m.add(tube(P.slice(0, -2).map(([x]) => V3(x, surf(P, o, x, 0) + 0.05, 0)), 0.5, { seg: 4 }), K.brass());
  for (const x of [10, 22, 34]) for (const z of [-2.2, 2.2]) m.add(sph(V3(x, surf(P, o, x, z) + 0.1, z), 0.5, 0), K.copper());
  gear(m, 0, 0, 0, 8.5, 12, 2.4, K.brass(), 1.0, { hole: 1.6, win: 4 });
  gear(m, -4.5, 10.2, 0.6, 4, 7, 1.8, K.copper(), -12 / 7, { hole: 0.8 });
  m.add(latheX([[-1.5, 2], [1.5, 2]], 8), K.iron());
  const e = gripX(m, -1.5, 21, 2.3, { m: K.iron(), wrap: K.copper(), rings: 4 });
  m.add(latheX([[e - 3, 2.8], [e, 2.8]], 6), K.brass());
  return m.finish(LEN(1));
}
function f502() {
  const m = new Model();
  m.add(bladeX([[0, -5.5, 5.5], [14, -5.5, 5.5]], { t: 1.6, te: 0.4, tf: () => 1 }), K.steel());
  const up = m.group(V3(0, 0, 0));
  const Pu = prof(36, 72, 6, hwTip(5.5, 5.2, 0.5));
  up.add(new THREE.Mesh(bladeX(Pu, { t: 1.6, te: 0.3, tf: (s) => 1 - 0.6 * s }), K.steel()));
  up.add(new THREE.Mesh(boxG(36, 0, 0, 2, 3.6, 11.4), K.brass()));
  for (const s of [-1, 1]) m.add(boxG(25, 0, s * 4.9, 24, 2.4, 1.4), K.ironL());
  m.add(boxG(14, 0, 0, 2, 3.6, 11.4), K.brass());
  // 弹簧
  const pts = [];
  for (let i = 0; i <= 70; i++) { const f = i / 70, a = f * TAU * 7; pts.push(V3(f * 22, Math.cos(a) * 3.1, Math.sin(a) * 3.1)); }
  const spr = m.group(V3(15, 0, 0));
  spr.add(new THREE.Mesh(tube(pts, 0.55, { seg: 4, up: AZ }), mat(0xd8a050, { r: 0.35, m: 0.35 })));
  m.fx.push((dt, t) => { const d = 2.2 * Math.sin(t * 4); up.position.x = d; spr.scale.x = (22 + d) / 22; });
  m.add(boxG(0, 0, 0, 2.4, 3, 15), K.brass());
  for (const s of [-1, 1]) m.add(torusG(V3(0, 0, s * 8.6), AY, 1.6, 0.6, 4, 10), K.brass());
  const e = gripX(m, -1.2, 22, 2.4, { m: K.dark(), rings: 0 });
  const gp = [];
  for (let i = 0; i <= 60; i++) { const f = i / 60, a = f * TAU * 8; gp.push(V3(-1.5 - f * 19, Math.cos(a) * 2.7, Math.sin(a) * 2.7)); }
  m.add(tube(gp, 0.45, { seg: 4, up: AZ }), K.copper());
  m.add(sph(V3(e - 2, 0, 0), 3, 1), K.brass());
  return m.finish(LEN(2));
}
function f503() {
  const m = new Model();
  const P = prof(0, 76, 9, hwTip(6.8, 6.2, 0.74));
  const o = { t: 2, te: 0.35 };
  m.add(bladeX(P, o), K.steel());
  const yS = (x, z) => surf(P, o, x, z);
  piston(m, V3(6, yS(6, -2.8) + 1.2, -2.8), AX, 16, 1.6, 7, 0);
  piston(m, V3(10, yS(10, 2.8) + 1.2, 2.8), AX, 12, 1.4, 6, PI);
  // 管道
  for (const s of [-1, 1]) m.add(tubeS([[-2, 2, s * 7], [2, 3, s * 6], [5, yS(5, s * 2.8) + 1.3, s * 3.6]], 0.7, 8, { seg: 6 }), K.copper());
  // 护手：铁块 + 压力表
  m.add(extXZ([[-3, -9], [3, -8], [3, 8], [-3, 9]], 5, { bevel: 0.8 }), K.iron());
  m.add(latheY(0, 0, [[2.4, 4.2], [3.4, 4.2], [3.6, 3.6]], 16), K.brass());
  const gauge = m.mesh(faceUp(new THREE.CircleGeometry(3.6, 20)).translate(0, 3.65, 0), mat(0xffffff, { map: 'dial', r: 0.6, flat: false }));
  const needle = m.group(V3(0, 3.9, 0));
  needle.add(new THREE.Mesh(boxG(1.4, 0, 0, 2.8, 0.25, 0.35), mat(0xc03020)));
  m.fx.push((dt, t) => { needle.rotation.y = -0.8 - 0.6 * Math.sin(t * 2.3) - 0.2 * Math.sin(t * 7); });
  for (const s of [-1, 1]) {
    m.add(cylG(V3(-1, 0, s * 9), V3(-1, 0, s * 11.5), 1.3, 1.6, 8), K.brass());
    steam(m, V3(-1, 0.5, s * 12), V3(-0.5, 0, s).normalize(), 5, 503 + s, 1.3);
  }
  const e = gripX(m, -3, 23, 2.4, { m: K.leather(), wrap: K.brass(), rings: 3 });
  // 阀门手轮
  const wheel = m.group(V3(e - 2.5, 0, 0));
  wheel.add(new THREE.Mesh(torusG(V3(), AX, 4, 0.6, 4, 16), mat(0xb03a2a, { r: 0.5 })));
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; wheel.add(new THREE.Mesh(cylG(V3(), V3(0, Math.cos(a) * 4, Math.sin(a) * 4), 0.4), K.iron())); }
  spin(m, wheel, 'x', 1.2);
  return m.finish(LEN(3));
}
function f504() {
  const m = new Model();
  const P = prof(10, 92, 9, hwTip(5.4, 5, 0.78));
  const o = { t: 1.9, te: 0.32 };
  m.add(bladeX(P, o), K.steel());
  m.add(bladeX(inl(P, 0.22), { t: 2.05, te: 1.1 }), K.brass());
  // 怀表
  m.add(latheY(0, 0, [[-2.4, 0.1], [-2.4, 12.6], [-1.6, 13.6], [1.6, 13.6], [2.2, 12.8], [2.3, 11.8]], 28, { flat: false }), K.gold());
  m.add(torusG(V3(0, 2.2, 0), AY, 12.4, 0.8, 4, 32), K.gold());
  clockFace(m, 0, 0, 2.3, 11.6, { speed: 1 });
  m.add(sph(V3(0, 2.6, 0), 0.8, 0), K.gold());
  m.add(cylG(V3(0, 0, 13.4), V3(0, 0, 16.5), 1.4, 1.4, 8), K.gold());
  m.add(latheY(0, 17.8, [[-0.9, 1.6], [0.9, 1.6]], 8), K.gold());
  m.add(torusG(V3(0, 0, 20.6), AY, 2.2, 0.55, 4, 12), K.gold());
  for (const g of chainG([[-1, 0, 22], [-10, -1, 22], [-20, -1, 17], [-30, 0, 6], [-33, 0, 2]], 0.9, 26)) m.add(g, K.gold());
  const e = gripX(m, -12, 24, 2.4, { m: K.leather(), wrap: K.gold(), rings: 3 });
  m.add(latheX([[e - 4, 0.2], [e - 3, 2.6], [e, 2.4]], 8), K.gold());
  m.add(torusG(V3(e - 5.4, 0, 0), AY, 1.8, 0.5, 4, 10), K.gold());
  return m.finish(LEN(4));
}
function f505() {
  const m = new Model();
  const W = 11, X0 = 10, X1 = 82;
  const outline = [];
  outline.push([X0, -W], [X1, -W]);
  for (let i = 1; i < 10; i++) { const a = -PI / 2 + i / 10 * PI; outline.push([X1 + Math.cos(a) * W, Math.sin(a) * W]); }
  outline.push([X1, W], [X0, W]);
  m.add(extXZ(outline, 3, { bevel: 0.6 }), mat(0x6c7684, { r: 0.45, m: 0.3 }));
  m.add(extXZ(outline.map(([x, z]) => [lerp(X0 + 6, x, 0.86), z * 0.66]), 0.6, { y: 1.6 }), K.steel());
  for (const x of [26, 44, 62]) m.add(latheY(x, 0, [[1.6, 1.6], [1.95, 1.6]], 10), K.dark());
  m.add(boxG(46, 2, 0, 60, 0.4, 1.4), mat(0xffb040, { r: 0.4, e: 0xff8a20, ei: 0.5 }));
  // 链齿
  const Rr = W + 1.2, Lstr = X1 - X0, Larc = PI * Rr, Ltot = 2 * Lstr + Larc;
  const at = (s) => {
    s = ((s % Ltot) + Ltot) % Ltot;
    if (s < Lstr) return [X0 + s, -Rr, 0, -1];
    s -= Lstr;
    if (s < Larc) { const a = -PI / 2 + s / Rr; return [X1 + Math.cos(a) * Rr, Math.sin(a) * Rr, Math.cos(a), Math.sin(a)]; }
    s -= Larc; return [X1 - s, Rr, 0, 1];
  };
  const band = [];
  for (let i = 0; i <= 48; i++) { const [x, z] = at(i / 48 * (Ltot - 0.01)); band.push(V3(x, 0, z)); }
  m.add(tube(band, 0.75, { seg: 4 }), K.iron());
  const tg = new THREE.ConeGeometry(1.2, 3, 3); tg.translate(0, 1.5, 0); tg.rotateX(PI / 2);
  const tm = mat(0xd0d6de, { r: 0.35, m: 0.35 }), teeth = [];
  const N = 40;
  for (let i = 0; i < N; i++) { const me = m.mesh(tg, tm); teeth.push(me); }
  m.fx.push((dt, t) => {
    teeth.forEach((me, i) => {
      const [x, z, nx, nz] = at(i / N * Ltot + t * 22);
      me.position.set(x, 0, z); me.rotation.set(0, Math.atan2(nx, nz) + 0.35 * (nx === 0 ? -nz : 1), 0);
    });
  });
  // 引擎
  m.add(boxG(3, 0, 0, 14, 8, 26), mat(0xb8402a, { r: 0.55, m: 0.25 }));
  for (let i = 0; i < 4; i++) m.add(boxG(-1 + i * 3, 4.4, 0, 1.2, 1.2, 22), K.iron());
  m.add(boxG(3, 0, 13.4, 8, 5, 1), glowM(CORE_O, 1.6, { flat: true }));
  m.add(cylG(V3(6, 2, -13), V3(6, 2, -17), 1.4, 1.8, 8), K.iron());
  steam(m, V3(6, 2.5, -18), V3(0, 0, -1), 5, 505, 1.4);
  m.add(tubeS([[-3, 4, -9], [5, 9, -6], [10, 9, 0], [5, 9, 6], [-3, 4, 9]], 1, 12, { seg: 6 }), K.dark());
  gear(m, 3, 0, 4.6, 4, 9, 1.4, K.brass(), 6, { hole: 0.8 });
  const e = gripX(m, -4, 26, 2.8, { m: K.dark(), wrap: mat(0xb8402a, { r: 0.55 }), rings: 4, wr: 0.7 });
  m.add(torusG(V3(e - 3, 0, 0), AY, 3, 0.9, 4, 12), K.iron());
  return m.finish(LEN(5), { maxW: 0.5 });
}
function f506() {
  const m = new Model();
  const P = prof(8, 104, 10, hwTip(8.4, 7.6, 0.78));
  const o = { t: 2.4, te: 0.4 };
  m.add(bladeX(P, o), K.steel());
  m.add(bladeX(inl(P, 0.18, 1), { t: 2.6, te: 1.5 }), K.brass());
  for (let x = 20; x < 80; x += 12) for (const z of [-5, 5]) m.add(sph(V3(x, surf(P, o, x, z) + 0.1, z), 0.6, 0), K.copper());
  // 手掌 + 手指
  m.add(extXZ([[-2, -11], [12, -10], [16, -6], [16, 6], [12, 10], [-2, 11]], 6.4, { bevel: 1 }), K.iron());
  m.add(boxG(4, 3.3, 0, 10, 0.6, 14), K.copper());
  const core = m.mesh(sph(V3(), 2.6, 1), glowM(CORE_C, 2.4)); core.position.set(3, 3.6, 0); pulse(m, core, 0.12, 3);
  m.add(torusG(V3(3, 3.4, 0), AY, 3.4, 0.5, 4, 14), K.brass());
  const fingers = [];
  [[7, 1], [11, 1], [15, 1], [10, -1]].forEach(([x, side], i) => {
    const fg = m.group(V3(x, 0, side * 10));
    const z1 = -side * 5, z2 = -side * 10;
    const thumb = i === 3;
    fg.add(new THREE.Mesh(boxG(0, 3.4, z1 / 2, 3.2, 2.6, 6), K.dark()));
    fg.add(new THREE.Mesh(sph(V3(0, 3.6, z1), 1.9, 0), K.brass()));
    fg.add(new THREE.Mesh(boxG(0, 3.8, (z1 + z2) / 2 * (thumb ? 0.8 : 1), 2.9, 2.4, thumb ? 4 : 5), K.dark()));
    fg.add(new THREE.Mesh(boxG(0, 5.1, (z1 + z2) / 2 * (thumb ? 0.8 : 1), 1.4, 0.4, thumb ? 3 : 4), K.brass()));
    fg.add(new THREE.Mesh(coneG(V3(0, 3.8, z2 * (thumb ? 0.8 : 1)), V3(0, -0.4, -side), 2.8, 1.4, 4), K.brass()));
    fingers.push(fg); fg.userData.side = side;
  });
  m.fx.push((dt, t) => { fingers.forEach((f, i) => { f.rotation.x = f.userData.side * 0.06 * Math.sin(t * 2 + i * 0.6); }); });
  // 前臂（握柄）+ 活塞
  m.add(latheX([[-34, 3.6], [-30, 3.8], [-4, 3.8], [-2, 4.4]], 8), K.iron());
  for (const x of [-28, -18, -8]) m.add(torusG(V3(x, 0, 0), AX, 4, 0.6, 4, 12), K.brass());
  for (const s of [-1, 1]) piston(m, V3(-30, 0, s * 5.2), AX, 12, 1.2, 4, s > 0 ? 0 : PI, { sp: 2 });
  m.add(sph(V3(-37, 0, 0), 4.6, 1), K.ironL());
  m.add(torusG(V3(-37, 0, 0), AZ, 4.8, 0.5, 4, 16), glowM(CORE_C, 1.6));
  return m.finish(LEN(6));
}
function f507() {
  const m = new Model();
  const wall = mat(0x6a6258, { r: 0.75 }), wallD = mat(0x4a443e, { r: 0.8 }), patina = mat(0x4f9080, { r: 0.6, m: 0.2 });
  const seg = [[0, 22, 18, 9], [22, 44, 16, 8], [44, 64, 14.5, 7.5]];
  for (const [x0, x1, w, d] of seg) {
    m.add(boxG((x0 + x1) / 2, 0, 0, x1 - x0, d, w), wall);
    m.add(boxG(x1, 0, 0, 1.6, d + 1.4, w + 1.6), K.brass());
  }
  m.add(boxG(0, 0, 0, 2, 10.4, 19.6), K.brass());
  // 窗户（一扇亮着）
  for (const [x, z, lit] of [[8, -4, 0], [8, 4, 1], [16, 0, 0], [30, -3.5, 1], [30, 3.5, 0], [38, 0, 0]]) {
    m.add(boxG(x, 4.6, z, 4.5, 0.4, 2.4), lit ? glowM(0xffb050, 1.6, { flat: true }) : wallD);
    m.add(latheY(x + 2.25, z, [[4.5, 1.2], [4.9, 0.1]], 6, { sz: 1 }), lit ? glowM(0xffb050, 1.6, { flat: true }) : wallD);
  }
  // 钟面
  m.add(latheY(54, 0, [[3.6, 6.6], [4.4, 6.6], [4.6, 5.8]], 24), K.brass());
  clockFace(m, 54, 0, 4.65, 5.9, { speed: 1.4, lit: true });
  // 钟楼 + 钟
  for (const z of [-6, 6]) for (const y of [-3, 3]) m.add(boxG(71, y, z, 13, 1.6, 1.6), wall);
  m.add(boxG(77.5, 0, 0, 1.6, 8, 14), K.brass());
  const bell = m.group(V3(76, 0, 0));
  bell.add(new THREE.Mesh(lathe(V3(), V3(-1, 0, 0), AY, [[0, 0.5], [1.5, 2.2], [5, 3], [8, 4.6], [8.6, 4.6]], 12), mat(0xd09a40, { r: 0.35, m: 0.35 })));
  m.fx.push((dt, t) => { bell.rotation.z = 0; bell.rotation.y = 0.25 * Math.sin(t * 2.4); });
  // 尖顶
  const roof = new THREE.ConeGeometry(11, 26, 4, 1); roof.rotateY(PI / 4); roof.rotateZ(-PI / 2); roof.scale(1, 0.62, 1); roof.translate(78.4 + 13, 0, 0);
  m.add(roof, patina);
  m.add(cylG(V3(104, 0, 0), V3(112, 0, 0), 0.8, 0.2, 6), K.gold());
  m.add(octa(V3(106, 0, 0), 1.6), K.gold());
  // 底部齿轮
  gear(m, 2, -9, 0, 6, 10, 2, K.brass(), 0.9, { hole: 1, win: 3 });
  gear(m, 2, 9, 0, 6, 10, 2, K.copper(), -0.9, { hole: 1, win: 3 });
  const e = gripX(m, -1, 26, 2.6, { m: K.leather(), wrap: K.brass(), rings: 3 });
  gear(m, e - 3, 0, 0, 3.6, 8, 2.4, K.brass(), 1.6, { hole: 0.8 });
  motes(m, 5, [60, 100, -10, 10, 3, 9], 0xffc070, 0.5, 507);
  return m.finish(LEN(7));
}
function f508() {
  const m = new Model();
  const P = prof(14, 122, 10, hwTip(12.5, 11, 0.78));
  const o = { t: 3, te: 0.6 };
  m.add(bladeX(P, o), mat(0x7a8492, { r: 0.45, m: 0.3 }));
  m.add(bladeX(inl(P, 0.5, 1), { t: 3.3, te: 1.8 }), K.ironL());
  for (const x of [34, 58, 82]) {
    const z = edgeHW(P, x) * 0.92;
    m.add(boxG(x, surf(P, o, x, 0) * 0.6, 0, 3, 3.6, z * 2), K.brass());
    for (const zz of [-z * 0.7, 0, z * 0.7]) m.add(sph(V3(x, surf(P, o, x, 0) + 0.3, zz), 0.7, 0), K.copper());
  }
  m.add(boxG(70, surf(P, o, 70, 0) + 0.2, 0, 60, 0.4, 1.6), glowM(CORE_O, 1.2, { flat: true }));
  for (const s of [-1, 1]) piston(m, V3(20, 3.2, s * 9), AX, 18, 1.8, 9, s > 0 ? 0 : PI, { sp: 2.4 });
  // 巨像头
  m.add(extXZ([[-6, -12], [10, -10], [14, -6], [14, 6], [10, 10], [-6, 12]], 11, { bevel: 1.2 }), K.iron());
  m.add(boxG(9, 5.8, 0, 3, 1.6, 18), K.ironL());
  for (const z of [-5, 5]) { const eye = m.mesh(boxG(0, 0, 0, 2.2, 1, 4), glowM(CORE_O, 2.6, { flat: true })); eye.position.set(6, 5.9, z); pulse(m, eye, 0.1, 4, z); }
  for (let i = -3; i <= 3; i++) m.add(boxG(-1.5, 5.6, i * 1.7, 5, 0.8, 0.8), K.dark());
  const gem = m.mesh(octa(V3(), 1.8, 1, 0.6, 1), glowM(CORE_C, 2.4)); gem.position.set(11, 6.8, 0); pulse(m, gem, 0.15, 3);
  // 肩甲 + 烟囱
  for (const s of [-1, 1]) {
    m.add(lathe(V3(4, 0, s * 13), AZ.clone().multiplyScalar(s), AX, [[0, 7], [3, 6.5], [5, 4], [5.6, 0.1]], 10, { sy: 1, sz: 0.7 }), K.brass());
    m.add(cylG(V3(-2, 4, s * 15), V3(-12, 6, s * 17), 1.6, 2, 8), K.dark());
    m.add(torusG(V3(-12, 6, s * 17), V3(-1, 0.2, 0.2 * s), 2.1, 0.5, 4, 10), K.copper());
    steam(m, V3(-13, 6.5, s * 17), V3(-1, 0, 0.3 * s).normalize(), 6, 508 + s, 1.8);
  }
  const e = gripX(m, -6, 32, 3.2, { m: K.leather(), wrap: K.iron(), rings: 4, wr: 0.7 });
  m.add(latheX([[e - 6, 4], [e, 4.2]], 6), K.iron());
  m.add(torusG(V3(e - 3, 0, 0), AX, 4.4, 0.6, 4, 12), K.brass());
  return m.finish(LEN(8), { maxW: 0.6 });
}
function edgeHW(P, x) {
  let i = 0; while (i < P.length - 2 && P[i + 1][0] < x) i++;
  const f = clamp((x - P[i][0]) / ((P[i + 1][0] - P[i][0]) || 1), 0, 1);
  return lerp(P[i][2] - P[i][1], P[i + 1][2] - P[i + 1][1], f) / 2;
}
function f509() {
  const m = new Model();
  const P = prof(14, 116, 11, hwTip(9.6, 9, 0.78));
  const o = { t: 2.4, te: 0.4 };
  m.add(bladeX(P, o), mat(0x92a6ba, { r: 0.4, m: 0.3 }));
  m.add(bladeX(inl(P, 0.42, 1), { t: 2.7, te: 1.4 }), mat(0x3a4656, { r: 0.45, m: 0.3 }));
  const ch = P.slice(0, -2).map(([x]) => V3(x, surf(P, o, x, 0) + 0.35, 0));
  const channel = m.mesh(tube(ch, 0.6, { seg: 4 }), glowM(CORE_C, 2));
  // 剑身齿轮列
  [[34, -3.2, 5, 10], [44.2, 2.4, 5, 10], [54.4, -3.2, 5, 10], [64.6, 2.4, 5, 10], [74.8, -3.2, 4, 8]].forEach(([x, z, R, N], i) => {
    gear(m, x, z, surf(P, o, x, 0) + 0.6, R, N, 1.2, i % 2 ? K.copper() : K.brass(), (i % 2 ? -1 : 1) * 1.5, { hole: 0.8, win: R > 4 ? 3 : 0, ph: i * 0.3 });
  });
  // 万向环核心
  const core = m.mesh(sph(V3(), 4.2, 1), glowM(CORE_C, 2.8)); pulse(m, core, 0.08, 3);
  const g1 = m.group(), g2 = m.group(V3(), g1), g3 = m.group(V3(), g2);
  g1.add(new THREE.Mesh(torusG(V3(), AX, 7, 0.8, 4, 24), K.brass()));
  g2.add(new THREE.Mesh(torusG(V3(), AZ, 8.8, 0.8, 4, 24), K.copper()));
  g3.add(new THREE.Mesh(torusG(V3(), AY, 10.6, 0.8, 4, 28), K.brass()));
  m.fx.push((dt, t) => { g1.rotation.x = t * 1.2; g2.rotation.z = t * 0.8; g3.rotation.y = -t * 0.5; });
  // 护手臂 + 特斯拉线圈
  for (const s of [-1, 1]) {
    m.add(boxG(0, 0, s * 15, 4, 2.4, 8), K.iron());
    for (let k = 0; k < 4; k++) m.add(torusG(V3(0, 1.6 + k * 1.1, s * 17), AY, 1.8 - k * 0.3, 0.4, 4, 10), K.copper());
    const tip = m.mesh(sph(V3(), 1.2, 1), glowM(CORE_C, 2.6)); tip.position.set(0, 6.4, s * 17); pulse(m, tip, 0.25, 9, s);
  }
  const e = gripX(m, -11, 26, 2.8, { m: K.dark(), wrap: K.brass(), rings: 4 });
  gear(m, e - 3.4, 0, 0, 4.2, 9, 2.6, K.brass(), 2, { hole: 0.8 });
  motes(m, 8, [-6, 110, -14, 14, 2, 8], CORE_C, 0.5, 509);
  return m.finish(LEN(9), { maxW: 0.55 });
}
function f510() {
  const m = new Model();
  const P = prof(20, 134, 12, hwTip(12, 11, 0.8));
  const o = { t: 2.8, te: 0.5 };
  m.add(bladeX(P, o), K.steel());
  m.add(bladeX(inl(P, 0.6, 1), { t: 3.1, te: 1.5 }), mat(0xd6a84c, { r: 0.35, m: 0.35 }));
  m.add(tube(P.slice(0, -2).map(([x]) => V3(x, surf(P, { t: 3.1, te: 1.5 }, x, 0) * 0.98 + 0.2, 0)), 0.7, { seg: 4 }), glowM(CORE_C, 2));
  for (const x of [40, 64, 88, 110]) for (const s of [-1, 1]) m.add(octa(V3(x, surf(P, o, x, s * 5.5) + 0.3, s * 5.5), 1.2, 1, 0.5, 1), glowM(CORE_O, 1.8));
  // 光环：大齿圈 + 卫星齿轮
  const ring = gear(m, 0, 0, -3, 30, 32, 2.4, K.brass(), 0.15, { hole: 24 });
  gear(m, 0, 0, -3.4, 22, 22, 1.6, K.copper(), -0.22, { hole: 17 });
  for (let i = 0; i < 4; i++) {
    const a = PI / 4 + i * PI / 2;
    gear(m, Math.cos(a) * 33, Math.sin(a) * 33, -2.2, 7, 10, 2, i % 2 ? K.copper() : K.brass(), -0.15 * 32 / 10, { hole: 1.2, win: 3, ph: i });
    const g = m.mesh(octa(V3(), 1.6, 1, 0.6, 1), glowM(i % 2 ? CORE_O : CORE_C, 2.4)); g.position.set(Math.cos(a) * 33, 0, Math.sin(a) * 33);
  }
  // 表盘
  m.add(latheY(0, 0, [[-1, 16.5], [1.6, 16.5], [2, 15]], 32, { flat: false }), K.gold());
  m.add(torusG(V3(0, 2, 0), AY, 16, 1, 4, 36), K.gold());
  clockFace(m, 0, 0, 2.1, 15, { speed: 3 });
  const hub = m.mesh(sph(V3(), 2, 1), glowM(CORE_C, 2.8)); hub.position.set(0, 3, 0); pulse(m, hub, 0.15, 3);
  // 罗马刻度上的光点
  for (let i = 0; i < 12; i += 3) { const a = i / 12 * TAU; m.add(octa(V3(Math.cos(a) * 18.5, 1, Math.sin(a) * 18.5), 1.6, 1, 0.6, 1), K.gold()); }
  // 漂浮齿轮碎片
  const r = rng(510);
  for (let i = 0; i < 5; i++) {
    const b = { x: 50 + i * 16, z: (i % 2 ? 1 : -1) * (19 + r() * 4), ph: r() * TAU };
    const g = m.mesh(gearGeo(3 + r() * 2, 8, 1, { hole: 0.8 }), i % 2 ? K.copper() : K.brass());
    m.fx.push((dt, t) => { g.position.set(b.x + Math.sin(t * 0.6 + b.ph) * 2, 3 + Math.sin(t * 1.2 + b.ph) * 2, b.z + Math.cos(t * 0.8 + b.ph) * 1.5); g.rotation.set(0.6 * Math.sin(b.ph), t * (i % 2 ? -1.5 : 1.5), 0.4); });
  }
  m.add(cylG(V3(134, 0, 0), V3(142, 0, 0), 1.2, 0.1, 6), K.gold());
  const e = gripX(m, -2, 38, 3, { m: K.dark(), wrap: K.gold(), rings: 5 });
  gear(m, e - 4, 0, 0, 5, 10, 3, K.gold(), 1.8, { hole: 1 });
  const pc = m.mesh(sph(V3(), 1.6, 1), glowM(CORE_O, 2.4)); pc.position.set(e - 4, 2, 0);
  motes(m, 10, [-30, 130, -24, 24, 2, 10], 0xffd080, 0.55, 5100);
  steam(m, V3(-30, 0, 0), V3(-1, 0, 0), 4, 5101, 1.6);
  return m.finish(LEN(10), { maxW: 0.62, maxT: 0.3 });
}

export const FORMS = {
  400: f400, 401: f401, 402: f402, 403: f403, 404: f404, 405: f405, 406: f406, 407: f407, 408: f408, 409: f409, 410: f410,
  500: f500, 501: f501, 502: f502, 503: f503, 504: f504, 505: f505, 506: f506, 507: f507, 508: f508, 509: f509, 510: f510,
};
