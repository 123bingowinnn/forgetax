// 符文剑家族（28, 44, 29, 30, 31, 32）与分裂剑家族（33, 45, 34, 35, 36, 37）
import {
  THREE, C, M, mat, glow, box, bevelBox, cylX, cylY, rivet, gem, torus, plate, grip, pommel, rng, finish, PI,
  loftGeom, XS, mergeGeometries, galaxyTexture, starTexture,
} from './kit.js';
import { px, symPoly, forkBlade, runeDisc, runeStrip2, magicHilt, wisp } from './base.js';

// ============================================================================
// 符文剑
// ============================================================================
// 参考图 28 的像素模板（护手翼行 ≈ 238）
const RUNE_OUTER = [[230, 17], [200, 30], [166, 39], [126, 33.5], [86, 29.5], [66, 21], [46, 10.5], [26, 0]];
const RUNE_GAP = [[230, 6], [166, 9], [126, 11.5], [86, 9], [56, 4], [40, 0]];

// 金色符文环（带青色刻点，绕自身轴旋转）
function goldRing(g, x, R, tilt, A, { speed = 0.6, dots = 14, tube = 0.0055, ph = 0 } = {}) {
  const outer = new THREE.Group();
  outer.position.x = x;
  outer.rotation.z = -tilt;
  g.add(outer);
  const spin = new THREE.Group();
  outer.add(spin);
  torus(spin, R, tube, M.gold, 'x', 4, 40);
  torus(spin, R - tube * 1.6, tube * 0.45, mat(C.goldD, { r: 0.5, m: 0.3 }), 'x', 3, 40);
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * PI * 2;
    gem(spin, 0.003, 0.004, 0.004, M.cyan, tube * 0.6, Math.sin(a) * R, Math.cos(a) * R);
  }
  A.push((dt, t) => { spin.rotation.x = t * speed + ph; });
  return outer;
}
// 暗色符文石板（正面朝 +Y，青色刻纹）
function runeTablet(p, x, z, s, seed, y = 0.03) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  p.add(g);
  bevelBox(g, s * 1.25, s * 0.22, s, mat(0x161a22, { r: 0.6, m: 0.2 }), 0, 0, 0, s * 0.06);
  bevelBox(g, s * 1.3, s * 0.16, s * 1.05, mat(0x6a4a28, { r: 0.6, m: 0.3 }), 0, -s * 0.04, 0, s * 0.03);
  const r = rng(seed), cyan = M.cyan;
  const yy = s * 0.115;
  // 竖笔 + 2~3 斜笔
  box(g, s * 0.7, 0.0015, s * 0.06, cyan, 0, yy, (r() - 0.5) * s * 0.2);
  for (let i = 0; i < 2 + (r() > 0.5 ? 1 : 0); i++) {
    const b = box(g, s * 0.4, 0.0015, s * 0.06, cyan, (r() - 0.3) * s * 0.4, yy, (r() - 0.5) * s * 0.3);
    b.rotation.y = (r() > 0.5 ? 1 : -1) * (0.5 + r() * 0.5);
  }
  return g;
}
function floatAnim(A, obj, amp = 0.012, sp = 1.4, ph = 0) {
  const y0 = obj.position.y;
  A.push((dt, t) => { obj.position.y = y0 + Math.sin(t * sp + ph) * amp; });
}

/**
 * 符文剑通用构建
 * L: 总长；opt: { gems, rings, disc, bronze, plates, tablets, purple }
 */
