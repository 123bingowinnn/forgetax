// 基础形态 + 三条投放线（1, 38, 39, 2, 3, 4, 5, 6, 7）
// 尺寸从参考图 ref/wiki/swords/<id>.webp 的像素轮廓换算：X = (护手行 - 像素行) * K，Z = 像素偏移 * K。
import {
  THREE, C, M, mat, glow, box, bevelBox, cylX, cylY, rivet, gem, torus, plate, guardBar, grip, pommel, rng, finish, PI,
} from './kit.js';

// 对称轮廓：pts = [[x, hw], ...] 从剑根到剑尖；返回多边形 [[x,z]]（+Z 侧上行，-Z 侧下行）
export function symPoly(pts) {
  const right = pts.map(([x, hw]) => [x, hw]);
  const left = [];
  for (let i = pts.length - 1; i >= 0; i--) if (pts[i][1] > 1e-6) left.push([pts[i][0], -pts[i][1]]);
  return right.concat(left);
}
// 像素换算器
export function px(K, YG, CX = 180) {
  return {
    X: (y) => (YG - y) * K,
    Z: (v) => v * K,
    P: (pts) => pts.map(([y, z]) => [(YG - y) * K, z * K]),
    K,
  };
}
const navy = () => mat(0x1a2236, { r: 0.6, m: 0.2 });
const steelLight = () => mat(0xa6b2c0, { r: 0.5, m: 0.25 });
const steelLightD = () => mat(0x7d8896, { r: 0.55, m: 0.25 });

// 旧剑式握柄 + 柄头 + 一字护手
function simpleHilt(g, { guardW, guardD, guardH, guardM, gripLen, gripR, gripM = M.leather, wrapM = M.leatherL, rings = 8, pom = 'cube', pomS, pomM }) {
  guardBar(g, { w: guardW, d: guardD, h: guardH, m: guardM });
  const xe = grip(g, { x0: -guardD / 2, len: gripLen, r: gripR, m: gripM, wrap: wrapM, rings });
  return pommel(g, { x: xe, type: pom, s: pomS, m: pomM || guardM });
}

// ---------------------------------------------------------------------------
// 1 旧剑 Worn Sword（总长 ~0.55m）
// ---------------------------------------------------------------------------
function worn() {
  const g = new THREE.Group();
  const { X, Z, P } = px(0.0017, 249);
  const face = mat(C.worn, { r: 0.85, m: 0.15 }), side = mat(0x8a8a84, { r: 0.8, m: 0.15 });
  const t = 0.014;
  // 带豁口的轮廓（右=+Z）
  const poly = P([
    [242, 22.5], [196, 22], [191, 17], [186, 21.5], [129, 21], [69, 19.5], [49, 15], [29, 6], [19, 0],
    [29, -5], [49, -15], [69, -20], [124, -20], [129, -15.5], [134, -21], [189, -23], [242, -23],
  ]);
  plate(g, poly, t, [face, side], 0, 0.004);
  // 锈斑 / 凹坑
  const pit = mat(0x3e3c38, { r: 0.95, m: 0 });
  const r = rng(11);
  for (let i = 0; i < 9; i++) {
    const y = 60 + r() * 170, z = (r() - 0.5) * 26;
    gem(g, Z(2 + r() * 2.5), 0.002, Z(1.5 + r() * 2), pit, X(y), t / 2, Z(z));
  }
  // 豁口里的锈橙色
  gem(g, Z(4), 0.003, Z(2.5), mat(C.rust, { r: 0.9, m: 0 }), X(190), t / 2 - 0.001, Z(18));
  const guardM = mat(0x5e5e5a, { r: 0.8, m: 0.2 });
  simpleHilt(g, { guardW: Z(88), guardD: Z(10), guardH: 0.02, guardM, gripLen: Z(62), gripR: 0.014, rings: 9, pom: 'cube', pomS: Z(22), pomM: guardM });
  return finish(g, { bladeLength: X(19), gripLength: Z(62) });
}

