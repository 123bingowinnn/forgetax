// 剑：核心 API（形态汇总 / 加热 / 入神彩虹 / 通用碎裂）
// 约定：剑平放，剑尖 +X，剑柄 -X，原点 = 护手中心；参考图正面朝 +Y；参考图右侧 = +Z。
import * as THREE from 'three';
import { FORMS as BASE } from './swords/base.js';
import { FORMS as RUNE_SPLIT } from './swords/rune_split.js';
import { FORMS as CITADEL_HOLY } from './swords/citadel_holy.js';
import { FORMS as SAW_DRAGON } from './swords/saw_dragon.js';
import { FORMS as MERCHANT } from './swords/merchant.js';

const ALL = Object.assign({}, BASE, RUNE_SPLIT, CITADEL_HOLY, SAW_DRAGON, MERCHANT);

/** 原作全部 78 个形态 id（按家族顺序） */
export const FORM_IDS = [
  1, 38, 39, 2, 3, 4, 5, 6, 7,
  8, 40, 9, 10, 11, 12,
  13, 41, 14, 15, 16, 17,
  18, 42, 19, 20, 21, 22,
  23, 43, 24, 25, 26, 27,
  28, 44, 29, 30, 31, 32,
  33, 45, 34, 35, 36, 37,
  100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110,
  200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210,
  3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010,
];
/** 当前已实现（有构建函数）的形态 */
export const hasForm = (id) => typeof ALL[id] === 'function';

// ---------------------------------------------------------------------------
// 旧 API 兼容（level + line → 形态）
// ---------------------------------------------------------------------------
const LEGACY = {
  iron: [[0, 1, '旧剑'], [2, 38, '精修剑'], [4, 39, '还算好用的铁剑'], [6, 2, '厚铁剑'], [8, 3, '便携铁门'],
    [10, 8, '这把巨剑不太对劲'], [11, 33, '断了也不散的剑'], [12, 44, '觉醒符文剑'], [14, 29, '过载之刃'],
    [16, 30, '大法师的奥术引擎'], [19, 31, '撕裂现实之剑'], [20, 32, '阿卡夏·创世之刃']],
  tree: [[0, 100, '枯枝'], [2, 101, '意外结实的树枝'], [4, 104, '萌动之种'], [9, 105, '这曾是根树枝'], [12, 106, '森林之芽'],
    [14, 107, '千年古树'], [17, 109, '承载世界之树'], [20, 110, '世界树·尤克特拉希尔']],
  sea: [[0, 200, '海带缠着的剑片'], [6, 201, '墨鱼骨小刀'], [12, 207, '珊瑚祭坛之刃'], [16, 209, '克拉肯触手']],
};
function legacyEntry(level, line) {
  const t = LEGACY[line] || LEGACY.iron;
  let e = t[0];
  for (const r of t) if (level >= r[0]) e = r;
  return e;
}
/** @deprecated 名字请用 data.js；保留给旧调用 */
export function swordName(level, line = 'iron') { return legacyEntry(level, line)[2]; }
/** @deprecated */
export function legacyFormId(level, line = 'iron') { return legacyEntry(level, line)[1]; }

// ---------------------------------------------------------------------------
// 构建
// ---------------------------------------------------------------------------
/**
 * buildSword(formId, { level }) → THREE.Group
 * 兼容旧调用 buildSword(level, { line })。
 * level 仅用于同形态内的轻微放大（奇数级 +3%）。
 */
export function buildSword(formId = 1, opts = {}) {
  opts = opts || {};
  let id = Number(formId) || 1;
  let level = opts.level;
  if (opts.line !== undefined) {
    level = Math.max(0, Math.floor(Number(formId) || 0));
    id = legacyFormId(level, opts.line);
  }
  if (!hasForm(id)) id = hasForm(1) ? 1 : Number(Object.keys(ALL)[0]);
  const inner = ALL[id]({ level: level ?? 0 });
  const iu = inner.userData || {};
  const s = level != null && level > 0 ? 1 + 0.03 * (level % 2) : 1;
  inner.scale.multiplyScalar(s);
  const group = new THREE.Group();
  group.name = `sword:${id}`;
  group.add(inner);
  group.updateMatrixWorld(true);
  const bb = new THREE.Box3();
  inner.traverse((o) => {
    if ((o.isMesh) && o.visible && !o.userData.noBounds) {
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      bb.union(b);
    }
  });
  const len = bb.max.x - bb.min.x;
  group.userData = {
    kind: 'sword',
    formId: id,
    level: level ?? 0,
    length: len,
    bladeLength: (iu.bladeLength ?? Math.max(0, bb.max.x)) * s,
    gripLength: (iu.gripLength ?? Math.max(0, -bb.min.x)) * s,
    width: bb.max.z - bb.min.z,
    bodyWidth: (iu.bodyWidth ?? (bb.max.z - bb.min.z)),
    thickness: bb.max.y - bb.min.y,
    tipX: bb.max.x, pommelX: bb.min.x,
    scale: s,
    heat: 0,
    frenzy: false,
    update: typeof iu.update === 'function' ? iu.update : () => {},
  };
  if (iu.bodyWidth) group.userData.bodyWidth = iu.bodyWidth * s;
  return group;
}

