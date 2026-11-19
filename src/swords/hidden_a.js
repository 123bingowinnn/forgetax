// 第三轮隐藏家族（原创形态）：熔岩巨剑 60–65、雷霆剑 70–75。
// 建模方式与 citadel_holy.js 相同：在「参考图坐标系」里搭建（像素单位：+X = 图右、+Y = 剑尖方向、
// +Z = 朝向观者，原点 = 护手中心），finishForm 转换到剑坐标（剑尖 +X、正面 +Y、图右 +Z）并缩放到目标总长。
// 动画部件（漂浮熔岩块、火焰、闪电、电球、旋转环、滴落熔岩）用 userData.dyn 的子组，不参与静态合并。
import * as THREE from 'three';
import { mat, glow, box, bbox, ext, cyl, oct, ring, spikeCone, gripY, finishForm, rng } from './citadel_holy.js';

const PI = Math.PI;
const TAU = PI * 2;

// ============================================================================
// 通用
// ============================================================================
const ICO0 = new THREE.IcosahedronGeometry(1, 0);
const ICO1 = new THREE.IcosahedronGeometry(1, 1);
const DODE = new THREE.DodecahedronGeometry(1, 0);

function mesh(p, geo, m, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z); me.scale.set(sx, sy, sz);
  p.add(me);
  return me;
}
function dynGroup(p, x = 0, y = 0, z = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.userData.dyn = true; p.add(g);
  return g;
}
/** 每次 build 独立的「呼吸」发光材质：update 时按 userData.pulse 调制 emissiveIntensity */
function pulseMat(color, ei, sp = 2, ph = 0, mode = 'breath', base = null) {
  const m = new THREE.MeshStandardMaterial({
    color: base ?? color, emissive: color, emissiveIntensity: ei, roughness: 0.5, metalness: 0, flatShading: true,
  });
  m.userData.pulse = { ei, sp, ph, mode };
  return m;
}
/** 线段（带重叠，转角处不留缝） */
function seg(p, x0, y0, x1, y1, w, d, m, z) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  return box(p, L + w * 0.6, w, d, m, (x0 + x1) / 2, (y0 + y1) / 2, z, Math.atan2(dy, dx));
}
function poly(p, pts, w, d, m, z) {
  for (let i = 0; i < pts.length - 1; i++) seg(p, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, d, m, z);
}
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

/**
 * 棱面剑身放样。rows = [[y, hw], ...] 自下而上，最后一行 hw=0 为剑尖；
 * 截面：中间平面（宽 hw-bev）+ 两侧倒角，正面 z=+t、背面 z=-t、刃口厚 t*edge。
 */
function facet(p, rows, bev, t, mF, mB, edge = 0.14, xOff = 0) {
  const face = [], bevs = [];
  const sec = rows.map(([y, hw, x = 0]) => ({ y, hw, fw: Math.max(0, hw - Math.min(bev, hw)), x: x + xOff }));
  const P = (x, y, z) => [x, y, z];
  for (const zs of [1, -1]) {
    const quad = (arr, a, b, c, d) => { if (zs > 0) arr.push(a, b, c, a, c, d); else arr.push(a, c, b, a, d, c); };
    for (let i = 0; i < sec.length - 1; i++) {
      const A = sec[i], B = sec[i + 1];
      const ta = zs * t, ea = zs * t * edge;
      quad(face, P(A.x - A.fw, A.y, ta), P(A.x + A.fw, A.y, ta), P(B.x + B.fw, B.y, ta), P(B.x - B.fw, B.y, ta));
      quad(bevs, P(A.x - A.hw, A.y, ea), P(A.x - A.fw, A.y, ta), P(B.x - B.fw, B.y, ta), P(B.x - B.hw, B.y, ea));
      quad(bevs, P(A.x + A.fw, A.y, ta), P(A.x + A.hw, A.y, ea), P(B.x + B.hw, B.y, ea), P(B.x + B.fw, B.y, ta));
    }
  }
  for (let i = 0; i < sec.length - 1; i++) {
    const A = sec[i], B = sec[i + 1], e = t * edge;
    for (const s of [-1, 1]) {
      const a = P(A.x + s * A.hw, A.y, e), b = P(B.x + s * B.hw, B.y, e), c = P(B.x + s * B.hw, B.y, -e), d = P(A.x + s * A.hw, A.y, -e);
      if (s > 0) bevs.push(a, d, c, a, c, b); else bevs.push(a, b, c, a, c, d);
    }
  }
  const A = sec[0], e = t * edge;
  bevs.push(P(A.x - A.hw, A.y, -t), P(A.x + A.hw, A.y, -t), P(A.x + A.hw, A.y, t), P(A.x - A.hw, A.y, -t), P(A.x + A.hw, A.y, t), P(A.x - A.hw, A.y, t));
  void e;
  const mk = (arr, m) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr.flat(), 3));
    g.computeVertexNormals();
    p.add(new THREE.Mesh(g, m));
  };
  mk(face, mF); mk(bevs, mB);
}
/** 剑身轮廓外扩（发光刃缘）：放在剑身后面，略大一圈 */
function rimRows(rows, d, tipD = d * 1.6) {
  return rows.map(([y, hw, x], i) => (i === rows.length - 1 ? [y + tipD, 0, x] : [y, hw + d, x]));
}
function hwAt(rows, y) {
  for (let i = 0; i < rows.length - 1; i++) {
    const [y0, h0] = rows[i], [y1, h1] = rows[i + 1];
    if (y >= y0 && y <= y1) return h0 + (h1 - h0) * (y - y0) / (y1 - y0 || 1);
  }
  return 0;
}

