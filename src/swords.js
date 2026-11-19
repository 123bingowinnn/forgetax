// 剑：核心 API（形态汇总 / 加热 / 入神彩虹 / 通用碎裂）
// 约定：剑平放，剑尖 +X，剑柄 -X，原点 = 护手中心；参考图正面朝 +Y；参考图右侧 = +Z。
import * as THREE from 'three';
import { FORMS as BASE } from './swords/base.js';
import { FORMS as RUNE_SPLIT } from './swords/rune_split.js';
import { FORMS as CITADEL_HOLY } from './swords/citadel_holy.js';
import { FORMS as SAW_DRAGON } from './swords/saw_dragon.js';
import { FORMS as MERCHANT } from './swords/merchant.js';
import { FORMS as HIDDEN_A } from './swords/hidden_a.js';
import { FORMS as HIDDEN_C } from './swords/hidden_c.js';
import { FORMS as MERCHANT2 } from './swords/merchant2.js';

const ALL = Object.assign({}, BASE, RUNE_SPLIT, CITADEL_HOLY, SAW_DRAGON, MERCHANT, HIDDEN_A, HIDDEN_C, MERCHANT2);

/** 全部形态 id（原作 78 + 第三轮新增 40，按家族顺序） */
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
  // 第三轮：隐藏家族（熔岩 / 雷霆 / 冰霜）与商人线（星辰 / 机关）
  60, 61, 62, 63, 64, 65,
  70, 71, 72, 73, 74, 75,
  50, 51, 52, 53, 54, 55,
  400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410,
  500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510,
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
    variant: 'plain',
    aura: 0,
    _fx: [],
    update: null,
  };
  const formUpdate = typeof iu.update === 'function' ? iu.update : null;
  const ud = group.userData;
  ud.update = (dt = 0.016, t = 0) => {
    if (formUpdate) formUpdate(dt, t);
    for (const f of ud._fx) f(dt, t);
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
    if (!(o.isMesh || o.isLine || o.isPoints) || o.userData.noOwn) return;
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

// ===========================================================================
// 材质品相（VARIANTS / setSwordVariant）
// ===========================================================================
/**
 * 品相表。h/s：目标色相/饱和度；l0 + l1*L：亮度重映射（保留原明暗层次）；
 * e/ei：附加自发光；rim/rimI：菲涅尔边缘光；m/r：金属度/粗糙度；pulse：呼吸光。
 */
export const VARIANTS = [
  { id: 'plain', name: '原色', nameEn: 'Plain' },
  { id: 'copper', name: '赤铜', nameEn: 'Copper', h: 0.035, s: 0.6, l0: 0.08, l1: 0.72, e: 0x2a0c04, ei: 1, rim: 0xff8a50, rimI: 0.25, m: 0.35, r: 0.45 },
  { id: 'gold', name: '鎏金', nameEn: 'Gilded', h: 0.115, s: 0.72, l0: 0.26, l1: 0.5, e: 0x4a3008, ei: 1, rim: 0xffd070, rimI: 0.35, m: 0.35, r: 0.35 },
  { id: 'frost', name: '寒铁', nameEn: 'Frost Iron', h: 0.55, s: 0.5, l0: 0.42, l1: 0.45, e: 0x0c3848, ei: 1, rim: 0x6cf6ff, rimI: 1.1, m: 0.25, r: 0.35 },
  { id: 'obsidian', name: '黑曜', nameEn: 'Obsidian', h: 0.74, s: 0.22, l0: 0.05, l1: 0.14, e: 0x1c0630, ei: 1, rim: 0xa040ff, rimI: 1.3, m: 0.35, r: 0.25 },
  { id: 'jade', name: '翡翠', nameEn: 'Jade', h: 0.39, s: 0.55, l0: 0.26, l1: 0.42, e: 0x0c5a34, ei: 0.8, rim: 0x9cffc8, rimI: 0.6, m: 0.1, r: 0.3 },
  { id: 'blood', name: '血钢', nameEn: 'Bloodsteel', h: 0.995, s: 0.7, l0: 0.1, l1: 0.3, e: 0x6a0404, ei: 1, rim: 0xff2020, rimI: 0.8, m: 0.35, r: 0.4, pulse: true },
  { id: 'holy', name: '圣辉', nameEn: 'Radiant', h: 0.12, s: 0.38, l0: 0.7, l1: 0.25, e: 0x5a4a2a, ei: 1, rim: 0xfff0c0, rimI: 0.9, m: 0.3, r: 0.35 },
];
const VARIANT_BY_ID = Object.fromEntries(VARIANTS.map((v) => [v.id, v]));
/** 品相的代表光色（光环默认取它） */
const VARIANT_AURA = { copper: 0xff8a4a, gold: 0xffc850, frost: 0x7ef0ff, obsidian: 0xa848ff, jade: 0x6affb0, blood: 0xff2a2a, holy: 0xfff0c8 };

// 菲涅尔边缘光（onBeforeCompile 注入，uniform 每材质独立）
function installRim(m) {
  if (m.userData._rim) return m.userData._rim;
  const u = { uRimColor: { value: new THREE.Color(0) }, uRimPow: { value: 1.6 } };
  m.userData._rim = u;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRimColor = u.uRimColor;
    sh.uniforms.uRimPow = u.uRimPow;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimPow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float rimF = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), uRimPow) + 0.12; totalEmissiveRadiance += uRimColor * rimF; }');
  };
  m.customProgramCacheKey = () => 'swordRim';
  m.needsUpdate = true;
  return u;
}