function runeSword(L, o = {}) {
  const g = new THREE.Group();
  const K = L / 309;
  const { X, Z, P } = px(K, 238);
  const t = 0.018 * L;
  const A = [];
  forkBlade(g, P, RUNE_OUTER, RUNE_GAP, t, [M.magicBlue, M.magicBlueD], 0.004);
  for (const s of [1, -1]) runeStrip2(g, X(185), X(70), s * Z(22), t / 2 + 0.001, s > 0 ? 3 : 5);
  // 剑格处的方块（叉刃根部）
  bevelBox(g, Z(10), t * 1.2, Z(30), M.magicBlueD, X(232), 0, 0, 0.003);
  if (o.hex) { const h = cylY(g, Z(12), 0.012, M.cyan, X(178), t / 2, 0, 6); h.rotation.y = PI / 6; }
  if (o.disc) runeDisc(g, X(190), Z(50), Z(8), 0.55, { dots: 16 });
  if (o.topGem) gem(g, Z(o.topGem[1]), 0.007, Z(6), M.cyan, X(o.topGem[0]), t / 2 + 0.002, 0);
  if (o.lowGem) gem(g, Z(9), 0.008, Z(8), M.cyan, X(o.lowGem), t / 2 + 0.002, 0);
  if (o.purple) gem(g, Z(11), Z(9), Z(11), M.purple, X(o.purple), t / 2 + 0.004, 0);
  (o.rings || []).forEach(([y, R, tilt], i) => goldRing(g, X(y), Z(R), tilt, A, { speed: 0.5 + i * 0.15, ph: i * 1.7, dots: 16, tube: 0.0075 * L }));
  // 铜色羽板（在剑身背后向外张开）
  if (o.plates) {
    for (const [y, s, ang, len, wid] of o.plates) {
      const cx = X(y), dz = s * Z(32);
      const piv = new THREE.Group();
      piv.position.set(cx, -t * 0.7, dz);
      piv.rotation.y = s * ang;
      g.add(piv);
      plate(piv, [[-Z(wid) / 2, 0], [Z(wid) / 2, 0], [Z(wid) / 2 - Z(4), s * Z(len)], [-Z(wid) / 2 - Z(2), s * Z(len) * 0.95]], 0.008, [M.bronze, M.bronzeD], 0, 0.002);
    }
  }
  // 漂浮符文石板
  (o.tablets || []).forEach(([y, z, s, rot], i) => {
    const tb = runeTablet(g, X(y), Z(z), Z(s), 40 + i, t / 2 + 0.02);
    tb.rotation.y = rot || 0;
    floatAnim(A, tb, 0.008, 1.3, i * 1.1);
  });
  const wingM = o.bronze ? [M.bronze, M.bronzeD] : [M.magicBlue, M.magicBlueD];
  if (o.bronze) {
    // 护手后方第二层铜翼
    plate(g, P([[236, 4], [226, 58], [240, 54], [246, 4]]), 0.01, [M.bronze, M.bronzeD], -0.006, 0.002);
    plate(g, P([[236, -4], [246, -4], [240, -54], [226, -58]]), 0.01, [M.bronze, M.bronzeD], -0.006, 0.002);
  }
  const xe = magicHilt(g, X, Z, P, { wingY: 244, gripLen: Z(52), wingM, guardGem: o.purple ? M.purple : M.cyan });
  if (o.wisp) wisp(g, X(110), Z(80), Z(32), A);
  return finish(g, { bladeLength: X(26), gripLength: -xe, update: (dt, tt) => A.forEach((f) => f(dt, tt)) });
}

const runescribed = () => runeSword(1.0, { hex: true, disc: true, wisp: true });
const awakeningRune = () => runeSword(1.08, { hex: true, disc: true, wisp: true, topGem: [95, 20], rings: [[100, 40, 0.5]] });
const overcharged = () => runeSword(1.16, {
  bronze: true, topGem: [100, 46], lowGem: 186, rings: [[118, 50, 0.45], [196, 48, 0.4]],
  tablets: [[150, -40, 16, 0.1], [150, 40, 16, -0.1]],
  plates: [[205, 1, 0.5, 28, 18], [205, -1, 0.5, 28, 18]],
});
const arcaneEngine = () => runeSword(1.24, {
  bronze: true, topGem: [110, 44], purple: 172, rings: [[80, 50, 0.45], [148, 55, 0.4], [222, 52, 0.45]],
  tablets: [[52, 0, 18, 0], [120, -78, 20, 0.35], [120, 78, 20, -0.35], [210, 0, 16, 0]],
  plates: [[165, 1, 0.6, 30, 20], [165, -1, 0.6, 30, 20], [195, 1, 0.9, 34, 22], [195, -1, 0.9, 34, 22], [225, 1, 1.2, 30, 20], [225, -1, 1.2, 30, 20]],
});
const realityCracking = () => runeSword(1.32, {
  bronze: true, topGem: [110, 46], purple: 175, rings: [[70, 50, 0.4], [118, 54, 0.4], [168, 56, 0.4], [222, 54, 0.45]],
  tablets: [[75, -92, 14, 0.2], [75, 92, 14, -0.2], [150, -100, 14, 0.3], [150, 100, 14, -0.3]],
  plates: [[105, 1, 0.5, 26, 18], [105, -1, 0.5, 26, 18], [135, 1, 0.6, 30, 20], [135, -1, 0.6, 30, 20], [165, 1, 0.75, 32, 20], [165, -1, 0.75, 32, 20],
    [195, 1, 0.95, 34, 22], [195, -1, 0.95, 34, 22], [225, 1, 1.2, 30, 20], [225, -1, 1.2, 30, 20]],
});

