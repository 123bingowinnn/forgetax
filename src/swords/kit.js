// 剑形态共享工具包（色板 / 材质缓存 / 几何 helper）
// 坐标约定：剑尖 +X，剑柄 -X，原点 = 护手中心；参考图正面朝 +Y（厚度沿 Y）；参考图右侧 = +Z。
// 材质可以在各形态之间共享：核心 swords.js 在 setSwordHeat / setSwordFrenzy 时会先对每把剑 clone 材质。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE, mergeGeometries };
export const PI = Math.PI;

// ---------------------------------------------------------------------------
// 色板（对照 ref/wiki/swords/*.webp 取色；原图光照偏暗，这里是提亮后的固有色）
// ---------------------------------------------------------------------------
export const C = {
  steelBlue: 0x6f8fb8,   // 主力钢蓝剑身（2/3/4/5/33…）
  steelBlueD: 0x4d6488,  // 钢蓝暗面/倒角
  magicBlue: 0x8fb4e0,   // 魔力线/符文线的浅天蓝剑身（6/7/28…）
  magicBlueD: 0x6a8cc0,
  worn: 0x6e6e6a,        // 旧剑灰
  wornD: 0x4a4a46,
  grey: 0x8e8e8e,        // 精修剑灰
  greyD: 0x666666,
  steel: 0xa8b4c2,       // 铁剑亮钢
  steelD: 0x7c8794,
  iron: 0x4a4e57,        // 深铁灰（护手、铁条、柄头）
  ironD: 0x2c2f36,
  black: 0x18191c,       // 黑色铁条/菱形钉
  bone: 0xe6cc92,        // 米色/骨色（尖刺）
  boneD: 0xbfa070,
  gold: 0xd7a650,        // 金
  goldD: 0xa87a34,
  bronze: 0xb8743c,      // 铜/赭金（符文环、护手翼，见 29/30）
  bronzeD: 0x8a5228,
  wood: 0x7a4418,        // 木柄棕（33 系护手）
  woodD: 0x4a260c,
  leather: 0x3a2e28,     // 握柄缠绳底
  leatherL: 0x6a5444,    // 缠绳亮
  white: 0xf2f2f0,
  cyan: 0x6cfcfc,        // 青色 emissive
  orange: 0xff7a2a,      // 橙色 emissive
  purple: 0xb048ff,      // 紫水晶
  red: 0xd81c1c,         // 红宝珠
  rust: 0x8a4a22,
};

// ---------------------------------------------------------------------------
// 材质（模块级缓存）
// ---------------------------------------------------------------------------
const _matCache = new Map();
/** 标准平直着色材质。opts: { r, m, e(emissive色), ei, opacity, side, flat } */
export function mat(color, o = {}) {
  const key = JSON.stringify([color, o]);
  let m = _matCache.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    color,
    roughness: o.r ?? 0.65,
    metalness: o.m ?? 0.15,
    flatShading: o.flat ?? true,
  });
  if (o.e !== undefined) { m.emissive.set(o.e); m.emissiveIntensity = o.ei ?? 1; }
  if (o.opacity !== undefined) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = o.opacity > 0.8; }
  if (o.side !== undefined) m.side = o.side;
  _matCache.set(key, m);
  return m;
}
/** 自发光材质（Bloom 出光）。 */
export const glow = (color, ei = 2.5) => mat(color, { e: color, ei, r: 0.4, m: 0 });
/** 常用材质快捷方式 */
export const M = {
  get steelBlue() { return mat(C.steelBlue, { r: 0.55, m: 0.25 }); },
  get steelBlueD() { return mat(C.steelBlueD, { r: 0.6, m: 0.25 }); },
  get magicBlue() { return mat(C.magicBlue, { r: 0.5, m: 0.2 }); },
  get magicBlueD() { return mat(C.magicBlueD, { r: 0.55, m: 0.2 }); },
  get iron() { return mat(C.iron, { r: 0.6, m: 0.3 }); },
  get ironD() { return mat(C.ironD, { r: 0.65, m: 0.3 }); },
  get black() { return mat(C.black, { r: 0.6, m: 0.2 }); },
  get bone() { return mat(C.bone, { r: 0.7, m: 0 }); },
  get boneD() { return mat(C.boneD, { r: 0.75, m: 0 }); },
  get gold() { return mat(C.gold, { r: 0.4, m: 0.35, e: 0x2a1a04, ei: 1 }); },
  get goldD() { return mat(C.goldD, { r: 0.45, m: 0.35 }); },
  get bronze() { return mat(C.bronze, { r: 0.5, m: 0.3 }); },
  get bronzeD() { return mat(C.bronzeD, { r: 0.55, m: 0.3 }); },
  get wood() { return mat(C.wood, { r: 0.8, m: 0 }); },
  get woodD() { return mat(C.woodD, { r: 0.85, m: 0 }); },
  get leather() { return mat(C.leather, { r: 0.9, m: 0 }); },
  get leatherL() { return mat(C.leatherL, { r: 0.85, m: 0 }); },
  get white() { return mat(C.white, { r: 0.5, m: 0.1 }); },
  get cyan() { return glow(C.cyan, 1.5); },
  get orange() { return glow(C.orange, 2.2); },
  get purple() { return mat(C.purple, { r: 0.3, m: 0.1, e: 0x8020ff, ei: 1.4 }); },
  get red() { return mat(C.red, { r: 0.3, m: 0.1, e: 0xc01010, ei: 1.2 }); },
};

