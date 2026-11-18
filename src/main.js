// 铸剑大师 · FORGETAX 网页版 —— 主程序：渲染、交互、流程
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import * as D from './data.js';
import * as G from './game.js';
import SFX from './audio.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Sparks, Shards } from './fx.js';
import { drawCounter, drawPrice, drawLabel } from './boards.js';
import * as SW from './swords.js';
import * as RL from './relics3d.js';
import * as P from './props.js';
import { swordIcon } from './icons.js';

const SAVE_KEY = 'forgetax3d.save.v3';
const META_KEY = 'forgetax3d.meta.v3';
const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DEBUG = /debug|shot|auto/.test(location.hash);

/* ======================= 渲染器 ======================= */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: DEBUG });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x040302);
scene.fog = new THREE.Fog(0x050403, 5, 14);
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.03, 60);
scene.add(camera);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.45, 0.82);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tint: { value: new THREE.Color(1, 1, 1) }, tintAmt: { value: 0 }, vig: { value: 1.0 }, time: { value: 0 }, red: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec3 tint; uniform float tintAmt; uniform float vig; uniform float time; uniform float red;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(col, col * tint * 1.25 + tint * 0.05 * l, tintAmt);
      col = mix(col, vec3(l * 1.4, l * 0.15, l * 0.1) + vec3(0.12,0.0,0.0), red);
      vec2 d = vUv - 0.5; float v = smoothstep(0.85, 0.25, length(d * vec2(1.1, 1.0)));
      col *= mix(1.0, v, 0.55 * vig);
      col += (hash(vUv * 900.0 + time) - 0.5) * 0.025;
      gl_FragColor = vec4(col, c.a);
    }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

/* ======================= 世界 ======================= */
const W = buildWorld(scene);
const player = new Player(camera, canvas, W.room, W.colliders);
player.onStep = () => SFX.step();
const sparks = new Sparks(scene);
sparks.setScale(innerHeight);
const shards = new Shards(scene);
const raycaster = new THREE.Raycaster();
raycaster.far = 2.6;

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  sparks.setScale(innerHeight);
});

/* ======================= 状态 ======================= */
let st = null;
let titleSword = null;
let meta = loadMeta();
let phase = 'title';        // title | play | anvil | busy | modal
let target = null;          // 当前准星对准的交互物
let bellArmed = 0;
let selCons = 0;
const swordObjs = new Map(); // swordId -> { group, key }
let hammerAnim = null;
let shakeAmt = 0;
let flashA = 0, flashColor = '#fff';
let frenzyHue = 0;
let lastFrenzy = false;
const iconCache = new Map();

function loadMeta() {
  const def = { ach: {}, codex: {}, runs: 0, bestDay: 0, wins: 0, muted: false, tutorialDone: false };
  try { return Object.assign(def, JSON.parse(localStorage.getItem(META_KEY) || '{}')); }
  catch (e) { return def; }
}
function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { } }
function save() {
  if (!st) return;
  try {
    if (st.over === 'dead') localStorage.removeItem(SAVE_KEY);
    else {
      const copy = JSON.parse(JSON.stringify(st));
      // 手里/熔炉中的剑存档时放回剑架
      copy.swords.forEach(s => { if (s.loc === 'hand' || s.loc === 'furnace') { s.loc = 'rack'; s.slot = 50 + Math.floor(Math.random() * 100); } });
      localStorage.setItem(SAVE_KEY, JSON.stringify(copy));
    }
  } catch (e) { }
}
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && s.version === 3) return s; } catch (e) { }
  return null;
}

/* ======================= 图标 ======================= */
function iconOf(kind, id) {
  const key = kind + ':' + id;
  if (iconCache.has(key)) return iconCache.get(key);
  let url = '';
  try {
    const g = kind === 'cons' ? RL.buildConsumable(id) : RL.buildRelic(id);
    url = RL.renderIcon(renderer, g, 128);
  } catch (e) { console.warn(e); }
  iconCache.set(key, url);
  return url;
}

/* ======================= HUD ======================= */
function toast(msg, err) {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 2700);
  if (err) SFX.error();
}

let subT = null;
function subtitle(text, ms = 2600) {
  const el = $('#subtitle');
  el.textContent = text; el.classList.add('show');
  clearTimeout(subT); subT = setTimeout(() => el.classList.remove('show'), ms);
}

function banner(text, rainbow) {
  const b = $('#banner');
  b.textContent = text;
  b.className = rainbow ? 'rainbow' : '';
  void b.offsetWidth;
  b.classList.add('go');
  if (!rainbow) b.style.color = '#f1e6d2'; else b.style.color = '';
}

function floaterAt(world, text, color, size = 40) {
  const v = world.clone().project(camera);
  const el = document.createElement('div');
  el.className = 'floater';
  el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px';
  el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
  el.style.color = color; el.style.fontSize = size + 'px';
  el.textContent = text;
  $('#floaters').appendChild(el);
  setTimeout(() => el.remove(), 1700);
}

const procMap = new Map();
function showProc(id, text, kind = 'relic') {
  const box = $('#procs');
  let p = procMap.get(id);
  if (!p) {
    const el = document.createElement('div');
    el.className = 'proc';
    el.innerHTML = `<img src="${iconOf(kind, id)}"><span class="cnt"></span><span class="t"></span>`;
    box.appendChild(el);
    p = { el, n: 0, timer: null };
    procMap.set(id, p);
  }
  p.n++;
  p.el.classList.remove('fade');
  p.el.querySelector('.t').textContent = text;
  p.el.querySelector('.cnt').textContent = p.n > 1 ? '×' + p.n : '';
  p.el.style.animation = 'none'; void p.el.offsetWidth; p.el.style.animation = '';
  clearTimeout(p.timer);
  p.timer = setTimeout(() => { p.el.classList.add('fade'); setTimeout(() => { p.el.remove(); procMap.delete(id); }, 500); }, 2400);
}

function setControls(rows) {
  $('#controls').innerHTML = rows.map(([k, t]) => `<div class="row"><span>${t}</span>${keyHtml(k)}</div>`).join('');
}
function keyHtml(k) {
  if (k === 'LMB') return '<span class="key mouse l"></span>';
  if (k === 'RMB') return '<span class="key mouse r"></span>';
  return `<span class="key">${k}</span>`;
}

let goldShown = 0, goldTimer = null;
function updateGold() {
  if (!st) return;
  const el = $('#goldNum');
  if (st.gold !== goldShown) {
    const d = st.gold - goldShown;
    const gd = $('#goldDelta');
    gd.textContent = (d > 0 ? '+' : '') + fmt(d);
    gd.classList.add('show');
    clearTimeout(goldTimer); goldTimer = setTimeout(() => gd.classList.remove('show'), 1800);
    goldShown = st.gold;
  }
  el.textContent = fmt(st.gold);
}

function swordLabel(s) {
  return `剑 #${s.no} · ${esc(G.swordName(s))} +${s.level} · ${s.heated ? '<span class="hot">炽热</span>' : '冷却'} · ${fmt(G.value(st, s))} G`;
}

function updateHandLabel() {
  const s = st && G.handSword(st);
  const el = $('#handLabel');
  if (s && phase === 'play') { el.innerHTML = swordLabel(s); el.classList.remove('hidden'); }
  else el.classList.add('hidden');
}

function updateConsBar() {
  const el = $('#consBar');
  const ids = st ? Object.keys(st.consumables) : [];
  if (phase !== 'anvil' || !ids.length) { el.classList.add('hidden'); return; }
  if (selCons >= ids.length) selCons = 0;
  const cur = D.CONS_MAP[ids[selCons]];
  el.innerHTML = `<div class="c-desc"><b>消耗品</b>${esc(cur.name)} · ${esc(cur.desc.replace(/^按 Q 使用：/, ''))}</div>
    <div class="c-help">数字键选择 · Q 使用${st.consumables.rewind ? ' · R 撤销上一锤' : ''}</div>
    <div class="slots">${ids.map((id, i) => {
      const on = !!st.active[id];
      return `<div class="slot ${i === selCons ? 'sel' : ''} ${on ? 'on' : ''}"><span class="n">${i + 1}</span><img src="${iconOf('cons', id)}"><span class="x">×${st.consumables[id]}</span><span class="nm">${esc(D.CONS_MAP[id].name)}</span></div>`;
    }).join('')}</div>`;
  el.classList.remove('hidden');
}

function flash(color, a) { flashColor = color; flashA = Math.max(flashA, a); }

/* ======================= 剑的 3D 同步 ======================= */
const tmpV = new THREE.Vector3();
const HAND_BASIS = (() => {
  const x = new THREE.Vector3(-0.42, 1, -0.12).normalize();
  const y = new THREE.Vector3(0.25, 0.08, 1).normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  y.crossVectors(z, x).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z);
})();

function swordKey(s) { return D.formOf(s); }

function getSwordObj(s) {
  let o = swordObjs.get(s.id);
  const key = swordKey(s);
  if (!o || o.key !== key) {
    const g = SW.buildSword(key, { level: s.level });
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    g.userData.interact = { kind: 'sword', id: s.id };
    if (o) { o.group.parent && o.group.parent.remove(o.group); }
    o = { group: g, key, frenzy: false, heat: -1 };
    swordObjs.set(s.id, o);
  }
  return o;
}