/** 裂缝网络（正反两面）：主裂缝沿中线蜿蜒向上，分支斜向刃口 */
function cracks(p, rows, bev, t, m, seed, o = {}) {
  const r = rng(seed);
  const y0 = o.y0 ?? rows[0][0] + 6, y1 = o.y1 ?? rows[rows.length - 1][0] - 30;
  const step = o.step ?? 13, w = o.w ?? 2.2, nBr = o.branches ?? 4;
  const main = [];
  let x = 0;
  for (let y = y0; y <= y1; y += step * (0.75 + r() * 0.5)) {
    const fw = Math.max(1, hwAt(rows, y) - bev) * 0.45;
    x = Math.max(-fw, Math.min(fw, x + (r() - 0.5) * step * 0.9));
    main.push([x, y]);
  }
  const lines = [main];
  for (let k = 0; k < nBr; k++) {
    const i = 1 + Math.floor(r() * (main.length - 2));
    const s = k % 2 ? 1 : -1;
    const br = [main[i]];
    let [bx, by] = main[i];
    const n = 2 + Math.floor(r() * 2);
    for (let j = 0; j < n; j++) {
      by += step * (0.4 + r() * 0.5);
      const fw = Math.max(1, hwAt(rows, by) - bev) * 0.95;
      bx = Math.max(-fw, Math.min(fw, bx + s * step * (0.6 + r() * 0.6)));
      br.push([bx, by]);
    }
    lines.push(br);
  }
  for (const zs of o.oneSide ? [1] : [1, -1]) for (const [li, L] of lines.entries()) poly(p, L, li === 0 ? w * 1.25 : w, 1.2, m, zs * (t + 0.3));
  return lines;
}

/** 闪电折线组（独立 dyn 组，用于闪烁） */
function bolt(p, a, b, n, jit, w, m, seed, z = 0, branch = true) {
  const g = dynGroup(p);
  const r = rng(seed);
  const pts = [a];
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  for (let i = 1; i < n; i++) {
    const f = i / n, o = (r() - 0.5) * 2 * jit;
    pts.push([a[0] + dx * f + nx * o, a[1] + dy * f + ny * o, (r() - 0.5) * jit * 0.6]);
  }
  pts.push(b);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0, z0 = 0] = pts[i], [x1, y1, z1 = 0] = pts[i + 1];
    seg(g, x0, y0, x1, y1, w, w, m, z + (z0 + z1) / 2);
  }
  if (branch && pts.length > 3) {
    const i = 1 + Math.floor(r() * (pts.length - 2));
    const [bx, by] = pts[i];
    const ex = bx + nx * jit * 2.2 * (r() < 0.5 ? -1 : 1) + dx * 0.15, ey = by + ny * jit * 2.2 + dy * 0.15;
    seg(g, bx, by, (bx + ex) / 2 + (r() - 0.5) * jit, (by + ey) / 2, w * 0.7, w * 0.7, m, z);
    seg(g, (bx + ex) / 2 + (r() - 0.5) * jit, (by + ey) / 2, ex, ey, w * 0.6, w * 0.6, m, z);
  }
  return g;
}
/** 闪烁控制：每隔 period 秒随机重排一次可见性 */
function flicker(anims, bolts, rate = 9, prob = 0.45, salt = 0) {
  anims.push((dt, t) => {
    const slot = Math.floor(t * rate);
    bolts.forEach((b, i) => { b.visible = hash(slot + salt, i * 7.3 + salt) < prob; });
  });
}

/** 收尾：加入 pulse 动画 + 组合 anims */
function done(g, L, anims, opts = {}) {
  const root = finishForm(g, L, { ...opts, update: () => {} });
  const pulsing = [];
  root.traverse(o => { if (o.isMesh) pulsing.push(o); });
  root.userData.update = (dt, t) => {
    for (const f of anims) f(dt, t);
    const heated = (root.userData.heat || 0) > 0;
    if (heated) return;
    for (const o of pulsing) {
      const m = o.material, pu = m && m.userData && m.userData.pulse;
      if (!pu || m.isShaderMaterial) continue;
      let f;
      if (pu.mode === 'flicker') f = 0.55 + 0.45 * Math.abs(Math.sin(t * pu.sp + pu.ph) * Math.sin(t * pu.sp * 1.71 + 1.3));
      else f = 0.72 + 0.22 * Math.sin(t * pu.sp + pu.ph) + 0.06 * Math.sin(t * pu.sp * 2.9 + pu.ph);
      m.emissiveIntensity = pu.ei * f;
    }
  };
  return root;
}

// ============================================================================
// 熔岩巨剑 60–65
// ============================================================================
const MG = {
  obs: () => mat(0x26222a, { r: 0.42, m: 0.3 }),
  obsB: () => mat(0x16131a, { r: 0.5, m: 0.3 }),
  basalt: () => mat(0x403833, { r: 0.85, m: 0.05 }),
  basaltD: () => mat(0x2b2522, { r: 0.85, m: 0.05 }),
  iron: () => mat(0x34302e, { r: 0.55, m: 0.3 }),
  copper: () => mat(0x8c3e1e, { r: 0.5, m: 0.3 }),
  grip: () => mat(0x2e2420, { r: 0.85, m: 0 }),
  flame: () => glow(0xff6a18, 1.6),
  flameHot: () => glow(0xffc040, 1.8),
  ember: () => glow(0xff4a10, 1.5),
};

