// 锯刃（18, 42, 19, 20, 21, 22）与龙牙（23, 43, 24, 25, 26, 27）——按原作渲染图 1:1 建模。
// 与 citadel_holy.js 相同的做法：在「参考图坐标系」（像素，+X 图右，+Y 剑尖方向，+Z 朝向观者，
// 原点 = 护手中心）里搭建，再由 finishForm 转换到剑坐标并缩放到目标总长。
import * as THREE from 'three';
import { mat, glow, box, bar, ext, cyl, disc, oct, ring, gripY, finishForm } from './citadel_holy.js';

const PI = Math.PI;

// ============================================================================
// 锯刃家族
// ============================================================================
const SM = {
  blade: () => mat(0x23262d, { r: 0.55, m: 0.3 }),
  bladeSide: () => mat(0x15171b, { r: 0.6, m: 0.3 }),
  rail: () => mat(0x5d6d80, { r: 0.45, m: 0.3 }),
  railD: () => mat(0x2c3540, { r: 0.5, m: 0.3 }),
  tooth: () => mat(0x9aabc2, { r: 0.45, m: 0.3 }),
  toothD: () => mat(0x4c5a6e, { r: 0.5, m: 0.3 }),
  copper: () => mat(0x9a4c2a, { r: 0.5, m: 0.3 }),
  clamp: () => mat(0x5f7088, { r: 0.45, m: 0.3 }),
  box: () => mat(0xb0532c, { r: 0.6, m: 0.2 }),
  boxD: () => mat(0x7a3418, { r: 0.6, m: 0.2 }),
  gem: () => mat(0xff5a20, { e: 0xff3a10, ei: 0.7, r: 0.35, m: 0.1 }),
  glowRail: () => glow(0xe84a24, 0.6),
  steelD: () => mat(0x2f3844, { r: 0.5, m: 0.3 }),
  steelL: () => mat(0x5a6878, { r: 0.45, m: 0.3 }),
  grip: () => mat(0x4a4e55, { r: 0.7, m: 0.2 }),
  gearRing: () => mat(0xa0532e, { r: 0.5, m: 0.3 }),
  gearTooth: () => mat(0x7d8ea6, { r: 0.45, m: 0.3 }),
  gearIn: () => mat(0x1a1c20, { r: 0.6, m: 0.2 }),
  spoke: () => mat(0xd8dde4, { r: 0.4, m: 0.3 }),
};

/** 齿轮（独立组，可旋转）：铜色外圈 + 外齿 + 暗色盘 + 白色辐条 */
function gear(p, anims, x, y, z, R, speed, nT = 14) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.userData.dyn = true; p.add(g);
  disc(g, R * 0.86, 3, 12, SM.gearIn(), 0, 0, 0);
  ring(g, R * 0.84, R * 0.16, SM.gearRing(), 0, 0, 1.6, 4, 14);
  for (let i = 0; i < nT; i++) {
    const a = (i / nT) * PI * 2;
    const t = box(g, R * 0.3, R * 0.22, 4.4, SM.gearTooth(), Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.02, 0.8);
    t.rotation.z = a;
  }
  for (let i = 0; i < 3; i++) {
    const s = box(g, R * 1.45, 0.9, 1, SM.spoke(), 0, 0, 2.2);
    s.rotation.z = (i / 3) * PI + 0.3;
  }
  disc(g, R * 0.2, 4.4, 6, SM.gearTooth(), 0, 0, 0.6);
  anims.push((dt, t) => { g.rotation.z = t * speed; });
  return g;
}

