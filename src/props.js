// 场景道具 —— 每个 build*() 返回 THREE.Group（未加入场景），锚点见 userData。
// 约定：单位米、Y 向上、正面朝 +Z；需要动画的道具提供 userData.update(dt, t)；自带灯光列在 userData.lights。
import * as THREE from 'three';
import {
  makeMaterials, applyWorldUV, TEX_TILE, glowTexture, plateTexture,
  stoneTexture, brickTexture, brickBumpTexture,
} from './textures.js';

const PI = Math.PI;

// ---------------------------------------------------------------- helpers
const _geo = new Map();
function cachedGeo(key, fn) {
  let g = _geo.get(key);
  if (!g) { g = fn(); _geo.set(key, g); }
  return g;
}
function boxGeo(w, h, d, tile = 0) {
  return cachedGeo(`box${w}|${h}|${d}|${tile}`, () => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (tile) applyWorldUV(g, tile);
    return g;
  });
}
function cylGeo(rt, rb, h, seg = 8, open = false) {
  return cachedGeo(`cyl${rt}|${rb}|${h}|${seg}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
}
function sphGeo(r, w = 8, h = 6) {
  return cachedGeo(`sph${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
}
function mesh(geo, mat, parent, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
const box = (p, w, h, d, mat, x, y, z, tile = 0) => mesh(boxGeo(w, h, d, tile), mat, p, x, y, z);
/** 竖直圆柱（沿 Y） */
const cyl = (p, rt, rb, h, seg, mat, x, y, z) => mesh(cylGeo(rt, rb, h, seg), mat, p, x, y, z);
/** 沿 X 的圆柱 */
function cylX(p, r, len, seg, mat, x, y, z) { const m = cyl(p, r, r, len, seg, mat, x, y, z); m.rotation.z = PI / 2; return m; }
/** 沿 Z 的圆柱 */
function cylZ(p, r, len, seg, mat, x, y, z) { const m = cyl(p, r, r, len, seg, mat, x, y, z); m.rotation.x = PI / 2; return m; }

/** 棱台：底面 wb×db，顶面 wt×dt，高 h，底面在 y=0；平面着色 */
function frustumGeo(wb, db, wt, dt, h, cx = 0) {
  return cachedGeo(`fr${wb}|${db}|${wt}|${dt}|${h}|${cx}`, () => {
    const b = [[-wb / 2, 0, -db / 2], [wb / 2, 0, -db / 2], [wb / 2, 0, db / 2], [-wb / 2, 0, db / 2]];
    const t = [[-wt / 2 + cx, h, -dt / 2], [wt / 2 + cx, h, -dt / 2], [wt / 2 + cx, h, dt / 2], [-wt / 2 + cx, h, dt / 2]];
    const quads = [
      [t[3], t[2], t[1], t[0]], // top
      [b[0], b[1], b[2], b[3]], // bottom
      [b[3], b[2], t[2], t[3]], // +z
      [b[1], b[0], t[0], t[1]], // -z
      [b[2], b[1], t[1], t[2]], // +x
      [b[0], b[3], t[3], t[0]], // -x
    ];
    const pos = [];
    for (const [a, bb, c, d] of quads) pos.push(...a, ...bb, ...c, ...a, ...c, ...d);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    applyWorldUV(g, 1);
    return g;
  });
}

function anchor(parent, x, y, z, name) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  o.name = name || 'anchor';
  parent.add(o);
  return o;
}

function setShadows(root, cast = true) {
  root.traverse((o) => { if (o.isMesh && o.castShadow !== false) o.castShadow = cast; });
}

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let _local = null;
/** 道具专用的额外共享材质 */
function localMats() {
  if (_local) return _local;
  const m = makeMaterials();
  const archTex = stoneTexture({ plain: true });
  _local = {
    arch: new THREE.MeshStandardMaterial({ map: archTex, color: 0xffd2a8, roughness: 0.9, emissive: 0x3a1a08, emissiveIntensity: 0.6 }),
    archDark: new THREE.MeshStandardMaterial({ map: archTex, color: 0xd0a888, roughness: 0.9, emissive: 0x2a1206, emissiveIntensity: 0.6 }),
    ash: new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 1, emissive: 0x501c06, emissiveIntensity: 0.6 }),
    anvilTop: new THREE.MeshStandardMaterial({ map: m.iron.map, color: 0x80848a, roughness: 0.3, metalness: 0.3 }),
    anvil: new THREE.MeshStandardMaterial({ map: m.iron.map, color: 0x575b61, roughness: 0.45, metalness: 0.25 }),
    hammerHead: new THREE.MeshStandardMaterial({ map: m.iron.map, color: 0x4a4d52, roughness: 0.45, metalness: 0.25 }),
    hammerFace: new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.3, metalness: 0.35 }),
    jail: new THREE.MeshStandardMaterial({ map: m.iron.map, color: 0x3c3f44, roughness: 0.45, metalness: 0.2 }),
    rivet: new THREE.MeshStandardMaterial({ color: 0x5a5d62, roughness: 0.25, metalness: 0.3 }),
    recess: new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 1, side: THREE.BackSide }),
    vendInterior: new THREE.MeshStandardMaterial({ color: 0x7c9a86, roughness: 0.8, emissive: 0x23392c, emissiveIntensity: 0.55, side: THREE.BackSide }),
    vendPanel: new THREE.MeshStandardMaterial({ color: 0x5f7d6a, roughness: 0.75, emissive: 0x1a2c22, emissiveIntensity: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xd8f0e0, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.07, depthWrite: false }),
    screenFrame: new THREE.MeshStandardMaterial({ color: 0x8a6f3e, roughness: 0.6, metalness: 0.3, map: m.woodPanel.map }),
    ghostRing: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.6, 0.62), transparent: true, opacity: 0.9, depthWrite: false }),
    ghostRingHi: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.9, 0.9), transparent: true, opacity: 0.8, depthWrite: false }),
    lampShade: new THREE.MeshStandardMaterial({ color: 0x1d2420, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }),
    lampInner: new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.93, 0.8).multiplyScalar(1.6), side: THREE.BackSide }),
  };
  return _local;
}

// ================================================================ 铁砧
/**
 * 低多边形铁砧。原点 = 地面中心；砧面顶高 0.95；砧角朝 +X。
 * 总长约 1.32（x ∈ [-0.5, 0.82]），砧面宽 (Z) 0.34。
 * userData.topY = 0.95
 * userData.swordSpot：剑原点（护手）建议位置，剑身沿 +X 横放在砧面上（砧面中心偏左）。
 * userData.faceCenter：砧面中心（锤击点）。
 */
export function buildAnvil() {
  const g = new THREE.Group(); g.name = 'anvil';
  const L = localMats();
  // 底座（两级台阶）+ 四足
  mesh(frustumGeo(0.82, 0.56, 0.7, 0.46, 0.1), L.anvil, g, 0, 0, 0);
  mesh(frustumGeo(0.66, 0.44, 0.5, 0.36, 0.12), L.anvil, g, 0, 0.1, 0);
  // 腰
  mesh(frustumGeo(0.48, 0.34, 0.3, 0.22, 0.4), L.anvil, g, 0, 0.22, 0);
  // 上部外扩
  mesh(frustumGeo(0.3, 0.22, 0.86, 0.34, 0.2, -0.04), L.anvil, g, 0, 0.62, 0);
  // 砧面
  box(g, 0.86, 0.13, 0.34, L.anvil, -0.04, 0.885, 0);
  box(g, 0.84, 0.012, 0.32, L.anvilTop, -0.04, 0.946, 0);
  // 砧尾（左侧小台阶）
  box(g, 0.1, 0.1, 0.24, L.anvil, -0.52, 0.88, 0);
  // 砧角：沿 +X 的锥体，顶部与砧面齐平
  const hornGeo = cachedGeo('anvilHorn', () => {
    const c = new THREE.ConeGeometry(0.13, 0.48, 8, 1);
    c.rotateZ(-PI / 2); // 尖端朝 +X
    c.scale(1, 0.85, 1);
    c.translate(0.24, 0, 0);
    return c;
  });
  const horn = mesh(hornGeo, L.anvil, g, 0.37, 0.95 - 0.13 * 0.85, 0);
  horn.rotation.x = PI / 8; // 让一条棱朝上，更有块面感
  // 砧角下方的过渡楔
  mesh(frustumGeo(0.14, 0.24, 0.02, 0.2, 0.18, 0.06), L.anvil, g, 0.36, 0.66, 0);
  // 方孔与圆孔（砧面上的 hardy hole）
  box(g, 0.05, 0.004, 0.05, makeMaterials().black, -0.38, 0.953, 0.0);

  g.userData.topY = 0.95;
  g.userData.swordSpot = anchor(g, -0.3, 0.95, 0.02, 'swordSpot');
  g.userData.faceCenter = new THREE.Vector3(-0.04, 0.95, 0);
  return g;
}

// ================================================================ 锤子
/**
 * 大锤。原点 = 握柄末端；柄沿 +Y 长 0.75；锤头中心 y=0.8，长轴沿 X。
 * userData.face：打击面中心（-X 侧）局部坐标 Vector3；userData.faceNormal = (-1,0,0)。
 */