// ---------------------------------------------------------------------------
// 基础几何 helper（全部返回 Mesh 并已 add 到 parent）
// ---------------------------------------------------------------------------
export function add(parent, geom, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geom, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
/** 普通方块：sx 沿 X(剑长)，sy 沿 Y(厚度)，sz 沿 Z(宽度) */
export const box = (p, sx, sy, sz, m, x = 0, y = 0, z = 0) => add(p, new THREE.BoxGeometry(sx, sy, sz), m, x, y, z);

const _geoCache = new Map();
function cached(key, fn) { let g = _geoCache.get(key); if (!g) { g = fn(); _geoCache.set(key, g); } return g; }

/** 倒角方块几何（切角 b）。 */
export function bevelBoxGeom(sx, sy, sz, b = 0.004) {
  b = Math.min(b, sx / 2 - 1e-4, sy / 2 - 1e-4, sz / 2 - 1e-4);
  return cached(`bb${sx},${sy},${sz},${b}`, () => {
    const w = sx - 2 * b, d = sz - 2 * b;
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, -d / 2); sh.lineTo(w / 2, -d / 2); sh.lineTo(w / 2, d / 2); sh.lineTo(-w / 2, d / 2); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: sy - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1 });
    g.rotateX(-PI / 2);
    g.translate(0, -(sy - 2 * b) / 2, 0);
    return g;
  });
}
export const bevelBox = (p, sx, sy, sz, m, x = 0, y = 0, z = 0, b = 0.004) => add(p, bevelBoxGeom(sx, sy, sz, b), m, x, y, z);