/** 锯齿（三棱锥）：根在 (x,y)，s = -1 朝左 / +1 朝右 */
function tooth(p, x, y, z, s, len, h, d) {
  const pts = s > 0 ? [[x, y - h / 2], [x + len, y - h * 0.35], [x, y + h / 2]] : [[x, y - h / 2], [x, y + h / 2], [x - len, y - h * 0.35]];
  // 前后两个斜面组成的尖楔
  const ty = y - h * 0.35;
  const tip = [x + s * len, ty, z];
  const a = [x, y + h / 2, z], b = [x, y - h / 2, z];
  const f = [x, y, z + d / 2], k = [x, y, z - d / 2];
  const tri = (P, Q, R, m) => {
    const g = new THREE.BufferGeometry();
    const arr = s > 0 ? [...P, ...Q, ...R] : [...P, ...R, ...Q];
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    g.computeVertexNormals();
    p.add(new THREE.Mesh(g, m));
  };
  tri(a, f, tip, SM.tooth());   // 上前面（亮）
  tri(f, b, tip, SM.toothD());  // 下前面（暗）
  tri(k, a, tip, SM.tooth());
  tri(b, k, tip, SM.toothD());
  void pts;
}

const sawSpecs = {
  18: { L: 1.0, tip: 236, bodyTop: 196, hw: 26, railX: 29, railTop: 216, railBot: 72, teeth: [6, 98, 212, 18, 17], rungs: [4, 105, 205], gearsBot: [46, 63, 17.5], box: [55, 50, 48], gem: [22, 37], guard: [80, 11], gripY1: -58, gripR: 9.5, pommel: -84 },
  42: { L: 1.05, tip: 238, bodyTop: 198, hw: 26, railX: 29, railTop: 220, railBot: 75, teeth: [7, 96, 218, 17, 16], rungs: [5, 102, 210], gearsBot: [45, 66, 17], box: [54, 46, 50], gem: [22, 35], guard: [80, 11], gripY1: -56, pommel: -80, gripR: 9 },
  19: { L: 1.12, tip: 248, bodyTop: 214, hw: 26, railX: 29, railTop: 222, railBot: 58, teeth: [9, 72, 226, 17, 14], rungs: [6, 80, 200], gearsTop: [27, 222, 14], gearsBot: [44, 54, 17.5], box: [52, 44, 35], gem: [20, 32], guard: [82, 10], gripY1: -52, pommel: -74, gripR: 8.5 },
  20: { L: 1.25, tip: 252, bodyTop: 226, hw: 28, railX: 32, railTop: 232, railBot: 52, teeth: [11, 62, 236, 18, 14], rungs: [9, 66, 218], glow: 20, gearsTop: [27, 231, 14], gearsBot: [43, 50, 18], box: [50, 40, 36], gem: [20, 30], guard: [84, 10], gripY1: -46, pommel: -68, gripR: 8, curls: true },
  21: { L: 1.4, tip: 264, bodyTop: 244, hw: 34, railX: 37, railTop: 246, railBot: 44, teeth: [13, 50, 250, 20, 14], teeth2: true, rungs: [11, 56, 232], glow: 20, gearsTop: [24, 244, 13], gearsBot: [42, 42, 18], box: [50, 32, 26], gem: [20, 28], guard: [84, 9], gripY1: -40, pommel: -58, gripR: 7.5 },
  22: { L: 1.5, tip: 266, bodyTop: 248, hw: 34, railX: 37, railTop: 248, railBot: 42, teeth: [15, 48, 252, 20, 12.5], teeth2: true, rungs: [12, 54, 236], glow: 20, gearsTop: [27, 244, 13], gearsMid: [13, 137, 11], gearsBot: [43, 39, 19], box: [50, 34, 28], gem: [22, 28], guard: [86, 9], gripY1: -38, pommel: -56, gripR: 7 },
};