export function buildHammer() {
  const g = new THREE.Group(); g.name = 'hammer';
  const m = makeMaterials(), L = localMats();
  // 柄
  cyl(g, 0.026, 0.03, 0.75, 8, m.blackIron, 0, 0.375, 0);
  // 末端帽
  cyl(g, 0.036, 0.036, 0.03, 8, m.darkIron, 0, 0.015, 0);
  // 缠绕环：鲑红 / 米白 相间
  const ringRed = cylGeo(0.04, 0.04, 0.026, 10), ringW = cylGeo(0.035, 0.035, 0.014, 10);
  let y = 0.06;
  for (let i = 0; i < 8; i++) {
    mesh(ringRed, m.salmon, g, 0, y, 0);
    y += 0.026 / 2 + 0.007;
    if (i < 7) mesh(ringW, m.cream, g, 0, y, 0);
    y += 0.007 + 0.026 / 2;
  }
  // 锤头
  box(g, 0.3, 0.2, 0.2, L.hammerHead, 0.0, 0.8, 0);
  mesh(frustumGeo(0.17, 0.17, 0.2, 0.2, 0.04), L.hammerHead, g, -0.15, 0.8, 0).rotation.z = -PI / 2;
  mesh(frustumGeo(0.17, 0.17, 0.2, 0.2, 0.04), L.hammerHead, g, 0.15, 0.8, 0).rotation.z = PI / 2;
  // 打击面（稍亮的钢面）在 -X
  box(g, 0.02, 0.17, 0.17, L.hammerFace, -0.2, 0.8, 0);
  box(g, 0.02, 0.17, 0.17, L.hammerFace, 0.2, 0.8, 0);
  // 楔环
  box(g, 0.08, 0.205, 0.205, m.darkIron, 0, 0.8, 0);
  g.userData.face = new THREE.Vector3(-0.21, 0.8, 0);
  g.userData.faceNormal = new THREE.Vector3(-1, 0, 0);
  g.userData.headCenter = new THREE.Vector3(0, 0.8, 0);
  return g;
}

// ================================================================ 熔炉
/**
 * 嵌墙式拱形砖炉。原点 = 地面、背面（贴墙面）中心；整体向 +Z 凸出 0.6（台面凸到 0.8）。
 * 炉体宽 1.6（x ±0.8），高 1.8；左侧火钳架在 x≈-1.05。
 * 炉口：x ±0.5，炉床 y=0.82，拱顶 y=1.62，炉膛深 0.55（z 0.05→0.6）。
 * userData.heatSpot：Object3D，剑原点（护手）放在此处、剑身沿其局部 +X 即伸入炉膛煤火中。
 * userData.lights：[外部橙色主光, 炉膛内补光]；userData.update(dt,t) 闪烁 + 火星。
 */
