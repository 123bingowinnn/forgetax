// 遗物模型共享小工具（relics3d.js 与 relics3d_b.js 共用）
// 只依赖 three；所有几何/材质均模块级缓存。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const PI = Math.PI;

// ───────── 几何缓存 ─────────
const _geo = new Map();
export function G(key, fn) {
  let g = _geo.get(key);
  if (!g) { g = fn(); _geo.set(key, g); }
  return g;
}
export const box = (w, h, d) => G(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
/** 圆角方块 */
export const rbox = (w, h, d, r = 0.03, seg = 1) => G(`rbox${w},${h},${d},${r},${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, r));
export const cyl = (rt, rb, h, s = 8, open = false, ts = 0, tl = PI * 2) =>
  G(`cyl${rt},${rb},${h},${s},${open},${ts},${tl}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, open, ts, tl));
export const cone = (r, h, s = 6) => G(`cone${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
export const sph = (r, w = 8, h = 6) => G(`sph${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
/** 部分球面（phiStart/phiLength 横向，thetaStart/thetaLength 纵向） */
export const sphPart = (r, w, h, ps, pl, ts, tl) =>
  G(`sphp${r},${w},${h},${ps},${pl},${ts},${tl}`, () => new THREE.SphereGeometry(r, w, h, ps, pl, ts, tl));
/** 竖直圆环（XY 平面，正面朝 +Z） */
export const tor = (R, r, rs = 6, ts = 12, arc = PI * 2) =>
  G(`tor${R},${r},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(R, r, rs, ts, arc));
export const oct = (r) => G(`oct${r}`, () => new THREE.OctahedronGeometry(r, 0));
export const ico = (r, d = 0) => G(`ico${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
export const dod = (r) => G(`dod${r}`, () => new THREE.DodecahedronGeometry(r, 0));
export const tet = (r) => G(`tet${r}`, () => new THREE.TetrahedronGeometry(r, 0));
export const caps = (r, l, rs = 6) => G(`cap${r},${l},${rs}`, () => new THREE.CapsuleGeometry(r, l, 2, rs));
/** 车削体：pts=[[r,y],...]，绕 Y 轴 */
export const lathe = (key, pts, seg = 10) =>
  G(`lathe${key}`, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg));
/** 水平圆环（XZ 平面），角度约定与 CylinderGeometry 一致：θ 从 +Z 起向 +X 增加 */
export const ringArc = (R, r, ts = 0, tl = PI * 2, rs = 4, seg = 12) => G(`ringArc${R},${r},${ts},${tl},${rs},${seg}`, () => {
  const g = new THREE.TorusGeometry(R, r, rs, seg, tl);
  g.rotateX(PI / 2);
  g.rotateY(ts + tl - PI / 2);
  return g;
});
/** 沿曲线的管子：pts=[[x,y,z],...] */
export const tube = (key, pts, r, seg = 32, rs = 6, closed = false) => G(`tube${key}`, () =>
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((v) => new THREE.Vector3(...v)), closed), seg, r, rs, closed));

export function shapeFromPts(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}
/** 挤出形状（Z 方向居中，正面朝 +Z）。shapeFn 返回 THREE.Shape 或点数组 */
export function ext(key, shapeFn, depth, bev = 0.02, curveSegments = 8) {
  return G(`ext${key}`, () => {
    let s = shapeFn();
    if (Array.isArray(s)) s = shapeFromPts(s);
    const g = new THREE.ExtrudeGeometry(s, {
      depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments,
    });
    g.translate(0, 0, -depth / 2);
    return g;
  });
}
/** 圆形（可带孔）挤出：圆盘/垫圈，正面 +Z */
export function disc(R, depth, hole = 0, seg = 16, bev = 0.01) {
  return ext(`disc${R},${depth},${hole},${seg},${bev}`, () => {
    const s = new THREE.Shape();
    s.absarc(0, 0, R, 0, PI * 2, false);
    if (hole > 0) { const h = new THREE.Path(); h.absarc(0, 0, hole, 0, PI * 2, true); s.holes.push(h); }
    return s;
  }, depth, bev, seg);
}

// ───────── 材质缓存 ─────────
const _mat = new Map();
let _noise = null;
/** 共享的像素颗粒噪点贴图（32×32，最近邻采样），模仿原作图标的颗粒质感 */
export function noiseTex() {
  if (_noise) return _noise;
  const N = 32, data = new Uint8Array(N * N * 4), r = rng(1234);
  for (let i = 0; i < N * N; i++) {
    const v = 218 + Math.floor(r() * 37);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  _noise = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  _noise.magFilter = THREE.NearestFilter; _noise.minFilter = THREE.NearestFilter;
  _noise.wrapS = _noise.wrapT = THREE.RepeatWrapping;
  _noise.colorSpace = THREE.SRGBColorSpace;
  _noise.needsUpdate = true;
  return _noise;
}
/**
 * 共享材质。o: r 粗糙度, m 金属度, e 自发光色, ei 自发光强度, op 不透明度, ds 双面,
 * flat 平直着色（默认平滑）, tex:false 关闭颗粒贴图
 */
export function M(color, o = {}) {
  const key = color + JSON.stringify(o);
  let m = _mat.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: o.r ?? 0.75, metalness: o.m ?? 0.1, flatShading: !!o.flat,
      map: o.tex === false || o.op !== undefined ? null : noiseTex(),
      emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1,
      transparent: o.op !== undefined, opacity: o.op ?? 1, depthWrite: o.op === undefined,
      side: o.ds ? THREE.DoubleSide : THREE.FrontSide,
    });
    _mat.set(key, m);
  }
  return m;
}
/** 发光材质简写 */
export const glow = (color, ei = 1.5, base) => M(base ?? color, { r: 0.5, e: color, ei });

