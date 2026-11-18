/* 铸剑大师 - 静态数据：遗物、消耗品、剑名、概率曲线、贡额 */
(function (G) {
  'use strict';

  const D = {};

  D.BASE_VALUE = 320;            // 普通新剑基础价值
  D.CONTRACT_DAYS = 21;          // 契约天数
  D.BASE_RAGE_MAX = 3;           // 第三次欠贡结束契约
  D.FRENZY_CHARGE = 10;          // 充能满 10 进入入神
  D.FRENZY_TIME = 4.0;           // 入神基础时长（秒）
  D.RELIC_SLOTS = 8;
  D.DAILY_SWORDS = 3;

  // 基础签数：损伤 4 / 维持 10 / 成功 24 / 大成功 6 （= 9.1% / 22.7% / 54.6% / 13.6%）
  D.BASE_LOTS = { damage: 4, hold: 10, success: 24, great: 6 };

  // 未修正破碎率曲线（%）
  const BREAK_TABLE = [0, 2.5, 5.9, 15.5, 24.8, 29.7, 33.4, 36.8, 40.2, 43.5, 46.7];
  D.baseBreak = function (level) {
    if (level <= 10) return BREAK_TABLE[Math.max(0, level)] / 100;
    return Math.min(70, 46.7 + 1.6 * (level - 10)) / 100;
  };

  // 每日贡额：第 1 天 1,800 G，第 21 天约 232,000 G，之后无尽模式继续增长
  D.quota = function (day) {
    if (day <= D.CONTRACT_DAYS) return Math.round(1800 * Math.pow(1.2749, day - 1) / 10) * 10;
    const d21 = 1800 * Math.pow(1.2749, D.CONTRACT_DAYS - 1);
    return Math.round(d21 * Math.pow(1.32, day - D.CONTRACT_DAYS) / 10) * 10;
  };

  D.OUTCOMES = {
    break:   { key: 'break',   name: '破坏',   color: '#e2504a' },
    damage:  { key: 'damage',  name: '损伤',   color: '#e8973f' },
    hold:    { key: 'hold',    name: '维持',   color: '#7fc46a' },
    success: { key: 'success', name: '成功',   color: '#f0b6a0' },
    great:   { key: 'great',   name: '大成功', color: '#c98cf0' },
  };
  D.OUTCOME_ORDER = ['break', 'damage', 'hold', 'success', 'great'];

  // 剑名随强化等级变化
  const NAMES = [
    '旧剑', '磨过的旧剑', '精修剑', '还算好用的铁剑', '锋利的铁剑',
    '厚铁剑', '沉甸甸的厚铁剑', '便携铁门', '加固的便携铁门', '不太对劲的铁板巨剑',
    '断了也不散的剑', '会发光的铁块', '魔力碎片之剑', '屠龙预备役', '传说中的那把剑',
    '神匠之作', '天外陨铁', '让巨龙闭嘴的剑', '神剑·铸剑大师', '无法直视的光',
  ];
  D.swordName = function (level) {
    if (level < NAMES.length) return NAMES[level];
    return '无法直视的光 ' + '★'.repeat(Math.min(5, level - NAMES.length + 1));
  };

  /* ---------------- 遗物 ----------------
   * tag: damage(损伤流) / general / frenzy / economy / guard
   * unlock: 需要达成条件才会进入商店（局外解锁）
   */
  D.RELICS = [
    // —— 损伤流 ——
    { id: 'apron',  name: '补过的围裙', icon: '🧵', price: 2, tag: 'damage', desc: '每次损伤，剑值 +140 G。' },
    { id: 'splice', name: '开裂的接合片', icon: '🔩', price: 2, tag: 'damage', desc: '每次损伤，该剑破碎率降低 15%（相对值，最多 60%）。' },
    { id: 'oath',   name: '不屈誓言', icon: '📜', price: 3, tag: 'damage', desc: '每次损伤，有 70% 概率获得 +1 级。' },
    { id: 'seal',   name: '败王玉玺', icon: '🗿', price: 3, tag: 'damage', desc: '每次损伤，为下一次大成功积存额外 +1 级。' },
    { id: 'spine',  name: '巨人脊骨', icon: '🦴', price: 3, tag: 'guard',  desc: '每两次损伤准备一次保护：下一次破碎转为损伤（最多储存 1 次，保护产生的损伤不计数）。' },
    { id: 'crown',  name: '裂冠', icon: '👑', price: 2, tag: 'damage', desc: '损伤掉级时，保留失去的强化价值的 50%（转为固定价值）。' },
    { id: 'thorn',  name: '荆棘砝码', icon: '🪨', price: 2, tag: 'damage', desc: '所有剑值 +10%；两张「维持」签变为「损伤」签。' },
    { id: 'pearl',  name: '深海之珠', icon: '🦪', price: 4, tag: 'damage', desc: '损伤签 +3；每把剑的前两次损伤不掉级（仍触发损伤效果）。', unlock: 'level12' },
    { id: 'clumsy', name: '笨手笨脚', icon: '🧤', price: 1, tag: 'damage', desc: '损伤签 +2；每次损伤额外获得 +1 充能。', unlock: 'firstBreak' },
    // —— 通用 ——
    { id: 'horseshoe', name: '幸运马蹄铁', icon: '🧲', price: 2, tag: 'general', desc: '大成功签 +2。' },
    { id: 'glove',  name: '老铁匠的手套', icon: '✋', price: 1, tag: 'general', desc: '成功签 +3。' },
    { id: 'whet',   name: '磨刀石', icon: '🔪', price: 1, tag: 'economy', desc: '每次成功，剑值额外 +60 G。' },
    { id: 'steady', name: '稳重之手', icon: '🖐️', price: 3, tag: 'guard', desc: '破碎率降低 10%（相对值）。' },
    { id: 'calm',   name: '冷静的呼吸', icon: '🌬️', price: 2, tag: 'general', desc: '维持时，额外 +1 充能，且剑值 +5%。' },
    { id: 'dice',   name: '赌徒骰子', icon: '🎲', price: 2, tag: 'general', desc: '大成功的剑值倍率由 2.5 倍变为 3.5 倍；破碎率提高 10%（相对值）。', unlock: 'doubleGreat' },
    // —— 入神 ——
    { id: 'ember',  name: '炉心余烬', icon: '🔥', price: 3, tag: 'frenzy', desc: '入神外每次挥锤，额外 +1 充能。' },
    { id: 'hourglass', name: '流沙漏', icon: '⏳', price: 2, tag: 'frenzy', desc: '入神时长 +2 秒。' },
    { id: 'idol',   name: '龙鳞护符', icon: '🐉', price: 3, tag: 'frenzy', desc: '入神期间每次成功或大成功，剑值额外 +10%。', unlock: 'firstFrenzy' },
    { id: 'moon',   name: '新月磁石', icon: '🌙', price: 2, tag: 'frenzy', desc: '大成功时，额外 +2 充能。' },
    // —— 经济 / 继承 ——
    { id: 'miser',  name: '守财奴的秤', icon: '💰', price: 3, tag: 'economy', desc: '贡台结算时，剑值视为 +15%。' },
    { id: 'legacy', name: '断剑传承', icon: '🗡️', price: 3, tag: 'guard', desc: '剑破碎时，下一把放上铁砧的 +0 剑继承其一半的强化等级。' },
    { id: 'scrap',  name: '碎片收集者', icon: '🧺', price: 1, tag: 'economy', desc: '剑破碎时，获得其剑值 20% 的金币。' },
    { id: 'twin',   name: '双子铁砧', icon: '⚒️', price: 4, tag: 'economy', desc: '每天额外获得 1 把基础剑。' },
    { id: 'bell',   name: '和平铃铛', icon: '🔔', price: 3, tag: 'guard', desc: '巨龙的怒气上限 +1。', unlock: 'firstFail' },
  ];
  D.RELIC_MAP = {};
  D.RELICS.forEach(r => { D.RELIC_MAP[r.id] = r; });

  D.UNLOCKS = {
    firstBreak:  { relic: 'clumsy', text: '第一次把剑敲碎' },
    level12:     { relic: 'pearl',  text: '将一把剑强化到 +12' },
    doubleGreat: { relic: 'dice',   text: '同一把剑连续两次大成功' },
    firstFrenzy: { relic: 'idol',   text: '第一次进入入神' },
    firstFail:   { relic: 'bell',   text: '第一次未能交足贡品' },
  };

  /* ---------------- 消耗品（幽灵商人，用金币购买） ---------------- */
  D.CONSUMABLES = [
    { id: 'scale',  name: '裂开的龙鳞', icon: '🛡️', price: 600,  desc: '抵挡下一次锤击的破坏。无论结果如何都会消耗。' },
    { id: 'oil',    name: '淬火油',     icon: '🛢️', price: 500,  desc: '下一锤的大成功签 ×3。无论结果如何都会消耗。' },
    { id: 'incense',name: '入神香',     icon: '🕯️', price: 700,  desc: '立即使铁砧上的剑充能满格。' },
    { id: 'sword',  name: '一把旧剑',   icon: '⚔️', price: 450,  desc: '获得一把 +0 的基础剑。', instant: true },
    { id: 'pardon', name: '巨龙赦免令', icon: '📯', price: 2500, desc: '巨龙怒气 -1。', instant: true },
  ];
  D.CONS_MAP = {};
  D.CONSUMABLES.forEach(c => { D.CONS_MAP[c.id] = c; });

  D.priceScale = function (day) { return 1 + 0.35 * (day - 1); };
  D.isMerchantDay = function (day) { return day >= 3 && day % 3 === 0; };

  G.DATA = D;
})(typeof window !== 'undefined' ? window : globalThis);