export function buildFurnace() {
  const g = new THREE.Group(); g.name = 'furnace';
  const m = makeMaterials(), L = localMats();
  const W = 1.6, H = 1.8, D = 0.6;
  const hole = { l: -0.5, r: 0.5, b: 0.82, spring: 1.12, R: 0.5 };

  // 砖体前脸（带拱形洞，挤出贯穿形成炉膛侧壁与拱顶）
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, 0.8); shape.lineTo(W / 2, 0.8); shape.lineTo(W / 2, H); shape.lineTo(-W / 2, H); shape.lineTo(-W / 2, 0.8);
  const hp = new THREE.Path();
  hp.moveTo(hole.l, hole.b); hp.lineTo(hole.r, hole.b); hp.lineTo(hole.r, hole.spring);
  hp.absarc(0, hole.spring, hole.R, 0, PI, false);
  hp.lineTo(hole.l, hole.b);
  shape.holes.push(hp);
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false, curveSegments: 14 });
  applyWorldUV(bodyGeo, TEX_TILE.brick);
  const body = mesh(bodyGeo, [m.brick, m.brick], g, 0, 0, 0);

  // 炉膛内壁：背墙（发暖光的砖）
  const innerMat = m.brick.clone();
  innerMat.emissive = new THREE.Color(0xff7a30); innerMat.emissiveMap = brickTexture(); innerMat.emissiveIntensity = 0.35;
  const backGeo = new THREE.ShapeGeometry(new THREE.Shape(hp.getPoints(14)));
  applyWorldUV(backGeo, TEX_TILE.brick);
  mesh(backGeo, innerMat, g, 0, 0, 0.03, false);
  // 拱顶内壁也加一层暖光
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(hole.R - 0.005, hole.R - 0.005, D - 0.04, 14, 1, true, PI / 2, PI), innerMat);
  applyWorldUV(vault.geometry, TEX_TILE.brick);
  vault.rotation.x = PI / 2; vault.position.set(0, hole.spring, D / 2 + 0.01);
  vault.material = innerMat.clone(); vault.material.side = THREE.BackSide;
  g.add(vault);

  // 拱券砖（楔形块，浅色）
  const nV = 9, rIn = hole.R, rOut = hole.R + 0.24, gap = 0.012;
  for (let i = 0; i < nV; i++) {
    const a0 = (i / nV) * PI + gap, a1 = ((i + 1) / nV) * PI - gap;
    const s = new THREE.Shape();
    s.moveTo(Math.cos(a0) * rIn, Math.sin(a0) * rIn);
    s.lineTo(Math.cos(a0) * rOut, Math.sin(a0) * rOut);
    s.lineTo(Math.cos(a1) * rOut, Math.sin(a1) * rOut);
    s.lineTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn);
    const vg = new THREE.ExtrudeGeometry(s, { depth: 0.09, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 });
    applyWorldUV(vg, 0.8, [i * 0.37, 0]);
    mesh(vg, i % 3 === 1 ? L.archDark : L.arch, g, 0, hole.spring, D - 0.02);
  }
  // 拱脚两侧的大块石
  for (const sx of [-1, 1]) {
    box(g, 0.26, 0.15, 0.1, L.arch, sx * 0.63, hole.spring - 0.08, D + 0.03, 0.8);
    box(g, 0.24, 0.14, 0.1, L.archDark, sx * 0.64, hole.spring - 0.235, D + 0.03, 0.8);
  }

  // 下部：两侧砖墩 + 凹进的背板
  for (const sx of [-1, 1]) box(g, 0.36, 0.73, 0.55, m.brick, sx * 0.62, 0.365, 0.275, TEX_TILE.brick);
  box(g, 0.9, 0.73, 0.05, m.brick, 0, 0.365, 0.05, TEX_TILE.brick);
  // 木台面
  box(g, 1.76, 0.07, 0.5, m.wood, 0, 0.765, 0.55, TEX_TILE.wood);
  // 炉床（灰烬）
  box(g, 1.0, 0.02, 0.55, L.ash, 0, hole.b + 0.01, 0.33);

  // 煤块：两种发光材质（每个熔炉独立，用于闪烁）
  const coalMat = m.coal.clone(), hotMat = m.coalHot.clone();
  const r = mulberry(17);
  const coalGeos = [new THREE.BoxGeometry(1, 1, 1), new THREE.DodecahedronGeometry(0.6, 0)];
  const coals = [];
  for (let layer = 0; layer < 2; layer++) {
    const n = layer ? 10 : 15;
    for (let i = 0; i < n; i++) {
      const hot = layer === 1 ? r() < 0.75 : r() < 0.45;
      const c = mesh(coalGeos[r() < 0.6 ? 0 : 1], hot ? hotMat : coalMat, g,
        -0.42 + r() * 0.84, hole.b + 0.06 + layer * 0.09 + r() * 0.04, 0.1 + r() * 0.42, false);
      const s = 0.09 + r() * 0.07;
      c.scale.set(s * (1 + r() * 0.6), s * 0.7, s);
      c.rotation.set(r() * 0.4, r() * PI, r() * 0.4);
      coals.push(c);
    }
  }
  // 煤堆中央的光晕（Bloom 加强）
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color(1, 0.5, 0.18).multiplyScalar(0.7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = mesh(new THREE.PlaneGeometry(1.3, 0.55), glowMat, g, 0, hole.b + 0.16, 0.5, false);

  // 前方铁栅栏：8 根竖栏 + 1 道横栏
  for (let i = 0; i < 8; i++) cyl(g, 0.024, 0.024, 0.26, 6, m.blackIron, -0.44 + i * (0.88 / 7), 0.8 + 0.13, D + 0.06);
  cylX(g, 0.026, 1.24, 6, m.blackIron, 0, 0.97, D + 0.09);

  // 左侧铁制工具架：立杆 + 顶环 + 火钳 + 拨火棍
  const rack = new THREE.Group(); rack.position.set(-1.05, 0, 0.35); g.add(rack);
  cyl(rack, 0.1, 0.12, 0.04, 8, m.blackIron, 0, 0.02, 0);
  cyl(rack, 0.016, 0.016, 1.45, 6, m.blackIron, 0, 0.745, 0);
  const ring = mesh(cachedGeo('toolRing', () => new THREE.TorusGeometry(0.07, 0.012, 5, 14)), m.blackIron, rack, 0, 1.53, 0);
  ring.rotation.y = PI / 2.4;
  cylX(rack, 0.01, 0.22, 5, m.blackIron, 0.11, 1.32, 0);
  // 火钳（两根交叉斜靠）
  const tong = new THREE.Group(); tong.position.set(0.12, 0, 0.08); tong.rotation.z = 0.12; rack.add(tong);
  for (const s of [-1, 1]) {
    const leg = box(tong, 0.022, 1.25, 0.012, m.darkIron, s * 0.03, 0.62, 0);
    leg.rotation.z = s * 0.05;
  }
  // 拨火棍
  const poker = new THREE.Group(); poker.position.set(-0.05, 0, 0.1); poker.rotation.z = -0.1; rack.add(poker);
  cyl(poker, 0.012, 0.012, 1.2, 5, m.darkIron, 0, 0.6, 0);
  const pr = mesh(cachedGeo('pokerRing', () => new THREE.TorusGeometry(0.045, 0.01, 4, 10)), m.darkIron, poker, 0, 1.24, 0);

  // 灯光
  const light = new THREE.PointLight(0xff8c46, 3.5, 9, 1.6);
  light.position.set(0, 1.3, D + 0.65);
  const inner = new THREE.PointLight(0xff9a40, 1.6, 1.6, 2);
  inner.position.set(0, 1.25, 0.35);
  g.add(light, inner);
  g.userData.lights = [light, inner];

  // 火星粒子
  const NP = 26;
  const pPos = new Float32Array(NP * 3), pLife = new Float32Array(NP), pVel = new Float32Array(NP * 3);
  const respawn = (i, life) => {
    pPos[i * 3] = -0.38 + r() * 0.76; pPos[i * 3 + 1] = hole.b + 0.15; pPos[i * 3 + 2] = 0.15 + r() * 0.4;
    pVel[i * 3] = (r() - 0.5) * 0.1; pVel[i * 3 + 1] = 0.2 + r() * 0.35; pVel[i * 3 + 2] = (r() - 0.3) * 0.08;
    pLife[i] = life;
  };
  for (let i = 0; i < NP; i++) respawn(i, r() * 2);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const sparks = new THREE.Points(pGeo, new THREE.PointsMaterial({
    color: new THREE.Color(1, 0.6, 0.25).multiplyScalar(2.5), size: 0.022, map: glowTexture(),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sparks.frustumCulled = false;
  g.add(sparks);

  // 加热位：剑原点在炉口前上方，剑身 +X 指向炉膛（-Z）并略向下
  const heat = new THREE.Object3D(); heat.name = 'heatSpot';
  heat.position.set(0.05, 1.22, D + 0.48);
  heat.rotation.order = 'YXZ'; heat.rotation.y = PI / 2; heat.rotation.z = -0.2;
  g.add(heat);
  g.userData.heatSpot = heat;
  g.userData.coalMaterials = [coalMat, hotMat];
  g.userData.mouthCenter = new THREE.Vector3(0, 1.05, D);

  let flick = 1;
  g.userData.update = (dt, t) => {
    const n = 0.55 * Math.sin(t * 7.3) + 0.3 * Math.sin(t * 13.1 + 1.3) + 0.25 * Math.sin(t * 23.7 + 0.4);
    flick += ((1 + n * 0.12) - flick) * Math.min(1, dt * 12);
    light.intensity = 3.5 * flick;
    inner.intensity = 1.6 * (0.9 + n * 0.15);
    hotMat.emissiveIntensity = 1.5 * (0.88 + n * 0.12);
    coalMat.emissiveIntensity = 0.6 * (0.8 + 0.25 * Math.sin(t * 3.1));
    glowMat.opacity = 0.6 + n * 0.1;
    for (let i = 0; i < NP; i++) {
      pLife[i] -= dt;
      if (pLife[i] <= 0) respawn(i, 1.2 + r() * 1.3);
      pPos[i * 3] += (pVel[i * 3] + Math.sin(t * 3 + i) * 0.05) * dt;
      pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
      pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    }
    pGeo.attributes.position.needsUpdate = true;
  };
  return g;
}

// 简易可复现随机数
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ================================================================ 铁栏 + 巨龙之眼
function eyeTexture() {
  return canvasTex(512, 256, (g, W, H) => {
    const cx = W / 2, cy = H / 2;
    g.fillStyle = '#300400'; g.fillRect(0, 0, W, H);
    g.save(); g.scale(1, H / W * 1.6); // 椭圆渐变
    const gy = cy / (H / W * 1.6);
    const gr = g.createRadialGradient(cx, gy, 0, cx, gy, W * 0.5);
    gr.addColorStop(0, '#ffc27a');
    gr.addColorStop(0.18, '#ff8a44');
    gr.addColorStop(0.45, '#f2481e');
    gr.addColorStop(0.75, '#c0220c');
    gr.addColorStop(1, '#5a0800');
    g.fillStyle = gr; g.fillRect(0, 0, W, H / (H / W * 1.6));
    g.restore();
    // 金色血丝
    const r = mulberry(9);
    const vein = (x, y, ang, len, w, depth) => {
      g.strokeStyle = `rgba(255,${190 + r() * 40 | 0},120,${0.35 + 0.3 * r()})`;
      g.lineWidth = w;
      g.beginPath(); g.moveTo(x, y);
      let px = x, py = y, a = ang;
      const steps = 8;
      for (let i = 0; i < steps; i++) {
        a += (r() - 0.5) * 0.6;
        px += Math.cos(a) * len / steps; py += Math.sin(a) * len / steps * 0.55;
        g.lineTo(px, py);
        if (depth > 0 && r() < 0.18) vein(px, py, a + (r() < 0.5 ? 0.7 : -0.7), len * 0.45, w * 0.6, depth - 1);
      }
      g.stroke();
    };
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * PI * 2 + r() * 0.2;
      vein(cx + Math.cos(a) * 30, cy + Math.sin(a) * 18, a, 150 + r() * 120, 1.6 + r(), 2);
    }
    // 边缘压暗
    g.save(); g.scale(1, 0.5);
    const v = g.createRadialGradient(cx, cy * 2, W * 0.25, cx, cy * 2, W * 0.52);
    v.addColorStop(0, 'rgba(60,0,0,0)'); v.addColorStop(1, 'rgba(40,0,0,0.75)');
    g.fillStyle = v; g.fillRect(0, 0, W, H * 2);
    g.restore();
  });
}

function almondGeo(w, h, key) {
  return cachedGeo('almond' + key, () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.quadraticCurveTo(0, h, w / 2, 0);
    s.quadraticCurveTo(0, -h, -w / 2, 0);
    const geo = new THREE.ShapeGeometry(s, 18);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
    return geo;
  });
}

/**
 * 北墙铁栏门 + 深色凹室 + 巨龙之眼。
 * 原点 = 地面、墙面中心；正面朝 +Z。外框宽 2.0（x ±1.0），高 2.4。
 * 门洞（需要 lead 在墙上开洞）：x ∈ [-0.8, 0.8]，y ∈ [0, 2.1]；凹室向 -Z 深 1.5（z ∈ [-1.5, 0]）。
 * 栏杆、立柱在 z ∈ [0, 0.17]，石楣/石框在 z ∈ [-0.2, 0.2]。
 * userData.eye：眼睛 Group（位于 (0, 1.78, -0.95)）
 * userData.setEyeState('hidden'|'watch'|'angry'|'happy')；userData.update(dt,t)
 * userData.lights：[红色眼光]；userData.wallCut = {x:0, y:1.05, w:1.6, h:2.1}
 */
export function buildCage() {
  const g = new THREE.Group(); g.name = 'cage';
  const m = makeMaterials(), L = localMats();
  // 石楣 + 两侧石框
  box(g, 2.0, 0.3, 0.4, m.stonePlain, 0, 2.25, 0, TEX_TILE.stonePlain);
  for (const sx of [-1, 1]) box(g, 0.2, 2.1, 0.36, m.stonePlain, sx * 0.9, 1.05, 0.02, TEX_TILE.stonePlain);
  // 凹室（内表面朝内）
  box(g, 1.6, 2.1, 1.5, L.recess, 0, 1.05, -0.75);
  // 厚铁立柱 + 铆钉
  const rivG = sphGeo(0.022, 6, 4);
  for (const sx of [-1, 1]) {
    box(g, 0.13, 2.18, 0.1, L.jail, sx * 0.74, 1.09, 0.12);
    for (let i = 0; i < 7; i++) {
      const rv = mesh(rivG, L.rivet, g, sx * 0.74 + sx * 0.02, 0.22 + i * 0.3, 0.17);
      rv.scale.z = 0.6;
    }
  }
  // 7 根竖栏（带套环）
  const barG = cylGeo(0.04, 0.04, 2.1, 8), collarG = cylGeo(0.054, 0.054, 0.1, 8);
  for (let i = 0; i < 7; i++) {
    const x = -0.6 + i * 0.2;
    mesh(barG, L.jail, g, x, 1.05, 0.05);
    mesh(collarG, L.jail, g, x, 1.38, 0.05);
  }
  // 两道横栏
  cylX(g, 0.036, 1.46, 8, L.jail, 0, 1.2, 0.1);
  cylX(g, 0.036, 1.46, 8, L.jail, 0, 1.62, 0.1);

  // ---- 巨龙之眼 ----
  const eye = new THREE.Group(); eye.name = 'dragonEye';
  eye.position.set(0, 1.78, -0.75);
  g.add(eye);
  const lids = new THREE.Group(); eye.add(lids); // 用 scale.y 表示睁眼程度
  const irisMat = new THREE.MeshBasicMaterial({ map: eyeTexture(), transparent: true, opacity: 0, depthWrite: false, fog: false });
  const iris = new THREE.Mesh(almondGeo(0.95, 0.3, 'iris'), irisMat);
  lids.add(iris);
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false });
  const pupilGeo = cachedGeo('pupilV', () => almondGeo(0.28, 0.085, 'pupil').clone().rotateZ(PI / 2));
  const pupil = new THREE.Mesh(pupilGeo, pupilMat);
  pupil.position.z = 0.004;
  lids.add(pupil);
  // 外圈光晕
  const haloMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xff2a08, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.75), haloMat);
  halo.position.z = -0.02;
  eye.add(halo);
  const eyeLight = new THREE.PointLight(0xff3010, 0, 3.0, 2);
  eyeLight.position.set(0, 1.7, 0.35);
  g.add(eyeLight);
  g.userData.lights = [eyeLight];
  g.userData.eye = eye;
  g.userData.eyeParts = { iris, pupil, halo };
  g.userData.wallCut = { x: 0, y: 1.05, w: 1.6, h: 2.1 };

  const S = {
    hidden: { open: 0, bright: 0, rate: 2.5 },
    watch: { open: 1, bright: 1, rate: 0.7 },
    angry: { open: 1.12, bright: 1.9, rate: 3 },
    happy: { open: 0.3, bright: 1.15, rate: 2 },
  };
  let state = 'hidden', open = 0, bright = 0, blinkT = 3, blinkPhase = -1, px = 0;
  const baseCol = new THREE.Color(1, 1, 1), angryCol = new THREE.Color(1.5, 0.55, 0.42);
  g.userData.setEyeState = (s) => { if (S[s]) state = s; };
  g.userData.getEyeState = () => state;

  g.userData.update = (dt, t) => {
    const tg = S[state];
    const k = 1 - Math.exp(-tg.rate * dt);
    open += (tg.open - open) * k;
    bright += (tg.bright - bright) * (1 - Math.exp(-Math.max(1.2, tg.rate) * dt));
    // 眨眼
    let blink = 1;
    if (state === 'watch' || state === 'angry') {
      blinkT -= dt;
      if (blinkT <= 0 && blinkPhase < 0) { blinkPhase = 0; blinkT = 2.5 + Math.random() * 4; }
    }
    if (blinkPhase >= 0) {
      blinkPhase += dt / 0.22;
      blink = blinkPhase < 1 ? Math.abs(Math.cos(blinkPhase * PI)) : 1;
      if (blinkPhase >= 1) blinkPhase = -1;
    }
    const o = Math.max(0, open * blink);
    lids.scale.y = Math.max(0.001, o);
    lids.visible = o > 0.01 && bright > 0.01;
    // 瞳孔
    let tx = 0, dil = 1;
    if (state === 'watch') { tx = 0.13 * Math.sin(t * 0.37) + 0.06 * Math.sin(t * 0.91 + 1); }
    else if (state === 'angry') { tx = 0.02 * Math.sin(t * 9); dil = 0.6; }
    else if (state === 'happy') { tx = 0; dil = 1.3; }
    px += (tx - px) * Math.min(1, dt * 3);
    pupil.position.x = px;
    pupil.scale.x += (dil - pupil.scale.x) * Math.min(1, dt * 4);
    pupil.rotation.z = px * 0.4;
    // 颜色/亮度
    const a = Math.min(1, bright * 1.4);
    irisMat.opacity = a; pupilMat.opacity = a;
    const ang = Math.max(0, Math.min(1, bright - 1));
    irisMat.color.copy(baseCol).lerp(angryCol, ang).multiplyScalar(0.4 + 0.42 * Math.min(1.6, bright));
    haloMat.opacity = Math.min(1, 0.18 * bright * Math.max(0.2, o));
    haloMat.color.setRGB(1, 0.16 + 0.1 * (1 - ang), 0.03);
    eyeLight.intensity = 0.8 * bright * o;
    // 抖动 / 眯眼上移
    if (state === 'angry') eye.position.set(0 + (Math.random() - 0.5) * 0.02, 1.78 + (Math.random() - 0.5) * 0.015, -0.75);
    else eye.position.set(0, 1.78 + (state === 'happy' ? 0.03 : 0), -0.75);
  };
  return g;
}

