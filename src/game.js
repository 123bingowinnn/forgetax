// 铸剑大师 - 核心规则（不依赖 DOM / Three），按原作数据整理
import * as D from './data.js';

let rand = Math.random;
let uid = 1;
export function setRandom(fn) { rand = fn; }
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = n => Math.round(n).toLocaleString('en-US');

export const has = (st, id) => st.relics.includes(id);
export const isUnlocked = (meta, r) => !r.unlock || !!(meta && meta.ach && meta.ach[r.unlock]);

/* ============================ 剑 ============================ */
export function newSword(opts = {}) {
  const special = opts.family && D.FAMILIES[opts.family] && D.FAMILIES[opts.family].special;
  const lv = opts.level || 0;
  return {
    id: 's' + Date.now().toString(36) + (uid++), no: 0,
    lane: opts.lane || 'A', branch: opts.branch ?? (rand() < 0.5 ? 0 : 1), family: special ? opts.family : null,
    level: lv, peak: lv, base: special ? D.SPECIAL_BASE : D.BASE_VALUE, flat: 0, mult: 1,
    heated: !!opts.heated, charge: opts.charge || 0, loc: 'rack', slot: -1,
    hammers: 0, successes: 0, last: null, sameStreak: 0, succStreak: 0, holdStreak: 0,
    spliceStacks: 0, scorched: 0, pearlUsed: 0, kingSeal: 0, heartStacks: 0, windStacks: 0,
    spineCount: 0, spineReady: false, cornerUsed: false, phoenixUsed: false,
    cogs: 0, cups: 0, molar: 0, idolMarks: 0, driveCount: 0,
    nextGreat: 0, nextSucc: 0, nextBreakMul: 1, afterDamage: false, lastBonus: null,
  };
}

function addSword(st, s, where) {
  st.swordNo = (st.swordNo || 0) + 1;
  s.no = st.swordNo;
  st.swords.push(s);
  if (where === 'floor') { s.loc = 'floor'; s.slot = st.swords.filter(x => x.loc === 'floor').length - 1; }
  else placeOnRack(st, s);
  recordForm(st, s);
  return s;
}
function placeOnRack(st, s) {
  const used = new Set(st.swords.filter(x => x.loc === 'rack' && x !== s).map(x => x.slot));
  let i = 0; while (used.has(i)) i++;
  if (i >= D.RACK_SLOTS) { s.loc = 'floor'; s.slot = st.swords.filter(x => x.loc === 'floor' && x !== s).length; return; }
  s.loc = 'rack'; s.slot = i;
}

export const formOf = s => D.formOf(s);
export const swordName = s => D.FORM_NAMES[D.formOf(s)] || '剑';
export function value(st, s) {
  let v = (s.base * Math.pow(1.5, s.level) + s.flat) * s.mult;
  if (has(st, 'iron-signet')) v *= 1.15;
  if (has(st, 'thorn-weight')) v *= 1.1;
  if (has(st, 'black-iron-stone') && s.level >= 8) v *= 1.3;
  if (has(st, 'dragon-signet') && s.level >= 12) v *= 1.5;
  return Math.max(0, Math.round(v));
}
const levelValue = (s, lv) => s.base * Math.pow(1.5, lv);

export const swordById = (st, id) => st.swords.find(s => s.id === id) || null;
export const anvilSword = st => st.swords.find(s => s.loc === 'anvil') || null;
export const handSword = st => st.swords.find(s => s.loc === 'hand') || null;
export const furnaceSword = st => st.swords.find(s => s.loc === 'furnace') || null;
export const altarSwords = st => st.swords.filter(s => s.loc === 'altar');
export const rackSwords = st => st.swords.filter(s => s.loc === 'rack');

function recordForm(st, s) {
  const f = D.formOf(s);
  st.codexNew = st.codexNew || [];
  st.formsSeen = st.formsSeen || {};
  if (!st.formsSeen[f]) { st.formsSeen[f] = true; st.codexNew.push(f); }
}

/* ============================ 开局 / 送货 ============================ */
export function newRun(meta, opts = {}) {
  const st = {
    version: 3, day: 1, gold: 0, rage: 0, swords: [], swordNo: 0, relics: [],
    consumables: {}, active: { ward: false, chalk: false, powder: false },
    vend: null, ghost: null,
    legacy: null, molarPending: false, grudge: 0, permTickets: {}, mournings: 0,
    pocketPaid: 0, royalCredit: 0, extraTomorrow: 0, deliveryNotes: 0, journeyman: false, testament: 0,
    wireUsedToday: false, voucherUsed: false, hookReady: false, writ: false, ledgerGhost: false, oblivionUsed: false,
    frenzy: { active: false, timeLeft: 0, swordId: null },
    stats: { hammers: 0, breaks: 0, greats: 0, maxLevel: 0, maxValue: 0, tributeTotal: 0, frenzies: 0, overtimePaid: 0 },
    history: [], over: null, endless: false, thrown: false, tutorial: opts.tutorial !== false,
    altarScrap: 0, lastResult: null, undoSnap: null, formsSeen: {}, codexNew: [], achNew: [],
  };
  deliver(st, D.SWORDS_PER_DAY);
  rollVend(st, meta, true);
  return st;
}

