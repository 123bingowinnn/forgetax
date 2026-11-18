// 程序化贴图与材质工厂 —— Unity 低多边形风格：块面色 + 像素颗粒噪点
// 所有贴图 / 材质均缓存复用。贴图默认 RepeatWrapping + SRGBColorSpace。
// 每张贴图覆盖的世界尺寸见 TEX_TILE（米），配合 applyWorldUV() 使用即可获得统一的纹理密度。
import * as THREE from 'three';

/** 每张贴图一次平铺对应的世界尺寸（米） */
export const TEX_TILE = {
  brick: 1.6,   // 4 块砖 × 8 行（砖 0.4 × 0.2）
  stone: 2.0,   // 2 块 × 4 行大石块
  stonePlain: 1.5,
  wood: 1.2,    // 6 条木板
  woodPanel: 1.0,
  floor: 1.6,   // 2 × 2 方砖（单块 0.8）
  paper: 1.0,
  metal: 1.0,
};

const _tex = new Map();
const _mat = new Map();

// ---------- 工具 ----------
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const hex = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
function shade([r, g, b], k) { return hex(r * k, g * k, b * k); }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

/** 叠加像素颗粒（cell 像素一格），amount 为亮度扰动幅度 0..1 */
function grain(ctx, w, h, amount = 0.12, cell = 2, seed = 7) {
  const r = rng(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      const k = 1 + (r() - 0.5) * 2 * amount;
      for (let yy = y; yy < Math.min(h, y + cell); yy++) {
        for (let xx = x; xx < Math.min(w, x + cell); xx++) {
          const i = (yy * w + xx) * 4;
          d[i] = Math.min(255, d[i] * k);
          d[i + 1] = Math.min(255, d[i + 1] * k);
          d[i + 2] = Math.min(255, d[i + 2] * k);
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** 大块低频斑驳（明暗块），给墙面一点 Unity 风格的脏旧感 */
function blotches(ctx, w, h, n, seed, alpha = 0.12, dark = true) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, s = 8 + r() * 40;
    ctx.fillStyle = dark ? `rgba(0,0,0,${alpha * r()})` : `rgba(255,240,220,${alpha * r()})`;
    // 像素化方块斑
    const steps = 3 + (r() * 4) | 0;
    for (let k = 0; k < steps; k++) {
      ctx.fillRect((x + (r() - 0.5) * s) | 0, (y + (r() - 0.5) * s) | 0, (s * (0.3 + r() * 0.6)) | 0, (s * (0.3 + r() * 0.6)) | 0);
    }
  }
}

function finish(c, key, { nearest = true, color = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  t.name = key;
  t.needsUpdate = true;
  _tex.set(key, t);
  return t;
}

function cached(key, fn) {
  if (_tex.has(key)) return _tex.get(key);
  return fn();
}

// ---------- 砖墙 ----------
function drawBrick(bump) {
  const W = 512, H = 512, cols = 4, rows = 8;
  const c = canvas(W, H), g = c.getContext('2d');
  const r = rng(1234);
  const bw = W / cols, bh = H / rows, m = 5; // 砖缝宽度(px)
  g.fillStyle = bump ? '#000' : '#1b120c';
  g.fillRect(0, 0, W, H);
  const base = [106, 86, 72];
  for (let row = 0; row < rows; row++) {
    const off = (row % 2) * bw * 0.5;
    for (let col = -1; col < cols; col++) {
      const x0 = col * bw + off + m / 2, y0 = row * bh + m / 2;
      const w = bw - m, h = bh - m;
      if (bump) {
        g.fillStyle = '#bbb'; g.fillRect(x0, y0, w, h);
        g.fillStyle = '#fff'; g.fillRect(x0 + 3, y0 + 3, w - 6, h - 6);
        continue;
      }
      const k = 0.78 + r() * 0.4;
      const tint = mix(base, [100, 76, 62], r() * 0.7);
      g.fillStyle = shade(tint, k); g.fillRect(x0, y0, w, h);
      // 低多边形倒角：上亮下暗
      g.fillStyle = shade(tint, k * 1.18); g.fillRect(x0, y0, w, 4);
      g.fillStyle = shade(tint, k * 1.08); g.fillRect(x0, y0, 4, h);
      g.fillStyle = shade(tint, k * 0.68); g.fillRect(x0, y0 + h - 5, w, 5);
      g.fillStyle = shade(tint, k * 0.8); g.fillRect(x0 + w - 4, y0, 4, h);
      // 偶尔的剥落/灰浆斑（k_9 那种浅色块）
      if (r() < 0.12) {
        g.fillStyle = shade([150, 120, 95], 0.9 + r() * 0.2);
        const px = x0 + r() * w * 0.6, py = y0 + r() * h * 0.4;
        for (let k2 = 0; k2 < 6; k2++) g.fillRect(px + (r() - 0.3) * 20, py + (r() - 0.3) * 14, 6 + r() * 16, 4 + r() * 10);
      }
    }
  }
  if (!bump) {
    blotches(g, W, H, 40, 99, 0.18);
    grain(g, W, H, 0.12, 2, 5);
  }
  return c;
}
export function brickTexture() {
  return cached('brick', () => finish(drawBrick(false), 'brick'));
}
export function brickBumpTexture() {
  return cached('brickBump', () => finish(drawBrick(true), 'brickBump', { color: false, nearest: false }));
}

// ---------- 冷石墙 / 石柱（灰绿） ----------
function drawStone(bump, plain) {
  const W = 512, H = 512;
  const c = canvas(W, H), g = c.getContext('2d');
  const r = rng(plain ? 77 : 4321);
  const base = [92, 98, 88];
  if (plain) {
    g.fillStyle = bump ? '#fff' : shade(base, 0.95);
    g.fillRect(0, 0, W, H);
    if (!bump) { blotches(g, W, H, 60, 3, 0.16); blotches(g, W, H, 20, 4, 0.06, false); grain(g, W, H, 0.16, 4, 9); }
    return c;
  }
  const rows = 4, cols = 2, m = 4;
  g.fillStyle = bump ? '#000' : '#1a1d19';
  g.fillRect(0, 0, W, H);
  const bh = H / rows, bw = W / cols;
  for (let row = 0; row < rows; row++) {
    const off = (row % 2) * bw * 0.5;
    for (let col = -1; col < cols; col++) {
      const x0 = col * bw + off + m / 2, y0 = row * bh + m / 2, w = bw - m, h = bh - m;
      if (bump) { g.fillStyle = '#ccc'; g.fillRect(x0, y0, w, h); g.fillStyle = '#fff'; g.fillRect(x0 + 4, y0 + 4, w - 8, h - 8); continue; }
      const k = 0.82 + r() * 0.3;
      const tint = mix(base, [80, 92, 84], r());
      g.fillStyle = shade(tint, k); g.fillRect(x0, y0, w, h);
      g.fillStyle = shade(tint, k * 1.15); g.fillRect(x0, y0, w, 5);
      g.fillStyle = shade(tint, k * 0.7); g.fillRect(x0, y0 + h - 6, w, 6);
      g.fillStyle = shade(tint, k * 0.82); g.fillRect(x0 + w - 5, y0, 5, h);
    }
  }
  if (!bump) { blotches(g, W, H, 50, 11, 0.16); grain(g, W, H, 0.15, 4, 21); }
  return c;
}
export function stoneTexture(opts = {}) {
  const plain = !!opts.plain;
  const key = plain ? 'stonePlain' : 'stone';
  return cached(key, () => finish(drawStone(false, plain), key));
}
export function stoneBumpTexture() {
  return cached('stoneBump', () => finish(drawStone(true, false), 'stoneBump', { color: false, nearest: false }));
}

// ---------- 木板 ----------
function drawWood(tone) {
  const W = 256, H = 256;
  const c = canvas(W, H), g = c.getContext('2d');
  const r = rng(tone === 'panel' ? 55 : tone === 'light' ? 66 : 33);
  const base = tone === 'panel' ? [80, 64, 40] : tone === 'light' ? [112, 80, 54] : [70, 57, 48];
  const planks = tone === 'panel' ? 1 : 6;
  const ph = H / planks;
  for (let p = 0; p < planks; p++) {
    const k = 0.85 + r() * 0.3;
    g.fillStyle = shade(base, k);
    g.fillRect(0, p * ph, W, ph);
    // 木纹：沿 U 方向的细长条纹
    const lines = tone === 'panel' ? 70 : 12;
    for (let i = 0; i < lines; i++) {
      const y = p * ph + r() * ph;
      const len = 30 + r() * 200, x = r() * W;
      g.fillStyle = r() < 0.5 ? shade(base, k * (0.6 + r() * 0.2)) : shade(base, k * (1.15 + r() * 0.2));
      const th = tone === 'panel' ? 1 + (r() * 2 | 0) : 1;
      g.fillRect(x, y, len, th);
      if (x + len > W) g.fillRect(x - W, y, len, th);
    }
    if (planks > 1) {
      g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(0, p * ph, W, 2);
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, p * ph + 2, W, 1);
      // 钉子/结疤
      if (r() < 0.6) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(r() * W, p * ph + ph * 0.3 + r() * ph * 0.4, 4, 3); }
    }
  }
  if (tone === 'panel') blotches(g, W, H, 30, 8, 0.25);
  grain(g, W, H, 0.1, 2, 13);
  return c;
}
/** opts.tone: 'dark'（默认，桌面/架子）| 'light'（偏红褐）| 'panel'（售货机下部的橄榄褐木纹） */
export function woodTexture(opts = {}) {
  const tone = opts.tone || 'dark';
  const key = 'wood_' + tone;
  return cached(key, () => finish(drawWood(tone), key));
}

// ---------- 地砖 ----------
export function floorTexture() {
  return cached('floor', () => {
    const W = 256, H = 256, n = 2, m = 4;
    const c = canvas(W, H), g = c.getContext('2d');
    const r = rng(808);
    g.fillStyle = '#0d0d0c'; g.fillRect(0, 0, W, H);
    const s = W / n;
    const base = [48, 47, 44];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x0 = i * s + m / 2, y0 = j * s + m / 2, w = s - m;
      const k = 0.8 + r() * 0.35;
      g.fillStyle = shade(base, k); g.fillRect(x0, y0, w, w);
      g.fillStyle = shade(base, k * 1.12); g.fillRect(x0, y0, w, 3);
      g.fillStyle = shade(base, k * 0.75); g.fillRect(x0, y0 + w - 3, w, 3);
    }
    blotches(g, W, H, 30, 12, 0.22);
    grain(g, W, H, 0.14, 2, 31);
    return finish(c, 'floor');
  });
}