function sawForm(id) {
  const S = sawSpecs[id];
  const g = new THREE.Group(), anims = [];
  const T = 12; // 剑身厚（Z）
  // 黑色剑身（带尖）
  ext(g, [[-S.hw, 6], [S.hw, 6], [S.hw, S.bodyTop], [0, S.tip], [-S.hw, S.bodyTop]], T, [SM.blade(), SM.bladeSide()], 0, 1);
  // 两侧导轨
  for (const s of [-1, 1]) {
    box(g, 6, S.railTop - S.railBot, 10, SM.rail(), s * S.railX, (S.railTop + S.railBot) / 2, 1);
    box(g, 2, S.railTop - S.railBot, 10.4, SM.railD(), s * (S.railX + 2.5), (S.railTop + S.railBot) / 2, 1);
    if (S.glow) {
      box(g, 3, S.railTop - S.railBot - 8, 2, SM.glowRail(), s * S.glow, (S.railTop + S.railBot) / 2, T / 2 + 1.2);
    }
  }
  // 横档（梯子）
  const [nR, r0, r1] = S.rungs;
  const rx = S.glow ? S.glow : S.railX - 3;
  for (let i = 0; i < nR; i++) {
    const y = nR === 1 ? r0 : r0 + (r1 - r0) * i / (nR - 1);
    box(g, rx * 2 + (S.glow ? 4 : 0), 3, 2, S.glow ? SM.glowRail() : SM.copper(), 0, y, T / 2 + 0.8);
    if (!S.glow) disc(g, 1.6, 1.2, 6, SM.clamp(), 0, y, T / 2 + 2);
    else if (i % 3 === 1) for (const s of [-1, 1]) box(g, 5, 4, 3, SM.clamp(), s * S.glow, y, T / 2 + 2);
  }
  // 锯齿
  const [nT, ty0, ty1, tl, th] = S.teeth;
  for (let i = 0; i < nT; i++) {
    const y = ty0 + (ty1 - ty0) * i / (nT - 1);
    for (const s of [-1, 1]) {
      tooth(g, s * (S.railX + 3), y, 1, s, tl, th, 9);
      if (S.teeth2 && i < nT - 1) tooth(g, s * (S.railX + 3 + tl * 0.45), y + (ty1 - ty0) / (nT - 1) / 2, -2.5, s, tl * 0.9, th * 0.9, 7);
    }
  }
  // 齿轮
  const gearRow = (spec, z, sp) => { if (!spec) return; const [x, y, R] = spec; for (const s of [-1, 1]) gear(g, anims, s * x, y, z, R, s * sp); };
  gearRow(S.gearsTop, T / 2 + 3, 1.6);
  gearRow(S.gearsMid, T / 2 + 3, 2.2);
  gearRow(S.gearsBot, 3, 1.2);
  if (S.curls) for (const s of [-1, 1]) { const c = ring(g, 7, 1.1, SM.copper(), s * 46, 74, -1, 4, 10); c.rotation.y = 0.4 * s; }
  // 底部箱体 + 宝石
  const [bw, bh, by] = S.box;
  box(g, bw, bh, 22, SM.box(), 0, by, 0);
  box(g, bw + 0.4, 3, 22.4, SM.boxD(), 0, by - bh / 2 + 1.5, 0);
  oct(g, S.gem[0], S.gem[1], 8, SM.gem(), 0, by + 2, 11);
  // 箱下黑块 + 护手横条
  const [gw, gh] = S.guard;
  box(g, bw * 0.9, by - bh / 2 - gh / 2, 14, SM.blade(), 0, (by - bh / 2 + gh / 2) / 2, 0);
  box(g, gw, gh, 16, SM.steelD(), 0, 0, 0);
  box(g, gw, 2, 16.4, SM.steelL(), 0, gh / 2 - 1, 0);
  // 握柄 + 锥形柄头
  box(g, 18, 6, 14, SM.steelD(), 0, -gh / 2 - 3, 0);
  gripY(g, S.gripR, -gh / 2 - 5, S.gripY1, SM.grip(), 12, 8);
  cyl(g, S.gripR * 1.4, S.gripR * 1.4, 4, 6, SM.steelD(), 0, S.gripY1 - 1, 0);
  const ph = S.gripY1 - 3 - S.pommel;
  cyl(g, 0.01, S.gripR * 1.4, ph, 6, SM.steelD(), 0, S.gripY1 - 3 - ph / 2, 0);
  return finishForm(g, S.L, { update: (dt, t) => anims.forEach(f => f(dt, t)) });
}