/** 熔岩块：暗色十二面体 + 内部发光二十面体从缝隙透出 */
function lavaChunk(p, s, lava, x = 0, y = 0, z = 0, seed = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); p.add(g);
  const r = rng(seed);
  const a = mesh(g, DODE, MG.basaltD(), 0, 0, 0, s, s * (0.75 + r() * 0.3), s * (0.85 + r() * 0.3));
  a.rotation.set(r() * 3, r() * 3, r() * 3);
  const b = mesh(g, ICO0, lava, 0, 0, 0, s * 1.02);
  b.rotation.set(r() * 3, r() * 3, r() * 3);
  return g;
}
/** 漂浮熔岩块（沿椭圆轨道 + 上下浮动 + 自转） */
function floaters(p, anims, n, cx, cy, rx, ry, rz, s, lava, seed, speed = 0.5, bob = 3) {
  for (let i = 0; i < n; i++) {
    const g = dynGroup(p);
    const ss = s * (0.7 + hash(seed, i) * 0.6);
    lavaChunk(g, ss, lava, 0, 0, 0, seed * 10 + i);
    const a0 = (i / n) * TAU, ph = hash(i, seed) * TAU;
    const place = (t) => {
      const a = a0 + t * speed;
      g.position.set(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry + Math.sin(t * 1.6 + ph) * bob, rz + Math.sin(a) * rz * 0.0 + Math.cos(a * 1) * rz);
      g.rotation.set(t * 0.7 + ph, t * 0.9 + i, 0);
    };
    place(0);
    anims.push((dt, t) => place(t));
  }
}
/** 火焰锥（会跳动） */
function flames(p, anims, list, seed = 1) {
  for (const [i, [x, y, z, r, h, ang = PI / 2]] of list.entries()) {
    const g = dynGroup(p, x, y, z);
    const outer = spikeCone(g, r, h, 5, MG.flame(), 0, 0, 0, ang);
    const inner = spikeCone(g, r * 0.55, h * 0.62, 5, MG.flameHot(), 0, 0, r * 0.3, ang);
    const ph = hash(seed, i) * TAU;
    anims.push((dt, t) => {
      const k = 0.78 + 0.22 * Math.sin(t * 9 + ph) * Math.sin(t * 5.3 + ph * 2);
      outer.scale.y = h * k; inner.scale.y = h * 0.62 * (1.1 - (k - 0.78));
      g.rotation.y = t * 1.5 + ph;
    });
  }
}
/** 滴落的熔岩（循环下落） */
function drips(p, anims, list, lava) {
  for (const [i, [x, y0, y1, z]] of list.entries()) {
    const g = dynGroup(p, x, y0, z);
    const d = oct(g, 3.2, 6, 3.2, lava, 0, 0, 0);
    const ph = hash(i, 3.3);
    anims.push((dt, t) => {
      const u = (t * 0.55 + ph) % 1;
      g.position.y = y0 + (y1 - y0) * u * u;
      d.scale.set(3.2 * (1 - u * 0.5), 6 + u * 4, 3.2 * (1 - u * 0.5));
      g.visible = u < 0.92;
    });
  }
}
/** 粗岩块护手 */
function rockGuard(p, gw, gh, gd, lava, seed, o = {}) {
  const r = rng(seed);
  bbox(p, gw * 0.42, gh, gd, MG.basalt(), 0, 0, 0, 2);
  for (const s of [-1, 1]) {
    const m = bbox(p, gw * 0.34, gh * 0.8, gd * 0.86, s > 0 ? MG.basaltD() : MG.basalt(), s * gw * 0.32, (o.lift ?? 3), 0, 2);
    m.rotation.z = s * (0.12 + r() * 0.06);
    const tip = bbox(p, gw * 0.14, gh * 0.62, gd * 0.7, MG.basalt(), s * gw * 0.47, (o.lift ?? 3) + 4, 0, 1.5);
    tip.rotation.z = s * 0.35;
  }
  // 熔岩缝
  box(p, gw * 0.8, 1.8, gd + 0.6, lava, 0, -gh * 0.12, 0);
  box(p, 1.8, gh * 0.9, gd + 0.6, lava, gw * 0.12, 0, 0);
  box(p, 1.8, gh * 0.9, gd + 0.6, lava, -gw * 0.12, 0, 0);
}
function magmaHilt(p, lava, hot, gy0, gy1, pEnd, r = 7) {
  gripY(p, r, gy0, gy1, MG.grip(), 11, 6);
  for (let y = gy0 - 8; y > gy1 + 4; y -= 14) box(p, r * 2.3, 1.6, r * 2.3, lava, 0, y, 0);
  bbox(p, r * 3.2, 6, r * 3.2, MG.basalt(), 0, gy1 - 1, 0, 1.2);
  const pr = gy1 - 3 - pEnd;
  oct(p, r * 2.8, pr, r * 2.8, MG.basaltD(), 0, gy1 - 3 - pr / 2, 0);
  oct(p, r * 1.8, pr * 0.7, r * 3.0, hot, 0, gy1 - 3 - pr / 2, 0);
}