function deliver(st, n) {
  const out = [];
  let lanes = [];
  for (let i = 0; i < n; i++) { if (!lanes.length) lanes = shuffle(['A', 'B', 'C']); out.push(lanes.pop()); }
  return out.map((lane, i) => {
    const s = newSword({ lane });
    if (has(st, 'lifetime-contract')) { s.level = s.peak = 7; s.heated = true; }
    else if (st.journeyman) { s.level = s.peak = Math.max(s.level, 2); }
    if (i === 0 && st.testament) { s.level = s.peak = Math.max(s.level, st.testament); }
    return addSword(st, s, st.thrown ? 'floor' : 'rack');
  });
}

/* ============================ 概率 ============================ */
export function deck(st, s, frenzy) {
  const t = has(st, 'sickle-and-hammer') ? { break: 5, damage: 5, hold: 5, success: 5, great: 5 } : Object.assign({}, D.BASE_DECK);
  const add = (k, n) => { t[k] += n; };
  if (has(st, 'bent-nail')) add('success', 4);
  if (has(st, 'blunt-mallet')) { add('damage', -1); add('success', 1); }
  if (has(st, 'lucky-coal')) add('great', 1);
  if (has(st, 'patient-weight')) add('hold', 3);
  if (has(st, 'sealing-stone')) add('hold', 2);
  if (has(st, 'worn-whetstone')) { add('hold', -2); add('success', 2); }
  if (has(st, 'iron-hoop')) add('break', -2);
  if (has(st, 'thorn-weight')) { add('hold', -2); add('damage', 2); }
  if (has(st, 'golden-nail')) add('great', 2);
  if (has(st, 'butterfingers')) { add('break', 3); add('great', 5); }
  if (has(st, 'abyssal-pearl')) add('damage', 3);
  if (has(st, 'eternal-seed')) add('hold', 6);
  if (has(st, 'royal-spike')) add('success', 6);
  if (has(st, 'oracle-die')) add('great', 4);
  if (has(st, 'obsidian-eye') && s.level >= 8) { add('success', -2); add('great', 2); }
  if (has(st, 'perfect-mana-core') && frenzy) add('great', 6);
  if (has(st, 'mourning-knot')) add('great', st.mournings);
  for (const k in st.permTickets) add(k, st.permTickets[k]);
  if (st.grudge > 0) add('great', st.grudge);
  add('success', s.cogs + s.molar + s.nextSucc);
  add('great', s.cups + s.nextGreat);
  for (const k in t) t[k] = Math.max(0, t[k]);
  if (st.active.chalk) t.great *= 2;
  return t;
}

export const isFrenzyFor = (st, s) => !!(s && st.frenzy.active && st.frenzy.swordId === s.id);
const willFrenzy = (st, s) => isFrenzyFor(st, s) || s.charge >= D.FRENZY_CHARGE;

export function breakMul(st, s) {
  let m = 1;
  if (has(st, 'black-knot')) m *= 0.9;
  if (has(st, 'dragonscale-tongs') && s.level >= 6) m *= 0.75;
  if (has(st, 'scorched-charm')) m *= 1 - Math.min(0.18, 0.03 * s.scorched);
  if (has(st, 'cracked-splice')) m *= 1 - Math.min(0.6, 0.15 * s.spliceStacks);
  m *= s.nextBreakMul;
  return m;
}

/** 下一锤五种结果的概率 */
export function probs(st, s, frenzyOverride) {
  if (!s) return null;
  const frenzy = frenzyOverride !== undefined ? frenzyOverride : willFrenzy(st, s);
  const t = deck(st, s, frenzy);
  const others = t.damage + t.hold + t.success + t.great;
  const bw = frenzy ? 0 : t.break * D.breakWeight(s.level);
  const tot = others + bw;
  if (tot <= 0) return { break: 0, damage: 0, hold: 1, success: 0, great: 0 };
  let pb = bw / tot;
  pb *= breakMul(st, s);
  const rest = 1 - pb;
  const p = { break: pb, damage: t.damage / others * rest, hold: t.hold / others * rest, success: t.success / others * rest, great: t.great / others * rest };
  if (st.active.powder && !frenzy) return { break: p.break + p.damage + p.hold, damage: 0, hold: 0, success: 0, great: p.success + p.great };
  return p;
}

function roll(p) { let r = rand(); for (const k of D.OUTCOME_ORDER) { if (r < p[k]) return k; r -= p[k]; } return 'hold'; }

export function frenzyDuration(st) { return D.FRENZY_TIME + (has(st, 'red-hourglass') ? 1 : 0) + (has(st, 'undying-wick') ? 2 : 0); }
export function strikeInterval(st, frenzy) {
  let sp = 1;
  if (has(st, 'worn-grip')) sp += 0.15;
  if (!frenzy && has(st, 'leather-loop')) sp += 0.2;
  if (frenzy && has(st, 'possessed-bellows')) sp += 0.3;
  return D.STRIKE_INTERVAL / sp;
}