// 判断材质是否属于“可换品相”的金属/剑身类：跳过发光件、贴图件、木头皮革深色、高饱和有机色
const _hsl = { h: 0, s: 0, l: 0 };
function variantEligible(m, o) {
  if (!m || !m.isMeshStandardMaterial || m.map || o.userData.noHeat || o.userData.noVariant) return false;
  const b = m.userData._orig;
  const eLum = (b.e.r + b.e.g + b.e.b) / 3 * b.ei;
  if (eLum > 0.25) return false; // 发光部件保持
  b.c.getHSL(_hsl);
  if (_hsl.l < 0.09) return false; // 近黑（皮革、黑铁条）
  if (_hsl.h > 0.02 && _hsl.h < 0.13 && _hsl.s > 0.3 && _hsl.l < 0.4) return false; // 木头 / 皮革 / 深棕
  if (_hsl.s > 0.68 && _hsl.l > 0.25 && _hsl.l < 0.7 && !(_hsl.h > 0.08 && _hsl.h < 0.16)) return false; // 鲜艳有机色（金色除外）
  return true;
}

/** 给剑换材质品相（不改模型）；可随时切换，与 heat / frenzy / breakSword 兼容 */
export function setSwordVariant(group, variantId = 'plain') {
  const v = VARIANT_BY_ID[variantId] || VARIANT_BY_ID.plain;
  ownMaterials(group);
  const ud = group.userData;
  ud.variant = v.id;
  const seen = new Set();
  const pulses = [];
  group.traverse((o) => {
    if (!o.isMesh || o.userData.noOwn) return;
    for (const m of baseMaterialsOf(o)) {
      if (!m || seen.has(m) || !m.emissive || m === rainbowMaterial) continue;
      seen.add(m);
      const u = m.userData;
      if (!u._orig) {
        const hb = u._heatBase; // 若已加热过，_heatBase 保存的是加热前的外观
        u._orig = hb ? { c: hb.c.clone(), e: hb.e.clone(), ei: hb.ei, m: m.metalness, r: m.roughness }
          : { c: m.color.clone(), e: m.emissive.clone(), ei: m.emissiveIntensity, m: m.metalness, r: m.roughness };
      }
      const b = u._orig;
      const ok = v.id !== 'plain' && variantEligible(m, o);
      if (!ok) {
        m.color.copy(b.c); m.emissive.copy(b.e); m.emissiveIntensity = b.ei; m.metalness = b.m; m.roughness = b.r;
        if (u._rim) u._rim.uRimColor.value.setRGB(0, 0, 0);
      } else {
        b.c.getHSL(_hsl);
        const L = Math.min(0.95, v.l0 + v.l1 * _hsl.l);
        m.color.setHSL(v.h, v.s, L);
        // 原有微弱自发光 + 品相自发光
        m.emissive.copy(b.e).multiplyScalar(b.ei).add(new THREE.Color(v.e).multiplyScalar(v.ei));
        m.emissiveIntensity = 1;
        m.metalness = Math.min(0.35, v.m ?? b.m);
        m.roughness = v.r ?? b.r;
        const rim = installRim(m);
        rim.uRimColor.value.set(v.rim).multiplyScalar(v.rimI);
        if (v.pulse) pulses.push({ m, e: m.emissive.clone(), rim: rim.uRimColor.value.clone(), ru: rim });
      }
      // 加热以“品相后的外观”为基准
      u._heatBase = { c: m.color.clone(), e: m.emissive.clone(), ei: m.emissiveIntensity };
    }
  });
  // 呼吸光
  if (ud._variantFx) { const i = ud._fx.indexOf(ud._variantFx); if (i >= 0) ud._fx.splice(i, 1); ud._variantFx = null; }
  if (pulses.length) {
    ud._variantFx = (dt, t) => {
      if (ud.heat > 0 || ud.frenzy) return;
      const k = 0.55 + 0.45 * Math.sin(t * 2.4);
      for (const p of pulses) { p.m.emissive.copy(p.e).multiplyScalar(0.5 + k); p.ru.uRimColor.value.copy(p.rim).multiplyScalar(0.4 + k); }
    };
    ud._fx.push(ud._variantFx);
  }
  if (ud.heat > 0) setSwordHeat(group, ud.heat);
  if (ud.aura > 0) setSwordAura(group, ud.aura); // 光环颜色跟随品相
}