// ---------------------------------------------------------------------------
// 32 阿卡夏·创世之刃（房形星盘框 + 星系 + 符文石板环 + 红宝珠日轮）
// ---------------------------------------------------------------------------
function akasha() {
  const g = new THREE.Group();
  const L = 1.45, K = L / 314;
  const { X, Z, P } = px(K, 284);
  const A = [];
  const wood = mat(0x8a5428, { r: 0.6, m: 0.25 }), woodD = mat(0x5c3416, { r: 0.65, m: 0.25 });
  // 房形外框（带洞的挤出体，厚 depth）
  const outer = P([[232, 44], [70, 44], [22, 0], [70, -44], [232, -44]]);
  const inner = P([[222, 34], [76, 34], [36, 0], [76, -34], [222, -34]]);
  const sh = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)));
  sh.holes.push(new THREE.Path(inner.map(([x, z]) => new THREE.Vector2(x, -z)).reverse()));
  const depth = 0.07;
  const fg = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelOffset: -0.004, bevelSegments: 1 });
  fg.rotateX(-PI / 2);
  fg.translate(0, -depth / 2, 0);
  const frame = new THREE.Mesh(fg, [wood, woodD]);
  frame.castShadow = true;
  g.add(frame);
  // 金色内框线
  for (const [a, b] of [[[222, 34], [76, 34]], [[222, -34], [76, -34]], [[76, 34], [36, 0]], [[76, -34], [36, 0]], [[222, 34], [222, -34]]]) {
    const [ax, az] = P([a])[0], [bx, bz] = P([b])[0];
    const len = Math.hypot(bx - ax, bz - az);
    const m = box(g, len, 0.006, 0.006, M.gold, (ax + bx) / 2, depth / 2 + 0.002, (az + bz) / 2);
    m.rotation.y = -Math.atan2(bz - az, bx - ax);
  }
  // 星空面板
  const panelM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: starTexture(), emissive: 0xffffff, emissiveMap: starTexture(), emissiveIntensity: 0.9, roughness: 0.7, metalness: 0 });
  const pan = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(inner.map(([x, z]) => new THREE.Vector2(x, -z)))), panelM);
  pan.geometry.rotateX(-PI / 2);
  pan.position.y = 0.0;
  g.add(pan);
  pan.userData.noHeat = true;
  const gal = new THREE.MeshBasicMaterial({ map: galaxyTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  gal.color.setScalar(1.6);
  const gg = new THREE.CircleGeometry(Z(44), 32);
  gg.rotateX(-PI / 2);
  const galaxy = new THREE.Mesh(gg, gal);
  galaxy.position.set(X(150), 0.003, 0);
  galaxy.scale.set(1.25, 1, 0.8);
  galaxy.userData.keepFx = true; galaxy.userData.noHeat = true; galaxy.userData.noBreak = true;
  g.add(galaxy);
  A.push((dt, t) => { galaxy.rotation.y = -t * 0.35; });
  // 日轮底座 + 红宝珠
  const bx = X(260);
  cylY(g, Z(30), 0.03, M.bronze, bx, 0, 0, 12);
  for (let i = 0; i < 9; i++) {
    const a = PI * (0.1 + 0.8 * (i / 8)) + PI / 2; // 朝剑尖方向的扇形光芒
    const r0 = Z(26), r1 = Z(i % 2 ? 44 : 52);
    const ca = Math.cos(a), sa = Math.sin(a);
    plate(g, [[bx - ca * r0 + sa * Z(6), sa * r0 + ca * Z(6)], [bx - ca * r1, sa * r1], [bx - ca * r0 - sa * Z(6), sa * r0 - ca * Z(6)]], 0.016, [M.bronze, M.bronzeD], 0.004, 0.002);
  }
  torus(g, Z(21), 0.006, M.gold, 'y', 4, 28).position.set(bx, 0.017, 0);
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(Z(17), 1), mat(0xa00c0c, { r: 0.25, m: 0.1, e: 0x900404, ei: 0.7 }));
  orb.position.set(bx, 0.018, 0);
  orb.scale.y = 0.6;
  g.add(orb);
  // 连接框与底座
  bevelBox(g, X(232) - X(250), 0.03, Z(26), M.bronze, (X(232) + X(250)) / 2, 0, 0, 0.003);
  // 三道倾斜星环
  goldRing(g, X(80), Z(95), 0.5, A, { speed: 0.35, dots: 20, tube: 0.011 });
  goldRing(g, X(190), Z(100), 0.45, A, { speed: -0.3, dots: 20, tube: 0.011, ph: 1 });
  goldRing(g, X(255), Z(65), 0.5, A, { speed: 0.4, dots: 14, tube: 0.009, ph: 2 });
  // 8 枚符文石板
  [[82, -92], [82, 92], [132, -88], [132, 82], [172, -88], [172, 86], [212, -88], [212, 88]].forEach(([y, z], i) => {
    const tb = runeTablet(g, X(y), Z(z), Z(17), 60 + i, 0.03);
    tb.rotation.y = (z > 0 ? -1 : 1) * 0.15;
    floatAnim(A, tb, 0.01, 1.2, i * 0.8);
  });
  // 握柄
  const x0 = X(282);
  const xe = grip(g, { x0, len: Z(34), r: 0.013, m: mat(0x3a2414, { r: 0.8, m: 0.1 }), wrap: M.bronze, rings: 7 });
  const xp = pommel(g, { x: xe, type: 'diamond', s: 0.03, m: M.bronze });
  gem(g, Z(4), Z(4), Z(4), M.cyan, xp + 0.012, 0.012, 0);
  return finish(g, { bladeLength: X(22), gripLength: -xp, update: (dt, tt) => A.forEach((f) => f(dt, tt)) });
}