// ---------- 旧纸 ----------
export function paperTexture() {
  return cached('paper', () => {
    const W = 256, H = 256;
    const c = canvas(W, H), g = c.getContext('2d');
    const r = rng(2024);
    g.fillStyle = '#d9cfb4'; g.fillRect(0, 0, W, H);
    // 污渍
    for (let i = 0; i < 14; i++) {
      const x = r() * W, y = r() * H, rad = 10 + r() * 40;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(150,120,70,${0.08 + r() * 0.12})`);
      gr.addColorStop(1, 'rgba(150,120,70,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // 边缘发暗
    const v = g.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(90,60,20,0.25)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    grain(g, W, H, 0.05, 2, 41);
    return finish(c, 'paper', { nearest: false });
  });
}

// ---------- 深铁 ----------
export function metalTexture() {
  return cached('metal', () => {
    const W = 128, H = 128;
    const c = canvas(W, H), g = c.getContext('2d');
    const r = rng(999);
    g.fillStyle = '#d4d4d4'; g.fillRect(0, 0, W, H);
    blotches(g, W, H, 26, 17, 0.12);
    // 划痕
    for (let i = 0; i < 18; i++) {
      g.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.06})`;
      g.save(); g.translate(r() * W, r() * H); g.rotate(r() * Math.PI);
      g.fillRect(0, 0, 8 + r() * 30, 1); g.restore();
    }
    grain(g, W, H, 0.07, 2, 3);
    return finish(c, 'metal');
  });
}