// ---------------------------------------------------------------------------
// 38 精修剑 Refined Sword（~0.6m）
// ---------------------------------------------------------------------------
function refined() {
  const g = new THREE.Group();
  const { X, Z, P } = px(0.00185, 254);
  const face = mat(C.grey, { r: 0.6, m: 0.25 }), side = mat(0xa8a8a8, { r: 0.55, m: 0.25 });
  const t = 0.013;
  plate(g, symPoly([[X(244), Z(23.5)], [X(89), Z(19.5)], [X(19), 0]]), t, [face, side], 0, 0.004);
  // 中央血槽
  box(g, X(65) - X(192), 0.002, Z(3), M.black, (X(65) + X(192)) / 2, t / 2, 0);
  const guardM = mat(0x8a8a8a, { r: 0.55, m: 0.25 });
  simpleHilt(g, { guardW: Z(89), guardD: Z(10), guardH: 0.02, guardM, gripLen: Z(58), gripR: 0.0135, rings: 9, pom: 'cube', pomS: Z(20), pomM: guardM });
  return finish(g, { bladeLength: X(19), gripLength: Z(58) });
}

// ---------------------------------------------------------------------------
// 39 还算好用的铁剑 Decent Iron Sword（~0.68m）
// ---------------------------------------------------------------------------
function decent() {
  const g = new THREE.Group();
  const { X, Z } = px(0.0021, 259);
  const t = 0.014;
  plate(g, symPoly([[X(250), Z(23.5)], [X(89), Z(19.5)], [X(19), 0]]), t, [steelLight(), steelLightD()], 0, 0.0045);
  box(g, X(62) - X(236), 0.002, Z(3), M.black, (X(62) + X(236)) / 2, t / 2, 0);
  const guardM = mat(0xb4bcc6, { r: 0.5, m: 0.25 });
  simpleHilt(g, { guardW: Z(91), guardD: Z(9), guardH: 0.022, guardM, gripLen: Z(58), gripR: 0.0145, rings: 9, pom: 'cube', pomS: Z(18), pomM: guardM });
  return finish(g, { bladeLength: X(19), gripLength: Z(58) });
}

// 投放线共用：深铁护手 + 钢灰缠柄 + 菱形柄头
function laneHilt(g, Z, { guardW, gripLen, gripR = 0.0175, pomS = 0.034 }) {
  const iron = M.iron;
  bevelBox(g, Z(10), 0.026, guardW, iron, 0, 0, 0, 0.004);
  bevelBox(g, Z(4), 0.03, guardW * 0.9, mat(0x5a606a, { r: 0.55, m: 0.3 }), Z(6), 0, 0, 0.002);
  const xe = grip(g, { x0: -Z(5), len: gripLen, r: gripR, m: mat(0x2f3238, { r: 0.7, m: 0.2 }), wrap: mat(0x5d636c, { r: 0.6, m: 0.3 }), rings: 10 });
  return pommel(g, { x: xe, type: 'diamond', s: pomS, m: iron });
}

// ---------------------------------------------------------------------------
// 2 厚铁剑 Thick Iron Sword（~0.75m）
// ---------------------------------------------------------------------------
function thickIron() {
  const g = new THREE.Group();
  const { X, Z, P } = px(0.00234, 244);
  const t = 0.022;
  const prof = [[X(238), Z(41)], [X(149), Z(37)], [X(79), Z(34.5)], [X(19), 0]];
  plate(g, symPoly(prof), t, [M.steelBlue, M.steelBlueD], 0, 0.006);
  // 两侧黑色铁条 + 铆钉
  for (const s of [1, -1]) {
    const zb = s * Z(33), zt = s * Z(27.5), xb = X(232), xt = X(72), w = Z(2.6);
    plate(g, [[xb, zb - w], [xt, zt - w], [xt, zt + w], [xb, zb + w]], 0.006, M.black, t / 2, 0);
    for (let i = 0; i < 6; i++) {
      const u = (i + 0.5) / 6, x = xb + (xt - xb) * u, z = zb + (zt - zb) * u;
      rivet(g, x, z, t / 2 + 0.003, 0.0035, mat(0x8a929c, { r: 0.5, m: 0.4 }));
    }
  }
  laneHilt(g, Z, { guardW: Z(90), gripLen: Z(56), pomS: 0.036 });
  return finish(g, { bladeLength: X(19), gripLength: Z(56) });
}