// ============================================================================
// 分裂剑
// ============================================================================
const woodM = () => mat(0x8a4c1c, { r: 0.75, m: 0.05 });
const woodDM = () => mat(0x5a2e0e, { r: 0.8, m: 0.05 });
const whiteGem = () => mat(0xf6f6f6, { r: 0.35, m: 0.1, e: 0xffffff, ei: 0.35 });

// 分节剑身方块
function segBlock(g, x0, x1, hw, t, tip = false) {
  const len = x1 - x0;
  if (tip) {
    plate(g, symPoly([[x0, hw], [x0 + len * 0.6, hw], [x1, 0]]), t, [M.steelBlue, M.steelBlueD], 0, 0.004);
  } else {
    plate(g, [[x0, hw * 1.03], [x1, hw], [x1, -hw], [x0, -hw * 1.03]], t, [M.steelBlue, M.steelBlueD], 0, 0.004);
  }
  // 两条铜色内嵌竖条
  const top = tip ? x0 + len * 0.55 : x1 - len * 0.1;
  for (const s of [1, -1]) box(g, top - (x0 + len * 0.1), 0.002, hw * 0.12, mat(0x6a4a30, { r: 0.7, m: 0.2 }), (top + x0 + len * 0.1) / 2, t / 2, s * hw * 0.72);
  gem(g, hw * 0.16, 0.004, hw * 0.1, whiteGem(), x0 + len * (tip ? 0.45 : 0.5), t / 2, 0);
}