/** 中心亮、四周透明的径向渐变（光晕 / 发光平面用） */
export function glowTexture() {
  return cached('glow', () => {
    const c = canvas(128, 128), g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return finish(c, 'glow', { nearest: false });
  });
}

/** 纯色小贴图（价签、屏幕默认底图），w×h，可带细边框 */
export function plateTexture(bg = '#060606', border = '#1e1e1e', w = 256, h = 64) {
  const key = `plate_${bg}_${border}_${w}x${h}`;
  return cached(key, () => {
    const c = canvas(w, h), g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (border) { g.strokeStyle = border; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3); }
    grain(g, w, h, 0.25, 2, 6);
    return finish(c, key, { nearest: false });
  });
}

// ---------- 世界坐标 UV ----------
/**
 * 按世界尺寸（几何局部坐标）重写 UV：盒式投影（按法线主轴选平面）。
 * tile = 一次贴图平铺对应的米数。适用于 Box / Extrude 等块状几何。
 */
export function applyWorldUV(geometry, tile = 1, offset = [0, 0]) {
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const p = geometry.attributes.position, n = geometry.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = n.getX(i) > 0 ? -z : z; v = y; }
    else if (ay >= az) { u = x; v = n.getY(i) > 0 ? -z : z; }
    else { u = n.getZ(i) > 0 ? x : -x; v = y; }
    uv[i * 2] = u / tile + offset[0];
    uv[i * 2 + 1] = v / tile + offset[1];
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