// ---------------------------------------------------------------------------
// 3 便携铁门 Portable Iron Door（~0.88m）
// ---------------------------------------------------------------------------
function ironDoor() {
  const g = new THREE.Group();
  const { X, Z } = px(0.00273, 254);
  const t = 0.024;
  const prof = [[X(246), Z(53)], [X(69), Z(43)], [X(19), 0]];
  plate(g, symPoly(prof), t, [M.steelBlue, M.steelBlueD], 0, 0.006);
  const hw = (y) => Z(43 + (53 - 43) * ((y - 69) / (246 - 69)));
  const hinge = mat(0xc46a2e, { r: 0.6, m: 0.2 });
  for (const y of [92, 160, 213]) {
    const w = hw(y) * 2 + Z(4);
    bevelBox(g, Z(5), 0.008, w, M.black, X(y), t / 2 + 0.002, 0, 0.0015);
    // 左侧（-Z）门轴铰链
    bevelBox(g, Z(20), 0.016, Z(18), hinge, X(y), 0, -hw(y) - Z(7), 0.003);
  }
  // 中央橙色发光缝
  box(g, X(78) - X(222), 0.003, Z(3), M.orange, (X(78) + X(222)) / 2, t / 2 + 0.0005, 0);
  // 边缘铆钉
  const rv = mat(0x9aa2ac, { r: 0.5, m: 0.4 });
  for (let i = 0; i < 7; i++) {
    const y = 80 + i * 25;
    for (const s of [1, -1]) rivet(g, X(y), s * (hw(y) - Z(5)), t / 2, 0.0032, rv);
  }
  laneHilt(g, Z, { guardW: Z(94), gripLen: Z(60), pomS: 0.04 });
  return finish(g, { bladeLength: X(19), gripLength: Z(60) });
}

// 黑色菱形钉
function studs(g, X, Z, ys, y0, s = 1) {
  for (const y of ys) gem(g, Z(10 * s), 0.008, Z(7.5 * s), M.black, X(y), y0, 0);
}

// ---------------------------------------------------------------------------
// 4 愤怒的铁疙瘩 Angry Hunk of Metal（~0.75m）
// ---------------------------------------------------------------------------
function angryHunk() {
  const g = new THREE.Group();
  const { X, Z, P } = px(0.00234, 244);
  const t = 0.024;
  const core = P([
    [238, 31], [199, 32], [185, 37], [175, 41], [169, 50], [163, 42], [139, 43], [131, 51], [124, 43],
    [99, 44], [89, 49], [69, 40], [49, 26], [29, 12], [19, 3],
    [29, -9], [39, -22], [49, -28], [92, -29], [130, -30], [170, -30], [210, -31], [238, -31],
  ]);
  plate(g, core, t, [M.steelBlue, M.steelBlueD], 0, 0.006);
  // 左侧三枚大锯齿（向上外翻）
  for (const y of [89, 129, 169]) {
    plate(g, P([[y + 4, -27], [y, -51], [y + 34, -27]]), t * 0.8, [M.steelBlue, M.bone], 0, 0.004);
  }
  studs(g, X, Z, [92, 132, 172], t / 2, 1.1);
  laneHilt(g, Z, { guardW: Z(89), gripLen: Z(56), pomS: 0.036 });
  return finish(g, { bladeLength: X(19), gripLength: Z(56) });
}