// 悬浮小剑：缓存的合并几何（材质组：0 刃亮 1 刃暗 2 护手 3 握柄）
const _mini = new Map();
function miniSwordGeom(kind = 0) {
  if (_mini.has(kind)) return _mini.get(kind);
  const parts = [];
  const bl = loftGeom([[0.0, 0.018, 1], [0.15, 0.015, 1], [0.21, 0, 0.4]], XS.diamond(0.006, 0.0015));
  // loftGeom 自带 0/1 两组
  parts.push(bl);
  const gd = new THREE.BoxGeometry(0.012, 0.012, kind === 2 ? 0.02 : 0.07);
  const gr = new THREE.CylinderGeometry(0.006, 0.006, 0.06, 6); gr.rotateZ(-PI / 2); gr.translate(-0.036, 0, 0);
  const pm = new THREE.BoxGeometry(0.012, 0.012, 0.012); pm.translate(-0.072, 0, 0);
  const prep = (x) => { const y = x.index ? x.toNonIndexed() : x; if (y.attributes.uv) y.deleteAttribute('uv'); return y; };
  const gs = [prep(bl), prep(gd), prep(gr), prep(pm)];
  const merged = mergeGeometries(gs, false);
  merged.clearGroups();
  const nb = gs[0].attributes.position.count, ng = gs[1].attributes.position.count;
  const nr = gs[2].attributes.position.count, np = gs[3].attributes.position.count;
  const g0 = bl.groups[0];
  merged.addGroup(0, g0.count, 0);
  merged.addGroup(g0.count, nb - g0.count, 1);
  merged.addGroup(nb, ng, 2);
  merged.addGroup(nb + ng, nr + np, 3);
  _mini.set(kind, merged);
  return merged;
}
function miniSword(p, x, z, ang, scale, kind, guardM) {
  const steel = mat(0xb8c0c8, { r: 0.45, m: 0.3 }), steelD = mat(0x7d8792, { r: 0.5, m: 0.3 });
  const gripM = mat(0x6a3a14, { r: 0.8, m: 0 });
  const m = new THREE.Mesh(miniSwordGeom(kind), [steel, steelD, guardM, gripM]);
  m.castShadow = true;
  m.position.set(x, 0.03, z);
  m.rotation.y = -ang;
  m.scale.setScalar(scale);
  p.add(m);
  return m;
}
// 骨白色弯刃（37）
function boneSliver(p, x, z, ang, s) {
  const m = plate(p, [[0, -0.006], [0.06 * s, -0.012], [0.12 * s, 0.004], [0.06 * s, 0.0]], 0.006, [mat(0xf4f0e6, { r: 0.5, m: 0, e: 0xffffff, ei: 0.2 }), mat(0xd8d0c0, { r: 0.6, m: 0 })], 0.03, 0.001);
  m.position.x = x; m.position.z = z;
  m.rotation.y = -ang;
  return m;
}

/**
 * 分裂剑通用：L 总长，nb 剑身节数（含剑尖节），orbit 悬浮小剑配置
 */