function attach(group, parent) {
  if (group.parent !== parent) parent.add(group);
}

function anvilSwordPose(o) {
  const g = o.group, ud = g.userData;
  const L = ud.length || 0.6, bl = ud.bladeLength || L * 0.75, gl = ud.gripLength || L - bl;
  // 剑尖朝世界 -X（玩家视角右侧），剑身中点对准砧面中心
  const mid = (bl - gl) / 2;
  const top = (W.anvil.userData.topY || 0.95);
  const sc = Math.min(1, 1.3 / L, 0.62 / (ud.bodyWidth || ud.width || 0.3));
  g.scale.setScalar(sc);
  g.position.set(0.12 + mid * sc, top + 0.02 + (ud.thickness || 0.03) * sc / 2, 2.32);
  g.rotation.set(0, Math.PI, 0);
}

function syncSwords() {
  if (!st) return;
  const alive = new Set(st.swords.map(s => s.id));
  for (const [id, o] of swordObjs) {
    if (!alive.has(id) && !o.detached) { o.group.parent && o.group.parent.remove(o.group); swordObjs.delete(id); }
  }
  const rackSlots = W.rack.userData.slots || [];
  const altarSlots = W.altar.userData.slots || [];
  for (const s of st.swords) {
    const o = getSwordObj(s);
    if (o.detached) continue;
    const g = o.group;
    g.visible = true;
    if (s.loc === 'rack') {
      const slot = rackSlots[s.slot] || rackSlots[s.slot % Math.max(1, rackSlots.length)];
      if (slot) { attach(g, slot); g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); const L = g.userData.length || 0.6; g.scale.setScalar(Math.min(1, 1.05 / L, (s.slot < 7 ? 0.33 : 0.39) / (g.userData.bodyWidth || g.userData.width || 0.2))); }
      else { attach(g, scene); g.position.set(3.2, 1, 0.5 + s.slot * 0.1); }
      g.visible = s.slot < Math.max(12, rackSlots.length);
    } else if (s.loc === 'floor') {
      attach(g, scene);
      const k = s.slot || 0;
      const L = g.userData.length || 0.6;
      g.scale.setScalar(Math.min(1, 1.0 / L));
      g.position.set(2.45 - (k % 3) * 0.32, 0.03 + (g.userData.thickness || 0.03) / 2, -0.15 + Math.floor(k / 3) * 0.55 + (k % 2) * 0.1);
      g.rotation.set(0, Math.PI / 2 + ((s.no * 37) % 7 - 3) * 0.12, 0);
    } else if (s.loc === 'altar') {
      const slot = altarSlots[s.slot];
      if (slot) { attach(g, slot); g.position.set(0, 0.02, 0); g.rotation.set(0, 0, 0); const L = g.userData.length || 0.6; g.scale.setScalar(Math.min(1, 0.95 / L)); }
    } else if (s.loc === 'anvil') {
      attach(g, scene); anvilSwordPose(o);
    } else if (s.loc === 'furnace') {
      const hs = W.furnace.userData.heatSpot;
      if (hs) { attach(g, hs); g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); const L = g.userData.length || 0.6; g.scale.setScalar(Math.min(1, 0.9 / L)); }
    } else if (s.loc === 'hand') {
      attach(g, player.hand);
      const L = g.userData.length || 0.6;
      const sc = Math.min(1, 0.75 / L);
      g.scale.setScalar(sc);
      // 竖握：剑尖朝左上，剑面朝向镜头（参考预告片中手持剑的姿势）
      const gl = (g.userData.gripLength || 0.12) * sc;
      g.position.set(-0.02, -0.02 + gl * 0.6, 0);
      g.quaternion.setFromRotationMatrix(HAND_BASIS);
    }
    // 加热/入神外观
    const heat = s.heated ? (s.hammers === 0 ? 0.18 : Math.max(0, 0.12 - s.hammers * 0.04)) : 0;
    if (o.heat !== heat && !o.heating) { SW.setSwordHeat(g, heat); o.heat = heat; }
    const fr = G.isFrenzyFor(st, s);
    if (o.frenzy !== fr) { SW.setSwordFrenzy(g, fr); o.frenzy = fr; }
  }
}

/* ======================= 场景物件同步（面板、日历、售货机、商人、遗物架） ======================= */
function syncBoards() {
  if (!st) return;
  // 锻造面板
  const s = G.anvilSword(st);
  if (!s) W.panel.draw({ empty: true });
  else {
    const fr = G.isFrenzyFor(st, s);
    const lr = st.lastResult && st.lastResult.swordId === s.id ? st.lastResult : null;
    const tags = [];
    if (st.active.ward) tags.push('龙鳞护佑');
    if (st.active.chalk) tags.push('红粉笔');
    if (st.active.powder) tags.push('火药包');
    if (G.has(st, 'giants-spine') && s.spineReady) tags.push('脊骨保护就绪');
    if (st.undoSnap && st.consumables.rewind) tags.push('R 可撤销');
    if (!s.heated) tags.push('剑是冷的');
    const maxT = G.frenzyDuration(st);
    W.panel.draw({
      name: G.swordName(s), level: s.level, value: G.value(st, s),
      last: lr ? { outcome: lr.outcome, levelDelta: lr.levelDelta, delta: lr.delta, ratio: lr.ratio } : null,
      charge: s.charge, frenzy: fr ? { t: Math.max(0, st.frenzy.timeLeft), frac: st.frenzy.timeLeft / maxT } : null,
      probs: G.probs(st, s), tags,
    });
  }
  // 日历：今天画圈，商人来访日画天平
  const md = [];
  for (let k = 1; k <= 12; k++) md.push(k * 3);
  W.calendar.draw(st.day, md);
  // 贡品板
  W.tributeBoard.draw(G.quota(st), G.altarTotal(st));
  // 售货机
  const vs = W.vendScreens;
  drawCounter(vs.counter, st.vend.credits);
  vs.prices.forEach((sc, i) => { const it = st.vend.items[i]; if (!it) drawPrice(sc, 0, true); else if (it.gift && !it.sold) drawLabel(sc, '免费', { bg: '#0c0c0c', size: 0.5 }); else drawPrice(sc, it.price, it.sold); });
  drawLabel(vs.refresh, st.vend.gift ? '—' : (G.refreshCost(st) === 0 ? '免费' : fmt(G.refreshCost(st)) + ' G'), { size: 0.62 });
  syncVendItems();
  syncShelf();
  syncGhost();
}

let vendKey = '';
function syncVendItems() {
  const key = st.vend.items.map(it => it.id + it.sold).join('|');
  if (key === vendKey) return;
  vendKey = key;
  W.vendWindows.forEach((holder, i) => {
    holder.clear();
    const it = st.vend.items[i];
    if (!it || it.sold) return;
    const g = RL.buildRelic(it.id);
    g.scale.setScalar(1.25);
    holder.add(g);
    holder.userData.spin = g;
  });
}

let shelfKey = '';
function syncShelf() {
  const key = st.relics.join('|');
  if (key === shelfKey) return;
  shelfKey = key;
  const slots = W.shelf.userData.slots || [];
  slots.forEach((slot, i) => {
    slot.clear();
    const id = st.relics[i];
    if (!id) return;
    const g = RL.buildRelic(id);
    g.userData.interact = { kind: 'relic', id };
    g.traverse(m => { if (m.isMesh) m.castShadow = true; });
    slot.add(g);
  });
}

let ghostObj = null, ghostKey = '';
const ringGeo = new THREE.TorusGeometry(0.17, 0.006, 6, 40);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x7fe6e0, transparent: true, opacity: 0.85, toneMapped: false });
function syncGhost() {
  const present = !!st.ghost;
  const key = present ? st.ghost.offers.map(it => it.id + it.bought).join('|') : 'none';
  if (key === ghostKey) return;
  ghostKey = key;
  if (ghostObj) { W.ghostSpot.remove(ghostObj); ghostObj = null; }
  if (!present) return;
  ghostObj = P.buildGhost();
  // 隐藏自带的 4 个商品位，改为按商品数量排成弧形
  (ghostObj.userData.itemSlots || []).forEach(sl => { sl.visible = false; });
  W.ghostSpot.add(ghostObj);
  const offers = st.ghost.offers, n = offers.length;
  offers.forEach((it, i) => {
    const slot = new THREE.Group();
    const half = Math.ceil(n / 2), side = i < half ? -1 : 1, row = i < half ? i : i - half;
    const rows = side < 0 ? half : n - half;
    slot.position.set(side * (0.66 + 0.06 * (row % 2)), 1.5 - row * 0.42, 0.35);
    ghostObj.add(slot);
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = Math.PI / 2; ring.position.y = -0.02; slot.add(ring);
    slot.userData.ring = ring;
    if (it.bought >= it.stock) { ring.visible = false; return; }
    let g;
    if (it.kind === 'sword' || it.kind === 'special') {
      const form = it.kind === 'sword' ? 1 : D.FAMILIES[it.id].forms[it.level / 2];
      g = SW.buildSword(form, { level: it.level || 0 });
      const L = g.userData.length || 0.6; g.scale.setScalar(Math.min(1, 0.5 / L));
      g.rotation.set(Math.PI / 2, 0, Math.PI / 2); g.position.y = 0.2;
    } else g = RL.buildConsumable(it.id);
    slot.add(g);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.12;
    slot.add(hit);
    [slot, g, hit].forEach(o => { o.userData.interact = { kind: 'ghostItem', index: i }; });
    slot.userData.spin = g;
  });
}

