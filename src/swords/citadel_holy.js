// 城塞剑（8, 40, 9, 10, 11, 12）与圣剑（13, 41, 14, 15, 16, 17）——按原作渲染图 1:1 建模。
// 建模方式：先在「参考图坐标系」里搭建（像素单位：+X = 图右、+Y = 图上/剑尖、+Z = 朝向观者，
// 原点 = 护手中心），最后整体旋转成剑坐标系（剑尖 +X、正面 +Y、图右 +Z）并按目标总长缩放。
// 静态网格按材质合并以减少 draw call；动画部件（旗帜、浮石、灯笼）保持独立。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI;

// ============================================================================
// 材质（模块级缓存，可共享——核心 heat/frenzy 时会自行 clone）
// ============================================================================
const _mats = new Map();
export function mat(color, o = {}) {
  const key = [color, o.r, o.m, o.e, o.ei, o.flat, o.side, o.map && o.map.uuid, o.uv, o.op].join('|');
  let m = _mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: o.r ?? 0.72, metalness: o.m ?? 0.15,
      flatShading: o.flat ?? true,
      emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1,
      map: o.map || null, side: o.side ?? THREE.FrontSide,
    });
    if (o.op != null) { m.transparent = true; m.opacity = o.op; m.depthWrite = false; }
    if (o.uv) m.userData.triUV = o.uv; // 合并时按面法线做平面投影 UV（每 o.uv 像素一个贴图周期）
    _mats.set(key, m);
  }
  return m;
}
export const glow = (color, ei = 2.2) => mat(color, { e: color, ei, r: 0.5, m: 0 });