/* ============================ 挥锤 ============================ */
export function hammer(st) {
  const s = anvilSword(st);
  if (st.over) return { error: '游戏已结束' };
  if (!s) return { error: '铁砧上没有剑' };
  if (!s.heated) return { error: '剑是冷的，先去熔炉加热' };

  // 悔恨发条：保存锤前快照
  st.undoSnap = null;
  const snap = JSON.stringify(st);
  st.undoSnap = snap;

  const ev = [], ach = [];
  const bonus = (id, text) => ev.push({ id, text });
  let frenzy = isFrenzyFor(st, s), frenzyStarted = false;
  if (!frenzy && s.charge >= D.FRENZY_CHARGE) {
    st.frenzy = { active: true, timeLeft: frenzyDuration(st), swordId: s.id };
    s.charge = 0; frenzy = true; frenzyStarted = true;
    st.stats.frenzies++;
    ach.push('firstfrenzy');
    if (st.stats.frenzies >= 5) ach.push('frenzy5');
  }
  const p = probs(st, s, frenzy);
  let outcome = roll(p);
  const before = value(st, s), levelBefore = s.level;
  const firstStrike = s.hammers === 0;
  const usedCons = [];
  if (st.active.chalk) { st.active.chalk = false; usedCons.push('chalk'); }
  if (st.active.powder && !frenzy) { st.active.powder = false; usedCons.push('powder'); }
  if (st.grudge > 0) { bonus('grudge-nail', '怨念 +' + st.grudge + ' 大成功签'); st.grudge = 0; }

  // —— 破碎保护 ——
  let protectedBreak = false;
  if (outcome === 'break') {
    if (st.active.ward) { outcome = 'hold'; ev.push({ cons: 'ward', text: '龙鳞挡下了破坏' }); }
    else if (has(st, 'wirebound-scabbard') && !st.wireUsedToday) { st.wireUsedToday = true; outcome = 'damage'; protectedBreak = true; bonus('wirebound-scabbard', '破碎 → 损伤'); }
    else if (has(st, 'unyielding-cornerstone') && !s.cornerUsed) { s.cornerUsed = true; outcome = 'damage'; protectedBreak = true; bonus('unyielding-cornerstone', '破碎 → 损伤'); }
    else if (has(st, 'giants-spine') && s.spineReady) { s.spineReady = false; outcome = 'damage'; protectedBreak = true; bonus('giants-spine', '破碎 → 损伤'); }
    else if (has(st, 'phoenix-ash') && !s.phoenixUsed) { s.phoenixUsed = true; s.mult *= 0.6; outcome = 'hold'; bonus('phoenix-ash', '浴火重生 −40%'); }
  }
  if (st.active.ward) { st.active.ward = false; usedCons.push('ward'); }
  // 一次性的「下一锤」效果清空
  s.nextGreat = 0; s.nextSucc = 0; s.nextBreakMul = 1;

  s.hammers++; st.stats.hammers++;
  const prevLast = s.last;
  let broke = false;
  const lv = n => { s.level += n; };
  const flat = (id, g, text) => { s.flat += g; s.lastBonus = { k: 'flat', v: g, id }; bonus(id, text || '+' + fmt(g) + ' G'); };
  const mul = (id, m, text) => { s.mult *= m; s.lastBonus = { k: 'mult', v: m, id }; bonus(id, text || '×' + m); };
  const baseAdd = (id, g, text) => { s.base += g; s.lastBonus = { k: 'base', v: g, id }; bonus(id, text || '基础 +' + g + ' G'); };
  const charge = (n) => { if (!frenzy) s.charge = Math.min(D.FRENZY_CHARGE, s.charge + n); };

  switch (outcome) {
    case 'break': {
      broke = true;
      st.stats.breaks++;
      if (st.stats.breaks >= 10) ach.push('broken10');
      const peakV = Math.max(before, s.peakValue || 0);
      st.swords = st.swords.filter(x => x !== s);
      if (has(st, 'undertakers-chalice')) { const g = Math.round(peakV * 0.3); st.altarScrap += g; bonus('undertakers-chalice', '残骸 ' + fmt(g) + ' G 放上贡台'); }
      if (has(st, 'ash-sieve')) { st.gold += 500; bonus('ash-sieve', '+500 金币'); }
      if (has(st, 'grudge-nail') && s.level > 0) { st.grudge += s.level; bonus('grudge-nail', '存下 ' + s.level + ' 张大成功签'); }
      let pct = 0, ch = 0;
      if (has(st, 'broken-holy-sword')) { pct += 0.3; ch += 3; }
      if (has(st, 'dawn-scabbard')) { pct += 0.4; ch += 4; }
      if (pct > 0 && s.level > 0) { const L = Math.floor(s.level * pct); if (L > 0) { st.legacy = { level: L, charge: ch }; bonus(has(st, 'dawn-scabbard') ? 'dawn-scabbard' : 'broken-holy-sword', '传承 +' + L); } }
      if (has(st, 'hungry-molar') && s.level >= 4) { st.molarPending = true; bonus('hungry-molar', '下一把剑成功签 +4'); }
      if (has(st, 'ossuary-kings-scabbard') && s.level >= 7 && prevLast) { st.permTickets[prevLast] = (st.permTickets[prevLast] || 0) + 1; bonus('ossuary-kings-scabbard', '永久 +1 ' + D.OUTCOMES[prevLast].name + '签'); }
      if (has(st, 'undertakers-ledger') && s.level >= 7) { st.extraTomorrow = Math.min(2, st.extraTomorrow + 1); bonus('undertakers-ledger', '明天多送 1 把剑'); }
      if (st.frenzy.swordId === s.id) endFrenzy(st);
      break;
    }
    case 'damage': {
      let drop = s.level > 0;
      if (has(st, 'abyssal-pearl') && s.pearlUsed < 2) { s.pearlUsed++; if (drop) bonus('abyssal-pearl', '不掉级'); drop = false; }
      const oldV = levelValue(s, s.level);
      if (has(st, 'iron-comb')) flat('iron-comb', oldV * 0.05, '+' + fmt(oldV * 0.05) + ' G');
      if (drop) {
        lv(-1);
        if (has(st, 'cracked-crown')) { const k = 0.5 * (oldV - levelValue(s, s.level)); flat('cracked-crown', k, '保留 ' + fmt(k) + ' G'); }
      }
      if (has(st, 'patched-apron')) flat('patched-apron', 140);
      if (has(st, 'cracked-splice') && s.spliceStacks < 4) { s.spliceStacks++; bonus('cracked-splice', '破碎风险降低'); }
      if (has(st, 'defeated-kings-seal')) { s.kingSeal++; bonus('defeated-kings-seal', '下次大成功 +' + s.kingSeal); }
      if (has(st, 'giants-spine') && !protectedBreak) { s.spineCount++; if (s.spineCount >= 2 && !s.spineReady) { s.spineReady = true; s.spineCount = 0; bonus('giants-spine', '保护就绪'); } }
      if (has(st, 'unbroken-oath') && rand() < 0.7) { lv(1); bonus('unbroken-oath', '+1 级'); }
      if (has(st, 'cracked-wristwatch') && !frenzy) { charge(1); bonus('cracked-wristwatch', '充能 +1'); }
      if (has(st, 'blind-die')) s.nextGreat += 3;
      s.afterDamage = true;
      s.succStreak = 0; s.holdStreak = 0;
      break;
    }
    case 'hold': {
      if (has(st, 'heavy-paperweight')) flat('heavy-paperweight', 180);
      if (has(st, 'cold-teacup')) mul('cold-teacup', 1.06, '+6%');
      if (has(st, 'red-thread')) { s.nextBreakMul *= 0.8; bonus('red-thread', '破碎风险降低'); }
      s.holdStreak++;
      if (has(st, 'sealing-stone') && s.holdStreak % 2 === 0) { lv(1); bonus('sealing-stone', '+1 级'); }
      if (has(st, 'little-wind-bell') && s.windStacks < 2) { s.windStacks++; bonus('little-wind-bell', '下次成功 +' + s.windStacks); }
      if (has(st, 'sealed-heart') && s.heartStacks < 4) { s.heartStacks++; bonus('sealed-heart', '下次大成功 +' + s.heartStacks); }
      if (has(st, 'sleeping-ember') && rand() < 0.7) { lv(1); bonus('sleeping-ember', '+1 级'); }
      if (has(st, 'chained-hourglass') && !frenzy && rand() < 0.5) { charge(1); bonus('chained-hourglass', '充能 +1'); }
      if (has(st, 'closed-third-eye')) s.nextSucc += 4;
      if (has(st, 'blind-die')) s.nextGreat += 3;
      if (has(st, 'kings-empty-cup')) { s.cups++; bonus('kings-empty-cup', '大成功签 +1'); }
      if (has(st, 'eternal-seed')) baseAdd('eternal-seed', 40);
      s.succStreak = 0;
      break;
    }
    case 'success': case 'great': {
      const great = outcome === 'great';
      let n = great ? 2 : 1;
      if (great) {
        if (frenzy && has(st, 'glass-hourglass')) { n = 3; bonus('glass-hourglass', '+3 级'); }
        if (s.heartStacks) { n += s.heartStacks; bonus('sealed-heart', '额外 +' + s.heartStacks); s.heartStacks = 0; }
        if (s.kingSeal) { n += s.kingSeal; bonus('defeated-kings-seal', '额外 +' + s.kingSeal); s.kingSeal = 0; }
        if (!frenzy && has(st, 'silver-tuning-fork')) { n += 1; bonus('silver-tuning-fork', '+1 级'); }
        if (!frenzy && has(st, 'lightning-mark')) { s.nextBreakMul *= 0.6; bonus('lightning-mark', '破碎风险降低'); }
        st.stats.greats++;
      } else {
        if (s.windStacks) { n += s.windStacks; bonus('little-wind-bell', '额外 +' + s.windStacks); s.windStacks = 0; }
        if (has(st, 'golden-cog')) baseAdd('golden-cog', 30);
        if (has(st, 'bronze-cog')) { s.cogs++; bonus('bronze-cog', '成功签 +1'); }
        if (has(st, 'ceaseless-driveshaft')) { s.driveCount++; if (s.driveCount % 2 === 0) { n += 1; bonus('ceaseless-driveshaft', '+1 级'); } }
      }
      if (firstStrike && has(st, 'first-brand')) { n += 2; bonus('first-brand', '+2 级'); }
      if (s.afterDamage && has(st, 'interlocking-weights')) { n += 2; bonus('interlocking-weights', '+2 级'); }
      if (has(st, 'echo-hammer') && rand() < 0.25) { n += 1; bonus('echo-hammer', '+1 级'); }
      s.succStreak++;
      if (s.succStreak % 2 === 0) {
        if (has(st, 'third-hand')) { n += 1; bonus('third-hand', '+1 级'); }
        if (has(st, 'double-knot')) mul('double-knot', 1.1, '+10%');
      }
      if (!frenzy && has(st, 'scorched-charm') && s.scorched < 6) { s.scorched++; }
      const wasLevel = s.level;
      lv(n);
      if (great) s.mult *= 2.5 / 2.25;
      s.successes++;
      if (has(st, 'inspection-stamp')) flat('inspection-stamp', 100);
      if (great && has(st, 'cracked-bell')) mul('cracked-bell', 1.2, '+20%');
      if (has(st, 'dragon-heart') && wasLevel >= 7) mul('dragon-heart', 1.15, '+15%');
      s.holdStreak = 0;
      break;
    }
  }
  if (outcome !== 'damage') s.afterDamage = false;

  if (!broke) {
    // 结果序列类
    if (prevLast && outcome !== prevLast && has(st, 'soot-censer')) baseAdd('soot-censer', 20);
    s.sameStreak = prevLast === outcome ? s.sameStreak + 1 : 1;
    if (s.sameStreak >= 2 && s.sameStreak % 2 === 0) {
      if (has(st, 'wax-effigy')) flat('wax-effigy', 150);
      if (has(st, 'split-twin-mirror') && s.lastBonus) {
        const b = s.lastBonus;
        if (b.k === 'flat') s.flat += b.v; else if (b.k === 'mult') s.mult *= b.v; else s.base += b.v;
        bonus('split-twin-mirror', '重复「' + (D.RELIC_MAP[b.id] ? D.RELIC_MAP[b.id].name : '') + '」');
      }
    }
    if (frenzy && has(st, 'bell-collar')) mul('bell-collar', 1.05, '+5%');
    // 缚绳木偶：首次达到 4 的倍数等级
    if (has(st, 'bound-idol')) {
      const marks = Math.floor(s.level / 4);
      while (s.idolMarks < marks) { s.idolMarks++; mul('bound-idol', 1.15, '+15%'); }
    }
    // 充能
    let c = 1;
    if (firstStrike && has(st, 'ember-locket')) { c += 2; bonus('ember-locket', '充能 +2'); }
    charge(c);
    s.last = outcome;
    s.peak = Math.max(s.peak, s.level);
    st.stats.maxLevel = Math.max(st.stats.maxLevel, s.level);
    if (s.level >= 10) ach.push('first10');
    if (s.peak >= 20) ach.push('m_' + D.familyOf(s));
    recordForm(st, s);
    // 双子印
    if (has(st, 'seal-of-twins') && rand() < 0.02) {
      const twin = JSON.parse(JSON.stringify(s));
      twin.id = 's' + Date.now().toString(36) + (uid++);
      addSword(st, twin, 'floor');
      bonus('seal-of-twins', '复制了一把剑！');
    }
  }
  const after = broke ? 0 : value(st, s);
  if (!broke) s.peakValue = Math.max(s.peakValue || 0, after);
  st.stats.maxValue = Math.max(st.stats.maxValue, after);
  const ratio = before > 0 ? after / before : 1;
  st.lastResult = { outcome, levelDelta: broke ? 0 : s.level - levelBefore, delta: after - before, ratio, swordId: s.id };
  return {
    outcome, probs: p, swordId: s.id, sword: broke ? null : s,
    levelBefore, levelAfter: broke ? levelBefore : s.level, levelDelta: broke ? 0 : s.level - levelBefore,
    before, after, delta: after - before, ratio, broke, frenzy, frenzyStarted,
    chargeFull: !broke && !frenzy && s.charge >= D.FRENZY_CHARGE,
    events: ev, ach, usedCons, form: broke ? null : D.formOf(s),
  };
}