const magmaSpecs = {
  60: { L: 1.0, rows: [[8, 34], [30, 37], [166, 34], [204, 25], [236, 0]], bev: 10, t: 7.5, br: 4, guard: [96, 17, 19], gy1: -62, pEnd: -82 },
  61: { L: 1.1, rows: [[8, 32], [40, 35], [176, 31], [212, 23], [248, 0]], bev: 10, t: 7.5, br: 6, rim: 3.2, guard: [94, 17, 19], gy1: -58, pEnd: -78, drips: true },
  62: { L: 1.2, rows: [[16, 34], [48, 38], [182, 33], [220, 24], [256, 0]], bev: 10, t: 8, br: 7, rim: 3.5, volcano: true, gy1: -52, pEnd: -72, float: 2 },
  63: { L: 1.3, fang: true, bev: 9, t: 8, br: 8, rim: 3.5, horns: true, gy1: -50, pEnd: -70, float: 4 },
  64: { L: 1.4, rows: [[24, 40], [60, 45], [194, 39], [230, 28], [266, 0]], bev: 11, t: 9, br: 8, rim: 4, furnace: true, gy1: -46, pEnd: -64, float: 6 },
  65: { L: 1.5, rows: [[26, 42], [66, 48], [204, 42], [240, 30], [276, 0]], bev: 12, t: 10, br: 10, rim: 4.5, throne: true, gy1: -44, pEnd: -62, float: 8 },
};

function fangRows() {
  const rows = [[18, 36]];
  let y = 18;
  for (let i = 0; i < 10; i++) {
    y += 9; rows.push([y, 31 - i * 0.3]);
    y += 9; rows.push([y, 41 - i * 0.6]);
  }
  rows.push([y + 22, 26], [y + 52, 0]);
  return rows;
}