// ================================================================ 贡台
/**
 * 深色木质贡台桌。原点 = 地面中心；桌面 1.9(X) × 0.85(Z)，顶面 y=0.9；正面朝 +Z（玩家侧）。
 * userData.slots：6 个 Object3D（剑原点=护手，剑身沿局部 +X 平放），护手 x 交错 -0.2/0.0，z 由后到前。
 * userData.boardAnchor：前沿下方小黑板中心（朝 +Z，略向上仰）；默认自带木框黑板，
 *   userData.boardFace 为黑板面 Mesh（0.92×0.32，MeshBasicMaterial，可替换 material.map）。
 * userData.bellSpot：建议放铃铛的位置（左前角）。
 */
export function buildAltarTable(opts = {}) {
  const g = new THREE.Group(); g.name = 'altarTable';
  const m = makeMaterials();
  const W = 1.9, D = 0.85, H = 0.9;
  box(g, W, 0.05, D, m.wood, 0, H - 0.025, 0, TEX_TILE.wood);           // 桌面
  box(g, W + 0.02, 0.04, 0.05, m.wood, 0, H - 0.07, D / 2 - 0.02, TEX_TILE.wood); // 前沿压条
  box(g, W - 0.1, H - 0.1, D - 0.1, m.wood, 0, (H - 0.1) / 2 + 0.05, -0.02, TEX_TILE.wood); // 柜身
  box(g, W - 0.06, 0.06, D - 0.06, m.blackIron, 0, 0.03, -0.02);           // 踢脚
  for (const sx of [-1, 1]) box(g, 0.06, H - 0.05, 0.06, m.wood, sx * (W / 2 - 0.05), (H - 0.05) / 2, D / 2 - 0.06, TEX_TILE.wood);

  g.userData.slots = [];
  for (let i = 0; i < 6; i++) {
    const s = anchor(g, i % 2 ? 0.0 : -0.2, H, -0.3 + i * 0.12, 'slot' + i);
    g.userData.slots.push(s);
  }
  g.userData.topY = H;
  g.userData.bellSpot = anchor(g, -0.72, H, 0.2, 'bellSpot');

  // 小黑板
  const board = new THREE.Group(); board.name = 'tributeBoard';
  board.position.set(0, 0.6, D / 2 + 0.03);
  board.rotation.x = -0.12;
  g.add(board);
  const frameMat = m.woodLight;
  box(board, 1.0, 0.4, 0.03, frameMat, 0, 0, 0, TEX_TILE.wood);
  const faceMat = new THREE.MeshBasicMaterial({ map: plateTexture('#070707', '#141414', 512, 160), color: 0xffffff });
  const face = mesh(new THREE.PlaneGeometry(0.92, 0.32), faceMat, board, 0, 0, 0.016, false);
  for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(board, 0.035, 0.035, 0.01, m.brass, cx * 0.48, cy * 0.18, 0.02);
  if (opts.board === false) board.visible = false;
  g.userData.board = board;
  g.userData.boardFace = face;
  g.userData.boardAnchor = anchor(board, 0, 0, 0.017, 'boardAnchor');
  g.userData.boardSize = { w: 0.92, h: 0.32 };
  return g;
}

// ================================================================ 服务铃
/**
 * 前台服务铃。原点 = 底座底面中心；直径约 0.26，高约 0.16。
 * userData.ring()：触发按压 + 晃动动画；userData.button（Mesh，可射线拾取）；userData.update(dt,t)
 */
export function buildBell() {
  const g = new THREE.Group(); g.name = 'bell';
  const m = makeMaterials();
  cyl(g, 0.125, 0.13, 0.03, 18, m.rubber, 0, 0.015, 0);
  cyl(g, 0.118, 0.122, 0.012, 18, m.copper, 0, 0.036, 0);
  const shell = new THREE.Group(); shell.position.y = 0.04; g.add(shell);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xd08a48, roughness: 0.3, metalness: 0.3, emissive: 0x3a1404, emissiveIntensity: 0.6 });
  cyl(shell, 0.03, 0.112, 0.085, 18, shellMat, 0, 0.0425, 0);
  cyl(shell, 0.012, 0.012, 0.02, 8, m.blackIron, 0, 0.095, 0);
  const button = cyl(shell, 0.019, 0.019, 0.016, 10, m.blackIron, 0, 0.11, 0);
  const cap = mesh(sphGeo(0.019, 10, 5), m.steel, button, 0, 0.006, 0); cap.scale.y = 0.45;
  g.userData.button = button;
  g.userData.shell = shell;
  let tt = -1;
  g.userData.ring = () => { tt = 0; };
  g.userData.update = (dt) => {
    if (tt < 0) return;
    tt += dt;
    const press = tt < 0.08 ? tt / 0.08 : Math.max(0, 1 - (tt - 0.08) / 0.12);
    button.position.y = 0.11 - 0.012 * press;
    const wob = Math.exp(-tt * 5) * Math.sin(tt * 38);
    shell.rotation.z = 0.06 * wob; shell.rotation.x = 0.04 * Math.exp(-tt * 5) * Math.sin(tt * 31 + 1);
    shell.scale.setScalar(1 + 0.02 * wob);
    if (tt > 1.2) { tt = -1; shell.rotation.set(0, 0, 0); shell.scale.setScalar(1); button.position.y = 0.11; }
  };
  return g;
}

// ================================================================ 遗物售货机
function refreshArrowTexture() {
  return canvasTex(256, 256, (g, W) => {
    const c = W / 2;
    const gr = g.createRadialGradient(c, c * 0.8, 10, c, c, c);
    gr.addColorStop(0, '#d8352a'); gr.addColorStop(0.8, '#a8140e'); gr.addColorStop(1, '#5a0604');
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, c, 0, PI * 2); g.fill();
    g.strokeStyle = '#f1e6d2'; g.fillStyle = '#f1e6d2'; g.lineWidth = 18; g.lineCap = 'butt';
    const R = 70;
    const arrow = (a0, a1) => {
      g.beginPath(); g.arc(c, c, R, a0, a1); g.stroke();
      const ax = c + Math.cos(a1) * R, ay = c + Math.sin(a1) * R;
      const tx = -Math.sin(a1), ty = Math.cos(a1); // 切线方向
      const nx = Math.cos(a1), ny = Math.sin(a1);
      g.beginPath();
      g.moveTo(ax + tx * 30, ay + ty * 30);
      g.lineTo(ax + nx * 26, ay + ny * 26);
      g.lineTo(ax - nx * 26, ay - ny * 26);
      g.closePath(); g.fill();
    };
    arrow(PI * 1.05, PI * 1.8);
    arrow(PI * 0.05, PI * 0.8);
  });
}