// ---------------------------------------------------------------------------
// 5 会咬人的剑 Biting Blade（~0.88m）
// ---------------------------------------------------------------------------
function bitingBlade() {
  const g = new THREE.Group();
  const { X, Z, P } = px(0.00273, 259);
  const t = 0.026;
  const core = P([
    [254, 35], [70, 35], [56, 37], [39, 18], [19, 2], [29, -10], [39, -23], [50, -35], [254, -35],
  ]);
  plate(g, core, t, [M.steelBlue, M.steelBlueD], 0, 0.006);
  const boneF = M.bone, boneS = M.boneD;
  // 两侧骨色尖牙
  for (const y of [49, 89, 119, 159, 189]) plate(g, P([[y + 22, -33], [y + 2, -54], [y - 4, -33]]), t * 0.75, [boneF, boneS], 0, 0.003);
  for (const y of [59, 89, 119, 159, 189]) plate(g, P([[y + 22, 33], [y - 4, 33], [y + 2, 50]]), t * 0.75, [boneF, boneS], 0, 0.003);
  // 护手两侧的大骨角
  plate(g, P([[256, -30], [258, -62], [216, -66], [234, -32]]), 0.022, [boneF, boneS], 0, 0.004);
  plate(g, P([[256, 30], [234, 32], [216, 64], [258, 60]]), 0.022, [boneF, boneS], 0, 0.004);
  studs(g, X, Z, [96, 136, 176, 214], t / 2, 1.0);
  laneHilt(g, Z, { guardW: Z(92), gripLen: Z(56), pomS: 0.04 });
  return finish(g, { bladeLength: X(19), gripLength: Z(56) });
}

// 魔力线共用：V 形护手翼 + 青色宝石 + 青色柄头
export function magicHilt(g, X, Z, P, { wingY, gripLen, wingM = [M.magicBlue, M.magicBlueD], pomGem = M.cyan, guardGem = M.cyan }) {
  const y0 = wingY;
  // 翼：内低外高（参考图 6/7）
  plate(g, P([[y0 - 2, 5], [y0 - 9, 50], [y0 + 2, 47], [y0 + 7, 5]]), 0.014, wingM, 0, 0.003);
  plate(g, P([[y0 - 2, -5], [y0 + 7, -5], [y0 + 2, -47], [y0 - 9, -50]]), 0.014, wingM, 0, 0.003);
  gem(g, Z(8), Z(6), Z(8), guardGem, X(y0), 0.004, 0);
  bevelBox(g, Z(8), 0.016, Z(14), M.iron, X(y0 + 6), 0, 0, 0.002);
  const x0 = X(y0 + 9);
  const xe = grip(g, { x0, len: gripLen, r: 0.0125, m: mat(0x2b2f36, { r: 0.7, m: 0.2 }), wrap: mat(0x4a505a, { r: 0.6, m: 0.3 }), rings: 11 });
  bevelBox(g, Z(6), 0.018, 0.018, M.iron, xe - Z(3), 0, 0, 0.002);
  gem(g, Z(6), Z(5), Z(6), pomGem, xe - Z(6) - Z(5), 0, 0);
  return xe - Z(17);
}
// 暗色风痕（6/7 右上角的细弧）
export function wisp(g, x, z, R, A) {
  const m = mat(0x1c2a44, { r: 0.6, m: 0, e: 0x0c1c38, ei: 1, opacity: 0.7 });
  const piv = new THREE.Group();
  piv.position.set(x, 0.02, z);
  g.add(piv);
  const a = torus(piv, R, 0.0022, m, 'y', 3, 20, PI * 0.7);
  const b = torus(piv, R * 0.8, 0.0018, m, 'y', 3, 16, PI * 0.5);
  b.rotation.y = 0.6;
  a.userData.noBounds = b.userData.noBounds = true;
  a.userData.noBreak = b.userData.noBreak = true;
  A.push((dt, t) => { piv.rotation.y = t * 0.8; });
}

// ---------------------------------------------------------------------------
// 6 魔力碎片 Shard of Magic（~0.75m）
// ---------------------------------------------------------------------------
function shardOfMagic() {
  const g = new THREE.Group();
  const { X, Z, P } = px(0.00244, 230);
  const t = 0.016;
  plate(g, symPoly([[X(224), Z(25)], [X(67), Z(21)], [X(27), 0]]), t, [M.magicBlue, M.magicBlueD], 0, 0.004);
  box(g, X(75) - X(215), 0.002, Z(3.5), navy(), (X(75) + X(215)) / 2, t / 2, 0);
  gem(g, Z(12), 0.006, Z(6.5), M.cyan, X(168), t / 2, 0);
  const A = [];
  magicHilt(g, X, Z, P, { wingY: 232, gripLen: Z(62) });
  wisp(g, X(105), Z(75), Z(30), A);
  return finish(g, { bladeLength: X(27), gripLength: Z(62), update: (dt, tt) => A.forEach((f) => f(dt, tt)) });
}