function magmaForm(id) {
  const S = magmaSpecs[id];
  const g = new THREE.Group(), anims = [];
  const lava = pulseMat(0xff4a12, 1.7, 2.2, id);
  const hot = pulseMat(0xffa62a, 1.9, 2.8, id + 1);
  const rows = S.fang ? fangRows() : S.rows;
  const { bev, t } = S;
  // 发光刃缘（在剑身后面略大一圈）
  const rimM = pulseMat(0xe2401a, 1.0, 2.2, id + 2, 'breath', 0x5a1a0a);
  if (S.rim) facet(g, rimRows(rows, S.rim), bev * 0.5, t * 0.6, rimM, rimM, 0.3);
  facet(g, rows, bev, t, MG.obs(), MG.obsB());
  // 裂缝
  cracks(g, rows, bev, t, lava, id * 3 + 1, { branches: S.br, step: 13 });
  if (id >= 62) cracks(g, rows, bev, t, hot, id * 5 + 2, { branches: 0, step: 18, w: 1.4, y0: rows[0][0] + 20 });
  const tipY = rows[rows.length - 1][0];
  // 剑尖附近一点白热
  if (id >= 61) oct(g, 4, 10, 2, hot, 0, tipY - 26, t + 0.6);

  // ---- 护手 ----
  if (S.guard) {
    const [gw, gh, gd] = S.guard;
    rockGuard(g, gw, gh, gd, lava, id);
    oct(g, 10, 14, 6, hot, 0, 0, gd / 2 + 1.5);
  }
  if (S.drips) {
    for (const s of [-1, 1]) for (const k of [0.22, 0.38]) {
      spikeCone(g, 2.8, 9, 4, lava, s * 94 * k, -7, 0, -PI / 2);
    }
    drips(g, anims, [[-20, -12, -46, 9], [33, -12, -50, 9], [-36, -10, -40, 9]], lava);
    // 剑身流淌的岩浆线（沿刃口内侧）
    for (const s of [-1, 1]) {
      const pts = [];
      for (let y = 30; y < tipY - 40; y += 18) pts.push([s * (hwAt(rows, y) - bev - 2 + Math.sin(y * 0.3) * 2), y]);
      poly(g, pts, 2, 1.2, lava, t + 0.3);
    }
  }
  if (S.volcano) {
    // 火山：梯形岩丘 + 火山口 + 核心
    ext(g, [[-64, -10], [64, -10], [42, 16], [22, 34], [12, 26], [-12, 26], [-22, 34], [-42, 16]], 26, [MG.basalt(), MG.basaltD()], 0, 2);
    for (const s of [-1, 1]) {
      ext(g, [[s * 64, -10], [s * 76, -2], [s * 58, 8]], 18, MG.basaltD(), 0, 1);
      box(g, 2, 26, 1.2, lava, s * 40, 4, 14, s * 0.55);
      box(g, 2, 18, 1.2, lava, s * 22, -1, 14, -s * 0.3);
    }
    oct(g, 22, 30, 16, hot, 0, 14, 8);
    ring(g, 14, 2.4, MG.iron(), 0, 14, 12, 4, 8);
    flames(g, anims, [[-17, 30, 6, 6, 22], [17, 30, 6, 6, 22], [0, 28, -4, 7, 28]], id);
  }
  if (S.horns) {
    // 炎魔：骷髅状中块 + 双眼 + 弯角
    ext(g, [[-26, -12], [26, -12], [32, 6], [20, 22], [-20, 22], [-32, 6]], 24, [MG.basalt(), MG.basaltD()], 0, 2);
    for (const s of [-1, 1]) {
      ext(g, [[s * 6, 4], [s * 18, 8], [s * 16, 13], [s * 6, 10]], 2, hot, 12.5, 0);
      let x = s * 28, y = 4, a = s > 0 ? 0.25 : PI - 0.25, r = 9;
      for (let k = 0; k < 6; k++) {
        const L = 13 - k;
        const cone = spikeCone(g, r, L + 3, 6, k % 2 ? MG.basaltD() : MG.basalt(), x, y, 0, a);
        void cone;
        x += Math.cos(a) * L; y += Math.sin(a) * L;
        a += s > 0 ? 0.32 : -0.32;
        r *= 0.8;
      }
      spikeCone(g, r, 12, 5, hot, x, y, 0, a);
      box(g, 2, 16, 1.2, lava, s * 22, 0, 12.6, s * 0.5);
    }
    flames(g, anims, [[0, 22, 0, 8, 28]], id);
    // 脊背火焰锥
    for (let k = 0; k < 4; k++) spikeCone(g, 3, 9, 4, hot, 0, 60 + k * 40, t + 0.5, PI / 2);
  }
  if (S.furnace) {
    // 熔炉窗口
    const wy0 = 70, wy1 = 182, ww = 17;
    box(g, ww * 2, wy1 - wy0, 2, hot, 0, (wy0 + wy1) / 2, t + 0.4);
    for (const s of [-1, 1]) box(g, 5, wy1 - wy0 + 10, 4, MG.iron(), s * (ww + 2), (wy0 + wy1) / 2, t + 1.2);
    for (const y of [wy0 - 3, wy1 + 3]) box(g, ww * 2 + 9, 5, 4, MG.iron(), 0, y, t + 1.2);
    for (const x of [-8, 0, 8]) box(g, 2.2, wy1 - wy0, 3, MG.iron(), x, (wy0 + wy1) / 2, t + 1.8);
    for (let y = wy0 + 14; y < wy1; y += 22) box(g, ww * 2, 1.8, 3, MG.iron(), 0, y, t + 1.8);
    // 熔炉护手：铁箱 + 发光炉栅 + 两侧烟囱
    bbox(g, 104, 30, 28, MG.iron(), 0, 2, 0, 2.5);
    box(g, 108, 4, 30, MG.copper(), 0, 16, 0);
    box(g, 108, 4, 30, MG.copper(), 0, -12, 0);
    for (let k = -3; k <= 3; k++) box(g, 8, 2.4, 1, hot, k * 11, 2 + (k % 2) * 0, 14.4);
    for (let y = -4; y <= 8; y += 6) box(g, 80, 1.6, 1.2, MG.iron(), 0, y, 15);
    for (const s of [-1, 1]) {
      cyl(g, 6, 7, 34, 6, MG.iron(), s * 58, 30, 0);
      cyl(g, 8, 8, 4, 6, MG.copper(), s * 58, 46, 0);
      ring(g, 7, 1.4, lava, s * 58, 20, 0, 4, 8, 'y');
    }
    flames(g, anims, [[-58, 48, 0, 8, 32], [58, 48, 0, 8, 32]], id);
  }
  if (S.throne) {
    // 王座：座板 + 两侧高背柱 + 扶手 + 尖刺冠
    bbox(g, 116, 18, 32, MG.basalt(), 0, 0, 0, 2.5);
    box(g, 118, 3, 33, lava, 0, -4, 0);
    for (const s of [-1, 1]) {
      ext(g, [[s * 44, 4], [s * 60, 4], [s * 58, 70], [s * 51, 96], [s * 45, 70]], 22, [MG.obs(), MG.obsB()], 0, 1.5);
      box(g, 2, 60, 1.2, lava, s * 52, 40, 11.8);
      oct(g, 8, 12, 4, hot, s * 52, 74, 11);
      bbox(g, 20, 14, 28, MG.basaltD(), s * 60, -12, 0, 2);
      spikeCone(g, 4, 10, 5, MG.basalt(), s * 59, 44, 0, s > 0 ? 0.3 : PI - 0.3);
      spikeCone(g, 4, 10, 5, MG.basalt(), s * 59, 24, 0, s > 0 ? 0.15 : PI - 0.15);
    }
    for (const [k, x] of [-30, -15, 0, 15, 30].entries()) spikeCone(g, 4.5, k === 2 ? 22 : 14, 5, k === 2 ? hot : MG.basalt(), x, 9, 8, PI / 2);
    flames(g, anims, [[-51, 94, 0, 8, 34], [51, 94, 0, 8, 34], [0, 30, 0, 7, 24]], id);
    // 中央熔流
    box(g, 4, tipY - 80, 1.4, hot, 0, (tipY - 40) / 2 + 20, t + 0.8);
    // 剑身两侧火焰锥（逐级华丽）
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) spikeCone(g, 3.2, 12, 4, hot, s * (hwAt(rows, 100 + k * 40) + S.rim), 100 + k * 40, 0, s > 0 ? 0.6 : PI - 0.6);
  }
  if (S.float) {
    const n = S.float;
    if (id === 62) floaters(g, anims, n, 0, 64, 56, 24, 12, 6, lava, id, 0.45, 2.5);
    else if (id === 63) floaters(g, anims, n, 0, 120, 54, 80, 14, 6, lava, id, 0.35, 3);
    else floaters(g, anims, n, 0, 140, id === 65 ? 58 : 56, 112, 16, id === 65 ? 7.5 : 6.5, lava, id, 0.3, 3);
  }
  magmaHilt(g, lava, hot, S.guard ? -S.guard[1] / 2 : -10, S.gy1, S.pEnd, 7);
  return done(g, S.L, anims);
}