export function canUndo(st) { return !!(st.undoSnap && st.consumables.rewind); }
export function undo(st) {
  if (!canUndo(st)) return { error: '没有可撤销的锻造' };
  const snap = JSON.parse(st.undoSnap);
  const left = st.consumables.rewind - 1;
  Object.keys(st).forEach(k => delete st[k]);
  Object.assign(st, snap);
  st.undoSnap = null;
  if (left > 0) st.consumables.rewind = left; else delete st.consumables.rewind;
  return { ok: true };
}

export function tick(st, dt) {
  if (!st.frenzy.active) return null;
  st.frenzy.timeLeft -= dt;
  if (st.frenzy.timeLeft <= 0) {
    const s = swordById(st, st.frenzy.swordId);
    endFrenzy(st);
    const ev = [];
    if (s && has(st, 'headless-bell')) { s.level++; s.peak = Math.max(s.peak, s.level); recordForm(st, s); ev.push({ id: 'headless-bell', text: '+1 级' }); }
    return { ended: true, events: ev };
  }
  return null;
}
export function endFrenzy(st) { st.frenzy = { active: false, timeLeft: 0, swordId: null }; }

/* ============================ 搬运 ============================ */
export function takeToHand(st, id) {
  const s = swordById(st, id);
  if (!s) return { error: '没有这把剑' };
  if (handSword(st)) return { error: '手里已经拿着剑了' };
  if (isFrenzyFor(st, s)) endFrenzy(st);
  if (s.loc === 'anvil') st.undoSnap = null;
  s.loc = 'hand'; s.slot = -1;
  return { sword: s };
}
export function putOnRack(st) { const s = handSword(st); if (!s) return { error: '手里没有剑' }; placeOnRack(st, s); return { sword: s }; }
export function putOnAnvil(st) {
  const s = handSword(st); if (!s) return { error: '手里没有剑' };
  if (anvilSword(st)) return { error: '铁砧上已经有剑了' };
  s.loc = 'anvil'; s.slot = 0;
  const out = { sword: s };
  if (s.hammers === 0 && s.level === 0) {
    if (st.legacy) { s.level = s.peak = st.legacy.level; s.charge = Math.min(10, s.charge + st.legacy.charge); out.legacy = st.legacy.level; st.legacy = null; recordForm(st, s); }
    if (st.molarPending) { s.molar += 4; st.molarPending = false; out.molar = true; }
  }
  return out;
}
export function putInFurnace(st) {
  const s = handSword(st); if (!s) return { error: '手里没有剑' };
  if (furnaceSword(st)) return { error: '熔炉里已经有剑了' };
  s.loc = 'furnace'; s.slot = 0;
  return { sword: s };
}
export function heatSword(st, id) { const s = swordById(st, id); if (s) s.heated = true; }
export const ALTAR_SLOTS = 6;
export function putOnAltar(st) {
  const s = handSword(st); if (!s) return { error: '手里没有剑' };
  const used = new Set(altarSwords(st).map(x => x.slot));
  let i = 0; while (used.has(i)) i++;
  if (i >= ALTAR_SLOTS) return { error: '贡台已经放满了' };
  s.loc = 'altar'; s.slot = i;
  return { sword: s };
}
export function dropOnFloor(st) { const s = handSword(st); if (!s) return { error: '手里没有剑' }; s.loc = 'floor'; s.slot = st.swords.filter(x => x.loc === 'floor').length; return { sword: s }; }