// ---------------------------------------------------------------------------
// 每把剑私有材质（首次 heat/frenzy 时 clone，避免污染共享缓存材质）
// ---------------------------------------------------------------------------
function ownMaterials(group) {
  if (group.userData._ownMats) return;
  const map = new Map();
  const own = (m) => {
    if (!m || m === rainbowMaterial) return m;
    let c = map.get(m);
    if (!c) { c = m.clone(); map.set(m, c); }
    return c;
  };
  group.traverse((o) => {
    if (!(o.isMesh || o.isLine || o.isPoints)) return;
    if (o.userData._preFrenzy) {
      o.userData._preFrenzy = Array.isArray(o.userData._preFrenzy) ? o.userData._preFrenzy.map(own) : own(o.userData._preFrenzy);
    } else {
      o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
    }
  });
  group.userData._ownMats = true;
}

// ---------------------------------------------------------------------------
// 加热（烧红）
// ---------------------------------------------------------------------------
const HEAT_COLOR = new THREE.Color(0xff5a2a);
const HEAT_TINT = new THREE.Color(0xff8466);
function baseMaterialsOf(o) {
  const m = o.userData._preFrenzy || o.material;
  return Array.isArray(m) ? m : [m];
}
export function setSwordHeat(group, heat) {
  const h = Math.min(1, Math.max(0, heat || 0));
  if (!group.userData._ownMats && h === 0) { group.userData.heat = 0; return; }
  ownMaterials(group);
  group.userData.heat = h;
  const seen = new Set();
  group.traverse((o) => {
    if (!o.isMesh || o.userData.noHeat) return;
    for (const m of baseMaterialsOf(o)) {
      if (!m || seen.has(m) || !m.emissive || m === rainbowMaterial) continue;
      seen.add(m);
      const u = m.userData;
      if (!u._heatBase) u._heatBase = { c: m.color.clone(), e: m.emissive.clone(), ei: m.emissiveIntensity };
      const b = u._heatBase;
      if (h === 0) { m.color.copy(b.c); m.emissive.copy(b.e); m.emissiveIntensity = b.ei; continue; }
      m.color.copy(b.c).lerp(HEAT_TINT, h * 0.65);
      const e0r = b.e.r * b.ei, e0g = b.e.g * b.ei, e0b = b.e.b * b.ei;
      const hi = 0.45 * h + 0.25 * h * h;
      m.emissive.setRGB(e0r + (HEAT_COLOR.r * hi - e0r) * h, e0g + (HEAT_COLOR.g * hi - e0g) * h, e0b + (HEAT_COLOR.b * hi - e0b) * h);
      m.emissiveIntensity = 1;
    }
  });
}