/**
 * 遗物售货机。原点 = 地面中心（机身 z ∈ [-0.3, 0.3]，顶罩前沿到 z=0.4）；宽 2.0、高 2.2、深 0.6；正面朝 +Z。
 * 分区：石基座 y 0–0.55｜木纹操作面板 y 0.55–1.05｜台沿 1.05–1.11｜展示窗 1.11–1.86｜顶罩 1.86–2.2。
 * userData.windows[3]：展示物放置点（窗内底面中心，x = -0.6/0/0.6, y=1.27）。
 * userData.pricePlates[3]：价签 Mesh（0.52×0.14，各自独立 MeshBasicMaterial，替换 material.map）。
 * userData.slot：投剑口 Object3D（局部 +X 指向机内，即剑尖朝里插入）。
 * userData.hintPlate：投剑口下方小黑牌 Mesh（0.42×0.1）。
 * userData.counterScreen：计数屏 Mesh（0.5×0.22）。
 * userData.refreshButton：红色刷新按钮 Mesh（可射线拾取，子物体为箭头面）；userData.pressRefresh() 播放按下动画。
 * userData.refreshLabel：按钮下方金额标签 Mesh（0.34×0.09）。
 * userData.lights：[绿色内光]；userData.update(dt,t)
 */
export function buildVendingMachine() {
  const g = new THREE.Group(); g.name = 'vendingMachine';
  const m = makeMaterials(), L = localMats();
  const W = 2.0, FZ = 0.3;
  // 基座（灰绿石块）
  box(g, W, 0.55, 0.6, m.stone, 0, 0.275, 0, TEX_TILE.stone);
  // 侧板
  for (const sx of [-1, 1]) box(g, 0.08, 1.65, 0.64, m.machineDark, sx * (W / 2 - 0.04), 0.55 + 0.825, 0.0);
  // 操作面板：机身 + 木纹面
  box(g, 1.84, 0.5, 0.52, m.machineDark, 0, 0.8, -0.03);
  box(g, 1.84, 0.5, 0.04, m.woodPanel, 0, 0.8, FZ - 0.02, 0.9);
  box(g, 1.86, 0.025, 0.05, m.brass, 0, 1.04, FZ - 0.01);
  // 台沿
  box(g, 1.92, 0.06, 0.66, m.machineGreen, 0, 1.08, 0.02);
  // 展示区背板 + 窗间立柱
  box(g, 1.84, 0.76, 0.06, m.machineDark, 0, 1.49, -0.27);
  box(g, 1.84, 0.04, 0.6, m.machineDark, 0, 1.885, 0);
  const winX = [-0.6, 0, 0.6];
  g.userData.windows = []; g.userData.pricePlates = [];
  for (let i = 0; i < 3; i++) {
    const x = winX[i];
    // 内部箱体（浅绿，内表面）
    box(g, 0.58, 0.6, 0.52, L.vendInterior, x, 1.56, 0.02);
    // 背面圆角面板（简化为内嵌板）
    box(g, 0.46, 0.44, 0.02, L.vendPanel, x, 1.56, -0.22);
    // 金色边框
    box(g, 0.025, 0.76, 0.03, m.gold, x - 0.29, 1.49, FZ - 0.005);
    box(g, 0.025, 0.76, 0.03, m.gold, x + 0.29, 1.49, FZ - 0.005);
    box(g, 0.6, 0.025, 0.03, m.gold, x, 1.855, FZ - 0.005);
    // 顶部暖色灯条
    box(g, 0.5, 0.015, 0.03, m.warmLight, x, 1.835, FZ - 0.06).castShadow = false;
    // 玻璃
    mesh(boxGeo(0.56, 0.58, 0.004), L.glass, g, x, 1.56, FZ - 0.01, false);
    // 价签支撑 + 价签
    box(g, 0.56, 0.15, 0.08, m.machineDark, x, 1.185, FZ - 0.03);
    const plateMat = new THREE.MeshBasicMaterial({ map: plateTexture('#050505', '#181818', 256, 72), color: 0xffffff });
    const plate = mesh(new THREE.PlaneGeometry(0.52, 0.14), plateMat, g, x, 1.19, FZ + 0.015, false);
    plate.rotation.x = -0.2;
    plate.name = 'pricePlate' + i;
    g.userData.pricePlates.push(plate);
    g.userData.windows.push(anchor(g, x, 1.27, -0.02, 'window' + i));
  }
  // 顶罩
  box(g, W, 0.34, 0.72, m.machineDark, 0, 2.03, 0.04);
  box(g, W + 0.02, 0.05, 0.05, m.machineGreen, 0, 1.885, 0.385);

  // ---- 面板元件 ----
  const PZ = FZ + 0.0; // 面板前表面
  // 投剑口：金框 + 黑槽
  const sx = -0.58, sy = 0.93;
  box(g, 0.46, 0.028, 0.035, m.gold, sx, sy + 0.05, PZ + 0.015);
  box(g, 0.46, 0.028, 0.035, m.gold, sx, sy - 0.05, PZ + 0.015);
  box(g, 0.028, 0.128, 0.035, m.gold, sx - 0.216, sy, PZ + 0.015);
  box(g, 0.028, 0.128, 0.035, m.gold, sx + 0.216, sy, PZ + 0.015);
  box(g, 0.41, 0.075, 0.01, m.black, sx, sy, PZ + 0.002);
  const slot = new THREE.Object3D(); slot.name = 'swordSlot';
  slot.position.set(sx, sy, PZ + 0.03); slot.rotation.y = PI / 2; g.add(slot);
  g.userData.slot = slot;
  // 提示小黑牌
  const hintMat = new THREE.MeshBasicMaterial({ map: plateTexture('#060606', '#202020', 256, 64), color: 0xffffff });
  const hint = mesh(new THREE.PlaneGeometry(0.42, 0.1), hintMat, g, sx, 0.73, PZ + 0.004, false);
  box(g, 0.45, 0.012, 0.02, m.brass, sx, 0.672, PZ + 0.01);
  g.userData.hintPlate = hint;
  // 计数屏（木框 + 黑屏）
  const cx = 0.0, cy = 0.82;
  box(g, 0.58, 0.3, 0.03, L.screenFrame, cx, cy, PZ + 0.012);
  const scrMat = new THREE.MeshBasicMaterial({ map: plateTexture('#030303', '#111111', 256, 112), color: 0xffffff });
  const screen = mesh(new THREE.PlaneGeometry(0.5, 0.22), scrMat, g, cx, cy, PZ + 0.029, false);
  g.userData.counterScreen = screen;
  // 刷新按钮
  const bx = 0.6, by = 0.86;
  const ringM = cylZ(g, 0.15, 0.03, 20, m.blackIron, bx, by, PZ + 0.015);
  const btnMat = new THREE.MeshStandardMaterial({ color: 0xa8140e, roughness: 0.45, metalness: 0.1, emissive: 0x300000, emissiveIntensity: 0.6 });
  const btn = cylZ(g, 0.125, 0.05, 20, btnMat, bx, by, PZ + 0.045);
  btn.name = 'refreshButton';
  const faceMat = new THREE.MeshStandardMaterial({ map: refreshArrowTexture(), roughness: 0.45, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 });
  const btnFace = new THREE.Mesh(new THREE.CircleGeometry(0.125, 24), faceMat);
  btnFace.rotation.x = -PI / 2; btnFace.position.y = 0.0255; // 子物体（按钮坐标系 Y 轴 = 世界 +Z）
  btn.add(btnFace);
  btn.userData.pickable = true;
  g.userData.refreshButton = btn;
  const labelMat = new THREE.MeshBasicMaterial({ map: plateTexture('#000000', null, 256, 64), color: 0xffffff, transparent: true });
  const label = mesh(new THREE.PlaneGeometry(0.34, 0.09), labelMat, g, bx, 0.645, PZ + 0.004, false);
  g.userData.refreshLabel = label;
  // 面板上的铜钉
  for (const [x, y] of [[-0.88, 1.0], [0.88, 1.0], [-0.88, 0.6], [0.88, 0.6], [-0.3, 0.6], [0.32, 0.98], [-0.32, 0.66], [0.3, 0.64]]) {
    box(g, 0.022, 0.022, 0.012, m.brass, x, y, PZ + 0.006).rotation.z = 0.4;
  }

  // 灯光
  const light = new THREE.PointLight(0x9fe8b8, 1.2, 2.6, 2);
  light.position.set(0, 1.7, 0.55);
  g.add(light);
  g.userData.lights = [light];

  let press = -1;
  g.userData.pressRefresh = () => { press = 0; };
  g.userData.update = (dt) => {
    if (press < 0) return;
    press += dt;
    const k = press < 0.07 ? press / 0.07 : Math.max(0, 1 - (press - 0.07) / 0.15);
    btn.position.z = PZ + 0.045 - 0.025 * k;
    if (press > 0.25) { press = -1; btn.position.z = PZ + 0.045; }
  };
  return g;
}

// ================================================================ 幽灵商人
function ghostAlphaTexture() {
  return canvasTex(4, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, 0, 0); // v=0 底部 → canvas 底部（flipY）
    gr.addColorStop(0, '#000'); gr.addColorStop(0.25, '#555'); gr.addColorStop(0.6, '#dcdcdc'); gr.addColorStop(1, '#fff');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, false);
}

/**
 * 幽灵商人。原点 = 地面中心；身体悬浮（下摆约 y=0.3，兜帽顶约 y=1.82）；正面朝 +Z。
 * userData.itemSlots[4]：商品悬浮点 Object3D（[左上, 右上, 左下, 右下]，userData.kind='upper'|'lower'），
 *   每个自带青色细圆环；商品作为子物体放在 (0,0,0)（上方位：物体中心；下方位：物体底部）。
 * userData.body：浮动的身体 Group；userData.update(dt,t)
 */