// ---------- 材质工厂 ----------
/**
 * 返回共享材质表（缓存，多次调用返回同一对象）。
 * 需要独立动画（闪烁/变色）时请 .clone() 后再改。
 */
export function makeMaterials() {
  if (_mat.has('all')) return _mat.get('all');
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0.05 }, o));
  const metal = metalTexture();
  const M = {
    brick: std({ map: brickTexture(), bumpMap: brickBumpTexture(), bumpScale: 1.5, roughness: 0.92 }),
    stone: std({ map: stoneTexture(), bumpMap: stoneBumpTexture(), bumpScale: 1.2, roughness: 0.9, color: 0xffffff }),
    stonePlain: std({ map: stoneTexture({ plain: true }), roughness: 0.92 }),
    wood: std({ map: woodTexture(), roughness: 0.82 }),
    woodLight: std({ map: woodTexture({ tone: 'light' }), roughness: 0.8 }),
    woodPanel: std({ map: woodTexture({ tone: 'panel' }), roughness: 0.75 }),
    floor: std({ map: floorTexture(), roughness: 0.9 }),
    paper: std({ map: paperTexture(), roughness: 0.95, side: THREE.DoubleSide }),
    iron: std({ map: metal, color: 0x6a6d72, roughness: 0.5, metalness: 0.25 }),
    darkIron: std({ map: metal, color: 0x45484d, roughness: 0.55, metalness: 0.2 }),
    blackIron: std({ map: metal, color: 0x2a2c30, roughness: 0.5, metalness: 0.2 }),
    steel: std({ color: 0x9a9ea4, roughness: 0.35, metalness: 0.3 }),
    brass: std({ color: 0xb08a48, roughness: 0.45, metalness: 0.3, emissive: 0x1a1004, emissiveIntensity: 0.5 }),
    gold: std({ color: 0xd8aa52, roughness: 0.35, metalness: 0.35, emissive: 0x4a3008, emissiveIntensity: 0.5 }),
    copper: std({ color: 0xb4562e, roughness: 0.4, metalness: 0.3 }),
    coal: std({ color: 0x2a2624, roughness: 0.95, emissive: 0xff6a1a, emissiveIntensity: 0.6 }),
    coalCold: std({ color: 0x1e1c1b, roughness: 0.9, metalness: 0.1 }),
    coalHot: std({ color: 0xffd9a0, roughness: 0.9, emissive: 0xffa040, emissiveIntensity: 1.5 }),
    machineGreen: std({ map: metal, color: 0x46574c, roughness: 0.6, metalness: 0.15 }),
    machineDark: std({ map: metal, color: 0x2a332d, roughness: 0.65, metalness: 0.15 }),
    rubber: std({ color: 0x141414, roughness: 0.9 }),
    black: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    void: new THREE.MeshBasicMaterial({ color: 0x020202, side: THREE.BackSide }),
    salmon: std({ color: 0xe0806e, roughness: 0.7 }),
    cream: std({ color: 0xe6dccb, roughness: 0.7 }),
    rope: std({ color: 0x6b5236, roughness: 0.95 }),
    leather: std({ color: 0x6a4a32, roughness: 0.9 }),
    red: std({ color: 0xb01818, roughness: 0.5, metalness: 0.1, emissive: 0x400000, emissiveIntensity: 0.6 }),
    warmLight: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.85, 0.55).multiplyScalar(2.0) }),
    lampWhite: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.95, 0.85).multiplyScalar(3.0) }),
  };
  for (const [k, m] of Object.entries(M)) m.name = k;
  _mat.set('all', M);
  return M;
}