/* ======================= 交互 ======================= */
const center = new THREE.Vector2(0, 0);
function findTarget() {
  raycaster.setFromCamera(center, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const h of hits) {
    let o = h.object;
    if (o.isPoints || o.isSprite) continue;
    let inHand = false; for (let q = o; q; q = q.parent) if (q === player.hand) { inHand = true; break; }
    if (inHand) continue;
    while (o) {
      if (o.userData && o.userData.interact) return { data: o.userData.interact, obj: o, point: h.point, dist: h.distance };
      o = o.parent;
    }
    // 第一个被击中的不可交互实体会挡住后面的东西
    if (h.object.material && h.object.material.visible !== false && !h.object.material.transparent) return null;
  }
  return null;
}

/** 根据当前目标给出提示与 E 的动作 */
function describe(t) {
  const hand = G.handSword(st);
  if (!t) return null;
  const d = t.data;
  switch (d.kind) {
    case 'anvil': {
      const a = G.anvilSword(st);
      if (hand && !a) return { title: '铁砧', sub: hand.heated ? '' : '<span class="warn">这把剑还是冷的，敲不动。先去熔炉加热。</span>', act: [['E', '放上铁砧']], fn: () => placeOnAnvil() };
      if (a && !hand) return { title: '铁砧 · ' + esc(G.swordName(a)) + ' +' + a.level, act: [['E', '开始锻造']], fn: () => enterAnvil() };
      if (a && hand) return { title: '铁砧上已经有剑了', sub: '先把手里的剑放到别处' };
      return { title: '铁砧', sub: '拿一把剑过来' };
    }
    case 'furnace': {
      if (hand) return hand.heated ? { title: '熔炉', sub: '这把剑已经烧热了，加热永久有效' } : { title: '熔炉', act: [['E', '加热']], fn: () => heatInFurnace() };
      return { title: '熔炉', sub: '把剑放进来烧热，才能锻造（每把剑只需一次）' };
    }
    case 'sword': {
      const s = G.swordById(st, d.id);
      if (!s) return null;
      if (s.loc === 'anvil') return describe({ data: { kind: 'anvil' } });
      if (hand) {
        if (s.loc === 'altar') return describe({ data: { kind: 'altar' } });
        if (s.loc === 'rack') return describe({ data: { kind: 'rack' } });
        return null;
      }
      const where = s.loc === 'altar' ? '（贡台）' : s.loc === 'floor' ? '（地上）' : '';
      const fam = s.family ? D.FAMILIES[s.family].name : (Math.max(s.peak, s.level) >= 10 ? D.FAMILIES[D.familyOf(s)].name : D.LANE_NAMES[s.lane] + '线');
      return { title: esc(G.swordName(s)) + ' +' + s.level + where, sub: `剑 #${s.no} · ${fam} · ${s.heated ? '炽热' : '冷却'} · ${fmt(G.value(st, s))} G${s.charge ? ' · 充能 ' + s.charge + '/10' : ''}`, act: [['E', '拿起']], fn: () => pickUp(s.id) };
    }
    case 'rack':
      if (hand) return { title: '剑架', act: [['E', '挂回剑架']], fn: () => { G.putOnRack(st); SFX.putdown(); if (hand.loc === 'floor') toast('剑架满了，放在了地上'); changed(); } };
      return { title: '剑架', sub: G.rackSwords(st).length ? '对准一把剑来拿起它' : '空空如也。明天早上会送来新剑。' };
    case 'altar':
      if (hand) return { title: '贡台', sub: `已献上 ${fmt(G.altarTotal(st))} / ${fmt(G.quota(st))} G`, act: [['E', '献上这把剑']], fn: () => { const r = G.putOnAltar(st); if (r.error) return toast(r.error, true); SFX.putdown(); tutorialEvent('offer'); changed(); } };
      return { title: '贡台', sub: `今日贡额 ${fmt(G.quota(st))} G · 已献上 ${fmt(G.altarTotal(st))} G` };
    case 'bell': {
      const tot = G.altarTotal(st), q = G.quota(st);
      const sub = (tot >= q ? '贡品足额。' : `<span class="warn">贡品不足！还差 ${fmt(q - tot)} G，巨龙会发怒（${st.rage}/${D.RAGE_MAX}）。</span>`) + '<br>敲铃结束今天。献上的剑无论是否足额都会化作金币返还。';
      if (bellArmed > performance.now()) return { title: '再按一次 E 敲响贡铃', sub, act: [['E', '确认敲铃']], fn: () => ringBell() };
      return { title: '贡铃', sub, act: [['E', '敲响贡铃']], fn: () => { bellArmed = performance.now() + 2500; } };
    }
    case 'calendar':
      return { title: '日历 · ' + D.dateStr(st.day) + '（第 ' + st.day + ' 天）', sub: `今日贡额 ${fmt(G.quota(st))} G · 明日 ${fmt(D.quotaFor(st.day + 1))} G · 怒气 ${st.rage}/${D.RAGE_MAX}<br>天平 = 幽灵商人来访日 · 5月5日契约结束` };
    case 'vendSlot':
      if (hand) return { title: '投剑口', sub: '每把剑只算 1 枚剑币，与价值无关', act: [['E', '投入这把剑']], fn: () => insertSword() };
      return { title: '投剑口', sub: `剑币 ${st.vend.credits}。售货机收的不是钱，而是剑。` };
    case 'vendWindow': {
      const it = st.vend.items[d.index];
      if (!it || it.sold) return { title: it && it.vanished ? '消失了' : '空展示窗' };
      const info = D.RELIC_MAP[it.id];
      const rar = `<span style="color:${D.RARITY[info.rarity].color}">${D.RARITY[info.rarity].name}</span>`;
      if (it.gift) return { title: `${esc(info.name)} · ${rar}`, sub: esc(info.desc) + '<br>第一天的赠品：选一件，另外两件会消失', act: [['E', '免费领取']], fn: () => buyVend(d.index) };
      const can = st.vend.credits >= it.price;
      return { title: `${esc(info.name)} · ${rar}`, sub: esc(info.desc) + (can ? '' : `<br><span class="warn">需要 ${it.price} 枚剑币（现有 ${st.vend.credits}）。把剑投进投剑口。</span>`), act: can ? [['E', `兑换（${it.price} 剑币）`]] : [], fn: can ? () => buyVend(d.index) : null };
    }
    case 'vendRefresh': {
      if (st.vend.gift) return { title: '刷新按钮', sub: '第一天的赠品不能刷新' };
      const c = G.refreshCost(st);
      return { title: '刷新货架', sub: c === 0 ? '旧代金券：今天免费刷新一次' : `花费 ${fmt(c)} 金币，换一批遗物（每次刷新更贵）`, act: [['E', '刷新']], fn: () => { const r = G.refreshVend(st, meta); if (r.error) return toast(r.error, true); SFX.vend(); W.vending.userData.pressRefresh && W.vending.userData.pressRefresh(); changed(); } };
    }
    case 'ghostItem': {
      const it = st.ghost && st.ghost.offers[d.index];
      if (!it || it.bought >= it.stock) return null;
      const price = G.ghostPrice(it);
      let desc = '';
      if (it.kind === 'sword') desc = '一把 +0 的基础剑。';
      else if (it.kind === 'special') desc = `${D.FAMILIES[it.id].name}剑线（基础价值翻倍，每 2 级换一种形态）· +${it.level}`;
      else desc = D.CONS_MAP[it.id].desc;
      return { title: `${esc(it.name)} · ${fmt(price)} 金币`, sub: `${esc(desc)}<br>库存 ${it.stock - it.bought}${it.bought ? '（再买一个价格 ×3）' : ''}`, act: [['E', '购买']], fn: () => buyGhost(d.index) };
    }
    case 'relic': {
      const r = D.RELIC_MAP[d.id];
      return { title: esc(r.name) + ' · ' + D.RARITY[r.rarity].name, sub: esc(r.desc), act: [['X', '丢弃']], fnX: () => { G.discardRelic(st, d.id); SFX.putdown(); toast('丢弃了 ' + r.name); changed(); } };
    }
  }
  return null;
}