// ---------------------------------------------------------------------------
// 入神（彩虹斜纹）
// ---------------------------------------------------------------------------
const rainbowUniforms = { uTime: { value: 0 } };
export const rainbowMaterial = new THREE.ShaderMaterial({
  uniforms: rainbowUniforms,
  vertexShader: /* glsl */`
    varying vec3 vWorld;
    varying vec3 vView;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      vec4 mv = viewMatrix * wp;
      vView = mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform float uTime;
    varying vec3 vWorld;
    varying vec3 vView;
    vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    void main() {
      vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
      float s = dot(vWorld, vec3(1.0, 0.45, 0.85)) * 1.9 - uTime * 0.55;
      vec3 col = hsv2rgb(vec3(fract(s), 0.88, 1.0));
      col = pow(col, vec3(2.2));
      float l = 0.55 + 0.45 * abs(dot(n, normalize(vec3(0.25, 0.75, 0.6))));
      float band = smoothstep(0.93, 1.0, fract(s * 2.0 + 0.37));
      col = col * l * 1.3 + vec3(band) * 0.55;
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
rainbowMaterial.name = 'SwordRainbow';

/** 入神：除 userData.keepFx 的部件（星系等）外全部换成彩虹材质；off 时还原 */
export function setSwordFrenzy(group, on) {
  group.userData.frenzy = !!on;
  group.traverse((o) => {
    if (!o.isMesh || o.userData.keepFx) return;
    if (on) {
      if (!o.userData._preFrenzy) { o.userData._preFrenzy = o.material; o.material = rainbowMaterial; }
    } else if (o.userData._preFrenzy) {
      o.material = o.userData._preFrenzy;
      delete o.userData._preFrenzy;
    }
  });
}

/** 每帧推进彩虹滚动 */
export function updateSwordFx(t) {
  rainbowUniforms.uTime.value = t;
}

// ---------------------------------------------------------------------------
// 通用碎裂：按包围盒沿 X 切段（宽段再按 Z 一分为二），每段收集该区域的三角形，保持原材质
// ---------------------------------------------------------------------------
export function breakSword(group, { maxPieces = 14 } = {}) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const rel = new THREE.Matrix4();
  const nrm = new THREE.Matrix3();
  // 收集三角形：{ ax..cz, n, uv, mat }
  const tris = [];
  const bb = new THREE.Box3();
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  group.traverse((o) => {
    if (!o.isMesh || !o.visible || o.userData.noBreak) return;
    let vis = true;
    for (let p = o.parent; p && p !== group; p = p.parent) if (!p.visible) vis = false;
    if (!vis) return;
    const g = o.geometry;
    const pos = g.attributes.position;
    if (!pos) return;
    rel.multiplyMatrices(inv, o.matrixWorld);
    nrm.getNormalMatrix(rel);
    const idx = g.index;
    const uv = g.attributes.uv;
    const count = idx ? idx.count : pos.count;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const groups = g.groups.length ? g.groups : [{ start: 0, count, materialIndex: 0 }];
    for (const gr of groups) {
      const m = Array.isArray(o.material) ? mats[gr.materialIndex ?? 0] : o.material;
      if (!m || m.visible === false) continue;
      const end = Math.min(count, gr.start + gr.count);
      for (let i = gr.start; i + 2 < end + 0; i += 3) {
        const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
        va.fromBufferAttribute(pos, i0).applyMatrix4(rel);
        vb.fromBufferAttribute(pos, i1).applyMatrix4(rel);
        vc.fromBufferAttribute(pos, i2).applyMatrix4(rel);
        const t = { p: [va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z], uv: null, m };
        if (uv) t.uv = [uv.getX(i0), uv.getY(i0), uv.getX(i1), uv.getY(i1), uv.getX(i2), uv.getY(i2)];
        t.cx = (va.x + vb.x + vc.x) / 3; t.cz = (va.z + vb.z + vc.z) / 3;
        bb.expandByPoint(va); bb.expandByPoint(vb); bb.expandByPoint(vc);
        tris.push(t);
      }
    }
  });
  if (!tris.length) return [];
  // 切段：沿 X 等分（略加扰动），宽段按 Z 二分
  const L = bb.max.x - bb.min.x, Wd = bb.max.z - bb.min.z;
  const nX = Math.max(5, Math.min(9, Math.round(L / 0.11)));
  const splitZ = Wd > 0.16;
  const cutsX = [];
  for (let i = 1; i < nX; i++) cutsX.push(bb.min.x + (L * (i + (Math.sin(i * 12.9898) * 0.5) * 0.35)) / nX);
  const bins = new Map();
  for (const t of tris) {
    let ix = 0;
    while (ix < cutsX.length && t.cx > cutsX[ix] + (t.cz * 0.35)) ix++;
    let iz = 0;
    if (splitZ && ix > 0) iz = t.cz > (Math.sin(ix * 3.7) * 0.15 * Wd) ? 1 : 0;
    const key = ix * 2 + iz;
    let b = bins.get(key);
    if (!b) { b = []; bins.set(key, b); }
    b.push(t);
  }
  // 太多则合并相邻
  let keys = [...bins.keys()].sort((a, b) => a - b);
  while (keys.length > maxPieces) {
    // 合并最小的两个相邻桶
    let best = 0, bestN = Infinity;
    for (let i = 0; i < keys.length - 1; i++) {
      const n = bins.get(keys[i]).length + bins.get(keys[i + 1]).length;
      if (n < bestN) { bestN = n; best = i; }
    }
    const a = keys[best], b = keys[best + 1];
    bins.set(a, bins.get(a).concat(bins.get(b)));
    bins.delete(b);
    keys = [...bins.keys()].sort((x, y) => x - y);
  }
  const out = [];
  const cloneCache = new Map();
  const cloneMat = (m) => {
    if (m === rainbowMaterial) return m;
    let c = cloneCache.get(m);
    if (!c) { c = m.clone(); cloneCache.set(m, c); }
    return c;
  };
  for (const k of keys) {
    const list = bins.get(k);
    if (!list.length) continue;
    // 按材质分组
    const byMat = new Map();
    for (const t of list) { let a = byMat.get(t.m); if (!a) { a = []; byMat.set(t.m, a); } a.push(t); }
    let cx = 0, cy = 0, cz = 0, n = 0;
    for (const t of list) { for (let j = 0; j < 9; j += 3) { cx += t.p[j]; cy += t.p[j + 1]; cz += t.p[j + 2]; n++; } }
    cx /= n; cy /= n; cz /= n;
    const pos = [], uvs = [], mats = [];
    const geo = new THREE.BufferGeometry();
    let start = 0;
    for (const [m, arr] of byMat) {
      for (const t of arr) {
        for (let j = 0; j < 9; j += 3) pos.push(t.p[j] - cx, t.p[j + 1] - cy, t.p[j + 2] - cz);
        if (t.uv) uvs.push(...t.uv); else uvs.push(0, 0, 0, 0, 0, 0);
      }
      geo.addGroup(start, arr.length * 3, mats.length);
      start += arr.length * 3;
      mats.push(cloneMat(m));
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mats.length === 1 ? mats[0] : mats);
    if (mats.length === 1) geo.clearGroups();
    mesh.position.set(cx, cy, cz);
    mesh.castShadow = true;
    out.push(mesh);
  }
  return out;
}