export function quota(st) {
  let q = D.quotaFor(st.day);
  if (has(st, 'sealed-rebate')) q *= 0.9;
  q -= Math.min(q * 0.3, st.royalCredit || 0);
  return Math.round(q);
}
export const altarTotal = st => altarSwords(st).reduce((a, s) => a + value(st, s), 0) + Math.round(st.altarScrap || 0);

/* ============================ 遗物售货机 ============================ */
export function refreshCost(st) {
  if (has(st, 'worn-voucher') && !st.voucherUsed) return 0;
  const n = st.vend ? st.vend.refreshes : 0;
  return Math.round(Math.max(150, D.quotaFor(st.day) * 0.12) * Math.pow(1.6, n) / 10) * 10;
}
export function rollVend(st, meta, gift) {
  const keep = st.vend ? { credits: st.vend.credits, refreshes: st.vend.refreshes } : { credits: 0, refreshes: 0 };
  let items;
  if (gift) {
    const pool = D.RELICS.filter(r => isUnlocked(meta, r) && r.rarity === 'common' && !st.relics.includes(r.id));
    items = shuffle(pool).slice(0, 3).map(r => ({ id: r.id, price: 0, sold: false, gift: true }));
  } else {
    const avail = D.RELICS.filter(r => isUnlocked(meta, r) && r.day <= st.day && !st.relics.includes(r.id));
    const odds = D.shopOdds(st.day);
    items = [];
    for (let i = 0; i < 3; i++) {
      let r = rand() * 100, rar = r < odds[0] ? 'common' : r < odds[0] + odds[1] ? 'rare' : 'legendary';
      let pool = avail.filter(x => x.rarity === rar && !items.some(it => it.id === x.id));
      if (!pool.length) pool = avail.filter(x => !items.some(it => it.id === x.id));
      if (!pool.length) break;
      const pick = pool[Math.floor(rand() * pool.length)];
      items.push({ id: pick.id, price: pick.price, sold: false });
    }
  }
  st.vend = Object.assign({ items, gift: !!gift }, keep);
}
export function insertSword(st) {
  const s = handSword(st); if (!s) return { error: '手里没有剑' };
  st.swords = st.swords.filter(x => x !== s);
  let n = 1;
  if (st.hookReady && s.hammers === 0 && s.level === 0) { n = 2; st.hookReady = false; }
  st.vend.credits += n;
  return { sword: s, credits: n };
}
export function refreshVend(st, meta) {
  if (st.vend.gift) return { error: '第一天的赠品不能刷新' };
  const cost = refreshCost(st);
  if (st.gold < cost) return { error: '金币不足' };
  st.gold -= cost;
  if (cost === 0) st.voucherUsed = true;
  st.vend.refreshes += 1;
  if (has(st, 'collectors-hook')) st.hookReady = true;
  rollVend(st, meta, false);
  return { cost };
}
export function buyVend(st, idx, meta) {
  const it = st.vend.items[idx];
  if (!it || it.sold) return { error: '已经卖掉了' };
  if (st.relics.length >= D.RELIC_SLOTS) return { error: '遗物架已满。对准架上的遗物按 X 丢弃一件', full: true };
  if (st.vend.credits < it.price) return { error: '需要投入 ' + it.price + ' 把剑（已投入 ' + st.vend.credits + '）' };
  st.vend.credits -= it.price;
  it.sold = true;
  st.relics.push(it.id);
  if (it.id === 'silver-supply-writ') st.writ = true;
  if (it.id === 'wandering-ghosts-ledger') st.ledgerGhost = true;
  if (st.vend.gift) { st.vend.items.forEach(x => { if (!x.sold) { x.sold = true; x.vanished = true; } }); }
  return { id: it.id };
}
export function discardRelic(st, id) { if (!st.relics.includes(id)) return { error: '没有这件遗物' }; st.relics = st.relics.filter(r => r !== id); return { ok: true }; }