/** 沿 X 轴的圆柱/圆锥：r1 在 +X 端，r2 在 -X 端；中心 x */
export function cylX(p, r1, len, m, x, seg = 6, r2 = r1, y = 0, z = 0) {
  const g = cached(`cx${r1},${r2},${len},${seg}`, () => { const g = new THREE.CylinderGeometry(r1, r2, len, seg, 1); g.rotateZ(-PI / 2); return g; });
  return add(p, g, m, x, y, z);
}
/** 沿 Y 轴（剑面法线）的圆柱，用于铆钉/圆饼 */
export function cylY(p, r, h, m, x, y, z, seg = 6) {
  return add(p, cached(`cy${r},${h},${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg, 1)), m, x, y, z);
}
/** 铆钉：剑面上的小凸起（y = 表面高度） */
export const rivet = (p, x, z, y, r = 0.006, m = M.iron) => cylY(p, r, r * 0.9, m, x, y + r * 0.3, z, 6);
/** 八面体宝石/菱形钉（sx 沿剑长, sy 厚, sz 宽） */
export function gem(p, sx, sy, sz, m, x = 0, y = 0, z = 0) {
  const g = cached('oct', () => new THREE.OctahedronGeometry(1, 0));
  const mesh = add(p, g, m, x, y, z);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}
/** 圆环：axis = 'x'（套在剑身上）| 'y'（平放在剑面上）| 'z' */
export function torus(p, R, r, m, axis = 'x', rs = 4, ts = 24, arc = PI * 2) {
  const g = cached(`to${R},${r},${rs},${ts},${arc},${axis}`, () => {
    const g = new THREE.TorusGeometry(R, r, rs, ts, arc);
    if (axis === 'x') g.rotateY(PI / 2);
    else if (axis === 'y') g.rotateX(PI / 2);
    return g;
  });
  return add(p, g, m);
}

/** XZ 平面多边形 → 沿 Y 挤出的板几何（居中于 y=0）。pts: [[x,z],...]，bevel>0 时带切角 */
export function plateGeom(pts, thick, bevel = 0) {
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const b = Math.min(bevel, thick / 2 - 1e-4);
  const g = new THREE.ExtrudeGeometry(sh, b > 0
    ? { depth: thick - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 1 }
    : { depth: thick, bevelEnabled: false });
  g.rotateX(-PI / 2); // (u,v,w) -> (u, w, -v)
  g.translate(0, b > 0 ? -(thick - 2 * b) / 2 : -thick / 2, 0);
  return g;
}
/** 倒角板：m 可为材质或 [面材质, 侧面材质] */
export function plate(p, pts, thick, m, y = 0, bevel = 0) {
  return add(p, plateGeom(pts, thick, bevel), m, 0, y, 0);
}

// ---------------------------------------------------------------------------
// 棱形剑身放样
// profile: [[x, halfWidth, thicknessScale]]，xsec: 上表面截面 [[zFrac(+1..-1), y]]（含 z=0），下表面镜像。
// 材质 0 = 亮面（上表面 -Z 半边 + 刃侧），1 = 暗面（上表面 +Z 半边 + 背面）。传同一个材质即可统一。
// ---------------------------------------------------------------------------
export const XS = {
  /** 菱形截面：中脊高 t，刃厚 e */
  diamond: (t, e) => [[1, e], [0, t], [-1, e]],
  /** 带中脊的斜面 */
  ridge: (t, e, f = 0.45, k = 0.85) => [[1, e], [f, t * k], [0, t], [-f, t * k], [-1, e]],
  /** 平台 + 斜刃（f = 平台占半宽比例） */
  flat: (t, e, f = 0.6) => [[1, e], [f, t], [0, t], [-f, t], [-1, e]],
};
export function loftGeom(profile, xsec, caps = true) {
  const ring = xsec.map(([z, y]) => [z, y]);
  for (let i = xsec.length - 1; i >= 0; i--) ring.push([xsec[i][0], -xsec[i][1]]);
  const n = ring.length;
  const secs = profile.map(([x, hw, ts]) => ring.map(([z, y]) => new THREE.Vector3(x, y * (ts ?? 1), z * hw)));
  const tris = [[], []];
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3();
  const tri = (a, b, c, mi, o) => {
    e1.subVectors(b, a); e2.subVectors(c, a); nn.crossVectors(e1, e2);
    if (nn.lengthSq() < 1e-16) return;
    if (nn.dot(o) < 0) { const t = b; b = c; c = t; }
    tris[mi].push(a, b, c);
  };
  for (let i = 0; i < secs.length - 1; i++) {
    const xm = (profile[i][0] + profile[i + 1][0]) / 2;
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      const a = secs[i][j], b = secs[i][j2], c = secs[i + 1][j2], d = secs[i + 1][j];
      const [z1, y1] = ring[j], [z2, y2] = ring[j2];
      const my = (y1 + y2) / 2, mz = (z1 + z2) / 2;
      let mi = 1;
      if (Math.abs(z1 - z2) < 1e-6) mi = 0;
      else if (my > 0 && mz <= 0) mi = 0;
      const out = new THREE.Vector3().add(a).add(b).add(c).add(d).multiplyScalar(0.25);
      out.x -= xm;
      tri(a, b, c, mi, out);
      tri(a, c, d, mi, out);
    }
  }
  if (caps) {
    const capAt = (k, dir) => {
      const [x, hw] = profile[k];
      if (hw <= 0) return;
      const c = new THREE.Vector3(x, 0, 0), o = new THREE.Vector3(dir, 0, 0);
      for (let j = 0; j < n; j++) tri(c, secs[k][j], secs[k][(j + 1) % n], 1, o);
    };
    capAt(0, -1);
    capAt(profile.length - 1, 1);
  }
  const pos = [];
  for (const v of tris[0]) pos.push(v.x, v.y, v.z);
  for (const v of tris[1]) pos.push(v.x, v.y, v.z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.addGroup(0, tris[0].length, 0);
  g.addGroup(tris[0].length, tris[1].length, 1);
  g.computeVertexNormals();
  return g;
}
/** 放样剑身。mA 亮面，mB 暗面（默认同 mA） */
export function blade(p, profile, xsec, mA, mB = mA) {
  return add(p, loftGeom(profile, xsec), [mA, mB]);
}
/** 剑身半宽插值 */
export function hwAt(profile, x) {
  for (let i = 0; i < profile.length - 1; i++) {
    const [x0, h0] = profile[i], [x1, h1] = profile[i + 1];
    if (x >= x0 && x <= x1) return h0 + (h1 - h0) * ((x - x0) / ((x1 - x0) || 1));
  }
  return 0;
}
/** 剑身轮廓多边形 [[x,z]] */
export function outlineOf(profile) {
  const up = profile.map(([x, hw]) => [x, hw]);
  const lo = [];
  for (let i = profile.length - 1; i >= 0; i--) if (profile[i][1] > 0) lo.push([profile[i][0], -profile[i][1]]);
  return up.concat(lo);
}

// ---------------------------------------------------------------------------
// 护手 / 握柄 / 柄头 / 尖刺
// ---------------------------------------------------------------------------
/** 一字护手：w = 总宽(Z)，d = 沿 X 厚，h = 沿 Y 高 */
export function guardBar(p, { w = 0.14, d = 0.02, h = 0.022, m = M.iron, x = 0, b = 0.003 } = {}) {
  return bevelBox(p, d, h, w, m, x, 0, 0, b);
}
/** 缠绳握柄：从 x0 向 -X 延伸 len。返回柄末端 x。rings = 缠绳圈数 */
export function grip(p, { x0 = 0, len = 0.12, r = 0.011, m = M.leather, wrap = M.leatherL, rings = 8, seg = 6 } = {}) {
  cylX(p, r, len, m, x0 - len / 2, seg);
  if (wrap && rings > 0) {
    const step = len / rings;
    for (let i = 0; i < rings; i++) {
      const ring = cylX(p, r * 1.2, step * 0.42, wrap, x0 - (i + 0.5) * step, seg);
      ring.rotation.x = 0.0;
    }
  }
  return x0 - len;
}
/** 柄头：x = 柄末端；type: 'cube' | 'diamond'（向 -X 的菱形尖）| 'cone' | 'ball' | 'gem'。返回最外端 x */
export function pommel(p, { x, type = 'cube', s = 0.024, m = M.iron, m2 = null } = {}) {
  if (type === 'cube') { bevelBox(p, s, s, s, m, x - s / 2, 0, 0, s * 0.12); return x - s; }
  if (type === 'diamond') {
    // 方颈 + 下尖锥（参考 2/3/4：柄头为倒四棱锥）
    bevelBox(p, s * 0.45, s, s, m, x - s * 0.22, 0, 0, s * 0.1);
    const g = cached(`pd${s}`, () => { const g = new THREE.ConeGeometry(s * 0.72, s * 1.1, 4, 1); g.rotateY(PI / 4); g.rotateZ(PI / 2); return g; });
    add(p, g, m2 || m, x - s * 0.45 - s * 0.55);
    return x - s * 1.55;
  }
  if (type === 'cone') { cylX(p, s * 0.6, s, m, x - s / 2, 6, 0.002); return x - s; }
  if (type === 'ball') { add(p, cached(`pb${s}`, () => new THREE.IcosahedronGeometry(s / 2, 0)), m, x - s / 2); return x - s; }
  if (type === 'gem') { gem(p, s * 0.8, s * 0.55, s * 0.55, m, x - s * 0.8); return x - s * 1.6; }
  return x;
}
/** 三角尖刺板：基底两点 a,b（[x,z]）与尖端 tip，厚 thick */
export function spike(p, a, b, tip, thick, m, y = 0, bevel = 0) {
  return plate(p, [a, tip, b], thick, m, y, bevel);
}

// ---------------------------------------------------------------------------
// 杂项
// ---------------------------------------------------------------------------
/** 确定性随机 */
export function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
/** 线框立方体几何（12 根细杆合并） */
export function wireCubeGeom(s, t) {
  return cached(`wc${s},${t}`, () => {
    const h = s / 2, gs = [];
    for (const a of [-h, h]) for (const c of [-h, h]) {
      gs.push(new THREE.BoxGeometry(s + t, t, t).translate(0, a, c));
      gs.push(new THREE.BoxGeometry(t, s + t, t).translate(a, 0, c));
      gs.push(new THREE.BoxGeometry(t, t, s + t).translate(a, c, 0));
    }
    return mergeGeometries(gs);
  });
}
/** 在剑面上排一列发光符文短划（x0→x1，z 固定，y = 表面高度） */
export function runeStrip(p, x0, x1, z, y, m = M.cyan, seed = 1, w = 0.004) {
  const r = rng(seed);
  const n = Math.max(2, Math.round((x1 - x0) / 0.03));
  // 主竖线
  box(p, x1 - x0, 0.002, w * 0.6, m, (x0 + x1) / 2, y, z);
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) * ((x1 - x0) / n);
    const len = 0.008 + r() * 0.01;
    const side = r() > 0.5 ? 1 : -1;
    box(p, w, 0.002, len, m, x, y, z + side * len / 2);
  }
}

// --- 程序化贴图（全局缓存，只读共享，不要 dispose） ---
let _galaxyTex = null, _starTex = null;
export function galaxyTexture() {
  if (_galaxyTex) return _galaxyTex;
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rnd = rng(77);
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,235,255,1)');
  grd.addColorStop(0.08, 'rgba(240,150,255,0.95)');
  grd.addColorStop(0.3, 'rgba(120,40,200,0.45)');
  grd.addColorStop(0.7, 'rgba(40,10,90,0.15)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < 1400; i++) {
      const t = Math.pow(rnd(), 0.8), r = t * S * 0.47;
      const a = arm * PI + t * 6.0 + (rnd() - 0.5) * 0.6 * (1 - t * 0.4);
      const x = S / 2 + Math.cos(a) * r + (rnd() - 0.5) * 8 * t;
      const y = S / 2 + Math.sin(a) * r + (rnd() - 0.5) * 8 * t;
      const w = 1 - t;
      g.fillStyle = `rgba(${(190 + 65 * w) | 0},${(70 + 150 * w * w) | 0},255,${0.25 + 0.6 * rnd() * (1 - t * 0.6)})`;
      const sz = 1 + rnd() * 2.6 * (1 - t * 0.5);
      g.fillRect(x, y, sz, sz);
    }
  }
  _galaxyTex = new THREE.CanvasTexture(c);
  _galaxyTex.colorSpace = THREE.SRGBColorSpace;
  return _galaxyTex;
}
export function starTexture() {
  if (_starTex) return _starTex;
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rnd = rng(31);
  g.fillStyle = '#05030a'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 5; i++) {
    const x = rnd() * S, y = rnd() * S, r = 30 + rnd() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(70,20,110,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }
  for (let i = 0; i < 260; i++) {
    const b = rnd();
    g.fillStyle = `rgba(${200 + 55 * b | 0},${200 + 40 * b | 0},255,${0.3 + 0.7 * b})`;
    const s = b > 0.92 ? 2 : 1;
    g.fillRect(rnd() * S, rnd() * S, s, s);
  }
  _starTex = new THREE.CanvasTexture(c);
  _starTex.colorSpace = THREE.SRGBColorSpace;
  _starTex.wrapS = _starTex.wrapT = THREE.RepeatWrapping;
  _starTex.repeat.set(3, 3);
  return _starTex;
}

/**
 * 收尾：填写 userData（length/bladeLength/gripLength/width/thickness）。
 * 形态函数可在 return 前调用：return finish(g, { bladeLength, gripLength, update })
 */
export function finish(group, { bladeLength, gripLength, update } = {}) {
  group.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(group);
  const ud = group.userData;
  ud.length = bb.max.x - bb.min.x;
  ud.width = bb.max.z - bb.min.z;
  ud.thickness = bb.max.y - bb.min.y;
  ud.bladeLength = bladeLength ?? Math.max(0, bb.max.x);
  ud.gripLength = gripLength ?? Math.max(0, -bb.min.x);
  if (update) ud.update = update;
  return group;
}