// ============================================================================
// 雷霆剑 70–75
// ============================================================================
const TM = {
  steel: () => mat(0x34487a, { r: 0.42, m: 0.32 }),
  steelB: () => mat(0x1c2240, { r: 0.45, m: 0.3 }),
  purple: () => mat(0x3c3266, { r: 0.45, m: 0.3 }),
  purpleD: () => mat(0x241d40, { r: 0.5, m: 0.3 }),
  gold: () => mat(0xc99a3e, { r: 0.4, m: 0.35 }),
  copper: () => mat(0xa85a2c, { r: 0.45, m: 0.32 }),
  grip: () => mat(0x2a2338, { r: 0.8, m: 0.05 }),
  bolt: () => glow(0xb8f2ff, 1.9),
  boltV: () => glow(0xb49cff, 2.2),
  shell: () => mat(0x9fe8ff, { e: 0x7fdcff, ei: 1.2, op: 0.35, r: 0.3, m: 0 }),
};

/** 锯齿闪电状护手翼 */
function zigWing(s, w, h, n) {
  const pts = [[s * 6, -h / 2], [s * 6, h / 2]];
  for (let i = 1; i <= n; i++) {
    const x = s * (6 + (w - 6) * i / n);
    pts.push([x - s * (w / n) * 0.4, h / 2 + i * 2.6], [x, h / 2 - 2 + i * 1.2]);
  }
  pts.push([s * (w + 6), h / 2 + n * 2.6 + 6]);
  pts.push([s * w, -h / 2 + 2]);
  for (let i = n; i >= 1; i--) {
    const x = s * (6 + (w - 6) * i / n);
    pts.push([x - s * (w / n) * 0.5, -h / 2 - 3], [x - s * (w / n) * 0.7, -h / 2 + 1]);
  }
  return s > 0 ? pts : pts.reverse();
}
function thunderHilt(p, el, gw, gh, gy1, pEnd, r = 6.5, o = {}) {
  for (const s of [-1, 1]) {
    ext(p, zigWing(s, gw / 2, gh, o.zig ?? 3), 12, [TM.steel(), TM.purpleD()], 0, 1);
    box(p, gw / 2 - 8, 1.6, 1, el, s * gw / 4 + s * 2, 0, 6.6);
  }
  bbox(p, 26, gh + 6, 16, TM.purple(), 0, 0, 0, 1.6);
  box(p, 28, 2.2, 17, TM.gold(), 0, gh / 2 + 2, 0);
  oct(p, 12, 16, 6, el, 0, 1, 8.5);
  gripY(p, r, -gh / 2 - 3, gy1, TM.grip(), 12, 6);
  for (let y = -gh / 2 - 10; y > gy1 + 4; y -= 11) box(p, r * 2.2, 1.4, r * 2.2, TM.gold(), 0, y, 0);
  box(p, r * 3, 4, r * 3, TM.gold(), 0, gy1 - 1, 0);
  const pr = gy1 - 3 - pEnd;
  oct(p, r * 2.8, pr, r * 2.8, TM.purple(), 0, gy1 - 3 - pr / 2, 0);
  oct(p, r * 1.5, pr * 0.65, r * 3.0, el, 0, gy1 - 3 - pr / 2, 0);
}
/** 中线闪电（静态，发光材质闪烁） */
function zigLine(p, y0, y1, amp, step, w, m, z, seed) {
  const r = rng(seed); const pts = [];
  let s = 1;
  for (let y = y0; y <= y1; y += step * (0.8 + r() * 0.4)) { pts.push([s * amp * (0.5 + r() * 0.5), y]); s = -s; }
  pts.push([0, y1 + step * 0.5]);
  poly(p, pts, w, 1.2, m, z);
  poly(p, pts, w, 1.2, m, -z);
}
/** 电球：发光核心 + 半透明外壳，绕中心椭圆运动 */
function orbs(p, anims, n, cx, cy, rx, ry, rz, s, seed, speed = 0.8) {
  for (let i = 0; i < n; i++) {
    const g = dynGroup(p);
    mesh(g, ICO1, TM.bolt(), 0, 0, 0, s * 0.55);
    const sh = mesh(g, ICO0, TM.shell(), 0, 0, 0, s);
    const a0 = (i / n) * TAU, ph = hash(seed, i) * TAU;
    const place = (t) => {
      const a = a0 + t * speed;
      g.position.set(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry + Math.sin(t * 2 + ph) * 2, rz * Math.cos(a));
      sh.rotation.set(t * 2 + ph, t * 3, 0);
      const k = 1 + 0.15 * Math.sin(t * 13 + ph);
      sh.scale.setScalar(s * k);
    };
    place(0);
    anims.push((dt, t) => place(t));
  }
}
/** 带尖刺的避雷环（axis 'z' = 面朝观者的光环；'y' = 环绕剑身） */
function rodRing(p, anims, R, cx, cy, axis, nSpk, speed, el, sy = 1) {
  const g = dynGroup(p, cx, cy, 0);
  const inner = new THREE.Group(); g.add(inner);
  ring(inner, R, R * 0.06, TM.gold(), 0, 0, 0, 4, 24);
  ring(inner, R * 0.92, R * 0.025, el, 0, 0, 0, 3, 24);
  for (let i = 0; i < nSpk; i++) {
    const a = (i / nSpk) * TAU;
    spikeCone(inner, R * 0.07, R * 0.22, 4, i % 2 ? TM.steel() : TM.gold(), Math.cos(a) * R, Math.sin(a) * R, 0, a);
    if (i % 2 === 0) mesh(inner, ICO0, el, Math.cos(a) * R * 1.24, Math.sin(a) * R * 1.24, 0, R * 0.045);
  }
  if (axis === 'y') { g.rotation.x = PI / 2; g.scale.set(1, sy, 1); }
  anims.push((dt, t) => { inner.rotation.z = t * speed; });
  return g;
}