// ============================================================================
// 龙牙家族
// ============================================================================
const DM = {
  rim: () => mat(0x7189aa, { r: 0.45, m: 0.3 }),
  rimSide: () => mat(0x4a5c74, { r: 0.5, m: 0.3 }),
  bone: () => mat(0xe2c38c, { r: 0.7, m: 0.05 }),
  boneD: () => mat(0xb89764, { r: 0.7, m: 0.05 }),
  black: () => mat(0x1d1c21, { r: 0.6, m: 0.2 }),
  scale: () => mat(0x5d84b8, { r: 0.45, m: 0.25 }),
  gold: () => mat(0xd29a38, { r: 0.4, m: 0.35 }),
  goldGlow: () => mat(0xf2c040, { r: 0.4, m: 0.3, e: 0xffb020, ei: 0.55 }),
  orange: () => mat(0xe8873a, { r: 0.45, m: 0.3, e: 0xff7a20, ei: 0.35 }),
  bronze: () => mat(0x8a5426, { r: 0.5, m: 0.3 }),
  grip: () => mat(0x5a3820, { r: 0.8, m: 0.1 }),
  jade: () => glow(0x7cf0b4, 1.4),
  cyan: () => glow(0x9ffcf0, 1.6),
  wingPane: () => mat(0x1f2228, { r: 0.4, m: 0.3 }),
};

/** 五边形（尖朝上），中心 (x,y)，宽 w */
function pentagon(w) {
  const h = w * 0.95;
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h * 0.08], [0, h / 2], [-w / 2, h * 0.08]];
}
function pent(p, x, y, z, w, m, d = 2) {
  const pts = pentagon(w).map(([a, b]) => [a + x, b + y]);
  return ext(p, pts, d, m, z, 0.6);
}

/** 尖刺：根在剑缘 (x,y)，s = -1 向左上 / +1 向右上 */
function dSpike(p, x, y, z, s, len, base, m, mD, ang = 0.62) {
  const dx = Math.cos(ang) * s, dy = Math.sin(ang);
  const tip = [x + dx * len, y + dy * len, z];
  // 底边沿剑缘（竖直）
  const a = [x, y + base * 0.5, z], b = [x, y - base * 0.5, z];
  const f = [x + s * base * 0.15, y, z + base * 0.35], k = [x + s * base * 0.15, y, z - base * 0.35];
  const tri = (P, Q, R, mm) => {
    const g = new THREE.BufferGeometry();
    const arr = s > 0 ? [...P, ...Q, ...R] : [...P, ...R, ...Q];
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    g.computeVertexNormals();
    p.add(new THREE.Mesh(g, mm));
  };
  tri(a, f, tip, m); tri(f, b, tip, mD); tri(k, a, tip, mD); tri(b, k, tip, mD);
}

/** 翼片：四边形 [外上, 内上, 内下, 根]，金框 + 暗色镜面 */
function wing(p, pts, z, tilt) {
  const grp = new THREE.Group(); p.add(grp);
  const cx = pts.reduce((a, q) => a + q[0], 0) / 4, cy = pts.reduce((a, q) => a + q[1], 0) / 4;
  grp.position.set(cx, cy, z);
  const loc = pts.map(([a, b]) => [a - cx, b - cy]);
  ext(grp, loc, 2.6, DM.gold(), 0, 0.4);
  const inner = loc.map(([a, b]) => [a * 0.8, b * 0.86]);
  ext(grp, inner, 1.4, DM.wingPane(), 1.6, 0);
  // 内侧一条金色高光细边
  bar(grp, inner[0][0], inner[0][1], inner[3][0] * 0.9, inner[3][1] * 0.9, 1.2, 1.2, DM.goldGlow(), 2.2);
  const axis = new THREE.Vector3(pts[0][0] - pts[3][0], pts[0][1] - pts[3][1], 0).normalize();
  grp.quaternion.setFromAxisAngle(axis, tilt);
  return grp;
}