// ============================================================================
// 程序化贴图
// ============================================================================
function seeded(seed) {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
export const rng = seeded;

let _stoneTex = null;
export function stoneTex() {
  if (_stoneTex) return _stoneTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#8e7a5c'; x.fillRect(0, 0, 128, 128);
  const r = seeded(7), rows = 8, rh = 128 / rows;
  for (let j = 0; j < rows; j++) {
    const off = (j % 2) * 16, cols = 4, cw = 128 / cols;
    for (let i = -1; i < cols; i++) {
      const v = 0.86 + r() * 0.2;
      const R = Math.round(214 * v), G = Math.round(193 * v), B = Math.round(152 * v);
      x.fillStyle = `rgb(${R},${G},${B})`;
      x.fillRect(i * cw + off + 1.5, j * rh + 1.5, cw - 3, rh - 3);
      x.fillStyle = 'rgba(255,255,255,0.12)';
      x.fillRect(i * cw + off + 1.5, j * rh + 1.5, cw - 3, 2);
    }
  }
  for (let k = 0; k < 900; k++) { // 颗粒
    x.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.05 + r() * 0.06})`;
    x.fillRect(Math.floor(r() * 128), Math.floor(r() * 128), 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (_stoneTex = t);
}

let _bannerTex = null;
function bannerTex() {
  if (_bannerTex) return _bannerTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#2f3f6c'; x.fillRect(0, 0, 64, 160);
  x.fillStyle = '#3d5088'; x.fillRect(4, 0, 56, 160);
  x.fillStyle = '#f4f0e4';
  x.fillRect(28, 26, 8, 100); x.fillRect(14, 50, 36, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (_bannerTex = t);
}

// ============================================================================
// 几何小工具（参考图坐标系，像素单位）
// ============================================================================
const _g = new Map();
function cg(key, fn) { let g = _g.get(key); if (!g) { g = fn(); _g.set(key, g); } return g; }
const UBOX = () => cg('box', () => new THREE.BoxGeometry(1, 1, 1));

function put(p, geo, m, x = 0, y = 0, z = 0) {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  p.add(me);
  return me;
}
/** 方块：w 沿 X（图右）、h 沿 Y（图上）、d 沿 Z（朝向观者）；rz 绕 Z 旋转 */
export function box(p, w, h, d, m, x = 0, y = 0, z = 0, rz = 0) {
  const me = put(p, UBOX(), m, x, y, z);
  me.scale.set(w, h, d); me.rotation.z = rz;
  return me;
}
/** 两点之间的细杆（XY 平面内） */
export function bar(p, x0, y0, x1, y1, w, d, m, z = 0) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  return box(p, L, w, d, m, (x0 + x1) / 2, (y0 + y1) / 2, z, Math.atan2(dy, dx));
}
/** 倒角方块（石块） */
export function bbox(p, w, h, d, m, x = 0, y = 0, z = 0, b = 1.5) {
  const key = `bb${w.toFixed(1)}_${h.toFixed(1)}_${d.toFixed(1)}_${b}`;
  const geo = cg(key, () => {
    const s = new THREE.Shape(), hw = w / 2 - b, hh = h / 2 - b;
    s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, hh); s.lineTo(-hw, hh); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.1, d - 2 * b), bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 1, curveSegments: 1 });
    g.translate(0, 0, -(d - 2 * b) / 2);
    return g;
  });
  return put(p, geo, m, x, y, z);
}
/** XY 多边形挤出（沿 Z 居中于 z）。m 可为 [正反面, 侧面] */
export function ext(p, pts, depth, m, z = 0, bevel = 0) {
  const s = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.05, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 1, curveSegments: 4,
  });
  geo.translate(0, 0, z - (depth - 2 * bevel) / 2);
  return put(p, geo, m);
}
/** 竖直（Y 轴）圆柱/圆锥；rt 顶半径 rb 底半径 */
export function cyl(p, rt, rb, h, seg, m, x = 0, y = 0, z = 0) {
  const geo = cg(`cy${rt}_${rb}_${seg}`, () => new THREE.CylinderGeometry(rt, rb, 1, seg));
  const me = put(p, geo, m, x, y, z); me.scale.y = h; return me;
}
/** 朝向观者（Z 轴）的圆盘/圆柱 */
export function disc(p, r, d, seg, m, x = 0, y = 0, z = 0) {
  const geo = cg(`dz${seg}`, () => new THREE.CylinderGeometry(1, 1, 1, seg).rotateX(PI / 2));
  const me = put(p, geo, m, x, y, z); me.scale.set(r, r, d); return me;
}
/** 八面体宝石（sx 宽 sy 高 sz 厚） */
export function oct(p, sx, sy, sz, m, x = 0, y = 0, z = 0) {
  const geo = cg('oct', () => new THREE.OctahedronGeometry(0.5, 0));
  const me = put(p, geo, m, x, y, z); me.scale.set(sx, sy, sz); return me;
}
/** 圆环（默认面朝 Z） */
export function ring(p, R, r, m, x, y, z, rs = 6, ts = 12, axis = 'z') {
  const geo = cg(`tor${rs}_${ts}_${(r / R).toFixed(3)}`, () => new THREE.TorusGeometry(1, r / R, rs, ts));
  const me = put(p, geo, m, x, y, z); me.scale.setScalar(R);
  if (axis === 'x') me.rotation.y = PI / 2;
  if (axis === 'y') me.rotation.x = PI / 2;
  return me;
}
/** 锥（尖朝 dir 方向，XY 平面角度 ang；0 = +X） */
export function spikeCone(p, r, h, seg, m, x, y, z, ang, flatZ = 1) {
  const geo = cg(`cone${seg}`, () => new THREE.ConeGeometry(1, 1, seg).translate(0, 0.5, 0));
  const me = put(p, geo, m, x, y, z);
  me.scale.set(r, h, r * flatZ); me.rotation.z = ang - PI / 2;
  return me;
}
/** 缠绕握柄（竖直，y0 顶、y1 底） */
export function gripY(p, r, y0, y1, m, n = 12, seg = 8, x = 0, z = 0) {
  const pts = [new THREE.Vector2(0.001, 0)];
  for (let i = 0; i <= n * 2; i++) pts.push(new THREE.Vector2(r * (i % 2 ? 1 : 0.84), i / (n * 2)));
  pts.push(new THREE.Vector2(0.001, 1));
  const geo = cg(`grip${n}_${seg}_${r}`, () => new THREE.LatheGeometry(pts, seg));
  const me = put(p, geo, m, x, y1, z); me.scale.y = y0 - y1; return me;
}
/** 链条：从 (x,yTop) 向下 n 节 */
export function chain(p, x, yTop, n, lr, m, z = 0) {
  for (let i = 0; i < n; i++) {
    const l = ring(p, lr, lr * 0.32, m, x, yTop - lr * 0.9 - i * lr * 1.55, z, 4, 8);
    l.scale.set(lr * 0.75, lr, lr);
    if (i % 2) l.rotation.y = PI / 2;
  }
  return yTop - n * lr * 1.55;
}
/** 低多边形岩石（倒锥，尖朝下）；顶面在 yTop，尖在 yBot */
export function rockGeo(rx, rz, yTop, yBot, seed = 1, apexX = 0, seg = 7) {
  const r = seeded(seed * 13 + 3);
  const h = yTop - yBot;
  const rings = [[1.0, 0], [1.08, 0.18], [0.9, 0.45], [0.55, 0.72], [0.0, 1]];
  const pos = [];
  const V = [];
  for (let k = 0; k < rings.length; k++) {
    const [rr, t] = rings[k];
    const row = [];
    const jitterR = k === 0 ? 0.06 : 0.22;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * PI * 2 + (k % 2) * (PI / seg) + (r() - 0.5) * 0.3;
      const f = rr * (1 - jitterR / 2 + r() * jitterR);
      const yy = yTop - t * h + (k > 0 && k < rings.length - 1 ? (r() - 0.5) * h * 0.08 : 0);
      row.push(new THREE.Vector3(Math.cos(a) * rx * f + apexX * t, yy, Math.sin(a) * rz * f));
    }
    V.push(row);
  }
  const tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const top = new THREE.Vector3(0, yTop + h * 0.02, 0);
  for (let i = 0; i < seg; i++) tri(top, V[0][(i + 1) % seg], V[0][i]);
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < seg; i++) {
    const a = V[k][i], b = V[k][(i + 1) % seg], c = V[k + 1][i], d = V[k + 1][(i + 1) % seg];
    tri(a, b, d); tri(a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  return g;
}
export function rock(p, x, y, z, rx, rz, yTop, yBot, m, seed, apexX = 0) {
  return put(p, rockGeo(rx, rz, yTop, yBot, seed, apexX), m, x, y, z);
}

// ============================================================================
// 合并 & 转换为剑坐标
// ============================================================================
function planarUV(g, scale) {
  const P = g.attributes.position, n = P.count;
  const uv = new Float32Array(n * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2);
    nn.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    const ax = Math.abs(nn.x), ay = Math.abs(nn.y), az = Math.abs(nn.z);
    for (let k = 0; k < 3; k++) {
      const v = k === 0 ? a : k === 1 ? b : c;
      let u, w;
      if (ay >= ax && ay >= az) { u = v.x; w = v.z; } else if (ax >= az) { u = v.z; w = v.y; } else { u = v.x; w = v.y; }
      uv[(i + k) * 2] = u / scale; uv[(i + k) * 2 + 1] = w / scale;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function bakeStatic(model) {
  model.updateMatrixWorld(true);
  const inv = model.matrixWorld.clone().invert();
  const rel = new THREE.Matrix4();
  const buckets = new Map();
  const remove = [];
  const subs = [];
  const visit = (o) => {
    if (o !== model && o.userData.dyn) { if (!o.isMesh) subs.push(o); return; }
    if (o.isMesh) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      let g0 = o.geometry;
      const groups = Array.isArray(o.material) && g0.groups.length ? g0.groups : [{ start: 0, count: Infinity, materialIndex: 0 }];
      for (const grp of groups) {
        let g = g0.index ? g0.toNonIndexed() : g0.clone();
        if (Array.isArray(o.material)) {
          const start = grp.start, count = Math.min(grp.count, g.attributes.position.count - start);
          const sub = new THREE.BufferGeometry();
          for (const nm of ['position', 'normal', 'uv']) {
            const at = g.attributes[nm]; if (!at) continue;
            sub.setAttribute(nm, new THREE.BufferAttribute(at.array.slice(start * at.itemSize, (start + count) * at.itemSize), at.itemSize));
          }
          g = sub;
        }
        for (const nm of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(nm)) g.deleteAttribute(nm);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        if (!g.attributes.normal) g.computeVertexNormals();
        rel.multiplyMatrices(inv, o.matrixWorld);
        g.applyMatrix4(rel);
        if (rel.determinant() < 0) { // 镜像：翻转三角形绕序
          for (const nm of ['position', 'normal', 'uv']) {
            const at = g.attributes[nm], s = at.itemSize, arr = at.array;
            for (let i = 0; i < at.count; i += 3) for (let k = 0; k < s; k++) {
              const t = arr[(i + 1) * s + k]; arr[(i + 1) * s + k] = arr[(i + 2) * s + k]; arr[(i + 2) * s + k] = t;
            }
          }
        }
        g.clearGroups();
        const m = mats[grp.materialIndex] || mats[0];
        if (m.userData.triUV) planarUV(g, m.userData.triUV);
        if (!buckets.has(m)) buckets.set(m, []);
        buckets.get(m).push(g);
      }
      remove.push(o);
    }
    for (const c of o.children) visit(c);
  };
  visit(model);
  for (const o of remove) o.parent.remove(o);
  // 清理空组
  const prune = (o) => { for (const c of [...o.children]) { prune(c); if (!c.isMesh && !c.userData.dyn && c.children.length === 0) o.remove(c); } };
  prune(model);
  for (const [m, gs] of buckets) {
    const merged = mergeGeometries(gs, false);
    const me = new THREE.Mesh(merged, m);
    me.castShadow = true; me.receiveShadow = true;
    model.add(me);
  }
  for (const sg of subs) bakeStatic(sg);
}

const _basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0));
/**
 * model：参考图坐标系下搭建的组。L：目标总长（米）。
 * 返回剑坐标系的根组，并填好 userData。
 */
export function finishForm(model, L, opts = {}) {
  bakeStatic(model);
  model.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(model);
  const s = L / (bb.max.y - bb.min.y);
  const zc = opts.centerZ !== false ? (bb.max.z + bb.min.z) / 2 : 0;
  const inner = new THREE.Group();
  inner.add(model);
  model.position.z = -zc;
  inner.scale.setScalar(s);
  if (opts.squeeze) inner.scale.x *= opts.squeeze; // 宽度方向（图 X）压缩
  inner.quaternion.setFromRotationMatrix(_basis);
  const root = new THREE.Group();
  root.add(inner);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const ud = root.userData;
  ud.length = L;
  ud.bladeLength = bb.max.y * s;
  ud.gripLength = -bb.min.y * s;
  ud.width = (bb.max.x - bb.min.x) * s * (opts.squeeze || 1);
  ud.thickness = (bb.max.z - bb.min.z) * s;
  ud.pxScale = s;
  if (opts.update) ud.update = opts.update;
  return root;
}

// ============================================================================
// 通用动画部件
// ============================================================================
/** 飘动的旗帜：x0..x1 宽，yTop 顶，yBot 底（V 形尖角的底），z 前后位置 */
export function banner(p, anims, x0, x1, yTop, yBot, z, phase = 0, notch = 0.18) {
  const cols = 4, rows = 8;
  const w = x1 - x0, h = yTop - yBot;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const u = i / cols, v = j / rows;
    let y = yTop - v * h;
    if (j === rows) y = yBot + h * notch * Math.abs(u - 0.5) * 2; // 底边 V 形
    else y = yTop - v * (h * (1 - notch)) - (j / rows) * 0 ;
    if (j === rows) y = yBot + h * notch * Math.abs(u - 0.5) * 2;
    pos.push(x0 + u * w, y, 0); uv.push(u, 1 - (yTop - y) / h);
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = mat(0xffffff, { map: bannerTex(), side: THREE.DoubleSide, flat: false, r: 0.85, m: 0 });
  const me = new THREE.Mesh(g, m);
  me.position.z = z; me.userData.dyn = true;
  p.add(me);
  // 顶部横杆
  box(p, w + 4, 2.2, 2.2, mat(0x2a2420), (x0 + x1) / 2, yTop + 1, z);
  const base = Float32Array.from(pos);
  const P = g.attributes.position;
  anims.push((dt, t) => {
    for (let k = 0; k < P.count; k++) {
      const yy = base[k * 3 + 1], xx = base[k * 3];
      const v = (yTop - yy) / h;
      P.setZ(k, Math.sin(t * 2.2 + phase + v * 3.2 + (xx - x0) / w * 1.5) * v * w * 0.07);
      P.setX(k, xx + Math.sin(t * 1.7 + phase + v * 2.0) * v * w * 0.025);
    }
    P.needsUpdate = true;
    g.computeVertexNormals();
  });
  return me;
}

/** 链子 + 灯笼（发光），可轻微摆动 */
export function lantern(p, anims, x, yTop, chainN, z, s = 1, phase = 0) {
  const grp = new THREE.Group(); grp.position.set(x, yTop, z); grp.userData.dyn = true; p.add(grp);
  const dark = mat(0x25221f, { r: 0.6 });
  const yc = chain(grp, 0, 0, chainN, 2.4 * s, dark, 0);
  box(grp, 6 * s, 1.6 * s, 6 * s, dark, 0, yc - 0.8 * s, 0);
  box(grp, 4.6 * s, 8 * s, 4.6 * s, glow(0xffb040, 2.6), 0, yc - 5.6 * s, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(grp, 1 * s, 8 * s, 1 * s, dark, sx * 2.6 * s, yc - 5.6 * s, sz * 2.6 * s);
  box(grp, 6 * s, 1.6 * s, 6 * s, dark, 0, yc - 10.4 * s, 0);
  oct(grp, 3 * s, 3 * s, 3 * s, dark, 0, yc - 11.8 * s, 0);
  anims.push((dt, t) => { grp.rotation.z = Math.sin(t * 1.3 + phase) * 0.06; });
  return grp;
}

// ============================================================================
// 城塞剑：共用部件
// ============================================================================
const CM = {
  plate: () => mat(0x343d50, { r: 0.55, m: 0.3 }),
  plateSide: () => mat(0x7a4a2c, { r: 0.6, m: 0.25 }),
  band: () => mat(0x1b1e24, { r: 0.55, m: 0.3 }),
  copper: () => mat(0xa8623a, { r: 0.5, m: 0.3 }),
  trim: () => mat(0xd9c99a, { r: 0.4, m: 0.3 }),
  silver: () => mat(0xc4cad2, { r: 0.4, m: 0.3 }),
  inset: () => mat(0x191c21, { r: 0.7 }),
  glowO: () => glow(0xff9a20, 1.25),
  gripW: () => mat(0x6a4a34, { r: 0.85, m: 0 }),
  pommel: () => mat(0xa9b1bc, { r: 0.45, m: 0.3 }),
  dark: () => mat(0x2c3038, { r: 0.6, m: 0.25 }),
  stone: () => mat(0xffffff, { map: stoneTex(), uv: 64, r: 0.9, m: 0 }),
  stoneB: () => mat(0xd2bd96, { r: 0.85, m: 0 }),
  stoneB2: () => mat(0xc1a87e, { r: 0.85, m: 0 }),
  plaster: () => mat(0xd8c6a2, { r: 0.85, m: 0 }),
  timber: () => mat(0x4a2e1e, { r: 0.8, m: 0 }),
  roof: () => mat(0x8a3a28, { r: 0.75, m: 0 }),
  roofD: () => mat(0x5a261a, { r: 0.75, m: 0 }),
  rock: () => mat(0x92959a, { r: 0.92, m: 0 }),
  rockD: () => mat(0x74777d, { r: 0.92, m: 0 }),
  win: () => glow(0xffa634, 1.05),
  wood: () => mat(0x6e4c36, { r: 0.85, m: 0 }),
  woodD: () => mat(0x3e2a1e, { r: 0.85, m: 0 }),
  green: () => mat(0x4f7a3a, { r: 0.85, m: 0 }),
};

/** 城塞家族的护手 + 握柄 + 锥形柄头。gw 护手宽，gy0 柄顶，gy1 柄底，pEnd 柄头尖 */
function citadelHilt(p, gw, gh, gd, gy1, pEnd, gr = 9) {
  box(p, gw, gh, gd, CM.dark(), 0, 0, 0);
  box(p, gw, 2.2, gd + 0.4, CM.copper(), 0, gh / 2 + 0.6, 0);
  box(p, gw * 0.55, 3, gd * 0.8, CM.dark(), 0, -gh / 2 - 1.5, 0);
  gripY(p, gr, -gh / 2 - 3, gy1 + 3, CM.gripW(), 12);
  cyl(p, gr * 1.15, gr * 1.15, 4, 8, CM.dark(), 0, gy1 + 2, 0);
  const pm = cyl(p, gr * 1.35, 0.01, gy1 - pEnd, 6, CM.pommel(), 0, (gy1 + pEnd) / 2, 0);
  return pm;
}

/** 铁板（尖顶），中心 (cx)，半宽 hw，yb 底、ye 檐、ya 顶点，厚 t */
function ironPlate(p, cx, hw, yb, ye, ya, t) {
  const pts = [[cx - hw, yb], [cx + hw, yb], [cx + hw, ye], [cx, ya], [cx - hw, ye]];
  ext(p, pts, t, [CM.plate(), CM.plateSide()], 0, 0.8);
  const z = t / 2 + 0.3, tr = CM.trim();
  box(p, 2.2, ye - yb, 1.2, tr, cx - hw + 1.1, (yb + ye) / 2, z);
  box(p, 2.2, ye - yb, 1.2, tr, cx + hw - 1.1, (yb + ye) / 2, z);
  bar(p, cx - hw + 0.5, ye, cx, ya - 0.5, 2.2, 1.2, tr, z);
  bar(p, cx + hw - 0.5, ye, cx, ya - 0.5, 2.2, 1.2, tr, z);
}
function bandRow(p, cx, w, y, z, rivets = true) {
  box(p, w, 10, 3.5, CM.band(), cx, y, z);
  if (rivets) for (const s of [-1, 1]) {
    disc(p, 2.4, 1.6, 6, CM.copper(), cx + s * (w / 2 - 6), y + 1, z + 2);
  }
}
function glowSlot(p, cx, y0, y1, z, iw = 18) {
  box(p, iw, y1 - y0 + 6, 1.2, CM.inset(), cx, (y0 + y1) / 2, z);
  box(p, 4.6, y1 - y0, 2.0, CM.glowO(), cx, (y0 + y1) / 2, z + 0.6);
}

// ---------------------------------------------------------------------------
// 8 这把巨剑不太对劲：带尖顶的铁板 + 铁箍 + 发光竖槽 + 左侧链条
// ---------------------------------------------------------------------------
function form8() {
  const g = new THREE.Group(), T = 16, z = T / 2 + 0.6;
  ironPlate(g, 0, 50, 13, 185, 224, T);
  for (const y of [180, 130, 81, 31]) bandRow(g, 0, 108, y, z + 1);
  glowSlot(g, 0, 55, 148, z);
  for (const y of [158, 105, 56]) for (const s of [-1, 1]) box(g, 2, 2, 1, CM.silver(), s * 40, y + 9, z);
  for (const y of [158, 105, 56]) for (const s of [-1, 1]) box(g, 2, 2, 1, CM.silver(), s * 40, y - 9, z);
  // 左侧合页 + 链条
  for (const y of [148, 104, 56]) box(g, 5, 14, T * 0.8, CM.band(), -52.5, y, 0);
  ring(g, 3, 1, CM.dark(), -58, 186, 2);
  chain(g, -60, 215, 5, 3.2, CM.dark(), 4);
  // 支柱 + 护手
  for (const s of [-1, 1]) box(g, 6, 9, 9, CM.dark(), s * 9, 8.5, 0);
  citadelHilt(g, 52, 10, 18, -73, -94);
  return finishForm(g, 1.0);
}

// ---------------------------------------------------------------------------
// 40 双层铁板巨剑：两块并排的尖顶铁板 + 铜横杆
// ---------------------------------------------------------------------------
function form40() {
  const g = new THREE.Group(), T = 16, z = T / 2 + 0.6;
  for (const cx of [-36, 36]) {
    ironPlate(g, cx, 36, 17, 202, 240, T);
    for (const y of [165, 122, 77, 33]) bandRow(g, cx, 74, y, z + 1);
    glowSlot(g, cx, 57, 138, z, 16);
    for (const y of [146, 100, 56]) for (const s of [-1, 1]) box(g, 2, 2, 1, CM.silver(), cx + s * 27, y, z);
  }
  for (const y of [172, 111, 52]) box(g, 96, 3, 3, CM.copper(), 0, y, z + 4);
  for (const y of [150, 95, 45]) box(g, 5, 14, T * 0.8, CM.band(), -73.5, y, 0);
  chain(g, -66, 178, 4, 2.8, CM.dark(), z + 1);
  for (const s of [-1, 1]) box(g, 6, 12, 9, CM.dark(), s * 9, 10, 0);
  citadelHilt(g, 50, 10, 18, -56, -77);
  return finishForm(g, 1.08);
}

// ---------------------------------------------------------------------------
// 9 被扯下门轴的城门：石拱门 + 木门 + 铁格栅 + 旗帜
// ---------------------------------------------------------------------------
function form9() {
  const g = new THREE.Group(), anims = [];
  const r = seeded(9);
  const D = 30;
  // 门洞：矩形 + 椭圆拱
  const hw = 49, ys = 180, ry = 34, y0 = 21;
  const arch = [];
  arch.push([-hw, y0], [hw, y0]);
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * PI; arch.push([Math.cos(a) * hw, ys + Math.sin(a) * ry]); }
  ext(g, arch, 6, CM.wood(), -6, 0);
  for (let x = -40; x <= 40; x += 10) box(g, 1.2, 190, 1, CM.woodD(), x + 5, 110, -2.6);
  // 门内暗色背板（门洞侧壁）
  // 铁格栅
  const iron = mat(0x202328, { r: 0.45, m: 0.35 });
  const topAt = (x) => ys + ry * Math.sqrt(Math.max(0, 1 - (x / hw) ** 2));
  for (let x = -44; x <= 44.1; x += 11) {
    const yt = topAt(x) - 1;
    box(g, 4.6, yt - y0, 4, iron, x, (yt + y0) / 2, 1.5);
  }
  for (let y = 33; y <= 200; y += 21) {
    const xw = y < ys ? hw : hw * Math.sqrt(Math.max(0, 1 - ((y - ys) / ry) ** 2));
    if (xw < 6) continue;
    box(g, xw * 2 - 1, 4.6, 4, iron, 0, y, 4.5);
  }
  box(g, 22, 8, 3, iron, -2, 119, 6.5);
  ring(g, 4, 1, CM.copper(), 0, 104, 6.5, 4, 10);
  for (const s of [-1, 1]) chain(g, s * 46, 158, 5, 2.6, iron, 7);
  // 两侧石柱（错缝石块）
  const sb = [CM.stoneB(), CM.stoneB2()];
  let k = 0;
  for (let y = y0 + 10; y < ys + 5; y += 20) {
    for (const s of [-1, 1]) {
      const wide = (k + (s > 0 ? 1 : 0)) % 2 === 0;
      const w = wide ? 40 : 32;
      const x = s * (hw + w / 2 - (wide ? 1 : 0));
      bbox(g, w + r() * 3, 19, D + r() * 2, sb[(k + (s > 0)) % 2], x + (r() - 0.5) * 2, y, (r() - 0.5) * 2, 2);
    }
    k++;
  }
  // 拱券石
  const nv = 9;
  for (let i = 0; i < nv; i++) {
    const a = PI - (i + 0.5) / nv * PI;
    const ex = Math.cos(a) * (hw + 12), ey = ys + Math.sin(a) * (ry + 12);
    const nrm = Math.atan2(Math.sin(a) * hw, Math.cos(a) * ry);
    const m = bbox(g, 24, 17, D, sb[i % 2], ex, ey, (r() - 0.5) * 2, 2);
    m.rotation.z = nrm - PI / 2 + PI / 2 + (r() - 0.5) * 0.08;
  }
  // 拱肩填充
  for (const s of [-1, 1]) bbox(g, 26, 26, D - 2, sb[1], s * 70, 200, -1, 2);
  // 顶部大块帽石
  const caps = [[-52, 233, 30, 26, -0.08], [-17, 240, 36, 26, 0.03], [20, 236, 34, 26, -0.04], [55, 230, 32, 26, 0.07]];
  for (const [x, y, w, h, rz] of caps) { const m = bbox(g, w, h, D + 4, CM.stoneB(), x, y, 0, 3); m.rotation.z = rz; }
  // 侧面突出的灰色碎石
  const rk = CM.rock();
  for (const [x, y, s] of [[-91, 182, 9], [-93, 117, 8], [-90, 70, 9], [-92, 40, 8], [92, 180, 8], [93, 118, 9], [90, 66, 8], [91, 36, 9]]) {
    const m = put(g, cg('dode', () => new THREE.DodecahedronGeometry(1, 0)), rk, x, y, 0);
    m.scale.set(s, s * 0.8, s * 1.2); m.rotation.set(r() * 3, r() * 3, r() * 3);
  }
  // 门槛（铁）
  box(g, 140, 11, D + 6, iron, 0, 15.5, 0);
  box(g, 140, 1.5, D + 6.4, mat(0x4a4f58, { m: 0.3 }), 0, 21.4, 0);
  // 旗帜
  banner(g, anims, 55, 80, 178, 70, D / 2 + 3, 0.5, 0.16);
  // 护手
  box(g, 18, 9, 10, iron, 0, 7, 0);
  citadelHilt(g, 38, 7, 16, -50, -67, 7);
  return finishForm(g, 1.02, { update: (dt, t) => anims.forEach(f => f(dt, t)) });
}

// ============================================================================
// 城堡部件（10/11/12）
// ============================================================================
/** 窗户：发光底 + 深色十字窗棂 + 窗框 */
function windowAt(p, x, y, z, w = 7, h = 10, cross = true) {
  box(p, w + 2.4, h + 2.4, 1, CM.timber(), x, y, z);
  box(p, w, h, 1.4, CM.win(), x, y, z + 0.2);
  if (cross) {
    box(p, 1.1, h, 1.8, CM.timber(), x, y, z + 0.4);
    box(p, w, 1.1, 1.8, CM.timber(), x, y + h * 0.12, z + 0.4);
  }
}
/** 圆塔：中心 (x,z)，y0..y1 墙体，半径 r；红色锥顶高 rh；windows: [y...] */
function tower(p, x, z, y0, y1, r, rh, wins = [], o = {}) {
  const st = CM.stone();
  cyl(p, r, r, y1 - y0, 8, st, x, (y0 + y1) / 2, z);
  // 顶部挑檐
  cyl(p, r * 1.12, r * 1.02, 5, 8, st, x, y1 - 2.5, z);
  const rr = r * (o.roofR ?? 1.2);
  cyl(p, 0.01, rr, rh, 8, CM.roof(), x, y1 + rh / 2, z);
  cyl(p, rr * 1.02, rr * 1.04, 2, 8, CM.roofD(), x, y1 + 1, z);
  cyl(p, 0.4, 0.8, 7, 4, CM.dark(), x, y1 + rh + 3, z);
  for (const wy of wins) windowAt(p, x + (o.wx ?? 0), wy, z + r * 0.95, 6, 9);
  // 侧面小方窗/石块突起
  if (o.studs !== false) for (const wy of wins) for (const s of [-1, 1]) box(p, 3, 6, 4, CM.stoneB2(), x + s * r * 0.92, wy + 4, z + r * 0.35);
}
/** 山墙小屋：x0..x1，墙 y0..ye，山尖 ya，z0..z1（前面 = z1）；正面山墙朝 +Z */
function house(p, x0, x1, y0, ye, ya, z0, z1, wins = [], o = {}) {
  const cx = (x0 + x1) / 2, w = x1 - x0, d = z1 - z0, zc = (z0 + z1) / 2;
  const wallM = o.stone ? CM.stone() : CM.plaster();
  ext(p, [[x0, y0], [x1, y0], [x1, ye], [cx, ya], [x0, ye]], d, wallM, zc, 0);
  // 木构框
  const tm = CM.timber(), zf = z1 + 0.4;
  if (o.timber !== false) {
    box(p, 2, ye - y0, 1.2, tm, x0 + 1, (y0 + ye) / 2, zf);
    box(p, 2, ye - y0, 1.2, tm, x1 - 1, (y0 + ye) / 2, zf);
    box(p, w, 2, 1.2, tm, cx, ye, zf);
    if (o.midBeam) box(p, w, 2, 1.2, tm, cx, o.midBeam, zf);
    if (o.xBrace) for (const [bx0, by0, bx1, by1] of o.xBrace) { bar(p, bx0, by0, bx1, by1, 1.6, 1.2, tm, zf); bar(p, bx0, by1, bx1, by0, 1.6, 1.2, tm, zf); }
  }
  // 屋顶两坡（沿 Z 延伸）
  const ov = o.overhang ?? 3, th = 3;
  for (const s of [-1, 1]) {
    const ex = s < 0 ? x0 - ov * 0.8 : x1 + ov * 0.8, ey = ye - ov * (ya - ye) / (w / 2) * 0.8;
    const L = Math.hypot(cx - ex, ya - ey);
    const ang = Math.atan2(ya - ey, cx - ex);
    const m = box(p, L + 1.5, th, d + 4, o.roofM || CM.roof(), (ex + cx) / 2 - Math.sin(ang) * th * 0.5 * -1 * 0, (ey + ya) / 2 + th * 0.5, zc, ang);
    // 前沿檐板
    bar(p, ex, ey, cx, ya, 2.2, 1.6, CM.roofD(), z1 + 2.2);
    void m;
  }
  for (const [wx, wy, ww, wh] of wins) windowAt(p, wx, wy, z1 + 0.6, ww || 7, wh || 10);
  if (o.chimney) { const [chx, chy] = o.chimney; box(p, 5, 12, 5, CM.stoneB2(), chx, chy, zc - d * 0.2); }
}
/** 城墙（带垛口）：x0..x1、y0..y1、z0..z1 */
function wall(p, x0, x1, y0, y1, z0, z1, o = {}) {
  const st = CM.stone();
  box(p, x1 - x0, y1 - y0, z1 - z0, st, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  if (o.merlons !== false) {
    const n = Math.max(2, Math.round((x1 - x0) / 11));
    const step = (x1 - x0) / n;
    for (let i = 0; i < n; i += 1) if (i % 2 === 0)
      box(p, step * 0.9, 6, 5, st, x0 + step * (i + 0.5), y1 + 3, z1 - 2.5);
  }
  // 沿口
  box(p, x1 - x0 + 2, 2.5, z1 - z0 + 2, CM.stoneB2(), (x0 + x1) / 2, y1 - 1, (z0 + z1) / 2);
}
function stairs(p, x0, x1, y0, y1, z, n = 5) {
  const h = (y1 - y0) / n;
  for (let i = 0; i < n; i++) bbox(p, x1 - x0 - i * 1.5, h, 10 + (n - i) * 3, i % 2 ? CM.stoneB() : CM.stoneB2(), (x0 + x1) / 2 + i * 0.7, y0 + h * (i + 0.5), z, 1);
}
function bracket(p, x0, x1, y, z, sx, sy) {
  box(p, x1 - x0, 3, 12, CM.timber(), (x0 + x1) / 2, y, z);
  bar(p, sx, sy, x1 - 6, y - 1, 2.4, 2.4, CM.timber(), z);
}
function floatRock(p, anims, x, y, z, s, seed) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.userData.dyn = true; p.add(grp);
  put(grp, rockGeo(s, s * 0.8, s * 0.35, -s * 0.6, seed, 0, 5), CM.rock());
  const ph = seed * 1.7;
  anims.push((dt, t) => { grp.position.y = y + Math.sin(t * 1.1 + ph) * 2.2; grp.rotation.y = t * 0.25 + ph; });
}
function bush(p, x, y, z, s) {
  const m = put(p, cg('ico', () => new THREE.IcosahedronGeometry(1, 0)), CM.green(), x, y, z); m.scale.set(s, s, s);
}

// ---------------------------------------------------------------------------
// 10 带把手的要塞
// ---------------------------------------------------------------------------
function form10() {
  const g = new THREE.Group(), anims = [];
  // 底部（握把上方）的小屋 = 剑格
  house(g, -32, 10, 14, 81, 97, -14, 14, [[-20, 58], [0, 58], [-20, 36], [0, 36], [-11, 88, 5, 6]],
    { midBeam: 47, xBrace: [[-30, 16, -12, 46], [-10, 16, 8, 46]] });
  box(g, 14, 12, 14, CM.dark(), -6, 7, 0);
  // 平台下的岩石
  rock(g, -18, 0, -12, 34, 16, 122, 58, CM.rock(), 3, 6);
  // 平台城墙
  wall(g, -57, 60, 117, 151, -24, 14);
  // 塔楼
  tower(g, 37, -8, 112, 218, 22, 40, [128, 160, 190]);
  tower(g, -36, -10, 140, 198, 19, 38, [160, 182]);
  tower(g, 8, -24, 150, 231, 15, 32, [205, 222], { studs: false });
  // 中央山墙屋
  house(g, -32, 25, 151, 178, 203, -14, 10, [[-20, 160], [12, 160], [-4, 186, 6, 8]], { stone: true, overhang: 4 });
  // 右下两座小屋 + 木支架 + 灯笼
  house(g, 10, 43, 75, 110, 121, -8, 12, [[20, 96, 6, 8], [33, 96, 6, 8], [27, 84, 6, 7]], { midBeam: 90 });
  house(g, 42, 78, 75, 110, 123, -12, 8, [[54, 96, 6, 8], [67, 96, 6, 8], [61, 84, 6, 7]], { midBeam: 90, chimney: [71, 124] });
  bracket(g, 24, 84, 72.5, 0, 26, 46);
  lantern(g, anims, 38, 70, 2, 4, 0.9, 1.3);
  // 左侧旗帜 + 灯笼
  banner(g, anims, -50, -27, 171, 106, 17, 0.2, 0.18);
  lantern(g, anims, -53, 96, 5, 10, 1.0, 0.4);
  bush(g, -50, 154, 10, 3); bush(g, 50, 152, 12, 2.5);
  citadelHilt(g, 30, 8, 14, -39, -56, 7);
  return finishForm(g, 1.15, { update: (dt, t) => anims.forEach(f => f(dt, t)) });
}

// ---------------------------------------------------------------------------
// 11 碾山城塞：悬浮巨岩上的城堡
// ---------------------------------------------------------------------------
function form11() {
  const g = new THREE.Group(), anims = [];
  rock(g, 6, 0, -12, 70, 24, 136, 8, CM.rock(), 11, -6);
  rock(g, -38, 0, -4, 26, 14, 120, 60, CM.rockD(), 5, 4);
  rock(g, 50, 0, -4, 24, 14, 118, 70, CM.rockD(), 6, -4);
  wall(g, -78, 75, 133, 168, -26, 16);
  tower(g, 46, -10, 120, 230, 24, 40, [140, 172, 202]);
  tower(g, -47, -8, 150, 218, 22, 37, [178, 200]);
  tower(g, 12, -26, 160, 243, 17, 32, [212, 230], { studs: false });
  house(g, -50, 20, 168, 195, 225, -14, 10, [[-36, 178, 8, 11], [-12, 178, 8, 11], [6, 178, 8, 11], [-15, 205, 6, 8]], { stone: true, overhang: 5 });
  // 岩壁上的小屋 + 台阶
  house(g, -65, -35, 88, 120, 128, 4, 18, [[-56, 108, 6, 8], [-44, 108, 6, 8], [-50, 95, 6, 7]], { midBeam: 101, timber: true });
  house(g, 17, 47, 98, 126, 133, 4, 18, [[26, 116, 6, 8], [38, 116, 6, 8], [32, 104, 6, 7]], { midBeam: 109 });
  stairs(g, -57, -33, 43, 86, 10, 5);
  banner(g, anims, -15, 16, 168, 65, 24, 0.0, 0.14);
  for (const [x, y, z, s, sd] of [[-100, 130, 0, 10, 1], [103, 167, 0, 9, 2], [72, 73, 8, 11, 3], [-48, 28, 6, 12, 4]]) floatRock(g, anims, x, y, z, s, sd);
  for (const [x, y, n, ph] of [[-93, 160, 5, 0], [-73, 116, 5, 1], [60, 116, 4, 2], [37, 76, 5, 3]]) lantern(g, anims, x, y, n, 8, 1.0, ph);
  bush(g, -76, 170, 8, 3); bush(g, 72, 170, 10, 3);
  citadelHilt(g, 26, 7, 12, -35, -43, 5);
  return finishForm(g, 1.2, { squeeze: 0.76, update: (dt, t) => anims.forEach(f => f(dt, t)) });
}

// ---------------------------------------------------------------------------
// 12 裂陆钢铁城塞：两座浮岛 + 拱桥 + 三面旗帜
// ---------------------------------------------------------------------------
function form12() {
  const g = new THREE.Group(), anims = [];
  // 主岩
  rock(g, 20, 0, -12, 62, 24, 114, -6, CM.rock(), 21, -8);
  rock(g, -32, 0, -6, 26, 14, 100, 40, CM.rockD(), 22, 2);
  rock(g, 62, 0, -6, 24, 14, 100, 46, CM.rockD(), 23, -4);
  wall(g, -52, 78, 112, 140, -24, 14);
  // 主城
  tower(g, 61, -8, 120, 215, 19, 33, [150, 175, 200]);
  tower(g, -22, -6, 140, 185, 18, 26, [160]);
  house(g, -10, 40, 140, 160, 178, -12, 12, [[0, 150, 6, 8], [15, 150, 6, 8], [30, 150, 6, 8], [15, 168, 5, 6]], { stone: true });
  house(g, -2, 28, 160, 182, 196, -20, -2, [[13, 186, 5, 6], [5, 172, 6, 7], [21, 172, 6, 7]], { stone: true });
  // 拱桥（左浮岛 → 右塔）
  const st = CM.stone();
  box(g, 96, 6, 14, st, -3, 214, -14);
  for (const x of [-48, -24, 18, 40]) box(g, 8, 32, 12, st, x, 195, -14);
  { const a = ring(g, 1, 0.16, st, -36, 198, -14, 4, 10); a.scale.set(8, 9, 6); }
  { const a = ring(g, 1, 0.12, st, -3, 196, -14, 4, 14); a.scale.set(19, 18, 6); }
  { const a = ring(g, 1, 0.16, st, 29, 198, -14, 4, 10); a.scale.set(8, 9, 6); }
  box(g, 96, 1.4, 1.4, CM.dark(), -3, 224, -8);
  for (let x = -48; x <= 42; x += 9) box(g, 1.2, 6, 1.2, CM.dark(), x, 220, -8);
  // 拱桥中部尖塔
  cyl(g, 0.01, 6, 10, 8, CM.roof(), 10, 223, -16);
  // 左上浮岛
  rock(g, -77, 0, -10, 36, 18, 212, 140, CM.rock(), 24, 6);
  wall(g, -112, -42, 205, 218, -20, 8, { merlons: false });
  tower(g, -87, -10, 210, 255, 15, 25, [230, 245]);
  tower(g, -54, -12, 212, 250, 12, 20, [236], { studs: false });
  house(g, -88, -60, 218, 238, 248, -4, 10, [[-80, 228, 5, 7], [-68, 228, 5, 7]], { midBeam: 223 });
  // 左下小屋 + 台阶
  house(g, -57, -30, 82, 106, 114, 2, 16, [[-50, 96, 6, 8], [-38, 96, 6, 8], [-44, 86, 6, 6]], { midBeam: 90 });
  stairs(g, -52, -32, 37, 82, 10, 5);
  // 右侧木平台小屋
  bracket(g, 65, 113, 84, 4, 70, 60);
  house(g, 86, 104, 86, 104, 113, -4, 10, [[91, 96, 4, 6], [99, 96, 4, 6]], { midBeam: 93, chimney: [101, 110] });
  bush(g, 76, 142, 12, 4); bush(g, -46, 141, 10, 3);
  // 旗帜
  banner(g, anims, -105, -90, 222, 175, 12, 0.3, 0.14);
  banner(g, anims, 55, 73, 195, 147, 13, 1.1, 0.14);
  banner(g, anims, 0, 30, 147, 57, 22, 2.0, 0.14);
  for (const [x, y, z, s, sd] of [[-35, 20, 8, 12, 31], [85, 135, 0, 9, 32], [-62, 120, 6, 8, 33], [100, 60, -4, 7, 34]]) floatRock(g, anims, x, y, z, s, sd);
  for (const [x, y, n, ph] of [[-92, 140, 4, 0], [-70, 112, 5, 1], [-55, 70, 4, 2], [72, 130, 4, 3], [45, 46, 5, 4], [-20, 40, 3, 5]]) lantern(g, anims, x, y, n, 9, 0.95, ph);
  citadelHilt(g, 24, 6, 12, -28, -36, 5);
  return finishForm(g, 1.32, { squeeze: 0.66, update: (dt, t) => anims.forEach(f => f(dt, t)) });
}

// ============================================================================
// 圣剑家族
// ============================================================================
const HM = {
  face: () => mat(0x7f9cc8, { r: 0.45, m: 0.3 }),
  bevel: () => mat(0x3c4e68, { r: 0.5, m: 0.3 }),
  tip: () => mat(0xa9b8a6, { r: 0.45, m: 0.25 }),
  gold: () => mat(0xb87a2c, { r: 0.45, m: 0.35 }),
  goldD: () => mat(0x8a5a22, { r: 0.5, m: 0.3 }),
  copper: () => mat(0xa5502a, { r: 0.45, m: 0.3 }),
  white: () => glow(0xfff6e6, 1.6),
  steel: () => mat(0x6f86a6, { r: 0.45, m: 0.3 }),
  steelD: () => mat(0x2f3d4f, { r: 0.5, m: 0.3 }),
  grip: () => mat(0x5f3f28, { r: 0.85, m: 0 }),
  edgeGlow: () => glow(0xf4fbff, 1.8),
};

/**
 * 棱面剑身放样：rows = [[y, hw], ...] 自下而上，最后一行 hw=0 为剑尖。
 * 截面：中间平面（face 宽 = hw - bev）+ 两侧倒角（bevel）。正反两面对称。
 */
function holyBlade(p, rows, bev, t, mFace, mBev, mTip, tipFrom) {
  const face = [], bevs = [], tips = [];
  const pt = (x, y, z) => [x, y, z];
  const sec = rows.map(([y, hw, bv]) => {
    const b = Math.min(bv ?? bev, hw);
    const fw = Math.max(0, hw - b);
    return { y, hw, fw, zf: t, ze: t * 0.12 };
  });
  for (const zs of [1, -1]) {
    for (let i = 0; i < sec.length - 1; i++) {
      const A = sec[i], B = sec[i + 1];
      const tf = zs * A.zf, tg = zs * B.zf, ea = zs * A.ze, eb = zs * B.ze;
      const isTip = tipFrom != null && A.y >= tipFrom - 0.01;
      const quad = (arr, a, b, c, d) => {
        if (zs > 0) arr.push(a, b, c, a, c, d); else arr.push(a, c, b, a, d, c);
      };
      // 中面
      quad(isTip ? tips : face, pt(-A.fw, A.y, tf), pt(A.fw, A.y, tf), pt(B.fw, B.y, tg), pt(-B.fw, B.y, tg));
      // 左倒角
      quad(bevs, pt(-A.hw, A.y, ea), pt(-A.fw, A.y, tf), pt(-B.fw, B.y, tg), pt(-B.hw, B.y, eb));
      // 右倒角
      quad(bevs, pt(A.fw, A.y, tf), pt(A.hw, A.y, ea), pt(B.hw, B.y, eb), pt(B.fw, B.y, tg));
    }
  }
  // 侧边（刃口厚度）+ 底面
  for (let i = 0; i < sec.length - 1; i++) {
    const A = sec[i], B = sec[i + 1];
    for (const s of [-1, 1]) {
      const a = pt(s * A.hw, A.y, A.ze), b = pt(s * B.hw, B.y, B.ze), c = pt(s * B.hw, B.y, -B.ze), d = pt(s * A.hw, A.y, -A.ze);
      if (s > 0) bevs.push(a, d, c, a, c, b); else bevs.push(a, b, c, a, c, d);
    }
  }
  const A = sec[0];
  bevs.push(pt(-A.hw, A.y, -A.ze), pt(A.hw, A.y, -A.ze), pt(A.hw, A.y, A.ze), pt(-A.hw, A.y, -A.ze), pt(A.hw, A.y, A.ze), pt(-A.hw, A.y, A.ze));
  const mk = (arr, m) => {
    if (!arr.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr.flat(), 3));
    g.computeVertexNormals();
    put(p, g, m);
  };
  mk(face, mFace); mk(bevs, mBev); mk(tips, mTip);
}

/** 鱼骨金色斜纹：n 对，从 yA 到 yB，距中线 x0..x1 */
function slashes(p, n, yA, yB, x0, x1, z, m, ang = 0.5) {
  for (let i = 0; i < n; i++) {
    const y = n === 1 ? yA : yA + (yB - yA) * i / (n - 1);
    for (const s of [-1, 1]) {
      const L = x1 - x0;
      const cx = s * (x0 + x1) / 2;
      box(p, L, 2.8, 1.2, m, cx, y, z, s * ang);
    }
  }
}

/** 13 / 41 / 14 的金色翼形护手 */
function holyGuardSmall(p, o) {
  const gold = HM.gold(), goldD = HM.goldD(), steel = HM.steel(), white = HM.white();
  const T = 12;
  for (const s of [-1, 1]) {
    // 翼臂（金）
    const pts = [[s * 8, -12], [s * 48, -4], [s * 63, 9], [s * 55, 24], [s * 38, 21], [s * 14, 14]];
    ext(p, s > 0 ? pts : pts.slice().reverse(), T, gold, 0, 0.8);
    // 钢色内板
    const ip = [[s * 20, 2], [s * 45, 5], [s * 54, 11], [s * 48, 17], [s * 22, 12]];
    ext(p, s > 0 ? ip : ip.slice().reverse(), 2, steel, T / 2 + 0.4, 0);
    // 端部白钻
    oct(p, 9, 13, 3, white, s * 52, 11, T / 2 + 1.2);
  }
  // 下方金色横板
  box(p, o.barW ?? 64, 7, 12, goldD, 0, -8, 0);
  // 中心大白钻（菱形）+ 金座
  ext(p, [[0, -14], [16, 4], [0, 22], [-16, 4]], T + 2, gold, 0, 0.8);
  oct(p, 22, 27, 6, white, 0, 4, T / 2 + 1.5);
}
function holyHiltSmall(p, gy1, pEnd) {
  gripY(p, 7, -12, gy1, HM.grip(), 12);
  cyl(p, 8.5, 8.5, 3, 8, HM.goldD(), 0, -12, 0);
  cyl(p, 8.5, 8.5, 3, 8, HM.goldD(), 0, gy1, 0);
  const pr = (gy1 - pEnd);
  oct(p, 16, pr, 16, HM.gold(), 0, gy1 - pr / 2 - 1, 0);
}

function holySmall(spec) {
  const g = new THREE.Group();
  const T = spec.t ?? 5.5;
  holyBlade(g, spec.rows, spec.bev ?? 8, T, HM.face(), HM.bevel(), HM.face(), null);
  // 中央光槽：金边 + 白光芯
  const [fy0, fy1] = spec.fuller;
  box(g, 7.5, fy1 - fy0, 1.2, HM.gold(), 0, (fy0 + fy1) / 2, T + 0.3);
  box(g, 3, fy1 - fy0 - 3, 1.6, HM.white(), 0, (fy0 + fy1) / 2, T + 0.6);
  oct(g, 7.5, 12, 2, HM.gold(), 0, fy1 + 4, T + 0.3);
  if (spec.fullerGem) oct(g, 8, 14, 3, HM.gold(), 0, fy0 + 2, T + 1);
  for (const [n, yA, yB, x0, x1] of spec.slashes) slashes(g, n, yA, yB, x0, x1, T + 0.4, HM.gold(), 0.55);
  holyGuardSmall(g, spec);
  holyHiltSmall(g, spec.gy1, spec.pEnd);
  return finishForm(g, spec.L);
}

/** 15 / 16 / 17：宽刃 + 铜色刃缘 + 钢色十字护手 */
function holyBig(spec) {
  const g = new THREE.Group();
  const T = spec.t ?? 7;
  const rows = spec.rows;
  // 铜色外缘（略大一圈的剑身，放在后面）
  const rimRows = rows.map(([y, hw], i) => [y + (i === rows.length - 1 ? 3 : 0), hw + (hw > 0 ? 3.5 : 0)]);
  const rimTop = spec.rimTop;
  holyBlade(g, rimRows.filter(r => r[0] <= rimTop).concat([[rimTop + 0.5, 0.1]]), 3, T * 0.55, HM.copper(), HM.copper(), HM.copper(), null);
  holyBlade(g, rows, spec.bev ?? 9, T, HM.face(), HM.bevel(), HM.tip(), spec.tipFrom);
  // 中脊：金边 + 白光
  const [fy0, fy1] = spec.fuller;
  box(g, 9, fy1 - fy0, 2.2, HM.gold(), 0, (fy0 + fy1) / 2, T + 0.6);
  box(g, 3.6, fy1 - fy0 - 2, 2.8, HM.white(), -0.8, (fy0 + fy1) / 2, T + 0.9);
  oct(g, 9, 14, 3, HM.gold(), 0, fy1 + 5, T + 0.6);
  // 剑根小金钻
  oct(g, 10, 20, 4, HM.gold(), 0, fy0 + 2, T + 2);
  oct(g, 5, 10, 3, HM.white(), 0, fy0 + 2, T + 3.5);
  slashes(g, spec.nSlash, spec.slashY[0], spec.slashY[1], 8, spec.slashX, T + 0.5, HM.gold(), 0.32);
  if (spec.edgeGlow) {
    const [ya, yb, xa, xb] = spec.edgeGlow;
    bar(g, xa, ya, xb, yb, 2.6, 2, HM.edgeGlow(), T * 0.6);
  }
  // 剑根钢块
  const [by0, by1, bhw] = spec.base;
  box(g, bhw * 2, by1 - by0, T * 1.6, HM.steelD(), 0, (by0 + by1) / 2, 0);
  box(g, bhw * 2 - 8, by1 - by0 - 2, 1, HM.steel(), 0, (by0 + by1) / 2, T * 0.8 + 0.2);
  // 十字护手
  const gw = spec.gw, gh = spec.gh ?? 18;
  box(g, gw + 4, gh + 4, 10, HM.copper(), 0, 0, -1);
  box(g, gw, gh, 12, HM.steel(), 0, 0, 0);
  for (const s of [-1, 1]) {
    box(g, 4, gh + 6, 13, HM.steelD(), s * (gw / 2 - 2), 0.5, 0);
    oct(g, 7, 10, 3, HM.white(), s * (gw / 2 - 12), 0, 7);
  }
  // 中心白色心形宝石
  ext(g, [[0, -16], [15, 2], [9, 10], [0, 5], [-9, 10], [-15, 2]], 4, HM.white(), 7, 0);
  ext(g, [[0, -19], [18, 2], [10, 13], [0, 8], [-10, 13], [-18, 2]], 3, HM.gold(), 5, 0);
  // 握柄 + 柄头
  gripY(g, 6, -gh / 2, spec.gy1, HM.grip(), 10);
  cyl(g, 7.5, 7.5, 3, 8, HM.goldD(), 0, spec.gy1, 0);
  const pr = spec.gy1 - spec.pEnd;
  oct(g, 15, pr, 15, HM.gold(), 0, spec.gy1 - pr / 2 - 1, 0);
  return finishForm(g, spec.L);
}

const holySpecs = {
  13: { L: 1.0, rows: [[15, 28.5], [121, 25], [181, 22.5], [229, 0]], fuller: [22, 175], slashes: [[2, 70, 95, 6, 15]], gy1: -60, pEnd: -93 },
  41: { L: 1.08, rows: [[15, 28.5], [121, 25], [181, 22.5], [228, 0]], fuller: [26, 175], fullerGem: true, slashes: [[5, 50, 160, 6, 15]], gy1: -60, pEnd: -93 },
  14: { L: 1.15, rows: [[18, 32.5], [132, 29], [192, 26.5], [240, 0]], fuller: [24, 188], slashes: [[3, 52, 116, 6, 17]], gy1: -62, pEnd: -82 },
};
const holyBigSpecs = {
  15: { L: 1.3, rows: [[32, 35], [44, 37.5], [56, 43.5], [68, 46], [164, 40], [212, 30], [248, 0]], tipFrom: 212, rimTop: 214, fuller: [36, 205], nSlash: 11, slashY: [60, 190], slashX: 30, base: [10, 32, 32], gw: 136, gh: 18, gy1: -48, pEnd: -74 },
  16: { L: 1.42, rows: [[36, 39], [48, 45.5], [60, 49.5], [168, 40.5], [216, 31], [252, 0]], tipFrom: 216, rimTop: 218, fuller: [40, 208], nSlash: 13, slashY: [58, 196], slashX: 32, base: [10, 36, 36], gw: 134, gh: 20, gy1: -48, pEnd: -70 },
  17: { L: 1.55, rows: [[30, 40.5], [42, 46.5], [54, 50.5], [126, 44], [174, 40], [222, 33], [258, 0]], tipFrom: 222, rimTop: 224, fuller: [34, 214], nSlash: 15, slashY: [52, 200], slashX: 34, base: [8, 30, 36], gw: 136, gh: 20, gy1: -42, pEnd: -64, edgeGlow: [44, 218, -46, -36] },
};

export const FORMS = {
  8: form8,
  40: form40,
  9: form9,
  10: form10,
  11: form11,
  12: form12,
  13: () => holySmall(holySpecs[13]),
  41: () => holySmall(holySpecs[41]),
  14: () => holySmall(holySpecs[14]),
  15: () => holyBig(holyBigSpecs[15]),
  16: () => holyBig(holyBigSpecs[16]),
  17: () => holyBig(holyBigSpecs[17]),
};