const thunderSpecs = {
  70: { L: 1.0, rows: [[8, 25], [40, 28], [150, 27], [186, 24], [230, 0]], bev: 9, t: 6, bolts: 3, guard: [74, 12], gy1: -58, pEnd: -78 },
  71: { L: 1.1, saw: true, bev: 8, t: 6.5, bolts: 4, guard: [84, 13], gy1: -54, pEnd: -74 },
  72: { L: 1.2, rows: [[10, 30], [44, 32], [170, 29], [204, 20], [218, 6]], bev: 9, t: 7, bolts: 5, rod: true, guard: [92, 13], gy1: -50, pEnd: -70 },
  73: { L: 1.3, rows: [[24, 32], [60, 36], [186, 31], [222, 22], [256, 0]], bev: 10, t: 8, bolts: 6, hammer: true, gy1: -46, pEnd: -66, orbs: 2 },
  74: { L: 1.4, fork: true, bev: 8, t: 8, bolts: 9, guard: [126, 16], zig: 5, gy1: -44, pEnd: -62, orbs: 3, ring: true },
  75: { L: 1.5, rows: [[20, 30], [56, 36], [96, 30], [200, 24], [250, 15], [300, 0]], bev: 9, t: 8, bolts: 10, spear: true, guard: [116, 16], zig: 4, gy1: -42, pEnd: -60, orbs: 4, ring: true },
};

function sawRows() {
  const rows = [[10, 30]];
  let y = 10;
  for (let i = 0; i < 9; i++) { y += 15; rows.push([y, 37 - i * 0.4]); y += 4; rows.push([y, 28 - i * 0.3]); }
  rows.push([y + 22, 22], [y + 50, 0]);
  return rows;
}