export function buildGhost() {
  const g = new THREE.Group(); g.name = 'ghost';
  const m = makeMaterials(), L = localMats();
  const body = new THREE.Group(); body.position.y = 0.3; g.add(body);
  const alpha = ghostAlphaTexture();
  const ghostMat = new THREE.MeshStandardMaterial({
    color: 0xd8fbf6, emissive: 0x4fd6cc, emissiveIntensity: 0.55, roughness: 0.6,
    transparent: true, opacity: 0.8, alphaMap: alpha, side: THREE.DoubleSide, depthWrite: true,
  });
  const solidGhost = ghostMat.clone(); solidGhost.alphaMap = null; solidGhost.opacity = 0.82; solidGhost.side = THREE.FrontSide;
  const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1, 0.95).multiplyScalar(0.8), transparent: true, opacity: 0.35, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, alphaMap: alpha });

  // 长袍（Lathe，底部锯齿）
  const prof = [[0.27, 0], [0.3, 0.2], [0.29, 0.45], [0.33, 0.68], [0.36, 0.82], [0.33, 0.95], [0.22, 1.05], [0.12, 1.08]].map(([x, y]) => new THREE.Vector2(x, y));
  const SEG = 20;
  const robeGeo = new THREE.LatheGeometry(prof, SEG);
  { const p = robeGeo.attributes.position; const np = prof.length;
    for (let i = 0; i <= SEG; i++) { const idx = i * np; p.setY(idx, i % 2 ? 0.0 : 0.13); }
    robeGeo.computeVertexNormals(); }
  const robe = mesh(robeGeo, ghostMat, body, 0, 0, 0, false);
  const robeRim = new THREE.Mesh(robeGeo, rimMat); robeRim.scale.set(1.05, 1.0, 1.05); body.add(robeRim);
  // 兜帽
  const hprof = [[0.0, 0.95], [0.2, 0.98], [0.27, 1.12], [0.27, 1.3], [0.22, 1.44], [0.12, 1.52], [0.0, 1.54]].map(([x, y]) => new THREE.Vector2(x, y));
  const hoodGeo = new THREE.LatheGeometry(hprof, 14);
  const hood = mesh(hoodGeo, solidGhost, body, 0, 0, 0, false);
  hood.scale.z = 0.9;
  const hoodRim = new THREE.Mesh(hoodGeo, rimMat); hoodRim.scale.set(1.06, 1.03, 0.96); body.add(hoodRim);
  // 脸：圆角菱形黑洞 + 亮边
  const diamond = (s, rr) => {
    const sh = new THREE.Shape();
    const pts = [[0, s], [s, 0], [0, -s], [-s, 0]];
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % 4], [px, py] = pts[(i + 3) % 4];
      const p1 = [ax + (px - ax) * rr, ay + (py - ay) * rr], p2 = [ax + (bx - ax) * rr, ay + (by - ay) * rr];
      if (i === 0) sh.moveTo(p1[0], p1[1]); else sh.lineTo(p1[0], p1[1]);
      sh.quadraticCurveTo(ax, ay, p2[0], p2[1]);
    }
    sh.closePath();
    return sh;
  };
  const faceGeo = new THREE.ShapeGeometry(diamond(0.17, 0.28), 4);
  const face = mesh(faceGeo, m.black, body, 0, 1.25, 0.262, false);
  face.scale.set(1.05, 1.0, 1);
  const rimShape = diamond(0.215, 0.3); rimShape.holes.push(diamond(0.17, 0.28));
  const faceRimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 1, 0.97).multiplyScalar(0.9), transparent: true, opacity: 0.85 });
  const fr = mesh(new THREE.ShapeGeometry(rimShape, 4), faceRimMat, body, 0, 1.25, 0.256, false);
  fr.scale.set(1.05, 1.0, 1);
  // 交叉的双臂（袖筒）
  const armGeo = cachedGeo('ghostArm', () => new THREE.CapsuleGeometry(0.105, 0.36, 3, 10));
  for (const s of [-1, 1]) {
    const arm = mesh(armGeo, solidGhost, body, s * 0.02, 0.8 + s * 0.035, 0.27, false);
    arm.rotation.set(0.15 * s, s * 0.35, PI / 2 + s * 0.2);
  }
  // 行囊：背架、背包、铺盖卷、肩带
  box(body, 0.42, 0.4, 0.2, solidGhost, 0, 0.9, -0.33).castShadow = false;
  const roll = cylX(body, 0.09, 0.8, 10, solidGhost, 0, 1.5, -0.2); roll.castShadow = false;
  for (const s of [-1, 1]) {
    cyl(body, 0.016, 0.016, 0.9, 5, m.woodLight, s * 0.3, 1.2, -0.28);
    box(body, 0.035, 0.2, 0.02, m.rope, s * 0.15, 1.04, 0.3).rotation.x = -0.35;
    box(body, 0.035, 0.2, 0.02, m.leather, s * 0.2, 1.08, -0.1).rotation.x = 0.6;
  }
  cylX(body, 0.014, 0.7, 5, m.woodLight, 0, 1.4, -0.3);
  for (const s of [-1, 1]) { const st = cyl(body, 0.012, 0.012, 0.22, 5, m.rope, s * 0.3, 1.5, -0.2); }
  // 左侧小提灯
  const lan = new THREE.Group(); lan.position.set(-0.36, 0.78, 0.05); body.add(lan);
  box(lan, 0.07, 0.012, 0.07, m.brass, 0, 0.06, 0);
  box(lan, 0.07, 0.012, 0.07, m.brass, 0, -0.06, 0);
  mesh(cylGeo(0.026, 0.026, 0.1, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.7, 0.35).multiplyScalar(2.2) }), lan, 0, 0, 0, false);
  mesh(cachedGeo('lanRing', () => new THREE.TorusGeometry(0.03, 0.005, 4, 10)), m.brass, lan, 0, 0.095, 0);
  // 右侧挂珠
  for (let i = 0; i < 5; i++) mesh(sphGeo(0.018, 6, 4), m.woodLight, body, 0.33, 0.62 - i * 0.04, 0.02 + i * 0.004);

  // 商品悬浮位
  const slotDefs = [
    { p: [-0.62, 1.52, 0.08], r: 0.3, kind: 'upper' },
    { p: [0.62, 1.52, 0.08], r: 0.3, kind: 'upper' },
    { p: [-0.55, 0.98, 0.12], r: 0.15, kind: 'lower' },
    { p: [0.55, 0.98, 0.12], r: 0.15, kind: 'lower' },
  ];
  g.userData.itemSlots = [];
  const rings = [];
  slotDefs.forEach((d, i) => {
    const slot = anchor(g, d.p[0], d.p[1], d.p[2], 'itemSlot' + i);
    slot.userData.kind = d.kind;
    slot.userData.base = new THREE.Vector3(...d.p);
    const ringG = new THREE.Group(); ringG.name = 'ring';
    ringG.position.y = d.kind === 'lower' ? -0.01 : 0;
    slot.add(ringG);
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(d.r, 0.006, 4, 48), L.ghostRing);
    r1.rotation.x = PI / 2;
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(d.r, 0.009, 4, 24, 1.1), L.ghostRingHi);
    r2.rotation.x = PI / 2;
    ringG.add(r1, r2);
    rings.push({ ringG, r2, slot, i });
    g.userData.itemSlots.push(slot);
  });
  g.userData.body = body;
  g.userData.lights = [];

  g.userData.update = (dt, t) => {
    body.position.y = 0.3 + 0.05 * Math.sin(t * 1.6);
    body.rotation.y = 0.04 * Math.sin(t * 0.7);
    for (const { ringG, r2, slot, i } of rings) {
      slot.position.y = slot.userData.base.y + 0.025 * Math.sin(t * 1.3 + i * 1.7);
      r2.rotation.z = t * 0.9 * (i % 2 ? -1 : 1);
      ringG.rotation.x = 0.06 * Math.sin(t * 0.8 + i);
      ringG.rotation.z = 0.06 * Math.cos(t * 0.6 + i);
    }
  };
  return g;
}

// ================================================================ 剑架
/**
 * 东墙木制剑架：两排竖立展示，剑尖朝上，剑面正对房间（+Z），前方无横栏遮挡。
 * 原点 = 地面、背面（贴墙）中心；宽 2.44（x ±1.22），高 2.0（顶板），深 0.35；正面朝 +Z。
 * 下排 7 把：握柄插在底座木槽里，护手架在低横木上方，护手 y=0.46，间距 0.34（x = -1.02..1.02），z=0.24。
 * 上排 5 把：挂在背板的铁钩上，护手 y=1.3，间距 0.4（x = -0.8..0.8），z=0.13。
 *   以 1.05m 总长（握柄约 0.25）计，下排剑尖 ≤ ~1.26，上排剑尖 ≤ ~2.1。
 * userData.slots[12]：0–6 下排（左→右），7–11 上排（左→右）。Object3D，剑原点=护手；
 *   局部 +X = 世界 +Y（剑身向上），局部 +Y（剑面法线）= 世界 +Z，局部 +Z = 世界 +X。
 * userData.rows = { lower:{y,z,xs}, upper:{y,z,xs} }。
 */