/* ============================ 幽灵商人 ============================ */
export function rollGhost(st) {
  if (!D.isMerchantDay(st.day)) { st.ghost = null; return; }
  st.ghostVisits = (st.ghostVisits || 0) + 1;
  const v = st.ghostVisits, q = D.quotaFor(st.day), d = st.day;
  const offers = [];
  let basicStock = v === 1 ? 2 : v <= 3 ? 3 : v <= 7 ? 4 : 5;
  if (st.writ) basicStock += 2;
  offers.push({ kind: 'sword', id: 'basic', name: '基础剑', price: Math.max(700, Math.round(q * 0.4 / 10) * 10), stock: basicStock, bought: 0 });
  const fam = ['tree', 'fish', 'funeral'][Math.floor(rand() * 3)];
  const lvl = d < 9 ? 0 : d < 15 ? 2 : 4;
  const sp = Math.max(1100, q * 1.75 * 0.65) * (lvl === 0 ? 1 : lvl === 2 ? 1.6 : 2.4);
  offers.push({ kind: 'special', id: fam, level: lvl, name: D.FAMILIES[fam].name + '·' + D.FORM_NAMES[D.FAMILIES[fam].forms[lvl / 2]], price: Math.round(sp / 10) * 10, stock: 1, bought: 0 });
  let total = d < 6 ? 4 : d <= 14 ? 5 : 6;
  if (st.ledgerGhost) total += 2;
  const pool = D.CONSUMABLES.filter(c => c.minDay <= d && !(c.id === 'oblivion' && (st.rage <= 0 || st.oblivionUsed)));
  const chosen = [];
  if (d === 3) chosen.push('ward', 'rewind');
  for (const c of shuffle(pool)) {
    if (chosen.length >= total - 2) break;
    if (chosen.includes(c.id)) continue;
    if (c.legendary && rand() > 0.22) continue;
    chosen.push(c.id);
  }
  chosen.slice(0, total - 2).forEach(id => {
    const c = D.CONS_MAP[id];
    const price = d === c.minDay ? Math.max(c.min, q * c.k) : q * c.k;
    offers.push({ kind: 'cons', id, name: c.name, price: Math.round(price / 10) * 10, stock: c.stock, bought: 0 });
  });
  st.ghost = { day: d, offers };
}
export const ghostPrice = it => Math.round(it.price * Math.pow(3, it.bought));
export function buyGhost(st, idx) {
  const it = st.ghost && st.ghost.offers[idx];
  if (!it || it.bought >= it.stock) return { error: '卖完了' };
  const price = ghostPrice(it);
  if (st.gold < price) return { error: '金币不足（需要 ' + fmt(price) + '）' };
  if (it.id === 'oblivion' && st.rage <= 0) return { error: '巨龙现在并不生气' };
  st.gold -= price; it.bought++;
  let sword = null;
  if (it.kind === 'sword') sword = addSword(st, newSword({ lane: ['A', 'B', 'C'][Math.floor(rand() * 3)] }));
  else if (it.kind === 'special') sword = addSword(st, newSword({ family: it.id, level: it.level }));
  else if (it.id === 'oblivion') { st.rage = Math.max(0, st.rage - 1); st.oblivionUsed = true; }
  else if (it.id === 'delivery') st.deliveryNotes += 1;
  else st.consumables[it.id] = (st.consumables[it.id] || 0) + 1;
  const ach = st.ghost.offers.every(o => o.bought >= o.stock) ? ['soldout'] : [];
  return { item: it, sword, ach };
}

