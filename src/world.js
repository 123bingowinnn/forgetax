// 铸剑大师 - 房间搭建与道具摆放
import * as THREE from 'three';
import * as P from './props.js';
import * as TX from './textures.js';
import { InfoPanel, Calendar, TributeBoard, makeScreen, drawCounter, drawPrice, drawLabel, drawSwapHint } from './boards.js';

export const ROOM = { x0: -3.5, x1: 3.5, z0: -3, z1: 3, h: 3.0 };

function tiled(mat, rx, ry) {
  const m = mat.clone();
  ['map', 'roughnessMap', 'bumpMap', 'normalMap'].forEach(k => {
    if (m[k]) { m[k] = m[k].clone(); m[k].repeat.set(rx, ry); m[k].wrapS = m[k].wrapT = THREE.RepeatWrapping; m[k].needsUpdate = true; }
  });
  return m;
}

function wall(mat, w, h, texScale) {
  const m = tiled(mat, w / texScale, h / texScale);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.receiveShadow = true;
  return mesh;
}

function call(fn, ...a) {
  if (typeof fn !== 'function') return new THREE.Group();
  try { return fn(...a); } catch (e) { console.error(e); return new THREE.Group(); }
}

export function buildWorld(scene) {
  const W = { colliders: [], updaters: [], interactables: [] };
  const M = TX.makeMaterials ? TX.makeMaterials() : {};
  const brick = M.brick || new THREE.MeshStandardMaterial({ color: 0x6b4630, roughness: 0.95 });
  if (M.brick) { brick.color.multiply(new THREE.Color(0.62, 0.56, 0.53)); }   // 原作砖墙更灰褐、不那么橙
  const stone = M.stone || new THREE.MeshStandardMaterial({ color: 0x55584f, roughness: 0.95 });
  const floor = M.floor || new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.95 });
  const wood = M.wood || new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.9 });
  const { x0, x1, z0, z1, h } = ROOM;
  const RW = x1 - x0, RD = z1 - z0;

  /* ---------- 房间 ---------- */
  const f = wall(floor, RW, RD, 1.0);
  f.rotation.x = -Math.PI / 2; f.position.set(0, 0, 0);
  scene.add(f);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = h; scene.add(ceil);
  // 天花板木梁
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(RW, 0.22, 0.25), wood);
    b.position.set(0, h - 0.11, z0 + 0.9 + i * 1.5); b.castShadow = true; scene.add(b);
  }
  // 南墙（锻造墙，砖）
  const ws = wall(brick, RW, h, 1.6); ws.position.set(0, h / 2, z1); ws.rotation.y = Math.PI; scene.add(ws);
  // 西墙（砖）
  const ww = wall(brick, RD, h, 1.6); ww.position.set(x0, h / 2, 0); ww.rotation.y = Math.PI / 2; scene.add(ww);
  // 东墙（砖）
  const we = wall(brick, RD, h, 1.6); we.position.set(x1, h / 2, 0); we.rotation.y = -Math.PI / 2; scene.add(we);
  // 北墙（冷色石墙，凹室在笼门后）
  // 笼门处开洞：x ∈ [-2.0, -0.4]，y ∈ [0, 2.1]
  const hx0 = -2.0, hx1 = -0.4, hy = 2.1;
  [[x0, hx0, 0, h], [hx1, x1, 0, h], [hx0, hx1, hy, h]].forEach(([a, b, y0, y1]) => {
    const m = wall(stone, b - a, y1 - y0, 1.6);
    m.position.set((a + b) / 2, (y0 + y1) / 2, z0); scene.add(m);
  });
  // 北墙中间的石柱（笼门与售货机之间）
  const pil = new THREE.Mesh(new THREE.BoxGeometry(0.45, h, 0.5), tiled(stone, 0.3, 1.8));
  pil.position.set(0.32, h / 2, z0 + 0.25); pil.castShadow = pil.receiveShadow = true; scene.add(pil);
  W.colliders.push(box(pil.position.x, pil.position.z, 0.45, 0.5));
  // 踢脚
  const skirtM = new THREE.MeshStandardMaterial({ color: 0x15110e, roughness: 1 });
  [[0, z1 - 0.04, RW, 0.08], [0, z0 + 0.04, RW, 0.08], [x0 + 0.04, 0, 0.08, RD], [x1 - 0.04, 0, 0.08, RD]].forEach(([x, z, w, d]) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), skirtM); s.position.set(x, 0.07, z); scene.add(s);
  });

  /* ---------- 灯光 ---------- */
  scene.add(new THREE.HemisphereLight(0x5a4434, 0x0a0806, 0.35));
  // 锻造区暖光（带阴影：锤子的影子会投到墙上）
  const forgeSpot = new THREE.SpotLight(0xffd0a8, 24, 9, 0.75, 0.6, 1.6);
  forgeSpot.position.set(1.1, 2.75, 0.9);
  forgeSpot.target.position.set(-0.1, 1.2, 2.8);
  forgeSpot.castShadow = true;
  forgeSpot.shadow.mapSize.set(1024, 1024);
  forgeSpot.shadow.bias = -0.0008;
  forgeSpot.shadow.normalBias = 0.02;
  scene.add(forgeSpot, forgeSpot.target);
  const forgeFill = new THREE.PointLight(0xffb27a, 2.6, 5, 1.6);
  forgeFill.position.set(-0.6, 1.6, 1.4); scene.add(forgeFill);
  // 笼门区冷光
  const cageLight = new THREE.SpotLight(0xa8c0a8, 16, 6, 0.8, 0.7, 1.6);
  cageLight.position.set(-1.0, 2.85, -0.6); cageLight.target.position.set(-1.2, 0.9, -2.6);
  scene.add(cageLight, cageLight.target);
  // 东墙剑架补光
  const rackLight = new THREE.SpotLight(0xffb070, 14, 6, 0.9, 0.7, 1.5);
  rackLight.position.set(1.4, 2.7, 0.2); rackLight.target.position.set(3.5, 1.0, 0.0);
  scene.add(rackLight, rackLight.target);
  const shelfFill = new THREE.PointLight(0x9ab0c8, 1.2, 3.5, 1.8);
  shelfFill.position.set(2.4, 1.8, -1.3); scene.add(shelfFill);
  W.lights = { forgeSpot, forgeFill, cageLight, rackLight };

  /* ---------- 锻造墙：铁砧 / 锤子 / 面板 / 日历 ---------- */
  const anvil = call(P.buildAnvil);
  anvil.position.set(0, 0, 2.35);
  anvil.rotation.y = Math.PI; // 砧角朝向玩家视角的右侧
  shadowAll(anvil);
  scene.add(anvil);
  W.anvil = anvil;
  W.colliders.push(box(0, 2.35, 1.5, 0.75));
  tagInteract(anvil, { kind: 'anvil' });

  // 锤子横握：握柄末端（枢轴）在屏幕右侧，柄向左伸，锤面朝下；挥锤 = 绕世界 Z 轴转动 hammerRig
  const hammerRig = new THREE.Group();
  hammerRig.position.set(-0.9, 1.2, 2.32);
  const hammer = call(P.buildHammer);
  hammer.scale.setScalar(1.1);
  // 局部 X→世界 +Y，局部 Y→世界 +X，局部 Z→世界 -Z
  hammer.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1)));
  shadowAll(hammer);
  hammerRig.add(hammer);
  scene.add(hammerRig);
  W.hammer = hammer; W.hammerRig = hammerRig;
  tagInteract(hammer, { kind: 'anvil' });

  const panel = new InfoPanel();
  // 原作：锻造面板挂得很低、很大，就在铁砧正上方，锻造时占据画面上半部分
  panel.group.position.set(-0.18, 1.5, z1 - 0.05);
  panel.group.scale.setScalar(1.32);
  panel.group.rotation.y = Math.PI;
  scene.add(panel.group);
  W.panel = panel;

  const cal = new Calendar();
  cal.group.position.set(1.12, 1.62, z1 - 0.03);
  cal.group.rotation.set(0, Math.PI, 0.03);
  scene.add(cal.group);
  W.calendar = cal;
  tagInteract(cal.group, { kind: 'calendar' });

  const star = call(P.buildWallStar);
  star.position.set(-0.1, 2.65, z1 - 0.12); star.rotation.y = Math.PI; scene.add(star);

  /* ---------- 西墙：熔炉 + 幽灵商人站位 ---------- */
  const furnace = call(P.buildFurnace);
  furnace.position.set(x0 + 0.02, 0, 1.45);
  furnace.rotation.y = Math.PI / 2;
  shadowAll(furnace, false);
  scene.add(furnace);
  W.furnace = furnace;
  W.colliders.push(box(x0 + 0.45, 1.45, 0.9, 1.8));
  tagInteract(furnace, { kind: 'furnace' });
  if (furnace.userData.update) W.updaters.push(furnace.userData.update);

  const ghostSpot = new THREE.Group();
  ghostSpot.position.set(x0 + 0.75, 0, -0.75);
  ghostSpot.rotation.y = Math.PI / 2;
  scene.add(ghostSpot);
  W.ghostSpot = ghostSpot;
  W.colliders.push(box(x0 + 0.75, -0.75, 0.9, 1.2));

  /* ---------- 北墙：笼门 + 贡台 + 铃铛 + 贡品板 ---------- */
  const cage = call(P.buildCage);
  cage.position.set(-1.2, 0, z0 + 0.02);
  scene.add(cage);
  W.cage = cage;
  if (cage.userData.update) W.updaters.push(cage.userData.update);

  const altar = call(P.buildAltarTable);
  altar.position.set(-1.2, 0, z0 + 0.62);
  shadowAll(altar);
  scene.add(altar);
  W.altar = altar;
  W.colliders.push(box(-1.2, z0 + 0.62, 1.95, 0.9));
  tagInteract(altar, { kind: 'altar' });

  const bell = call(P.buildBell);
  bell.position.set(-1.95, 0.9, z0 + 0.72);
  scene.add(bell);
  W.bell = bell;
  if (bell.userData.update) W.updaters.push(bell.userData.update);
  tagInteract(bell, { kind: 'bell' });

  const tb = new TributeBoard(altar.userData.boardFace);
  if (!altar.userData.boardFace) { tb.group.position.set(-1.2, 0.62, z0 + 1.09); scene.add(tb.group); }
  W.tributeBoard = tb;

  /* ---------- 北墙：遗物售货机 + 吊灯 ---------- */
  const vm = call(P.buildVendingMachine);
  vm.position.set(1.7, 0, z0 + 0.3);
  shadowAll(vm, false);
  scene.add(vm);
  W.vending = vm;
  W.colliders.push(box(1.7, z0 + 0.32, 2.05, 0.66));
  const ud = vm.userData;
  // 屏幕贴图
  W.vendScreens = { counter: makeScreen(256, 110), prices: [0, 1, 2].map(() => makeScreen(256, 96)), refresh: makeScreen(256, 80), hint: makeScreen(256, 96) };
  if (ud.counterScreen) ud.counterScreen.material = W.vendScreens.counter.mat;
  (ud.pricePlates || []).forEach((m, i) => { m.material = W.vendScreens.prices[i].mat; });
  if (ud.refreshLabel) { ud.refreshLabel.material = W.vendScreens.refresh.mat; W.vendScreens.refresh.mat.transparent = true; }
  if (ud.hintPlate) { ud.hintPlate.material = W.vendScreens.hint.mat; drawSwapHint(W.vendScreens.hint); }
  drawCounter(W.vendScreens.counter, 0);
  if (ud.refreshButton) tagInteract(ud.refreshButton, { kind: 'vendRefresh' });
  W.vendWindows = (ud.windows || []).map((o, i) => {
    const holder = new THREE.Group();
    o.add(holder);
    return holder;
  });
  // 窗口可交互的透明体积
  (ud.windows || []).forEach((o, i) => {
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.35), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.2;
    o.add(hit);
    tagInteract(hit, { kind: 'vendWindow', index: i });
  });
  if (ud.update) W.updaters.push(ud.update);
  // 投剑口的交互体积（总能射中）
  if (ud.slot) {
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
    ud.slot.add(hit);
    tagInteract(hit, { kind: 'vendSlot' });
  }

  const lamp = call(P.buildCeilingLamp);
  lamp.position.set(1.7, h, z0 + 0.9);
  scene.add(lamp);

  /* ---------- 东墙：剑架 + 遗物陈列架 ---------- */
  const rack = call(P.buildSwordRack);
  rack.position.set(x1 - 0.02, 0, 0.95);
  rack.rotation.y = -Math.PI / 2;
  shadowAll(rack);
  scene.add(rack);
  W.rack = rack;
  W.colliders.push(box(x1 - 0.3, 0.95, 0.6, 2.0));
  tagInteract(rack, { kind: 'rack' });

  // 送货口（每天早上剑从这里送进来）+ 剑架壁灯
  if (P.buildHatch) {
    const hatch = call(P.buildHatch);
    hatch.position.set(x1 - 0.02, 1.25, 2.55);
    hatch.rotation.y = -Math.PI / 2;
    scene.add(hatch);
    W.hatch = hatch;
    if (hatch.userData.update) W.updaters.push(hatch.userData.update);
  }
  if (P.buildWallLamp) {
    [0.25, 1.65].forEach(z => {
      const l = call(P.buildWallLamp);
      l.position.set(x1 - 0.02, 2.05, z); l.rotation.y = -Math.PI / 2;
      scene.add(l);
      if (l.userData.update) W.updaters.push(l.userData.update);
    });
  }

  const shelf = call(P.buildRelicShelf);
  shelf.position.set(x1 - 0.02, 0, -1.35);
  shelf.rotation.y = -Math.PI / 2;
  shadowAll(shelf);
  scene.add(shelf);
  W.shelf = shelf;
  W.colliders.push(box(x1 - 0.3, -1.35, 0.6, 1.6));

  // 杂物
  if (P.buildClutter) {
    [['barrel', -3.0, -2.5], ['crate', -3.0, 2.55], ['crate', 2.95, -2.5]].forEach(([k, x, z]) => {
      const c = call(P.buildClutter, k);
      c.position.set(x, 0, z); shadowAll(c); scene.add(c);
      W.colliders.push(box(x, z, 0.7, 0.7));
    });
  }

  W.room = ROOM;
  return W;
}

export function box(cx, cz, w, d) { return { x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 }; }

export function tagInteract(obj, data) {
  obj.userData.interact = data;
}

function shadowAll(g, cast = true) {
  g.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = true; } });
}