export function buildSwordRack() {
  const g = new THREE.Group(); g.name = 'swordRack';
  const m = makeMaterials();
  const W = 2.44, H = 2.0, D = 0.35;
  const lower = { y: 0.46, z: 0.24, xs: [] }, upper = { y: 1.3, z: 0.13, xs: [] };
  for (let i = 0; i < 7; i++) lower.xs.push(-1.02 + i * 0.34);
  for (let i = 0; i < 5; i++) upper.xs.push(-0.8 + i * 0.4);
  // 立柱 + 脚
  for (const sx of [-1, 1]) {
    box(g, 0.09, H, 0.12, m.wood, sx * (W / 2 - 0.045), H / 2, 0.08, TEX_TILE.wood);
    box(g, 0.13, 0.06, D, m.wood, sx * (W / 2 - 0.045), 0.03, D / 2, TEX_TILE.wood);
  }
  // 背板（深色，衬托浅色剑身）
  const backMat = m.wood;
  for (let i = 0; i < 6; i++) box(g, W - 0.18, 0.3, 0.025, backMat, 0, 0.32 + i * 0.3, 0.0125, TEX_TILE.wood);
  box(g, W + 0.06, 0.06, 0.16, m.wood, 0, H - 0.03, 0.08, TEX_TILE.wood);     // 顶板
  box(g, W - 0.18, 0.04, 0.05, m.woodLight, 0, H - 0.08, 0.05, TEX_TILE.wood);
  // 底座木槽（握柄插入处）
  box(g, W - 0.18, 0.2, 0.26, m.wood, 0, 0.12, D - 0.14, TEX_TILE.wood);
  box(g, W - 0.14, 0.03, 0.3, m.woodLight, 0, 0.235, D - 0.15, TEX_TILE.wood);
  const slotHoleG = boxGeo(0.12, 0.004, 0.05);
  for (const x of lower.xs) mesh(slotHoleG, m.black, g, x, 0.252, lower.z, false);
  // 低横木（护手架在其上方）——位于剑身后方偏下，不挡剑刃
  box(g, W - 0.18, 0.05, 0.06, m.woodLight, 0, lower.y - 0.06, lower.z - 0.07, TEX_TILE.wood);
  for (const x of lower.xs) {
    // 两侧小木托，护手落在上面
    for (const d of [-0.07, 0.07]) box(g, 0.025, 0.03, 0.06, m.woodLight, x + d, lower.y - 0.025, lower.z - 0.02);
  }
  // 上排挂板 + 铁钩
  box(g, W - 0.18, 0.08, 0.04, m.woodLight, 0, upper.y - 0.1, 0.045, TEX_TILE.wood);
  const hookG = cylGeo(0.009, 0.009, upper.z - 0.04, 5);
  const hookTipG = cylGeo(0.009, 0.009, 0.035, 5);
  for (const x of upper.xs) {
    for (const d of [-0.06, 0.06]) {
      const h = mesh(hookG, m.blackIron, g, x + d, upper.y - 0.02, (upper.z + 0.04) / 2 + 0.01); h.rotation.x = PI / 2;
      mesh(hookTipG, m.blackIron, g, x + d, upper.y - 0.005, upper.z + 0.02);
    }
  }
  // 铁角片
  for (const sx of [-1, 1]) for (const y of [0.25, H - 0.06]) box(g, 0.13, 0.08, 0.01, m.darkIron, sx * (W / 2 - 0.05), y, 0.145);

  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(basis);
  g.userData.slots = [];
  const mk = (x, row, name) => { const a = anchor(g, x, row.y, row.z, name); a.quaternion.copy(q); g.userData.slots.push(a); };
  lower.xs.forEach((x, i) => mk(x, lower, 'rackSlotL' + i));
  upper.xs.forEach((x, i) => mk(x, upper, 'rackSlotU' + i));
  g.userData.rows = { lower, upper };
  return g;
}

// ================================================================ 送货口
/**
 * 墙上的送货口：铁框 + 可上下滑动的小木门，门后漆黑。宽 0.7、高 0.5（洞口）。
 * 原点 = 洞口中心、墙面上（z=0）；正面朝 +Z；整体凸出墙面约 0.14，不需要在墙上开洞。
 * 门向上滑入上方的木罩中。外形范围约 x ±0.45，y -0.33..+0.86。
 * userData.setOpen(bool[, instant])：开/关（update 中缓动，约 0.6s）；userData.open(t)：直接设置开度 0..1；
 * userData.isOpen()、userData.openAmount()；userData.spawnPoint：洞口内送出物品的位置（z=0.06）；
 * userData.ledge：洞口下沿小台面顶面中心；userData.door（Mesh/Group）。
 */
export function buildHatch() {
  const g = new THREE.Group(); g.name = 'hatch';
  const m = makeMaterials(), L = localMats();
  const W = 0.7, H = 0.5;
  // 洞内黑暗
  mesh(new THREE.PlaneGeometry(W, H), m.black, g, 0, 0, 0.008, false);
  // 侧面内壁（暗）
  for (const sx of [-1, 1]) { const w = box(g, 0.01, H, 0.1, L.recess, sx * W / 2, 0, 0.06); w.material = m.rubber; }
  // 铁框：两侧导轨（延伸到上方木罩）、底框
  const rail = L.jail;
  for (const sx of [-1, 1]) {
    box(g, 0.07, 1.12, 0.06, rail, sx * (W / 2 + 0.035), 0.3, 0.07);
  }
  box(g, W + 0.14, 0.07, 0.07, rail, 0, -H / 2 - 0.035, 0.075);
  // 铆钉
  const rivG = sphGeo(0.016, 6, 4);
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
    const r = mesh(rivG, L.rivet, g, sx * (W / 2 + 0.035), -0.2 + i * 0.15, 0.1); r.scale.z = 0.6;
  }
  // 下沿小台面
  box(g, W + 0.2, 0.04, 0.22, m.woodLight, 0, -H / 2 - 0.09, 0.11, TEX_TILE.wood);
  for (const sx of [-1, 1]) { const b = box(g, 0.03, 0.12, 0.03, m.blackIron, sx * 0.3, -H / 2 - 0.16, 0.16); b.rotation.x = 0.7; }
  // 上方木罩（门滑进去）
  const hoodY = H / 2 + 0.3;
  box(g, W + 0.14, 0.6, 0.05, m.wood, 0, hoodY, 0.125, TEX_TILE.wood);
  box(g, W + 0.18, 0.05, 0.08, rail, 0, H / 2 + 0.01, 0.13);
  box(g, W + 0.18, 0.04, 0.08, rail, 0, hoodY + 0.3, 0.13);
  // 木门（竖木板 + 两道铁箍 + 拉手）
  const door = new THREE.Group(); door.name = 'hatchDoor';
  door.position.set(0, 0, 0.07);
  g.add(door);
  for (let i = 0; i < 5; i++) {
    const b = box(door, W / 5 - 0.006, H - 0.01, 0.03, i % 2 ? m.woodLight : m.wood, -W / 2 + W / 10 + i * W / 5, 0, 0);
  }
  for (const y of [-0.15, 0.15]) box(door, W - 0.02, 0.04, 0.012, m.blackIron, 0, y, 0.021);
  const handle = mesh(cachedGeo('hatchHandle', () => new THREE.TorusGeometry(0.035, 0.008, 4, 10, PI)), m.blackIron, door, 0, -0.18, 0.03);
  handle.rotation.z = PI;
  // 锚点
  g.userData.door = door;
  g.userData.spawnPoint = anchor(g, 0, -0.05, 0.06, 'spawnPoint');
  g.userData.ledge = anchor(g, 0, -H / 2 - 0.07, 0.11, 'ledge');
  let cur = 0, target = 0;
  const apply = () => {
    const e = cur * cur * (3 - 2 * cur);
    door.position.y = e * (H + 0.02);
  };
  g.userData.open = (t) => { cur = target = Math.max(0, Math.min(1, t)); apply(); };
  g.userData.setOpen = (b, instant = false) => { target = b ? 1 : 0; if (instant) { cur = target; apply(); } };
  g.userData.isOpen = () => target === 1;
  g.userData.openAmount = () => cur;
  g.userData.update = (dt) => {
    if (cur === target) return;
    const step = dt / 0.6;
    cur = target > cur ? Math.min(target, cur + step) : Math.max(target, cur - step);
    apply();
  };
  return g;
}

// ================================================================ 壁灯
/**
 * 暖色小壁灯（铁支架 + 小灯罩 + 灯泡）。原点 = 墙上安装点；正面朝 +Z；灯泡在 (0, -0.06, 0.36)，光源在 (0,-0.12,0.4)。
 * userData.lights = [PointLight 暖色]；userData.update(dt,t) 轻微闪烁。
 */
export function buildWallLamp() {
  const g = new THREE.Group(); g.name = 'wallLamp';
  const m = makeMaterials(), L = localMats();
  box(g, 0.1, 0.16, 0.02, m.blackIron, 0, 0, 0.01);
  const arm = cylZ(g, 0.01, 0.34, 5, m.blackIron, 0, 0.0, 0.18);
  const brace = cyl(g, 0.007, 0.007, 0.26, 5, m.blackIron, 0, -0.06, 0.14); brace.rotation.x = 1.15;
  // 灯罩（向下开口）
  const prof = [[0.012, 0.03], [0.04, 0.02], [0.075, -0.03], [0.085, -0.06]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(prof, 12), L.lampShade, g, 0, -0.02, 0.36);
  mesh(new THREE.LatheGeometry(prof.map((v) => new THREE.Vector2(v.x * 0.94, v.y - 0.003)), 12), L.lampInner, g, 0, -0.02, 0.36, false);
  cyl(g, 0.012, 0.012, 0.06, 6, m.blackIron, 0, 0.02, 0.36);
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.75, 0.4).multiplyScalar(3) });
  mesh(sphGeo(0.028, 8, 6), bulbMat, g, 0, -0.06, 0.36, false);
  const light = new THREE.PointLight(0xffb066, 3.0, 5, 1.5);
  light.position.set(0, -0.12, 0.4);
  g.add(light);
  g.userData.lights = [light];
  g.userData.update = (dt, t) => { light.intensity = 3.0 * (0.97 + 0.03 * Math.sin(t * 11.0) * Math.sin(t * 3.7)); };
  return g;
}

// ================================================================ 遗物陈列架
/**
 * 8 格木制陈列架（4 列 × 2 行，下部为柜体）。原点 = 地面、背面中心；宽 1.86，高 1.72，深 0.4；正面朝 +Z。
 * 格子内尺寸约 0.42 × 0.36 × 0.34；userData.slots[8]：格子底面中心（行优先：上排左→右，再下排）。
 */