let lastPromptKey = '';
function updatePrompt() {
  const el = $('#prompt');
  if (phase !== 'play') { el.classList.add('hidden'); $('#crosshair').classList.remove('active'); lastPromptKey = ''; return; }
  target = findTarget();
  const info = describe(target);
  $('#crosshair').classList.toggle('active', !!info);
  if (!info) { el.classList.add('hidden'); lastPromptKey = ''; return; }
  const key = info.title + '|' + (info.sub || '') + '|' + JSON.stringify(info.act || []);
  if (key !== lastPromptKey) {
    el.innerHTML = `<div class="p-title">${info.title}</div>${info.sub ? `<div class="p-sub">${info.sub}</div>` : ''}${info.act && info.act.length ? `<div class="p-act">${info.act.map(([k, t]) => keyHtml(k) + `<span>${t}</span>`).join('')}</div>` : ''}`;
    lastPromptKey = key;
  }
  el.classList.remove('hidden');
  target && (target.info = info);
}

function changed() {
  syncSwords();
  syncBoards();
  updateGold();
  updateHandLabel();
  updateConsBar();
  updateControls();
  lastPromptKey = '';
  save();
}

function updateControls() {
  if (phase === 'anvil') {
    setControls([['LMB', '敲击'], ['RMB', '放下剑并离开'], ['E', '拿着剑离开']].concat(Object.keys(st.consumables).length ? [['Q', '使用消耗品']] : []).concat(st.consumables.rewind ? [['R', '撤销上一锤']] : []));
  } else if (phase === 'play') {
    setControls([['WASD', '移动'], ['E', '交互'], ['Tab', '遗物'], ['C', '图鉴']]);
  } else setControls([]);
}

/* ---------- 具体动作 ---------- */
function pickUp(id) {
  const r = G.takeToHand(st, id);
  if (r.error) return toast(r.error, true);
  SFX.pickup();
  tutorialEvent('pick');
  changed();
}

function placeOnAnvil() {
  const r = G.putOnAnvil(st);
  if (r.error) return toast(r.error, true);
  SFX.putdown();
  if (r.legacy) toast('传承：这把剑继承了 +' + r.legacy);
  if (r.molar) toast('饥饿的臼齿：这把剑成功签 +4');
  tutorialEvent('anvil');
  changed();
  enterAnvil();
}

const ANVIL_CAM = { pos: new THREE.Vector3(0.0, 1.62, 1.28), look: new THREE.Vector3(0.02, 1.32, 2.95) };
function enterAnvil() {
  phase = 'busy';
  updatePrompt();
  player.goFixed(ANVIL_CAM.pos, ANVIL_CAM.look, 0.45, () => { phase = 'anvil'; changed(); });
  SFX.click();
}

function leaveAnvil(takeSword) {
  if (hammerAnim) return;
  const s = G.anvilSword(st);
  if (takeSword && s) {
    if (G.handSword(st)) return toast('手里已经拿着剑了', true);
    G.takeToHand(st, s.id);
    SFX.pickup();
  } else if (s && G.isFrenzyFor(st, s)) G.endFrenzy(st);
  phase = 'busy';
  changed();
  player.leaveFixed(new THREE.Vector3(0, 1.62, 1.35), Math.PI, -0.15, 0.4, () => { phase = 'play'; changed(); });
}

function heatInFurnace() {
  const s = G.handSword(st);
  if (!s) return;
  const r = G.putInFurnace(st);
  if (r.error) return toast(r.error, true);
  phase = 'busy';
  changed();
  const o = swordObjs.get(s.id);
  o.heating = true;
  SFX.heat(); setTimeout(() => SFX.sizzle(), 500);
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / 1300);
    SW.setSwordHeat(o.group, k);
    const hs = W.furnace.userData.heatSpot;
    if (hs) { hs.getWorldPosition(tmpV); if (Math.random() < 0.5) sparks.ember(tmpV, new THREE.Vector3(0.4, 0.1, 0.3), 0xff8a30, { size: 0.012 }); }
    if (k < 1) requestAnimationFrame(step);
    else {
      o.heating = false; o.heat = -1;
      G.heatSword(st, s.id);
      s.loc = 'hand';
      phase = 'play';
      toast('剑已烧红');
      tutorialEvent('heat');
      changed();
    }
  };
  requestAnimationFrame(step);
}

function insertSword() {
  const s = G.handSword(st);
  if (!s) return;
  const o = swordObjs.get(s.id);
  const slot = W.vending.userData.slot;
  phase = 'busy';
  o.detached = true;
  // 动画：从手中飞向投剑口
  const g = o.group;
  const from = new THREE.Vector3(); g.getWorldPosition(from);
  const qFrom = new THREE.Quaternion(); g.getWorldQuaternion(qFrom);
  const sc = g.scale.x;
  scene.attach(g);
  const to = new THREE.Vector3(); slot.getWorldPosition(to);
  const toQ = new THREE.Quaternion(); slot.getWorldQuaternion(toQ);
  const t0 = performance.now();
  SFX.insert();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / 650);
    const e = k * k * (3 - 2 * k);
    g.position.lerpVectors(from, to, e);
    g.quaternion.slerpQuaternions(qFrom, toQ, Math.min(1, e * 1.5));
    g.scale.setScalar(sc * (1 - 0.5 * e));
    if (k > 0.75) g.translateX(-(k - 0.75) * 1.2);
    if (k < 1) requestAnimationFrame(step);
    else {
      scene.remove(g); swordObjs.delete(s.id);
      const r = G.insertSword(st);
      SFX.coin();
      if (r.credits > 1) toast('收藏家的钩子：这把剑换了 ' + r.credits + ' 枚剑币');
      phase = 'play';
      changed();
    }
  };
  requestAnimationFrame(step);
}

function buyVend(idx) {
  const r = G.buyVend(st, idx, meta);
  if (r.error) return toast(r.error, true);
  G.onRelicGained(st, r.id);
  SFX.vend();
  const name = D.RELIC_MAP[r.id].name;
  showProc(r.id, name, 'relic');
  toast(`获得遗物：${name}（陈列在东墙的遗物架上）`);
  tutorialEvent('vend');
  changed();
}

function buyGhost(idx) {
  const r = G.buyGhost(st, idx);
  if (r.error) return toast(r.error, true);
  SFX.coin();
  const it = r.item;
  if (it.kind === 'sword' || it.kind === 'special') toast('购买了 ' + it.name + '（放在了剑架上）');
  else if (it.id === 'oblivion') toast('遗忘之香：巨龙的怒气平息了一些');
  else if (it.id === 'delivery') toast('幽灵送货单：明天多送 2 把剑');
  else toast('购买了 ' + it.name + '（在铁砧前按 Q 使用）');
  grantAch(r.ach);
  changed();
}

/* ---------- 锻造 ---------- */
// 求让锤面落在剑面（或砧面）上的 hammerRig 转角
function hammerStrikeAngle(onSword = true) {
  const rig = W.hammerRig, h = W.hammer;
  const face = h.userData.face ? h.userData.face.clone() : new THREE.Vector3(-0.21, 0.8, 0);
  const s = st && G.anvilSword(st);
  const o = s && swordObjs.get(s.id);
  const top = (W.anvil.userData.topY || 0.95) + (onSword && o ? 0.02 + (o.group.userData.thickness || 0.03) * 0.9 : 0.005);
  const keep = rig.rotation.z;
  let best = 0, err = 1e9;
  for (let a = -0.5; a <= 0.6; a += 0.004) {
    rig.rotation.z = a; rig.updateMatrixWorld(true);
    const p = face.clone(); h.localToWorld(p);
    const e = Math.abs(p.y - top);
    if (e < err) { err = e; best = a; }
  }
  rig.rotation.z = keep;
  return best;
}
const HAMMER_RAISE = 0.17;
let hammerRestA = null;
function hammerRest() {
  if (phase === 'anvil' || (phase === 'busy' && player.mode !== 'walk')) {
    if (hammerRestA === null) hammerRestA = hammerStrikeAngle(true) + HAMMER_RAISE;
    return hammerRestA + Math.sin(performance.now() / 700) * 0.01;
  }
  hammerRestA = null;
  return hammerStrikeAngle(false);
}

function doHammer() {
  if (phase !== 'anvil' || hammerAnim) return;
  const s = G.anvilSword(st);
  if (!s) return;
  if (!s.heated) { toast('剑是冷的。先去熔炉把它烧红', true); return; }
  const fr = G.isFrenzyFor(st, s) || s.charge >= D.FRENZY_CHARGE;
  const strike = hammerStrikeAngle(true);
  hammerAnim = { t: 0, phase: 'down', strike, down: fr ? 0.09 : 0.12, up: fr ? 0.18 : 0.28, from: W.hammerRig.rotation.z };
}