const dragonSpecs = {
  23: { L: 1.0, hw: 31, leftTop: 215, peak: [-2, 238], rightTop: 168, rows: 4, pentW: 22, pitch: 39, row0: 161, spineTop: 205, spikes: 0, horns: 'big', gripY1: -58, pommel: -83 },
  43: { L: 1.05, hw: 31, leftTop: 215, peak: [-2, 238], rightTop: 168, rows: 4, pentW: 22, pitch: 39, row0: 161, spineTop: 205, spikes: 2, spikeY: [112, 160], spikeLen: 30, horns: 'big', gripY1: -58, pommel: -83 },
  24: { L: 1.12, hw: 33, leftTop: 226, peak: [0, 250], rightTop: 172, rows: 6, pentW: 18, pitch: 26, row0: 172, spineTop: 214, spikes: 3, spikeY: [92, 168], spikeLen: 26, horns: 'big', gripY1: -50, pommel: -72 },
  25: { L: 1.25, hw: 36, leftTop: 247, peak: [0, 268], rightTop: 212, rows: 8, pentW: 16, pitch: 23.5, row0: 216, spineTop: 238, spikes: 4, spikeY: [100, 196], spikeLen: 26, horns: 'small', wings: 1, jade: true, cyanEdge: true, gripY1: -40, pommel: -56 },
  26: { L: 1.38, hw: 37, leftTop: 250, peak: [-2, 268], rightTop: 222, rows: 12, pentW: 14, pitch: 18.5, row0: 230, spineTop: 248, spikes: 5, spikeY: [88, 210], spikeLen: 26, horns: 'small', wings: 2, jade: true, cyanEdge: false, gripY1: -36, pommel: -52 },
  27: { L: 1.45, hw: 38, leftTop: 242, peak: [-3, 267], rightTop: 227, rows: 12, pentW: 14, pitch: 17.5, row0: 225, spineTop: 250, spikes: 7, spikeY: [70, 215], spikeLen: 26, orangeSpikes: true, horns: 'small', wings: 3, jade: true, cyanEdge: true, gripY1: -36, pommel: -52 },
};