export function useConsumable(st, id) {
  if (!st.consumables[id]) return { error: '没有该消耗品' };
  const s = anvilSword(st);
  if (!s) return { error: '先把剑放上铁砧' };
  const fr = isFrenzyFor(st, s);
  if (id === 'ward') { if (fr) return { error: '入神中不能使用' }; if (st.active.ward) return { error: '龙鳞已经生效' }; st.active.ward = true; }
  else if (id === 'chalk') { if (st.active.chalk) return { error: '红粉笔已经生效' }; st.active.chalk = true; }
  else if (id === 'powder') { if (fr) return { error: '入神中不能使用' }; if (st.active.powder) return { error: '火药包已经生效' }; st.active.powder = true; }
  else if (id === 'starshard') { if (fr) return { error: '入神中不能使用' }; s.charge = Math.min(D.FRENZY_CHARGE, s.charge + 3); }
  else if (id === 'rewind') return { error: '悔恨发条请按 R 使用' };
  st.consumables[id]--;
  if (st.consumables[id] <= 0) delete st.consumables[id];
  return { id };
}

/* ============================ 敲铃进贡 ============================ */
export function ringBell(st) {
  const q = quota(st);
  const swords = altarSwords(st);
  const total = altarTotal(st);
  const ok = total >= q;
  const ach = [];
  const bestOffered = swords.reduce((m, s) => Math.max(m, s.level), 0);
  st.swords = st.swords.filter(s => s.loc !== 'altar');
  st.altarScrap = 0;
  st.stats.tributeTotal += total;
  st.gold += total; // 无论是否足额，贡品价值都会化作金币返还
  const rageBefore = st.rage;
  st.royalCredit = 0;
  st.journeyman = false; st.testament = 0;
  let creditGain = 0, pardoned = false;
  if (ok) {
    if (has(st, 'tax-tally')) { st.vend.credits += 1; creditGain = 1; }
    if (has(st, 'pocket-hearth')) st.pocketPaid++;
    if (has(st, 'journeyman-badge')) st.journeyman = true;
    if (has(st, 'smiths-testament') && bestOffered >= 10) st.testament = Math.floor(bestOffered * 0.3);
    if (has(st, 'royal-change')) st.royalCredit = Math.min(D.quotaFor(st.day + 1) * 0.3, (total - q) * 0.3);
    if (total >= q * 3) ach.push('triple');
    if (rageBefore >= 2) ach.push('lastchance');
    if (st.endless) { st.stats.overtimePaid++; if (st.stats.overtimePaid >= 3) ach.push('overtime3'); }
  } else {
    st.rage += 1;
    if (has(st, 'mourning-knot')) st.mournings++;
  }
  st.history.push({ day: st.day, quota: q, paid: total, ok });
  endFrenzy(st);
  if (st.rage >= D.RAGE_MAX) {
    if (has(st, 'dragons-pardon')) { st.relics = st.relics.filter(r => r !== 'dragons-pardon'); st.rage = D.RAGE_MAX - 1; pardoned = true; }
    else { st.over = 'dead'; ach.push('firstdeath'); }
  }
  if (!st.over && st.day === D.CONTRACT_DAYS && !st.endless) { st.over = 'win'; ach.push('clear'); }
  st.thrown = !ok;
  return { day: st.day, quota: q, total, count: swords.length, ok, gold: total, rage: st.rage, rageMax: D.RAGE_MAX, over: st.over, ach, pardoned, creditGain };
}