function resolveHit() {
  const s = G.anvilSword(st);
  const o = s && swordObjs.get(s.id);
  const formBefore = s ? D.formOf(s) : null;
  const res = G.hammer(st);
  if (res.error) return toast(res.error, true);
  hammerRestA = null;
  tutorialEvent('strike');
  if (res.frenzyStarted) tutorialEvent('frenzy');
  SFX.hit(res.outcome);
  const oc = D.OUTCOMES[res.outcome];
  // 撞击点
  const face = W.hammer.userData.face ? W.hammer.userData.face.clone() : new THREE.Vector3(-0.21, 0.8, 0);
  W.hammer.localToWorld(face);
  const impact = face.clone(); impact.y = (W.anvil.userData.topY || 0.95) + 0.04;
  const power = res.outcome === 'great' ? 1.4 : res.outcome === 'break' ? 1.3 : 1;
  sparks.burst(impact, res.outcome === 'great' ? 140 : res.outcome === 'break' ? 90 : 55, res.outcome === 'great' ? 0xe9b0ff : res.outcome === 'damage' ? 0xff9a40 : 0xffc070, { power, rainbow: res.frenzy, floor: (W.anvil.userData.topY || 0.95) + 0.01 });
  shakeAmt = Math.max(shakeAmt, { break: 0.05, damage: 0.025, hold: 0.012, success: 0.018, great: 0.035 }[res.outcome]);
  flash(res.outcome === 'break' ? '#ff4030' : res.outcome === 'great' ? '#e2b0ff' : '#ffd9a0', { break: 0.5, great: 0.35, success: 0.12, damage: 0.15, hold: 0.06 }[res.outcome]);

  // 结果浮字（面板下方，如「大成功 · 2.5倍」）
  const panelBottom = new THREE.Vector3(-0.22, 1.72 - 0.4, 2.9);
  if (res.broke) floaterAt(panelBottom, '破坏', oc.color, 46);
  else {
    const r = res.ratio;
    const rs = r >= 10 ? r.toFixed(0) : r.toFixed(2).replace(/\.?0+$/, '');
    floaterAt(panelBottom, `${oc.name} · ${rs}倍`, oc.color, 40);
  }
  res.events.forEach((ev, i) => setTimeout(() => {
    if (ev.cons) showProc(ev.cons, ev.text, 'cons');
    else showProc(ev.id, ev.text);
  }, 120 + i * 140));

  if (res.frenzyStarted) { SFX.frenzy(); banner('入 神', true); }
  if (res.chargeFull) { SFX.charge(); subtitle('充能已满 —— 下一锤进入入神', 1800); }

  if (res.broke && o) {
    const g = o.group;
    g.updateMatrixWorld(true);
    let pieces = [];
    try { pieces = SW.breakSword(g) || []; } catch (e) { console.warn(e); }
    shards.spawn(pieces, g.matrixWorld, impact);
    scene.remove(g); swordObjs.delete(res.swordId);
    grade.uniforms.red.value = 0.65;
    setTimeout(() => toast(`剑碎了……${fmt(res.before)} G 化为乌有`, true), 400);
    setTimeout(() => { if (phase === 'anvil' && !G.anvilSword(st)) leaveAnvil(false); }, 1300);
  }
  grantAch(res.ach);
  if (!res.broke && res.form !== formBefore) {
    // 进化！
    setTimeout(() => {
      SFX.unlock(); flash('#fff4d0', 0.45);
      banner('进化', false);
      subtitle('「' + D.FORM_NAMES[formBefore] + '」进化成了「' + D.FORM_NAMES[res.form] + '」', 3000);
      const ob = s && swordObjs.get(s.id);
      if (ob) { ob.group.getWorldPosition(tmpV); sparks.burst(tmpV, 120, 0xfff0c0, { power: 1.2, floor: 0.97 }); }
    }, 250);
  }
  changed();
  recordCodex();
}

function updateHammer(dt) {
  const rig = W.hammerRig;
  if (!hammerAnim) { rig.rotation.z += (hammerRest() - rig.rotation.z) * Math.min(1, dt * 9); return; }
  const a = hammerAnim;
  a.t += dt;
  if (a.phase === 'down') {
    const k = Math.min(1, a.t / a.down);
    rig.rotation.z = a.from + (a.strike - a.from) * k * k * k;
    if (k >= 1) { a.phase = 'up'; a.t = 0; resolveHit(); }
  } else {
    const k = Math.min(1, a.t / a.up);
    const e = 1 - Math.pow(1 - k, 3);
    const rest = hammerRestA !== null ? hammerRestA : a.strike + HAMMER_RAISE;
    rig.rotation.z = a.strike + (rest - a.strike) * e;
    if (k >= 1) hammerAnim = null;
    else if (k > 0.55 && queuedHit) { hammerAnim = null; queuedHit = false; doHammer(); }
  }
}
let queuedHit = false;

function useCons() {
  const ids = Object.keys(st.consumables);
  const id = ids[selCons];
  if (!id) return;
  const r = G.useConsumable(st, id);
  if (r.error) return toast(r.error, true);
  SFX.coin();
  showProc(id, D.CONS_MAP[id].name + (id === 'starshard' ? ' 充能 +3' : ' 生效'), 'cons');
  changed();
}

/* ---------- 成就 / 图鉴 ---------- */
const pendingAch = [];
function grantAch(ids) {
  (ids || []).forEach(id => {
    if (!D.ACH_MAP[id] || meta.ach[id]) return;
    meta.ach[id] = Date.now(); saveMeta();
    pendingAch.push(id);
  });
  if (pendingAch.length) setTimeout(showAch, 1400);
}
function showAch() {
  if (!pendingAch.length || !$('#modal').classList.contains('hidden')) return;
  if (st && st.frenzy.active) { setTimeout(showAch, 800); return; }
  const id = pendingAch.shift();
  const a = D.ACH_MAP[id];
  SFX.unlock();
  if (a.relic) {
    const r = D.RELIC_MAP[a.relic];
    openModal(`<img src="${iconOf('relic', r.id)}"><div class="ul">成就达成 · ${esc(a.name)}</div><div class="un">${esc(r.name)}</div><div class="sub">${esc(r.desc)}<br>${esc(a.desc)} · 今后会出现在遗物售货机里</div><div class="m-foot"><button class="btn primary" data-close>好</button></div>`, null, 'unlock');
  } else {
    achToast(a);
    setTimeout(showAch, 600);
  }
}
function achToast(a) {
  const el = document.createElement('div');
  el.className = 'achtoast';
  el.innerHTML = `<b>成就达成</b><span>${esc(a.name)}</span><small>${esc(a.desc)}</small>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}
function recordCodex() {
  if (!st || !st.codexNew || !st.codexNew.length) return;
  let fresh = [];
  st.codexNew.forEach(f => { if (!meta.codex[f]) { meta.codex[f] = Date.now(); fresh.push(f); } });
  st.codexNew = [];
  if (fresh.length) { saveMeta(); fresh.forEach(f => { if (f !== 1) codexToast(f); }); }
}
function codexToast(f) {
  const el = document.createElement('div');
  el.className = 'codextoast';
  el.innerHTML = `<img src="${swordIcon(renderer, f, 96)}"><div><b>图鉴新增</b><span>${esc(D.FORM_NAMES[f])}</span><small>按 C 查看图鉴</small></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function showCodex(tab = 'forms') {
  const total = Object.keys(D.FORM_NAMES).length;
  const got = Object.keys(meta.codex).filter(k => D.FORM_NAMES[k]).length;
  const achGot = D.ACHIEVEMENTS.filter(a => meta.ach[a.id]).length;
  let body = '';
  if (tab === 'forms') {
    body = `<div class="codex-tree">
      <div class="ct-note">+0～+5 所有剑形态相同；+6 起按送货时的「投放线」分成三条；+10 起由投放线和一个看不见的分支决定六个家族之一，之后每 2 级换一次形态。幽灵商人出售的三条特殊剑线每 2 级换一次形态。形态只跟随剑达到过的最高等级，损伤不会让它变回去。</div>
      ${D.CODEX_GROUPS.map(gp => `<div class="cg"><div class="cg-h">${esc(gp.name)}</div><div class="cg-row">${gp.forms.map(f => {
        const seen = !!meta.codex[f];
        const lvl = codexLevel(f);
        return `<div class="cf ${seen ? '' : 'locked'}" title="${seen ? esc(D.FORM_NAMES[f]) : '？？？'}"><img src="${swordIcon(renderer, f, 120, !seen)}"><span>${seen ? esc(D.FORM_NAMES[f]) : '？？？'}</span><small>${lvl}</small></div>`;
      }).join('')}</div></div>`).join('')}
    </div>`;
  } else {
    body = `<div class="ach-list">${D.ACHIEVEMENTS.map(a => {
      const ok = !!meta.ach[a.id];
      const r = a.relic ? D.RELIC_MAP[a.relic] : null;
      return `<div class="ach ${ok ? 'ok' : ''}">${r ? `<img src="${iconOf('relic', r.id)}">` : '<div class="ach-ico">★</div>'}<div><b>${esc(a.name)}</b><span>${esc(a.desc)}</span>${r ? `<small>解锁遗物：${esc(r.name)}</small>` : ''}</div></div>`;
    }).join('')}</div>`;
  }
  openModal(`<h2>${tab === 'forms' ? '剑之图鉴' : '成就'}</h2><div class="sub">形态 ${got}/${total} · 成就 ${achGot}/${D.ACHIEVEMENTS.length}</div>
    <div class="tabs"><button class="btn ${tab === 'forms' ? 'primary' : ''}" data-tab="forms">剑之图鉴</button><button class="btn ${tab === 'ach' ? 'primary' : ''}" data-tab="ach">成就</button></div>
    ${body}<div class="m-foot"><button class="btn" data-close>关闭（C）</button></div>`, box => {
    box.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => showCodex(b.dataset.tab));
  }, 'codex');
}
function codexLevel(f) {
  for (const k in D.FAMILIES) { const i = D.FAMILIES[k].forms.indexOf(f); if (i >= 0) return D.FAMILIES[k].special ? '+' + i * 2 : '+' + (10 + i * 2); }
  const base = { 1: '+0', 38: '+2', 39: '+4', 2: '+6', 4: '+6', 6: '+6', 3: '+8', 5: '+8', 7: '+8' };
  return base[f] || '';
}