function thunderForm(id) {
  const S = thunderSpecs[id];
  const g = new THREE.Group(), anims = [];
  const el = pulseMat(0x8ee8ff, 1.6, 23, id, 'flicker', 0xbff4ff);
  const elV = pulseMat(0x8a6cff, 1.1, 3, id, 'breath', 0x4a3a90);
  const { bev, t } = S;
  const boltM = TM.bolt();
  const boltList = [];
  let rows = S.rows, tipY;
  if (S.saw) rows = sawRows();
  if (S.fork) {
    // 主干 + 双叉
    const trunk = [[18, 34], [56, 38], [100, 34], [116, 22], [126, 0]];
    facet(g, rimRows(trunk, 2.6), bev * 0.5, t * 0.55, elV, elV, 0.3);
    facet(g, trunk, bev, t, TM.steel(), TM.steelB());
    const L = [[92, 15], [210, 13], [240, 9], [270, 0]];
    for (const s of [-1, 1]) {
      const pr = L.map(([y, hw], i) => [y, hw, s * (20 + (y - 92) * 0.07) + (i === L.length - 1 ? -s * 5 : 0)]);
      facet(g, rimRows(pr, 2.5), 3, t * 0.55, elV, elV, 0.3);
      facet(g, pr, bev * 0.6, t * 0.9, TM.steel(), TM.steelB());
      const zp = []; for (let y = 104; y < 236; y += 12) zp.push([s * (20 + (y - 92) * 0.07) + ((y / 12) % 2 ? 2.5 : -2.5), y]); poly(g, zp, 1.6, 1.2, el, t * 0.9 + 0.3); poly(g, zp, 1.6, 1.2, el, -t * 0.9 - 0.3);
      for (let k = 0; k < 3; k++) {
        const y0 = 140 + k * 30 + (s > 0 ? 14 : 0), cx = 20 + (y0 - 92) * 0.07;
        const b = bolt(g, [s * (cx - 10), y0], [-s * (cx - 10), y0 + 10], 4, 4, 1.8, boltM, id * 11 + k * 3 + (s > 0 ? 1 : 0), t * 0.5, false);
        boltList.push(b);
      }
    }
    zigLine(g, 24, 100, 6, 14, 2.2, el, t + 0.3, id);
    rows = trunk; tipY = 270;
  } else {
    if (id >= 71) facet(g, rimRows(rows, 2.6), bev * 0.5, t * 0.55, elV, elV, 0.3);
    facet(g, rows, bev, t, TM.steel(), TM.steelB());
    tipY = rows[rows.length - 1][0];
    zigLine(g, rows[0][0] + 10, tipY - 34, id === 70 ? 5 : 7, 14, 2.4, el, t + 0.3, id);
  }
  // 刃面金色/紫色饰条
  if (id >= 72 && !S.fork) {
    for (const s of [-1, 1]) {
      const pts = [];
      for (let y = rows[0][0] + 14; y < tipY - 40; y += 20) pts.push([s * (hwAt(rows, y) - bev - 2), y]);
      poly(g, pts, 1.8, 1.2, TM.gold(), t + 0.2);
    }
  }
  // 环绕刃口的闪电（闪烁）
  const nb = S.bolts;
  for (let i = 0; i < nb; i++) {
    if (S.fork && i > 4) break;
    const s = i % 2 ? 1 : -1;
    const y = 30 + (i / Math.max(1, nb - 1)) * (Math.min(tipY, 230) - 70);
    const hw = hwAt(rows, y) || 30;
    const b = bolt(g, [s * (hw - 4), y], [s * (hw + 14 + (id - 70) * 2), y + 22 + hash(id, i) * 18], 4, 4, 1.6, boltM, id * 31 + i, t * 0.5);
    boltList.push(b);
  }

  // ---- 部件 ----
  if (S.rod) {
    // 引雷针：细杆 + 金球 + 电球；剑根铜线圈；旋转小环
    cyl(g, 1.8, 3, 52, 6, TM.gold(), 0, 240, 0);
    for (const y of [226, 248]) mesh(g, ICO0, TM.gold(), 0, y, 0, 4);
    mesh(g, ICO1, el, 0, 268, 0, 5);
    mesh(g, ICO0, TM.shell(), 0, 268, 0, 8);
    for (let k = 0; k < 5; k++) { const c = ring(g, 1, 0.08, TM.copper(), 0, 26 + k * 7, 0, 4, 14, 'y'); c.scale.set(36, 12, 30); }
    rodRing(g, anims, 15, 0, 238, 'y', 8, 2.4, el, 1);
    for (let k = 0; k < 3; k++) {
      const s = k % 2 ? 1 : -1;
      boltList.push(bolt(g, [0, 266], [s * (30 + k * 6), 208 - k * 26], 5, 6, 1.8, boltM, id * 7 + k, 0));
    }
  }
  if (S.hammer) {
    // 雷神之锤：横置锤头作为护手
    bbox(g, 100, 40, 34, TM.purple(), 0, 4, 0, 3);
    for (const s of [-1, 1]) {
      bbox(g, 16, 46, 38, TM.steel(), s * 50, 4, 0, 2.5);
      box(g, 4, 48, 39, TM.gold(), s * 40, 4, 0);
      ext(g, [[s * 58, -14], [s * 58, 22], [s * 66, 14], [s * 66, -6]], 30, TM.steelB(), 0, 1);
    }
    box(g, 102, 3, 35, TM.gold(), 0, 24, 0);
    box(g, 102, 3, 35, TM.gold(), 0, -16, 0);
    // 符文
    const runes = [[-26, 4], [-13, 8], [13, 8], [26, 4]];
    for (const [x, y] of runes) {
      seg(g, x - 4, y - 7, x + 3, y + 1, 2, 1.2, elV, 17.6);
      seg(g, x + 3, y + 1, x - 2, y + 2, 2, 1.2, elV, 17.6);
      seg(g, x - 2, y + 2, x + 4, y + 9, 2, 1.2, elV, 17.6);
    }
    oct(g, 18, 24, 8, el, 0, 4, 18);
    for (const s of [-1, 1]) boltList.push(bolt(g, [s * 58, 26], [s * 30, 96], 5, 6, 2, boltM, id + s * 5, 10));
  }
  if (S.ring) rodRing(g, anims, S.spear ? 46 : 52, 0, S.spear ? 150 : 104, 'y', 10, S.spear ? -1.6 : 1.4, el, 0.5);
  if (S.spear) {
    // 审判之矛：护手后方放射金色尖芒 + 面朝观者的旋转光环 + 两侧副刃
    for (let k = 0; k < 9; k++) {
      const a = PI * (0.12 + 0.76 * k / 8);
      const L = k % 2 ? 26 : 40;
      spikeCone(g, 3.6, L, 4, k % 2 ? TM.gold() : TM.steel(), Math.cos(a) * 20, 8 + Math.sin(a) * 14, -8, a);
    }
    rodRing(g, anims, 44, 0, 18, 'z', 12, 0.7, el).position.z = -10;
    for (const s of [-1, 1]) {
      const pr = [[60, 7, s * 40], [110, 6, s * 44], [150, 0, s * 50]];
      facet(g, rimRows(pr, 2), 2, 3, elV, elV, 0.3);
      facet(g, pr, 3, 4, TM.steel(), TM.steelB());
      seg(g, s * 30, 70, s * 40, 66, 3, 3, TM.gold(), 0);
    }
    mesh(g, ICO1, el, 0, tipY + 10, 0, 4);
    for (let k = 0; k < 3; k++) boltList.push(bolt(g, [0, tipY + 10], [(k - 1) * 30, tipY - 40 - k * 10], 5, 6, 1.8, boltM, id * 3 + k, 0));
  }
  if (S.guard) thunderHilt(g, el, S.guard[0], S.guard[1], S.gy1, S.pEnd, 6.5, { zig: S.zig });
  else thunderHilt(g, el, 64, 12, S.gy1, S.pEnd, 6.5, { zig: 2 });
  if (S.orbs) {
    if (S.hammer) orbs(g, anims, S.orbs, 0, 8, 64, 30, 22, 7, id, 1.0);
    else orbs(g, anims, S.orbs, 0, 150, S.spear ? 60 : 58, S.spear ? 110 : 90, 16, 6.5, id, 0.7);
  }
  flicker(anims, boltList, 8 + (id - 70), 0.4 + (id - 70) * 0.04, id);
  return done(g, S.L, anims);
}

export const FORMS = {
  60: () => magmaForm(60),
  61: () => magmaForm(61),
  62: () => magmaForm(62),
  63: () => magmaForm(63),
  64: () => magmaForm(64),
  65: () => magmaForm(65),
  70: () => thunderForm(70),
  71: () => thunderForm(71),
  72: () => thunderForm(72),
  73: () => thunderForm(73),
  74: () => thunderForm(74),
  75: () => thunderForm(75),
};