// 叉形双刃（7 / 符文线共用）：outer=[[y,hw]...] 剑根→剑尖，gap=[[y,hw]...] 剑根→剑尖（hw=0 处闭合）
export function forkBlade(g, P, outer, gap, t, mats, bevel = 0.004) {
  const right = outer.map(([y, z]) => [y, z]);
  const inner = gap.slice().reverse().map(([y, z]) => [y, z]);
  const polyR = P(right.concat(inner));
  const polyL = P(right.concat(inner).map(([y, z]) => [y, -z]).reverse());
  plate(g, polyR, t, mats, 0, bevel);
  plate(g, polyL, t, mats, 0, bevel);
}
// 暗色符文环（扁环 + 青色刻点）
export function runeDisc(g, x, R, w, tilt, { dots = 16, dark = 0x141a24, glowM = M.cyan } = {}) {
  const piv = new THREE.Group();
  piv.position.x = x;
  piv.rotation.z = -tilt;
  g.add(piv);
  const geo = new THREE.RingGeometry(R - w, R, 40, 1);
  geo.rotateY(PI / 2);
  add2(piv, geo, mat(dark, { r: 0.6, m: 0.2, side: THREE.DoubleSide }));
  torus(piv, R - w * 0.45, 0.0012, glowM, 'x', 3, 40);
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * PI * 2;
    const m = box(piv, 0.002, 0.004, 0.004, glowM, 0.0015, Math.sin(a) * (R - w * 0.45), Math.cos(a) * (R - w * 0.45));
    m.rotation.x = -a;
  }
  return piv;
}
function add2(p, geo, m) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.castShadow = true;
  p.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// 7 觉醒之剑 Awakening Blade（~0.88m）
// ---------------------------------------------------------------------------
function awakeningBlade() {
  const g = new THREE.Group();
  const { X, Z, P } = px(0.00285, 236);
  const t = 0.017;
  forkBlade(g, P,
    [[226, 14], [190, 36], [156, 38], [116, 32.5], [86, 29.5], [66, 19.5], [26, 0]],
    [[205, 0], [175, 7], [146, 11.5], [106, 11.5], [76, 6.5], [46, 2], [34, 0]],
    t, [M.magicBlue, M.magicBlueD]);
  // 符文刻线
  const A = [];
  for (const s of [1, -1]) {
    runeStrip2(g, X(190), X(92), s * Z(22), t / 2 + 0.001, 7 + (s > 0 ? 1 : 0));
  }
  // 六角宝石
  const hex = cylY(g, Z(13), 0.012, M.cyan, X(168), t / 2, 0, 6);
  hex.rotation.y = PI / 6;
  runeDisc(g, X(186), Z(50), Z(7), 0.55, { dots: 14 });
  magicHilt(g, X, Z, P, { wingY: 238, gripLen: Z(60) });
  wisp(g, X(110), Z(80), Z(32), A);
  return finish(g, { bladeLength: X(26), gripLength: Z(60), update: (dt, tt) => A.forEach((f) => f(dt, tt)) });
}
// 符文短划（竖线 + 小横钩）
export function runeStrip2(g, x0, x1, z, y, seed = 1, m = glow(C.cyan, 1.1)) {
  const r = rng(seed);
  const len = Math.abs(x1 - x0);
  box(g, len, 0.0015, 0.0016, m, (x0 + x1) / 2, y, z);
  const n = Math.round(len / 0.028);
  for (let i = 0; i < n; i++) {
    const x = Math.min(x0, x1) + (i + 0.5) * (len / n);
    const L = 0.006 + r() * 0.008, s = r() > 0.5 ? 1 : -1;
    const b = box(g, 0.0016, 0.0015, L, m, x, y, z + s * L * 0.45);
    b.rotation.y = (r() - 0.5) * 1.2;
  }
}

export const FORMS = {
  1: worn,
  38: refined,
  39: decent,
  2: thickIron,
  3: ironDoor,
  4: angryHunk,
  5: bitingBlade,
  6: shardOfMagic,
  7: awakeningBlade,
};