/* ---------- 新手引导（第一天，巨龙的指示） ---------- */
let tut = null; // { i, done }
const tutMarker = new THREE.Group();
{
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false }));
  m.rotation.x = Math.PI;
  tutMarker.add(m);
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false, transparent: true, opacity: 0.8 }));
  r.rotation.x = Math.PI / 2; r.position.y = -0.14;
  tutMarker.add(r);
  tutMarker.visible = false;
  scene.add(tutMarker);
}
function startTutorial() {
  tut = { i: 0 };
  showTutStep();
}
function tutStep() { return tut ? D.TUTORIAL[tut.i] : null; }
function showTutStep() {
  const s = tutStep();
  const box = $('#tutorial');
  if (!s) { box.classList.add('hidden'); tutMarker.visible = false; return; }
  box.innerHTML = `<div class="tu-who">巨龙</div><div class="tu-say">“${esc(s.say)}”</div><div class="tu-hint">▸ ${esc(s.hint)}</div><div class="tu-skip">${tut.i + 1}/${D.TUTORIAL.length} · P 跳过引导</div>`;
  box.classList.remove('hidden');
  box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
  SFX.roar && tut.i === 0 && setTimeout(() => SFX.click(), 10);
}
function tutorialEvent(ev) {
  if (!tut) return;
  const s = tutStep();
  if (!s) return;
  const advance = () => { tut.i++; if (tut.i >= D.TUTORIAL.length) endTutorial(); else showTutStep(); };
  const k = s.key;
  if ((k === 'pick' && ev === 'pick') || (k === 'heat' && ev === 'heat') || (k === 'anvil' && ev === 'anvil') ||
      (k === 'strike' && ev === 'strike') || (k === 'frenzy' && ev === 'frenzy') || (k === 'offer' && ev === 'offer') ||
      (k === 'bell' && ev === 'bell') || (k === 'vend' && ev === 'vend') || (k === 'spare' && ev === 'spare')) advance();
  // 允许跳步：玩家提前完成后面的事
  else if (ev === 'heat' && k === 'pick') { tut.i = 2; showTutStep(); }
  else if (ev === 'offer' && ['strike', 'frenzy', 'anvil'].includes(k)) { tut.i = D.TUTORIAL.findIndex(x => x.key === 'bell'); showTutStep(); }
  else if (ev === 'vend' && k !== 'vend') { /* 先拿了赠品 */ tut.vendDone = true; }
}
function endTutorial() {
  tut = null; meta.tutorialDone = true; saveMeta();
  $('#tutorial').classList.add('hidden'); tutMarker.visible = false;
}
const tutTargets = {
  rack: () => new THREE.Vector3(3.3, 1.75, 0.95), furnace: () => new THREE.Vector3(-3.0, 1.75, 1.45), anvil: () => new THREE.Vector3(0, 1.35, 2.35),
  altar: () => new THREE.Vector3(-1.2, 1.35, -2.4), bell: () => new THREE.Vector3(-1.95, 1.2, -2.28), vend: () => new THREE.Vector3(1.7, 2.0, -2.5),
};
function updateTutMarker(t) {
  const s = tutStep();
  if (!s || phase !== 'play') { tutMarker.visible = false; return; }
  let tgt = s.target;
  // 根据实际状态调整指向
  if (s.key === 'offer' && !G.handSword(st)) tgt = G.anvilSword(st) ? 'anvil' : 'rack';
  if (s.key === 'heat' && !G.handSword(st)) tgt = 'rack';
  if (s.key === 'anvil' && !G.handSword(st)) tgt = 'rack';
  const p = tutTargets[tgt] && tutTargets[tgt]();
  if (!p) { tutMarker.visible = false; return; }
  tutMarker.visible = true;
  tutMarker.position.copy(p); tutMarker.position.y += Math.sin(t * 3) * 0.05;
  tutMarker.rotation.y = t * 1.5;
}