// 常用色板（函数，返回共享材质）
export const C = {
  iron: () => M(0x464b52, { r: 0.6, m: 0.3 }),
  ironDark: () => M(0x2e3136, { r: 0.65, m: 0.3 }),
  steel: () => M(0xb4bac0, { r: 0.4, m: 0.35 }),
  silver: () => M(0xc4cbcc, { r: 0.35, m: 0.35 }),
  gold: () => M(0xd9a334, { r: 0.4, m: 0.35, e: 0x2a1a00 }),
  brass: () => M(0xc4914a, { r: 0.45, m: 0.3, e: 0x1a1000 }),
  copper: () => M(0xc06a36, { r: 0.45, m: 0.3, e: 0x1a0800 }),
  wood: () => M(0x8a5a32, { r: 0.85 }),
  woodDark: () => M(0x55361f, { r: 0.85 }),
  leather: () => M(0x7a4a2a, { r: 0.85 }),
  leatherDark: () => M(0x55331d, { r: 0.85 }),
  parchment: () => M(0xe6d2a0, { r: 0.9 }),
  red: () => M(0xa82222, { r: 0.6 }),
  waxRed: () => M(0x9e1616, { r: 0.45, e: 0x200000 }),
  bone: () => M(0xe2d5b2, { r: 0.8 }),
  slate: () => M(0x464c54, { r: 0.85 }),
  dark: () => M(0x24252a, { r: 0.6 }),
  white: () => M(0xe8e6e0, { r: 0.7 }),
};

// ───────── 摆放 ─────────
/** 添加部件：p(父, 几何, 材质, [x,y,z], [rx,ry,rz], 缩放(数或[sx,sy,sz])) */
export function p(parent, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], s = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  if (Array.isArray(s)) m.scale.set(s[0], s[1], s[2]); else m.scale.setScalar(s);
  parent.add(m);
  return m;
}
/** 子组 */
export function sub(parent, pos = [0, 0, 0], rot = [0, 0, 0], s = 1) {
  const g = new THREE.Group();
  g.position.set(pos[0], pos[1], pos[2]);
  g.rotation.set(rot[0], rot[1], rot[2]);
  if (Array.isArray(s)) g.scale.set(s[0], s[1], s[2]); else g.scale.setScalar(s);
  parent.add(g);
  return g;
}
/** 两点之间的细杆 */
const _up = new THREE.Vector3(0, 1, 0);
export function rod(parent, a, b, r, mat, seg = 5) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const m = new THREE.Mesh(cyl(r, r, 1, seg), mat);
  m.scale.set(1, va.distanceTo(vb), 1);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(_up, vb.clone().sub(va).normalize());
  parent.add(m);
  return m;
}
/** 折线（XY 平面，z 为表面高度），用于裂纹/刻痕 */
export function crack(parent, pts, z, w, mat) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    p(parent, box(w, 1, w), mat, [(x0 + x1) / 2, (y0 + y1) / 2, z], [0, 0, Math.atan2(x0 - x1, y1 - y0)], [1, len + w * 0.8, 1]);
  }
}
/** 可复现随机数 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** 不规则块（扰动的二十面体，半径约 1） */
export function lump(seed, amt = 0.28) {
  return G(`lump${seed},${amt}`, () => {
    const g = new THREE.IcosahedronGeometry(1, 0);
    const pos = g.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const h = Math.round(v.x * 97 + v.y * 389 + v.z * 1531 + seed * 7919);
      const k = 1 + (rng(h)() - 0.5) * 2 * amt;
      pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
    }
    g.computeVertexNormals();
    return g;
  });
}
/** 标记为动态部件（不参与合并，update 时可按 key 取到） */
export function dyn(mesh, key = 'glow') { mesh.userData.dyn = key; return mesh; }

/**
 * 原作图标常见的展示底座：深色石板 + 上面一层薄木板。返回木板顶面高度。
 * w/d 为宽/深（模型单位，常用 1.0×0.5），h 为总高。
 */
export function plinth(parent, w = 1.0, d = 0.5, h = 0.14, y = 0) {
  const hb = h * 0.62, ht = h - hb;
  p(parent, box(w, hb, d), M(0x2b2e33, { r: 0.85 }), [0, y + hb / 2, 0]);
  p(parent, box(w * 0.94, ht, d * 0.9), M(0x8a5530, { r: 0.85 }), [0, y + hb + ht / 2, 0]);
  return y + h;
}