export function startNextDay(st, meta) {
  st.day += 1;
  // 每日：铁砧上的剑留着、剑不需要重新加热（原作加热永久有效）
  if (has(st, 'pocket-hearth')) {
    // 口袋火炉：对之后送来的剑生效，在 deliver 后处理
  }
  let n = D.SWORDS_PER_DAY + (has(st, 'supply-permit') ? 1 : 0) + st.deliveryNotes * 2 + st.extraTomorrow;
  st.deliveryNotes = 0; st.extraTomorrow = 0;
  const fresh = deliver(st, n);
  if (has(st, 'pocket-hearth') && st.pocketPaid) fresh.forEach(s => { s.base += 20 * st.pocketPaid; });
  if (has(st, 'charcoal-pouch')) fresh.forEach(s => { s.base += 80; s.charcoal = true; });
  st.thrown = false;
  st.wireUsedToday = false; st.voucherUsed = false; st.hookReady = false;
  endFrenzy(st);
  st.vend.refreshes = 0;
  rollVend(st, meta, false);
  rollGhost(st);
  st.lastResult = null; st.undoSnap = null;
  return { newSwords: n, swords: fresh };
}
export function continueEndless(st, meta) { st.over = null; st.endless = true; return startNextDay(st, meta); }

/** 木炭袋对已获得的剑也生效（第一次购买时补上） */
export function onRelicGained(st, id) {
  if (id === 'charcoal-pouch') st.swords.forEach(s => { if (!s.charcoal) { s.base += 80; s.charcoal = true; } });
}