// ===========================================================================
// 光环（setSwordAura）
// ===========================================================================
let _dotTex = null, _ringTex = null, _haloTex = null;
function dotTexture() {
  if (_dotTex) return _dotTex;
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  _dotTex = new THREE.CanvasTexture(c);
  return _dotTex;
}
function haloTexture() {
  if (_haloTex) return _haloTex;
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  gr.addColorStop(0.7, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  _haloTex = new THREE.CanvasTexture(c);
  return _haloTex;
}
function ringTexture() {
  if (_ringTex) return _ringTex;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const C = S / 2;
  g.strokeStyle = 'rgba(255,255,255,1)';
  g.lineWidth = 3; g.beginPath(); g.arc(C, C, 122, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1.5; g.beginPath(); g.arc(C, C, 108, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1; g.beginPath(); g.arc(C, C, 70, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2, r0 = 108, r1 = i % 4 === 0 ? 122 : 115;
    g.lineWidth = i % 4 === 0 ? 2 : 1;
    g.beginPath(); g.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0); g.lineTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1); g.stroke();
  }
  // 六芒星
  g.lineWidth = 1.5;
  for (let k = 0; k < 2; k++) {
    g.beginPath();
    for (let i = 0; i <= 3; i++) { const a = k * Math.PI / 3 + (i / 3) * Math.PI * 2 - Math.PI / 2; const x = C + Math.cos(a) * 104, y = C + Math.sin(a) * 104; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  const gr = g.createRadialGradient(C, C, 60, C, C, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.8, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  _ringTex = new THREE.CanvasTexture(c);
  return _ringTex;
}
// 剑的主发光色（emissive 亮度最高的材质）
function mainGlowColor(group) {
  let best = null, bestL = 0.15;
  group.traverse((o) => {
    if (!o.isMesh || o.userData.noOwn) return;
    for (const m of baseMaterialsOf(o)) {
      if (!m || !m.emissive || m === rainbowMaterial) continue;
      const b = m.userData._orig || { e: m.emissive, ei: m.emissiveIntensity };
      const l = ((b.e.r + b.e.g + b.e.b) / 3) * b.ei;
      if (l > bestL) { bestL = l; best = b.e.clone(); }
    }
  });
  if (!best) return new THREE.Color(0xffd890);
  const hsl = {}; best.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, Math.max(0.5, hsl.s), 0.62);
}

/**
 * 光环：tier 0 = 无；1 = 微光粒子；2 = 光晕 + 粒子；3 = 强光晕 + 环绕光点 + 地面光圈。
 * 光环是剑 group 的子对象（userData.isAura），不参与包围盒 / 碎裂 / 彩虹 / 加热，由 userData.update 驱动。
 * opts.color 可指定颜色（默认取品相色或剑的主发光色）。
 */
export function setSwordAura(group, tier = 0, opts = {}) {
  const ud = group.userData;
  if (ud._aura) {
    group.remove(ud._aura.obj);
    ud._aura.obj.traverse((o) => { if (o.isMesh || o.isPoints) { o.geometry.dispose(); o.material.dispose(); } });
    const i = ud._fx.indexOf(ud._aura.fx); if (i >= 0) ud._fx.splice(i, 1);
    ud._aura = null;
  }
  tier = Math.max(0, Math.min(3, Math.floor(tier || 0)));
  ud.aura = tier;
  if (!tier) return;
  const col = opts.color !== undefined ? new THREE.Color(opts.color)
    : (VARIANT_AURA[ud.variant] ? new THREE.Color(VARIANT_AURA[ud.variant]) : mainGlowColor(group));
  const x0 = ud.pommelX ?? -0.2, x1 = ud.tipX ?? 0.6;
  const L = x1 - x0, xc = (x0 + x1) / 2;
  const Wd = Math.max(0.1, Math.min(ud.bodyWidth ?? ud.width ?? 0.15, 0.7));
  const yBot = -(ud.thickness ?? 0.03) / 2;
  const root = new THREE.Group();
  root.name = 'swordAura';
  root.userData.isAura = true;
  const tag = (o) => { Object.assign(o.userData, { noBounds: true, noBreak: true, keepFx: true, noHeat: true, noOwn: true, noVariant: true }); o.castShadow = false; o.receiveShadow = false; o.renderOrder = 5; return o; };
  const fx = [];
  // --- 粒子：从剑身附近升起的光点 ---
  const N = [0, 36, 70, 120][tier];
  const pos = new Float32Array(N * 3), life = new Float32Array(N), speed = new Float32Array(N);
  const respawn = (i, initial) => {
    pos[i * 3] = x0 + Math.random() * L;
    pos[i * 3 + 1] = yBot + Math.random() * 0.03;
    pos[i * 3 + 2] = (Math.random() - 0.5) * Wd * 1.2;
    life[i] = initial ? Math.random() : 0;
    speed[i] = 0.05 + Math.random() * 0.09;
  };
  for (let i = 0; i < N; i++) respawn(i, true);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = new THREE.PointsMaterial({ color: col.clone().multiplyScalar(2.2), size: [0, 0.03, 0.034, 0.04][tier], map: dotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, opacity: 0.9 });
  const pts = tag(new THREE.Points(pg, pm));
  pts.frustumCulled = false;
  root.add(pts);
  fx.push((dt) => {
    const d = Math.min(0.05, dt || 0.016);
    for (let i = 0; i < N; i++) {
      life[i] += d * (0.35 + speed[i]);
      if (life[i] >= 1) respawn(i, false);
      pos[i * 3 + 1] += speed[i] * d * (tier >= 3 ? 1.6 : 1);
      pos[i * 3 + 2] += Math.sin(life[i] * 9 + i) * 0.0006;
      if (life[i] === 0) pos[i * 3 + 1] = yBot + Math.random() * 0.02;
    }
    pg.attributes.position.needsUpdate = true;
  });
  // --- 光晕：剑下方的柔光（剑身遮挡中部，边缘透出） ---
  if (tier >= 2) {
    const hm = new THREE.MeshBasicMaterial({ map: haloTexture(), color: col.clone().multiplyScalar(tier >= 3 ? 0.55 : 0.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 });
    const hg = new THREE.PlaneGeometry(1, 1); hg.rotateX(-Math.PI / 2);
    const halo = tag(new THREE.Mesh(hg, hm));
    halo.position.set(xc, 0.0, 0);
    halo.scale.set(L * 1.2, 1, Wd * (tier >= 3 ? 2.2 : 1.8) + 0.1);
    root.add(halo);
    fx.push((dt, t) => { hm.opacity = 0.75 + 0.25 * Math.sin(t * 2.2); });
  }
  // --- 三阶：环绕光点 + 地面光圈 ---
  if (tier >= 3) {
    const orbit = new THREE.Group();
    orbit.position.x = xc;
    root.add(orbit);
    const sm = new THREE.SpriteMaterial({ map: dotTexture(), color: col.clone().multiplyScalar(2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const motes = [];
    for (let i = 0; i < 8; i++) {
      const sp = tag(new THREE.Sprite(sm));
      sp.scale.setScalar(0.05);
      orbit.add(sp);
      motes.push({ sp, a: (i / 8) * Math.PI * 2, rx: L * 0.5, rz: Wd * 0.7 + 0.1, y: 0.06 + (i % 2) * 0.05 });
    }
    fx.push((dt, t) => {
      for (const m of motes) {
        const a = m.a + t * 0.9;
        m.sp.position.set(Math.cos(a) * m.rx, m.y + Math.sin(t * 2 + m.a * 3) * 0.02, Math.sin(a) * m.rz);
      }
    });
    const rm = new THREE.MeshBasicMaterial({ map: ringTexture(), color: col.clone().multiplyScalar(0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7, side: THREE.DoubleSide });
    const rg = new THREE.PlaneGeometry(1, 1); rg.rotateX(-Math.PI / 2);
    const ring = tag(new THREE.Mesh(rg, rm));
    const R = Math.max(L * 0.5, Wd * 0.75);
    ring.position.set(xc, yBot - 0.004, 0);
    ring.scale.set(R * 2, 1, R * 2);
    root.add(ring);
    fx.push((dt, t) => { ring.rotation.y = t * 0.25; rm.opacity = 0.5 + 0.2 * Math.sin(t * 1.7); });
  }
  root.traverse(tag);
  group.add(root);
  const f = (dt, t) => { for (const g of fx) g(dt, t); };
  ud._fx.push(f);
  ud._aura = { obj: root, fx: f, tier };
}