function dragonForm(id) {
  const S = dragonSpecs[id];
  const g = new THREE.Group();
  const T = 12, hw = S.hw;
  const y0 = 5;
  // 钢色外框剑身
  const outline = [[-hw, y0], [hw, y0], [hw, S.rightTop], [S.peak[0], S.peak[1]], [-hw, S.leftTop]];
  ext(g, outline, T, [DM.rim(), DM.rimSide()], 0, 1.4);
  // 米色内板（内缩），顶部与斜切口平行
  const b = 7;
  const panel = [[-hw + b, y0 + 3], [hw - b, y0 + 3], [hw - b, S.rightTop - 6], [-hw + b, S.leftTop - 15]];
  ext(g, panel, 1.5, DM.bone(), T / 2 + 0.6, 0);
  // 黑色脊骨 + 五边形鳞片
  const zS = T / 2 + 1.6;
  const spineW = S.pentW * 0.5;
  const yLow = y0 + 8;
  ext(g, [[-spineW / 2, yLow], [spineW / 2, yLow], [spineW / 2, S.spineTop - 26], [0, S.spineTop], [-spineW / 2, S.spineTop - 26]], 1.6, DM.black(), zS, 0);
  const off = S.pentW * 0.72;
  for (let i = 0; i < S.rows; i++) {
    const y = S.row0 - i * S.pitch;
    if (y < yLow + 4) break;
    const blue = i % 2 === 0;
    for (const s of [-1, 1]) pent(g, s * off, y, zS + (blue ? 0.6 : 0), S.pentW, blue ? DM.scale() : DM.black(), blue ? 2.4 : 1.6);
    if (!blue) box(g, off * 2, S.pentW * 0.45, 1.4, DM.black(), 0, y - S.pentW * 0.1, zS);
  }
  // 底部黑块（剑根）
  box(g, spineW * 2.2, 10, 1.6, DM.black(), 0, yLow + 2, zS);
  // 青色边缘光 / 顶部小光点
  if (S.cyanEdge) {
    box(g, 2.2, (S.leftTop - y0) * 0.55, 2, DM.cyan(), -hw + 2.5, S.leftTop - (S.leftTop - y0) * 0.3, T / 2 + 0.5);
    oct(g, 3.5, 3.5, 3, DM.cyan(), hw - 8, S.rightTop + 4, T / 2 + 0.8);
  }
  // 尖刺
  if (S.spikes) {
    const [sy0, sy1] = S.spikeY;
    for (let i = 0; i < S.spikes; i++) {
      const y = S.spikes === 1 ? sy0 : sy0 + (sy1 - sy0) * i / (S.spikes - 1);
      const ml = S.orangeSpikes ? DM.orange() : DM.goldGlow();
      dSpike(g, -hw, y, 0, -1, S.spikeLen, 13, ml, DM.gold(), 0.6);
      dSpike(g, hw, y, 0, 1, S.spikeLen * 0.95, 13, DM.bone(), DM.boneD(), 0.6);
    }
  }
  // 翼
  if (S.wings) {
    const base = [[-82, 118], [-62, 112], [-24, 34], [-36, 14]];
    for (let w = 0; w < S.wings; w++) {
      const sc = 1 + w * 0.12, rot = -w * 0.2, dz = -4 - w * 4;
      const ca = Math.cos(rot), sa = Math.sin(rot);
      for (const s of [-1, 1]) {
        const pts = base.map(([x, y]) => {
          const X = (x + 24) * sc, Y = (y - 14) * sc;
          return [s * (X * ca - Y * sa - 24 - w * 4), X * sa + Y * ca + 14 + w * 6];
        });
        wing(g, s > 0 ? pts : pts, dz, s * 0.35);
      }
    }
  }
  // 护手：米色角 + 铜色描边
  if (S.horns === 'big') {
    const hp = [[-8, 0], [-34, 2], [-52, 12], [-64, 30], [-72, 60], [-56, 44], [-40, 35], [-26, 31], [-20, 16]];
    for (const s of [-1, 1]) {
      const pts = hp.map(([x, y]) => [s * x, y]);
      const P = s > 0 ? pts.slice().reverse() : pts;
      ext(g, P, 7, DM.bone(), 4, 0.6);
      ext(g, P.map(([x, y]) => [x * 1.04 + s * 0.5, y - 1.8]), 5, DM.bronze(), 1.5, 0);
    }
  } else {
    const hp = [[-8, 0], [-30, 2], [-44, 12], [-50, 34], [-38, 24], [-26, 22], [-20, 12]];
    for (const s of [-1, 1]) {
      const pts = hp.map(([x, y]) => [s * x, y]);
      const P = s > 0 ? pts.slice().reverse() : pts;
      ext(g, P, 7, DM.bone(), 6, 0.6);
      ext(g, P.map(([x, y]) => [x * 1.05, y - 1.8]), 5, DM.bronze(), 3, 0);
    }
  }
  // 护手横条
  box(g, 76, 8, 12, DM.bronze(), 0, -1, 0);
  box(g, 76, 1.6, 12.4, DM.gold(), 0, 2.6, 0);
  // 中心宝石
  if (S.jade) {
    oct(g, 22, 22, 8, DM.jade(), 0, 12, 9);
  } else {
    oct(g, 16, 26, 14, DM.gold(), 0, 18, 6);
  }
  // 握柄 + 柄头
  gripY(g, 7.5, -5, S.gripY1, DM.grip(), 12, 8);
  cyl(g, 9, 9, 3, 8, DM.bronze(), 0, -5, 0);
  cyl(g, 9, 9, 3, 8, DM.bronze(), 0, S.gripY1, 0);
  const pr = S.gripY1 - S.pommel;
  oct(g, 18, pr, 18, DM.gold(), 0, S.gripY1 - pr / 2 - 1, 0);
  return finishForm(g, S.L);
}

export const FORMS = {
  18: () => sawForm(18),
  42: () => sawForm(42),
  19: () => sawForm(19),
  20: () => sawForm(20),
  21: () => sawForm(21),
  22: () => sawForm(22),
  23: () => dragonForm(23),
  43: () => dragonForm(43),
  24: () => dragonForm(24),
  25: () => dragonForm(25),
  26: () => dragonForm(26),
  27: () => dragonForm(27),
};