export function buildRelicShelf() {
  const g = new THREE.Group(); g.name = 'relicShelf';
  const m = makeMaterials();
  const cols = 4, rows = 2, cw = 0.42, ch = 0.36, t = 0.035, D = 0.4;
  const W = cols * cw + (cols + 1) * t;
  const base = 0.8;
  // 柜体
  box(g, W, base, D, m.wood, 0, base / 2, D / 2, TEX_TILE.wood);
  for (const sx of [-1, 1]) {
    box(g, W / 2 - 0.06, base - 0.16, 0.012, m.woodLight, sx * W / 4, base / 2, D + 0.006, TEX_TILE.wood);
    box(g, 0.02, 0.12, 0.03, m.brass, sx * 0.06, base / 2 + 0.05, D + 0.015);
  }
  box(g, W + 0.04, 0.04, D + 0.04, m.wood, 0, base + 0.02, D / 2, TEX_TILE.wood);
  const y0 = base + 0.04;
  const H = rows * ch + (rows) * t;
  box(g, W, H + 0.04, 0.02, m.wood, 0, y0 + H / 2, 0.01, TEX_TILE.wood); // 背板
  for (let c = 0; c <= cols; c++) {
    const x = -W / 2 + t / 2 + c * (cw + t);
    box(g, t, H, D - 0.03, m.wood, x, y0 + H / 2, D / 2 + 0.005, TEX_TILE.wood);
  }
  for (let r = 1; r <= rows; r++) box(g, W, t, D - 0.02, m.wood, 0, y0 + r * (ch + t) - t / 2, D / 2, TEX_TILE.wood);
  box(g, W + 0.06, 0.05, D + 0.04, m.wood, 0, y0 + H + 0.025, D / 2, TEX_TILE.wood); // 顶板
  g.userData.slots = [];
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      const x = -W / 2 + t + cw / 2 + c * (cw + t);
      const y = y0 + r * (ch + t);
      g.userData.slots.push(anchor(g, x, y, D / 2 + 0.02, 'relicSlot' + g.userData.slots.length));
      // 小铜铭牌
      box(g, 0.12, 0.03, 0.006, m.brass, x, y - (r === 0 ? 0.02 : t / 2) - (r === 0 ? 0 : 0), D + 0.003);
    }
  }
  g.userData.cell = { w: cw, h: ch, d: D - 0.05 };
  return g;
}

// ================================================================ 吊灯
/**
 * 工业风圆罩吊灯。原点 = 天花板挂点；灯罩底沿在 y≈-0.58。
 * 内含暖白 SpotLight（朝下，target 为子物体），userData.lights = [spot]。
 */
export function buildCeilingLamp() {
  const g = new THREE.Group(); g.name = 'ceilingLamp';
  const m = makeMaterials(), L = localMats();
  cyl(g, 0.06, 0.06, 0.02, 10, m.blackIron, 0, -0.01, 0);
  cyl(g, 0.008, 0.008, 0.38, 5, m.blackIron, 0, -0.2, 0);
  cyl(g, 0.03, 0.04, 0.05, 10, m.blackIron, 0, -0.41, 0);
  const prof = [[0.035, -0.42], [0.08, -0.44], [0.15, -0.5], [0.2, -0.56], [0.215, -0.58]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(prof, 18), L.lampShade, g, 0, 0, 0);
  const inner = prof.map((v) => new THREE.Vector2(v.x * 0.96, v.y - 0.004));
  mesh(new THREE.LatheGeometry(inner, 18), L.lampInner, g, 0, 0, 0, false);
  mesh(sphGeo(0.05, 10, 6), m.lampWhite, g, 0, -0.5, 0, false);
  const spot = new THREE.SpotLight(0xffe2b8, 14, 7, 0.8, 0.7, 1.5);
  spot.position.set(0, -0.52, 0);
  const target = new THREE.Object3D(); target.position.set(0, -3, 0.0);
  g.add(spot, target); spot.target = target;
  const fill = new THREE.PointLight(0xffe2b8, 0.6, 1.2, 2); fill.position.set(0, -0.5, 0);
  g.add(fill);
  g.userData.lights = [spot, fill];
  g.userData.target = target;
  return g;
}

// ================================================================ 墙上六角星
/**
 * 铁制六角星装饰（k_11 顶部阴影）。原点 = 星中心；外径 0.56，厚 0.03，正面 +Z；上方吊杆到 y=+0.6。
 */
export function buildWallStar() {
  const g = new THREE.Group(); g.name = 'wallStar';
  const m = makeMaterials();
  const R = 0.28, r = R / Math.sqrt(3);
  const s = new THREE.Shape();
  for (let i = 0; i < 12; i++) {
    const a = PI / 2 + i * PI / 6, rad = i % 2 ? r : R;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.06, 0, PI * 2, true); s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1, curveSegments: 8 });
  geo.translate(0, 0, -0.015);
  mesh(geo, m.blackIron, g, 0, 0, 0);
  cyl(g, 0.012, 0.012, 0.6 - R + 0.02, 5, m.blackIron, 0, R + (0.6 - R) / 2, 0);
  const ring = mesh(cachedGeo('starRing', () => new THREE.TorusGeometry(0.035, 0.008, 4, 10)), m.blackIron, g, 0, 0.62, 0);
  return g;
}

// ================================================================ 杂物
/**
 * 小杂物：'crate' 木箱(0.5³) | 'barrel' 木桶(高 0.75) | 'chain' 铁链(长 0.9，自原点向 -Y 垂下)
 *        | 'tongs' 火钳架 | 'bucket' 煤桶 | 'coal' 煤堆。原点 = 底面中心（chain 为顶端）。
 */
export function buildClutter(kind = 'crate') {
  const g = new THREE.Group(); g.name = 'clutter_' + kind;
  const m = makeMaterials();
  if (kind === 'crate') {
    const s = 0.5;
    box(g, s, s, s, m.woodLight, 0, s / 2, 0, TEX_TILE.wood);
    for (const z of [-1, 1]) {
      for (const y of [0.03, s - 0.03]) box(g, s + 0.01, 0.06, 0.02, m.wood, 0, y, z * (s / 2 + 0.005));
      for (const x of [-1, 1]) box(g, 0.06, s, 0.02, m.wood, x * (s / 2 - 0.03), s / 2, z * (s / 2 + 0.005));
      const d = box(g, 0.05, s * 1.3, 0.015, m.wood, 0, s / 2, z * (s / 2 + 0.008)); d.rotation.z = PI / 4;
    }
  } else if (kind === 'barrel') {
    const prof = [[0.0, 0], [0.24, 0], [0.28, 0.2], [0.29, 0.375], [0.28, 0.55], [0.24, 0.75], [0, 0.75]].map(([x, y]) => new THREE.Vector2(x, y));
    const bg = new THREE.LatheGeometry(prof, 12);
    const uv = bg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * 0.6, uv.getX(i) * 2.0);
    mesh(bg, m.woodLight, g, 0, 0, 0);
    for (const y of [0.12, 0.63]) cyl(g, 0.272, 0.272, 0.04, 12, m.darkIron, 0, y, 0);
    for (const y of [0.3, 0.45]) cyl(g, 0.292, 0.292, 0.035, 12, m.darkIron, 0, y, 0);
  } else if (kind === 'chain') {
    const lg = cachedGeo('chainLink', () => new THREE.TorusGeometry(0.035, 0.009, 4, 8));
    for (let i = 0; i < 12; i++) {
      const l = mesh(lg, m.darkIron, g, 0, -0.035 - i * 0.075, 0);
      l.scale.y = 1.4; l.rotation.y = i % 2 ? PI / 2 : 0;
    }
  } else if (kind === 'tongs') {
    box(g, 0.3, 0.03, 0.2, m.blackIron, 0, 0.015, 0);
    cyl(g, 0.015, 0.015, 1.1, 5, m.blackIron, 0, 0.55, 0);
    for (const s of [-1, 1]) {
      const t = box(g, 0.02, 1.0, 0.012, m.darkIron, s * 0.08, 0.5, 0.05); t.rotation.z = s * 0.08;
    }
    mesh(cachedGeo('toolRing', () => new THREE.TorusGeometry(0.07, 0.012, 5, 14)), m.blackIron, g, 0, 1.15, 0);
  } else if (kind === 'bucket') {
    mesh(cylGeo(0.2, 0.16, 0.32, 12, true), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide }), g, 0, 0.16, 0);
    cyl(g, 0.16, 0.16, 0.01, 12, m.darkIron, 0, 0.005, 0);
    for (let i = 0; i < 8; i++) {
      const c = mesh(cachedGeo('coalBox', () => new THREE.DodecahedronGeometry(0.06, 0)), m.coalCold, g, (Math.random() - 0.5) * 0.24, 0.28 + Math.random() * 0.03, (Math.random() - 0.5) * 0.24);
      c.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    }
    const h = mesh(new THREE.TorusGeometry(0.2, 0.006, 4, 16, PI), m.darkIron, g, 0, 0.32, 0); h.rotation.y = PI / 2;
  } else if (kind === 'coal') {
    const r = mulberry(5);
    for (let i = 0; i < 18; i++) {
      const c = mesh(cachedGeo('coalBox', () => new THREE.DodecahedronGeometry(0.06, 0)), m.coalCold, g, (r() - 0.5) * 0.5, 0.04 + r() * 0.06 * (1 - Math.abs(r() - 0.5)), (r() - 0.5) * 0.35);
      c.rotation.set(r() * 3, r() * 3, 0); c.scale.setScalar(0.8 + r() * 0.6);
    }
  }
  return g;
}

/** 便捷：按名称构建 */
export const PROP_BUILDERS = {
  anvil: buildAnvil, hammer: buildHammer, furnace: buildFurnace, cage: buildCage,
  altar: buildAltarTable, bell: buildBell, vending: buildVendingMachine, ghost: buildGhost,
  rack: buildSwordRack, shelf: buildRelicShelf, lamp: buildCeilingLamp, star: buildWallStar,
  hatch: buildHatch, wallLamp: buildWallLamp,
};