function splitSword(L, nb, orbit = null) {
  const g = new THREE.Group();
  const A = [];
  const K = L / 322;
  const Z = (v) => v * K;
  // 剑身：总可用长度按参考图 33（剑尖 19 → 护手 249）
  const bladeLen = Z(230) * (1 + (nb - 3) * 0.12);
  const hw = Z(22.5) * (nb > 3 ? 0.95 : 1), t = 0.026 * L;
  const gap = Z(10);
  const tipLen = Z(62);
  const segLen = (bladeLen - tipLen - gap * nb) / (nb - 1);
  let x = Z(12);
  // 连接白杆
  box(g, bladeLen - Z(8), t * 0.35, Z(4), M.white, x + (bladeLen - Z(8)) / 2, 0, 0);
  for (let i = 0; i < nb - 1; i++) {
    segBlock(g, x, x + segLen, hw, t);
    x += segLen + gap;
  }
  segBlock(g, x, x + tipLen, hw * 0.88, t, true);
  const tipX = x + tipLen;
  // 木护手 + 白色大菱形
  bevelBox(g, Z(12), 0.026, Z(76), woodM(), 0, 0, 0, 0.004);
  bevelBox(g, Z(6), 0.03, Z(10), woodDM(), 0, 0, Z(36), 0.002);
  bevelBox(g, Z(6), 0.03, Z(10), woodDM(), 0, 0, -Z(36), 0.002);
  gem(g, Z(18), Z(7), Z(11), whiteGem(), Z(2), 0.012, 0);
  const xe = grip(g, { x0: -Z(6), len: Z(56), r: Z(8.5), m: woodM(), wrap: mat(0x2e1a0a, { r: 0.9, m: 0 }), rings: 12 });
  const xp = pommel(g, { x: xe, type: 'diamond', s: Z(16), m: mat(0x9a5a28, { r: 0.6, m: 0.2 }) });
  let bodyWidth = Z(76);
  if (orbit) {
    const cx = orbit.cx(bladeLen);
    const piv = new THREE.Group();
    piv.position.x = cx;
    g.add(piv);
    const gold = M.gold, dark = mat(0x2a2420, { r: 0.6, m: 0.3 });
    const r = rng(orbit.seed || 5);
    const items = [];
    for (const ring of orbit.rings) {
      for (let i = 0; i < ring.n; i++) {
        const ang = ring.a0 + (ring.a1 - ring.a0) * (ring.n === 1 ? 0.5 : i / (ring.full ? ring.n : ring.n - 1));
        const R = ring.R * (1 + (r() - 0.5) * (ring.jit || 0));
        const sx = Math.cos(ang) * R, sz = Math.sin(ang) * R;
        const m = ring.bone
          ? boneSliver(piv, sx, sz, ang + 0.6, ring.s)
          : miniSword(piv, sx, sz, ang + (ring.tw || 0), ring.s * (1 + (r() - 0.5) * 0.15), r() > 0.7 ? 1 : 0, r() > 0.6 ? gold : dark);
        items.push({ m, y0: m.position.y, ph: r() * 6 });
      }
    }
    A.push((dt, t) => {
      piv.rotation.y = orbit.spin ? t * orbit.spin : Math.sin(t * 0.6) * 0.05;
      for (const it of items) it.m.position.y = it.y0 + Math.sin(t * 1.6 + it.ph) * 0.012;
    });
  }
  finish(g, { bladeLength: tipX, gripLength: -xp, update: (dt, tt) => A.forEach((f) => f(dt, tt)) });
  g.userData.bodyWidth = bodyWidth;
  return g;
}

const D = PI / 180;
const brokenTogether = () => splitSword(1.0, 3);
const hatesAlone = () => splitSword(1.06, 4, { cx: (b) => b * 0.55, rings: [{ n: 2, R: 0.26, a0: -42 * D, a1: 42 * D, s: 0.95 }] });
const commandsBlades = () => splitSword(1.12, 5, { cx: (b) => b * 0.55, rings: [{ n: 2, R: 0.33, a0: -48 * D, a1: 48 * D, s: 1.3 }] });
const shameless = () => splitSword(1.18, 6, { cx: (b) => b * 0.35, rings: [{ n: 6, R: 0.4, a0: -80 * D, a1: 80 * D, s: 1.35, jit: 0.12 }] });
const thousandSwords = () => splitSword(1.24, 6, {
  cx: (b) => b * 0.45, spin: 0.12, seed: 7,
  rings: [{ n: 10, R: 0.3, a0: 0, a1: 2 * PI, full: true, s: 0.85, jit: 0.1 }, { n: 15, R: 0.5, a0: 0.2, a1: 2 * PI + 0.2, full: true, s: 1.05, jit: 0.08 }],
});
const sovereign = () => splitSword(1.3, 6, {
  cx: (b) => b * 0.45, spin: -0.1, seed: 9,
  rings: [{ n: 6, R: 0.2, a0: 0.3, a1: 2 * PI + 0.3, full: true, bone: true, s: 1.0 },
    { n: 13, R: 0.34, a0: 0, a1: 2 * PI, full: true, s: 0.85, jit: 0.1 },
    { n: 20, R: 0.56, a0: 0.15, a1: 2 * PI + 0.15, full: true, s: 1.05, jit: 0.08 }],
});

export const FORMS = {
  28: runescribed,
  44: awakeningRune,
  29: overcharged,
  30: arcaneEngine,
  31: realityCracking,
  32: akasha,
  33: brokenTogether,
  45: hatesAlone,
  34: commandsBlades,
  35: shameless,
  36: thousandSwords,
  37: sovereign,
};