/* ---------- 进贡 ---------- */
const CAGE_CAM = { pos: new THREE.Vector3(-1.2, 1.55, -1.05), look: new THREE.Vector3(-1.2, 1.25, -3.0) };
function ringBell() {
  bellArmed = 0;
  phase = 'busy';
  if (W.bell.userData.ring) W.bell.userData.ring();
  SFX.servicebell();
  updatePrompt();
  const hand = G.handSword(st);
  if (hand) G.putOnRack(st);
  tutorialEvent('bell');
  changed();
  player.goFixed(CAGE_CAM.pos, CAGE_CAM.look, 0.7, async () => {
    const eye = W.cage.userData;
    eye.setEyeState && eye.setEyeState('watch');
    const q = G.quota(st), tot = G.altarTotal(st);
    subtitle(tot >= q ? '让我看看……' : '就这些？', 2000);
    await wait(1600);
    const offered = G.altarSwords(st).map(s => swordObjs.get(s.id)).filter(Boolean);
    offered.forEach(o => { o.detached = true; scene.attach(o.group); });
    const t0 = performance.now();
    await new Promise(res => {
      const step = () => {
        const k = (performance.now() - t0) / 900;
        offered.forEach((o, i) => { o.group.position.z -= 0.035 + k * 0.02; o.group.position.y += Math.sin(k * 3 + i) * 0.002; });
        if (k < 1) requestAnimationFrame(step); else { offered.forEach(o => scene.remove(o.group)); res(); }
      };
      requestAnimationFrame(step);
    });
    const res = G.ringBell(st);
    offered.forEach(o => { for (const [id, x] of swordObjs) if (x === o) swordObjs.delete(id); });
    grantAch(res.ach);
    meta.bestDay = Math.max(meta.bestDay || 0, res.day); saveMeta();
    if (res.ok) {
      eye.setEyeState && eye.setEyeState('happy');
      SFX.coin();
      subtitle(`巨龙收下了贡品。${fmt(res.gold)} G 化作金币回到了你手里。` + (res.creditGain ? '（税务计数板 +1 剑币）' : ''), 3200);
    } else {
      eye.setEyeState && eye.setEyeState('angry');
      SFX.roar(); shakeAmt = 0.06; flash('#ff3020', 0.35);
      if (res.pardoned) subtitle('……巨龙的赦免碎了。它这次放过了你。', 3600);
      else subtitle(res.over === 'dead' ? '巨龙已经没有耐心了。' : `贡品不足。铁栏后的庞然大物失去了一些耐心……（怒气 ${res.rage}/${res.rageMax}）`, 3600);
    }
    changed();
    await wait(2800);
    if (res.over === 'dead') return death();
    if (res.over === 'win') return victory();
    nextDay(res.ok);
  });
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function nextDay(ok) {
  $('#fade').classList.add('on');
  await wait(700);
  const r = G.startNextDay(st, meta);
  W.cage.userData.setEyeState && W.cage.userData.setEyeState('hidden');
  player.mode = 'walk'; player.trans = null;
  player.setPose(new THREE.Vector3(0, 1.62, 1.2), Math.PI, -0.1);
  changed();
  await wait(300);
  $('#fade').classList.remove('on');
  phase = 'play';
  changed();
  banner(D.dateStr(st.day));
  if (W.hatch && W.hatch.userData.setOpen) { W.hatch.userData.setOpen(true); SFX.putdown(); setTimeout(() => W.hatch.userData.setOpen(false), 3500); }
  if (ok === false) { shakeAmt = 0.03; setTimeout(() => toast(`巨龙把今天的 ${r.newSwords} 把剑扔进了屋里（在剑架前的地上）`), 900); }
  else setTimeout(() => toast(`送来了 ${r.newSwords} 把新剑 · 今日贡额 ${fmt(G.quota(st))} G`), 900);
  if (st.ghost) setTimeout(() => subtitle('有个幽灵飘进了工坊……它在熔炉旁边摆起了摊。'), 2000);
  if (st.day === 2 && tut) endTutorial();
}

function statsHtml() {
  const s = st.stats;
  return `<div class="stats"><div><b>${D.dateStr(st.day)}</b>撑到</div><div><b>${fmt(s.hammers)}</b>挥锤</div><div><b>${fmt(s.breaks)}</b>敲碎的剑</div>
    <div><b>+${s.maxLevel}</b>最高强化</div><div><b>${fmt(s.maxValue)}</b>最高剑值</div><div><b>${fmt(s.tributeTotal)}</b>累计进贡</div></div>`;
}

async function death() {
  phase = 'modal';
  grade.uniforms.red.value = 1;
  SFX.roar();
  await wait(900);
  $('#fade').classList.add('on');
  await wait(800);
  localStorage.removeItem(SAVE_KEY);
  player.exitLock();
  openModal(`<h2 style="color:#ff6a55">你被巨龙吃掉了</h2><div class="sub">“我的耐心在第三次失败时耗尽。”</div>${statsHtml()}
    <div class="m-foot"><button class="btn primary" id="mNew">新的契约</button><button class="btn" id="mTitle">返回标题</button></div>`, box => {
    box.querySelector('#mNew').onclick = () => { closeModal(); newRun(); };
    box.querySelector('#mTitle').onclick = () => { closeModal(); showTitle(); };
  }, '', false);
  $('#fade').classList.remove('on');
  grade.uniforms.red.value = 0;
}

function victory() {
  phase = 'modal';
  meta.wins = (meta.wins || 0) + 1; saveMeta();
  SFX.unlock();
  player.exitLock();
  openModal(`<h2>下班打卡</h2><div class="sub">你撑到了 5 月 5 日，契约完成。<br>你可以就此收工，也可以继续锻造——贡额之后每天上涨 20%。</div>${statsHtml()}
    <div class="m-foot"><button class="btn primary" id="mEnd">继续锻造（延长日）</button><button class="btn" id="mNew">新的契约</button></div>`, box => {
    box.querySelector('#mEnd').onclick = () => { closeModal(); st.over = null; st.endless = true; nextDay(true); };
    box.querySelector('#mNew').onclick = () => { closeModal(); newRun(); };
  }, '', false);
}

/* ======================= 模态 ======================= */
function openModal(html, bind, cls = '', dismissable = true) {
  const m = $('#modal'), box = m.querySelector('.m-box');
  box.className = 'm-box ' + cls;
  box.innerHTML = html;
  m.classList.remove('hidden');
  player.exitLock();
  box.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
  m.onclick = e => { if (dismissable && e.target === m) closeModal(); };
  m.dataset.dismissable = dismissable ? '1' : '';
  if (bind) bind(box);
}
function closeModal() {
  $('#modal').classList.add('hidden');
  if (phase === 'play' || phase === 'anvil') showResume();
  setTimeout(showAch, 200);
}
function showResume() { if (!player.locked && (phase === 'play' || phase === 'anvil')) $('#resume').classList.remove('hidden'); }

function showHelp() {
  openModal(`<h2>玩法说明</h2><div class="help">
    <p>你是被巨龙囚禁的铁匠。4 月 15 日到 5 月 5 日，每天傍晚都要把剑献给铁栏后的巨龙。贡额每天上涨，第三次交不够它就会吃掉你。</p>
    <h3>一天的流程</h3>
    <p>① 每天早上送来 3 把剑（剑架）→ ② 拿去熔炉加热（每把剑只需一次）→ ③ 放上铁砧锻造 → ④ 把够数的剑放上贡台 → ⑤ 敲铃结束一天。<br>没献上的剑会留到明天。献上的剑无论是否足额，价值都会化作金币返还。</p>
    <h3>操作</h3>
    <p><span class="key">W A S D</span> 移动 · 鼠标环顾 · <span class="key">E</span> 交互 · <span class="key">X</span> 丢弃对准的遗物 · <span class="key">Tab</span> 遗物 · <span class="key">C</span> 图鉴/成就 · <span class="key">Esc</span> 暂停<br>
    铁砧前：<b>左键</b> 敲击 · <b>右键</b> 把剑留在铁砧上离开 · <span class="key">E</span> 拿着剑离开 · <span class="key">1-9</span> 选消耗品 · <span class="key">Q</span> 使用 · <span class="key">R</span> 悔恨发条撤销</p>
    <h3>每一锤：从 1000 张签里抽一张</h3>
    <table><tr><th style="color:var(--break)">破坏</th><td>剑被毁。+0 不会碎；+5 时 29.7%，+10 时 46.7%，最高 72%。</td></tr>
    <tr><th style="color:var(--damage)">损伤</th><td>-1 级（最低 +0），外形不会变回去。</td></tr>
    <tr><th style="color:var(--hold)">维持</th><td>什么都不变，但很多遗物会在此触发。</td></tr>
    <tr><th style="color:var(--success)">成功</th><td>+1 级，剑值 ×1.5。</td></tr>
    <tr><th style="color:var(--great)">大成功</th><td>+2 级，剑值 ×2.5（比两次成功的 ×2.25 更多，且永久保留）。</td></tr></table>
    <h3>入神</h3><p>同一把剑每锤 +1 充能，满 10 格后下一锤进入入神：4 秒内没有破碎签，尽情连击。</p>
    <h3>剑的进化</h3><p>+2、+4 换形；+6 起按送货时的投放线分为厚铁、怒铁、魔力三条；+10 起由投放线与一个隐藏分支决定六大家族（城塞剑/圣剑/锯刃/龙牙/符文剑/分裂剑），此后每 2 级进化一次，直到 +20 的终极形态。幽灵商人还卖世界树、鱼刃、葬仪剑三条特殊剑线。把一个家族锻到 +20 会解锁它的传说遗物。</p>
    <h3>遗物与商人</h3><p>遗物售货机收的不是钱而是剑：任何剑都只算 1 枚剑币。第一天的三件遗物免费任选其一。每天会刷新三件，可以花金币重刷。遗物架只有 8 格。<br>幽灵商人在第 3、6、9……天来访，用金币出售基础剑、特殊剑线和消耗品，同一件商品每多买一个价格 ×3。</p>
  </div><div class="m-foot"><button class="btn primary" data-close>明白了</button></div>`);
}

function toggleRelicList(show) {
  const el = $('#relicList');
  if (!show) { el.classList.add('hidden'); return; }
  el.innerHTML = `<h2>遗物 ${st.relics.length}/${D.RELIC_SLOTS}</h2><div class="grid">${st.relics.map(id => { const r = D.RELIC_MAP[id]; return `<div class="r"><img src="${iconOf('relic', id)}"><div><b style="color:${D.RARITY[r.rarity].color}">${esc(r.name)}</b><span>${esc(r.desc)}</span></div></div>`; }).join('') || '<div style="grid-column:span 4;text-align:center;opacity:.6">还没有遗物。用剑去售货机换吧。</div>'}</div>
    <div class="info">${D.dateStr(st.day)}（第 ${st.day} 天）· 今日贡额 ${fmt(G.quota(st))} G · 怒气 ${st.rage}/${D.RAGE_MAX} · 剑币 ${st.vend.credits} · 消耗品 ${Object.entries(st.consumables).map(([k, v]) => D.CONS_MAP[k].name + '×' + v).join('、') || '无'}</div>`;
  el.classList.remove('hidden');
}

/* ======================= 开局 / 标题 ======================= */
function startPlay() {
  if (titleSword) titleSword.visible = false;
  $('#title').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  phase = 'play';
  player.mode = 'walk'; player.trans = null;
  player.setPose(new THREE.Vector3(0, 1.62, 1.2), Math.PI, -0.1);
  goldShown = st.gold;
  changed();
  showResume();
}

function resetScene() {
  swordObjs.forEach(o => o.group.parent && o.group.parent.remove(o.group)); swordObjs.clear();
  vendKey = shelfKey = ghostKey = '';
}

function newRun() {
  st = G.newRun(meta);
  meta.runs = (meta.runs || 0) + 1; saveMeta();
  resetScene();
  startPlay();
  banner(D.dateStr(st.day));
  if (!meta.tutorialDone || meta.runs <= 1) startTutorial();
  else { tut = null; $('#tutorial').classList.add('hidden'); setTimeout(() => subtitle('第一天的遗物售货机里有三件免费遗物，挑一件吧。', 4000), 1500); }
}

function continueRun() {
  st = loadSave();
  if (!st) return newRun();
  G.endFrenzy(st);
  resetScene();
  tut = null; $('#tutorial').classList.add('hidden');
  startPlay();
}

function showTitle() {
  phase = 'title';
  $('#title').classList.remove('hidden');
  $('#hud').classList.add('hidden');
  $('#resume').classList.add('hidden');
  $('#tutorial').classList.add('hidden');
  player.exitLock();
  const s = loadSave();
  $('#btnContinue').classList.toggle('hidden', !s);
  if (s) $('#btnContinue').textContent = '继续契约（' + D.dateStr(s.day) + '）';
  const forms = Object.keys(meta.codex).length, ach = Object.keys(meta.ach).length;
  $('#titleStats').textContent = meta.runs ? `契约 ${meta.runs} 次 · 最远 ${D.dateStr(Math.max(1, meta.bestDay || 1))} · 完成 ${meta.wins || 0} 次 · 图鉴 ${forms}/${Object.keys(D.FORM_NAMES).length} · 成就 ${ach}/${D.ACHIEVEMENTS.length}` : '';
  if (!titleSword) {
    titleSword = SW.buildSword(30, { level: 16 });
    scene.add(titleSword);
    anvilSwordPose({ group: titleSword });
    SW.setSwordHeat(titleSword, 0.3);
    W.panel.draw({ name: D.FORM_NAMES[30], level: 16, value: 509056, last: { outcome: 'great', levelDelta: 2, delta: 305434, ratio: 2.5 }, charge: 7, frenzy: null, probs: G.probs({ relics: [], active: {}, permTickets: {}, grudge: 0, mournings: 0, frenzy: {} }, Object.assign(G.newSword({}), { level: 16 }), false), tags: [] });
  }
  titleSword.visible = true;
  W.calendar.draw(1, [3, 6, 9, 12, 15, 18, 21]);
  W.tributeBoard.draw(1800, 0);
  player.goFixed(new THREE.Vector3(0.75, 1.55, 1.25), new THREE.Vector3(-0.15, 1.2, 2.9), 0.01);
}

/* ======================= 输入 ======================= */
canvas.addEventListener('mousedown', e => {
  SFX.resume();
  if (phase === 'anvil') {
    if (e.button === 0) { if (hammerAnim && hammerAnim.phase === 'up') queuedHit = true; else doHammer(); }
    else if (e.button === 2) leaveAnvil(false);
  }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
$('#resume').addEventListener('click', () => { $('#resume').classList.add('hidden'); player.requestLock(); SFX.resume(); });
player.onLockChange = locked => {
  if (!locked && (phase === 'play' || phase === 'anvil') && $('#modal').classList.contains('hidden')) showResume();
  if (locked) $('#resume').classList.add('hidden');
};

document.addEventListener('keydown', e => {
  SFX.resume();
  if (e.code === 'Tab') { e.preventDefault(); if (st && (phase === 'play' || phase === 'anvil')) toggleRelicList(true); return; }
  if (e.code === 'KeyC' && (phase === 'play' || phase === 'anvil' || phase === 'title')) {
    if (!$('#modal').classList.contains('hidden') && $('#modal .m-box').classList.contains('codex')) closeModal();
    else if ($('#modal').classList.contains('hidden')) showCodex();
    return;
  }
  if (!st || !$('#modal').classList.contains('hidden')) return;
  if (e.code === 'KeyP' && tut) { endTutorial(); toast('已跳过新手引导'); return; }
  if (phase === 'play') {
    if (e.code === 'KeyE' && target && target.info && target.info.fn) target.info.fn();
    else if (e.code === 'KeyX' && target && target.info && target.info.fnX) target.info.fnX();
  } else if (phase === 'anvil') {
    if (e.code === 'KeyE') leaveAnvil(true);
    else if (e.code === 'Space' || e.code === 'KeyJ') { e.preventDefault(); if (!e.repeat || G.isFrenzyFor(st, G.anvilSword(st))) doHammer(); }
    else if (e.code === 'KeyQ') useCons();
    else if (e.code === 'KeyR') doUndo();
    else if (/^Digit[1-9]$/.test(e.code)) { selCons = +e.code.slice(5) - 1; updateConsBar(); }
    else if (e.code === 'Escape') leaveAnvil(false);
  }
});
document.addEventListener('keyup', e => { if (e.code === 'Tab') toggleRelicList(false); });

function doUndo() {
  if (hammerAnim) return;
  if (!G.canUndo(st)) return toast(st.consumables.rewind ? '没有可以撤销的锻造' : '需要「悔恨发条」才能撤销（幽灵商人有售）', true);
  G.undo(st);
  SFX.vend();
  flash('#a0d0ff', 0.3);
  toast('悔恨发条：时间倒流了一锤');
  resetScene();
  changed();
}

$('#btnNew').onclick = () => { SFX.resume(); if (loadSave() && !confirm('开始新的契约会覆盖当前存档，确定吗？')) return; newRun(); };
$('#btnContinue').onclick = () => { SFX.resume(); continueRun(); };
$('#btnHow').onclick = () => { SFX.resume(); showHelp(); };
$('#btnCodex') && ($('#btnCodex').onclick = () => { SFX.resume(); showCodex(); });

/* ======================= 主循环 ======================= */
const clock = new THREE.Clock();
let boardTimer = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  if (st && phase !== 'title') {
    const ended = G.tick(st, dt);
    if (ended) { toast('入神结束 —— 破碎的风险回来了'); (ended.events || []).forEach(ev => showProc(ev.id, ev.text)); changed(); recordCodex(); }
    const fr = st.frenzy.active;
    if (fr !== lastFrenzy) { lastFrenzy = fr; changed(); }
    boardTimer += dt;
    if (fr && boardTimer > 0.1) { boardTimer = 0; syncBoards(); }
  }
  player.update(dt);
  if (phase === 'play') updatePrompt();
  updateHammer(dt);

  // 镜头震动
  if (shakeAmt > 0.0005) {
    camera.position.x += (Math.random() - 0.5) * shakeAmt;
    camera.position.y += (Math.random() - 0.5) * shakeAmt;
    shakeAmt *= Math.pow(0.0008, dt);
  }
  // 入神：画面染色 + 彩色光点
  const frOn = st && st.frenzy.active;
  frenzyHue = (frenzyHue + dt * 0.15) % 1;
  const ta = grade.uniforms.tintAmt;
  ta.value += ((frOn ? 0.55 : 0) - ta.value) * Math.min(1, dt * 4);
  grade.uniforms.tint.value.setHSL(0.33 + Math.sin(t * 0.7) * 0.25 + (frOn ? frenzyHue * 0.5 : 0), 0.9, 0.6);
  grade.uniforms.red.value = Math.max(0, grade.uniforms.red.value - dt * (st && st.over === 'dead' ? 0 : 0.6));
  grade.uniforms.time.value = t;
  if (frOn) {
    const s = G.anvilSword(st);
    const o = s && swordObjs.get(s.id);
    if (o) { o.group.getWorldPosition(tmpV); for (let i = 0; i < 3; i++) sparks.ember(tmpV.clone().add(new THREE.Vector3(-0.3, 0, 0)), new THREE.Vector3(1.0, 0.2, 0.3), 0xffffff, { rainbow: true, size: 0.016 }); }
  }
  // 熔炉余烬
  if (Math.random() < 0.15 && W.furnace.userData.heatSpot) { W.furnace.userData.heatSpot.getWorldPosition(tmpV); sparks.ember(tmpV, new THREE.Vector3(0.6, 0.1, 0.4), 0xff7a2a, { size: 0.008 }); }

  // 动画更新
  W.updaters.forEach(u => u(dt, t));
  if (ghostObj && ghostObj.userData.update) ghostObj.userData.update(dt, t);
  W.vendWindows.forEach(h => { if (h.userData.spin) h.userData.spin.rotation.y += dt * 0.6; });
  if (ghostObj) ghostObj.children.forEach(c => { if (c.userData.spin) { c.userData.spin.rotation.y += dt * 0.8; if (c.userData.ring) c.userData.ring.rotation.z += dt; } });
  if (st) updateTutMarker(t);
  swordObjs.forEach(o => { if (o.group.userData.update) o.group.userData.update(dt, t); });
  if (SW.updateSwordFx) SW.updateSwordFx(t);
  sparks.update(dt);
  shards.update(dt);

  // 闪光
  if (flashA > 0) { flashA = Math.max(0, flashA - dt * 2.5); }
  const fl = $('#flash'); fl.style.opacity = flashA; fl.style.background = flashColor;

  composer.render();
  requestAnimationFrame(frame);
}

/* ======================= 启动 ======================= */
SFX.enabled = !meta.muted;
showTitle();
$('#loading').classList.add('hidden');
composer.render();
requestAnimationFrame(frame);

/* ======================= 调试 / 自动测试接口 ======================= */
window.__ft = {
  get st() { return st; }, get meta() { return meta; }, G, D, W, player, camera, scene,
  newRun, continueRun, startPlay, changed, describe, findTarget, ringBell, nextDay, showCodex, startTutorial, tutorialEvent, get tut() { return tut; }, doHammer, resolveHit, enterAnvil, leaveAnvil, heatInFurnace, insertSword, buyVend,
  get phase() { return phase; }, set phase(v) { phase = v; },
  render: () => composer.render(),
  lookAt(x, y, z) { const d = new THREE.Vector3(x, y, z).sub(camera.position); player.yaw = Math.atan2(-d.x, -d.z); player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); player.applyCamera(); },
  tp(x, z) { player.pos.set(x, 1.62, z); player.applyCamera(); },
  pressE() { updatePrompt(); if (target && target.info && target.info.fn) { target.info.fn(); return target.info.title; } return null; },
  updatePrompt, THREE, swordObj: id => swordObjs.get(id) && swordObjs.get(id).group,
  step(n = 30, dt = 1 / 30) { for (let i = 0; i < n; i++) { player.update(dt); updateHammer(dt); sparks.update(dt); shards.update(dt); W.updaters.forEach(u => u(dt, i * dt)); swordObjs.forEach(o => { if (o.group.userData.update) o.group.userData.update(dt, i * dt); }); if (SW.updateSwordFx) SW.updateSwordFx(i * dt); } if (phase === 'play') updatePrompt(); composer.render(); },
};

if (/shot=/.test(location.hash)) import('../tools/scenarios.js');
