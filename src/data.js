// 铸剑大师 - 静态数据（数值按原作数据库 forgetax.tools 整理）
export const BASE_VALUE = 320;
export const SPECIAL_BASE = 640;
export const FRENZY_CHARGE = 10;
export const FRENZY_TIME = 4.0;
export const STRIKE_INTERVAL = 0.64;
export const RELIC_SLOTS = 8;
export const SWORDS_PER_DAY = 3;
export const RAGE_MAX = 3;
export const CONTRACT_DAYS = 21;
export const RACK_SLOTS = 12;

// 牌堆：破碎 9 / 损伤 2 / 维持 5 / 成功 12 / 大成功 2；破碎堆按等级加权
export const BASE_DECK = { break: 9, damage: 2, hold: 5, success: 12, great: 2 };
const CURVE = [0, 1.8, 5.9, 12.9, 24.8, 29.7, 34.7, 38.3, 41.8, 44.3, 46.7, 49.1, 50.5, 51.9, 53.2, 54.5, 55.8, 57.6, 59.4, 61.2, 63.0, 63.9, 64.8, 65.7, 66.6, 67.5, 68.4, 69.3, 70.2, 71.1, 72.0];
export function breakCurve(level) { return CURVE[Math.max(0, Math.min(30, level))] / 100; }
/** 破碎签的权重倍率：使基础牌堆下破碎率恰好等于曲线值 */
export function breakWeight(level) {
  const p = breakCurve(level);
  if (p <= 0) return 0;
  const others = BASE_DECK.damage + BASE_DECK.hold + BASE_DECK.success + BASE_DECK.great;
  return p / (1 - p) * others / BASE_DECK.break;
}

const QUOTAS = [1800, 2100, 2600, 3350, 4350, 5700, 7500, 9800, 12800, 16700, 21500, 27750, 35700, 45800, 58650, 74650, 94550, 119350, 149950, 186850, 232000];
export function quotaFor(day) {
  if (day <= QUOTAS.length) return QUOTAS[day - 1];
  return Math.round(QUOTAS[QUOTAS.length - 1] * Math.pow(1.2, day - QUOTAS.length));
}
export const isMerchantDay = d => d >= 3 && d % 3 === 0;
export function dateOf(day) { const d = 14 + day; return d <= 30 ? { month: 4, date: d } : { month: 5, date: d - 30 }; }
export const dateStr = day => { const d = dateOf(day); return d.month + '月' + d.date + '日'; };

export const OUTCOMES = {
  break:   { key: 'break',   name: '破坏',   color: '#ef6a5a' },
  damage:  { key: 'damage',  name: '损伤',   color: '#f0a64a' },
  hold:    { key: 'hold',    name: '维持',   color: '#9fd88a' },
  success: { key: 'success', name: '成功',   color: '#8fd3f0' },
  great:   { key: 'great',   name: '大成功', color: '#d79cf5' },
};
export const OUTCOME_ORDER = ['break', 'damage', 'hold', 'success', 'great'];

/* ========================= 剑的形态与进化 ========================= */
// 投放线：A 厚铁 / B 怒铁 / C 魔力；+10 时按线 + 隐藏分支(0/1) 决定家族
export const FAMILIES = {
  citadel: { name: '城塞剑', lane: 'A', branch: 0, forms: [8, 40, 9, 10, 11, 12] },
  holy:    { name: '圣剑',   lane: 'A', branch: 1, forms: [13, 41, 14, 15, 16, 17] },
  saw:     { name: '锯刃',   lane: 'B', branch: 0, forms: [18, 42, 19, 20, 21, 22] },
  dragon:  { name: '龙牙',   lane: 'B', branch: 1, forms: [23, 43, 24, 25, 26, 27] },
  rune:    { name: '符文剑', lane: 'C', branch: 0, forms: [28, 44, 29, 30, 31, 32] },
  split:   { name: '分裂剑', lane: 'C', branch: 1, forms: [33, 45, 34, 35, 36, 37] },
  magma:   { name: '熔岩巨剑', lane: 'A', hidden: true, forms: [60, 61, 62, 63, 64, 65] },
  thunder: { name: '雷霆剑',   lane: 'B', hidden: true, forms: [70, 71, 72, 73, 74, 75] },
  frost:   { name: '冰霜剑',   lane: 'C', hidden: true, forms: [50, 51, 52, 53, 54, 55] },
  tree:    { name: '世界树', special: true, forms: [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110] },
  fish:    { name: '鱼刃',   special: true, forms: [200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210] },
  funeral: { name: '葬仪剑', special: true, forms: [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010] },
  star:    { name: '星辰剑', special: true, forms: [400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410] },
  clock:   { name: '机关剑', special: true, forms: [500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510] },
};
export const LANE_FORMS = { A: [2, 3], B: [4, 5], C: [6, 7] };
export const LANE_NAMES = { A: '厚铁', B: '怒铁', C: '魔力' };

export const FORM_NAMES = {
  1: '旧剑', 38: '精修剑', 39: '还算好用的铁剑',
  2: '厚铁剑', 3: '便携铁门', 4: '愤怒的铁疙瘩', 5: '会咬人的剑', 6: '魔力碎片', 7: '觉醒之剑',
  8: '这把巨剑不太对劲', 40: '双层铁板巨剑', 9: '被扯下门轴的城门', 10: '带把手的要塞', 11: '碾山城塞', 12: '裂陆钢铁城塞',
  13: '光缚银剑', 41: '祝福之刃', 14: '破晓之刃', 15: '贤王之剑', 16: '应许黎明之剑', 17: '王者之剑',
  18: '这是锯还是剑？', 42: '啃甲锯刃', 19: '咬合钢锯刃', 20: '碎钢绞刃', 21: '断山巨锯', 22: '无可阻挡的毁灭齿轮',
  23: '幼龙之牙', 43: '龙鳞之刃', 24: '怒鳞龙刃', 25: '翼龙之刃', 26: '龙王吐息之刃', 27: '魔剑·屠龙者',
  28: '刻符之刃', 44: '觉醒符文剑', 29: '过载之刃', 30: '大法师的奥术引擎', 31: '撕裂现实之剑', 32: '阿卡夏·创世之刃',
  33: '断了也不散的剑', 45: '不想独处的剑', 34: '号令群剑之剑', 35: '厚颜无耻之剑', 36: '千剑之主', 37: '万刃君王',
  100: '枯枝', 101: '意外结实的树枝', 102: '打不断的棍子', 103: '大器晚成的棍子', 104: '萌动之种', 105: '这曾是根树枝', 106: '森林之芽', 107: '千年古树', 108: '涌泉之树', 109: '承载世界之树', 110: '世界树·尤克特拉希尔',
  200: '海带缠着的剑片', 201: '墨鱼骨小刀', 202: '蟹壳锯刃', 203: '冻金枪鱼', 204: '鱼串签', 205: '烤鱼串', 206: '河豚狼牙棒', 207: '珊瑚祭坛之刃', 208: '鲸颚之刃', 209: '克拉肯触手', 210: '利维坦之牙',
  60: '熔岩裂纹巨剑', 61: '流淌的岩浆刃', 62: '火山之心', 63: '炎魔的獠牙', 64: '地核熔炉', 65: '焚世·赤炎王座',
  70: '带电的铁片', 71: '雷鸣锯齿刃', 72: '风暴引雷针', 73: '雷神之锤剑', 74: '天穹裂雷', 75: '万雷·审判之矛',
  50: '结霜的魔刃', 51: '冰晶之刃', 52: '永冻冰棱', 53: '霜巨人的獠牙', 54: '极光冰冠', 55: '绝对零度·寒渊之心',
  400: '陨石碎片', 401: '星砂匕首', 402: '流星短剑', 403: '新月弯刀', 404: '彗尾长剑', 405: '星座之刃', 406: '星云之剑', 407: '双子星环剑', 408: '超新星', 409: '黑洞吞噬者', 410: '银河·万象之刃',
  500: '发条小刀', 501: '齿轮匕首', 502: '弹簧剑', 503: '蒸汽活塞剑', 504: '怀表之刃', 505: '链锯巨剑', 506: '机械臂剑', 507: '钟楼之剑', 508: '蒸汽巨像之刃', 509: '永动机核心', 510: '机神·时间齿轮',
  3000: '生锈的棺材钉', 3001: '裹尸布墓刀', 3002: '掘墓人的铲子', 3003: '断裂墓碑巨剑', 3004: '棺材盖巨剑', 3005: '唤醒亡者之钟', 3006: '游魂火炬', 3007: '守墓人之镰', 3008: '拔起的坟墓', 3009: '亡者墓园', 3010: '冥界之钥',
};

/** 由剑的属性 + 历史最高等级算出形态 id */
export function formOf(sword) {
  const g = Math.max(sword.peak || 0, sword.level || 0);
  if (sword.family && FAMILIES[sword.family] && FAMILIES[sword.family].special) {
    const f = FAMILIES[sword.family].forms;
    return f[Math.min(f.length - 1, Math.floor(g / 2))];
  }
  if (g < 2) return 1;
  if (g < 4) return 38;
  if (g < 6) return 39;
  if (g < 10) return LANE_FORMS[sword.lane || 'A'][g < 8 ? 0 : 1];
  const fam = familyOf(sword);
  const f = FAMILIES[fam].forms;
  return f[Math.min(f.length - 1, Math.floor((g - 10) / 2))];
}
export function familyOf(sword) {
  if (sword.family) return sword.family;
  if (sword.hidden) { for (const k in FAMILIES) { const F = FAMILIES[k]; if (F.hidden && F.lane === sword.lane) return k; } }
  for (const k in FAMILIES) { const F = FAMILIES[k]; if (!F.special && !F.hidden && F.lane === sword.lane && F.branch === sword.branch) return k; }
  return 'citadel';
}
/** 形态所属分组（用于图鉴） */
export const CODEX_GROUPS = [
  { key: 'base', name: '基础', forms: [1, 38, 39] },
  { key: 'lanes', name: '投放线（+6/+8）', forms: [2, 3, 4, 5, 6, 7] },
  ...Object.entries(FAMILIES).map(([k, f]) => ({ key: k, name: f.name + (f.special ? '（幽灵商人）' : f.hidden ? '（隐藏家族）' : ''), forms: f.forms })),
];

/* ========================= 材质品相 ========================= */
// 每把剑送来时随机一种品相：改变外观，并略微提高价值
export const VARIANTS = [
  { id: 'plain',    name: '',     w: 80, mult: 1.0 },
  { id: 'copper',   name: '赤铜', w: 6,  mult: 1.03, color: '#e08a5a' },
  { id: 'frost',    name: '寒铁', w: 4,  mult: 1.06, color: '#8fd8ff' },
  { id: 'jade',     name: '翡翠', w: 3,  mult: 1.06, color: '#7fe0a0' },
  { id: 'obsidian', name: '黑曜', w: 3,  mult: 1.1,  color: '#c9a0ff' },
  { id: 'blood',    name: '血钢', w: 2,  mult: 1.1,  color: '#ff6a5a' },
  { id: 'gold',     name: '鎏金', w: 1.5, mult: 1.15, color: '#ffd36a' },
  { id: 'holy',     name: '圣辉', w: 0.5, mult: 1.25, color: '#fff4c8' },
];
export const VARIANT_MAP = Object.fromEntries(VARIANTS.map(v => [v.id, v]));
export const HIDDEN_CHANCE = 0.16;
/** 剑等级 → 光环档位 */
export const auraTier = lv => lv >= 18 ? 3 : lv >= 14 ? 2 : lv >= 10 ? 1 : 0;

/* ========================= 遗物 ========================= */
// rarity: common 普通 / rare 稀有 / legendary 传说；price = 剑币（剑）；day = 售货机开始出现的日子
// unlock: 需要先达成的成就
const R = (id, name, rarity, price, day, desc, extra) => Object.assign({ id, name, rarity, price, day, desc }, extra || {});
export const RELICS = [
  R('ash-sieve', '灰烬筛', 'common', 1, 2, '剑破碎时，获得 500 金币。'),
  R('bent-nail', '弯钉子', 'common', 1, 2, '成功签 +4。'),
  R('black-knot', '黑结', 'common', 1, 2, '破碎率降低 10%。'),
  R('blunt-mallet', '钝木槌', 'common', 1, 2, '1 张损伤签变为成功签。'),
  R('bound-idol', '缚绳木偶', 'common', 1, 2, '每把剑首次达到 +4、+8、+12……时，剑值 +15%。'),
  R('charcoal-pouch', '木炭袋', 'common', 1, 2, '剑的基础价值 +80 G。'),
  R('first-brand', '初次烙印', 'common', 1, 2, '一把剑的第一锤若为成功或大成功，额外 +2 级。'),
  R('heavy-paperweight', '沉重镇纸', 'common', 1, 2, '每次维持：剑值 +180 G。'),
  R('inspection-stamp', '验讫印章', 'common', 1, 2, '每次成功或大成功：剑值 +100 G。'),
  R('iron-signet', '铁印戒', 'common', 1, 2, '剑值 +15%。'),
  R('leather-loop', '皮绳圈', 'common', 1, 2, '入神外的锻造速度 +20%。'),
  R('lucky-coal', '幸运煤块', 'common', 1, 2, '大成功签 +1。'),
  R('patched-apron', '补过的围裙', 'common', 1, 2, '每次损伤：剑值 +140 G。'),
  R('patient-weight', '耐心秤砣', 'common', 1, 2, '维持签 +3。'),
  R('red-thread', '红线', 'common', 1, 2, '维持后，下一锤的破碎率降低 20%。'),
  R('sealing-stone', '封印石', 'common', 1, 2, '维持签 +2。每连续 2 次维持：+1 级。'),
  R('wax-effigy', '蜡像', 'common', 1, 2, '每连续 2 次相同结果：剑值 +150 G。'),
  R('worn-whetstone', '旧磨刀石', 'common', 1, 2, '2 张维持签变为成功签。'),
  R('undertakers-chalice', '殡葬人的圣杯', 'rare', 1, 2, '剑破碎时，把它最高价值的 30% 作为残骸放上贡台。'),
  R('blind-die', '盲骰', 'common', 1, 3, '损伤或维持后：下一锤大成功签 +3。'),
  R('chained-hourglass', '锁链沙漏', 'common', 1, 3, '入神外每次维持，有 50% 概率 +1 充能。'),
  R('closed-third-eye', '闭合的第三只眼', 'common', 1, 3, '维持后，下一锤成功签 +4。'),
  R('cold-teacup', '凉掉的茶杯', 'common', 1, 3, '每次维持：剑值 +6%。'),
  R('cracked-wristwatch', '裂开的腕表', 'common', 1, 3, '入神外每次损伤 +1 充能。'),
  R('double-knot', '双结', 'common', 1, 3, '每连续 2 次成功/大成功：剑值 +10%。'),
  R('hungry-molar', '饥饿的臼齿', 'common', 1, 3, '+4 以上的剑破碎时，下一把未锻造的 +0 剑永久获得成功签 +4。'),
  R('iron-comb', '铁梳', 'common', 1, 3, '每次损伤：把损伤前等级价值的 5% 加到剑上。'),
  R('iron-hoop', '铁箍', 'common', 1, 3, '破碎签 -2。'),
  R('little-wind-bell', '小风铃', 'common', 1, 3, '每次维持使下一次成功额外 +1 级（最多 +2）。'),
  R('thorn-weight', '荆棘砝码', 'common', 1, 3, '剑值 +10%。2 张维持签变为损伤签。'),
  R('broken-holy-sword', '断裂的圣剑', 'rare', 1, 3, '剑破碎时，把 30% 的强化等级传给下一把未锻造的 +0 剑；继承时 +3 充能。'),
  R('cracked-crown', '裂冠', 'rare', 1, 3, '损伤失去的等级价值保留 50%。'),
  R('cracked-splice', '开裂的接合片', 'rare', 2, 3, '每次损伤使这把剑的破碎率降低 15%（最多 60%）。'),
  R('golden-nail', '金钉', 'rare', 2, 3, '大成功签 +2。'),
  R('grudge-nail', '怨恨之钉', 'rare', 2, 3, '剑破碎时，存下与其等级相同数量的一次性大成功签。'),
  R('mourning-knot', '哀悼结', 'rare', 1, 3, '每次进贡失败，本局永久大成功签 +1。'),
  R('scorched-charm', '焦黑护符', 'rare', 1, 3, '入神外每次成功/大成功使这把剑破碎率降低 3%（最多 18%）。'),
  R('sealed-heart', '封印之心', 'rare', 2, 3, '每次维持使下一次大成功额外 +1 级（最多 +4）。'),
  R('third-hand', '第三只手', 'rare', 2, 3, '每连续 2 次成功/大成功：额外 +1 级。'),
  R('worn-voucher', '旧代金券', 'rare', 2, 3, '每天 1 次免费刷新售货机。'),
  R('collectors-hook', '收藏家的钩子', 'rare', 2, 4, '刷新后，当天第一把未锻造的 +0 剑可以换 2 枚剑币。'),
  R('cracked-bell', '裂铃', 'common', 1, 4, '每次大成功：剑值 +20%。'),
  R('defeated-kings-seal', '败王玉玺', 'rare', 3, 4, '每次损伤使下一次大成功额外 +1 级。'),
  R('ember-locket', '余烬吊坠', 'rare', 2, 4, '每把剑的第一次普通锻造：+2 充能。'),
  R('interlocking-weights', '连环砝码', 'rare', 2, 4, '损伤之后若出现成功/大成功：额外 +2 级。'),
  R('journeyman-badge', '学徒徽章', 'rare', 2, 4, '足额进贡后，第二天送来的剑至少 +2。'),
  R('lightning-mark', '闪电印记', 'rare', 1, 4, '入神外大成功后，下一锤破碎率降低 40%。'),
  R('silver-tuning-fork', '银音叉', 'rare', 2, 4, '入神外每次大成功额外 +1 级。'),
  R('sleeping-ember', '沉睡的余烬', 'rare', 3, 4, '每次维持有 70% 概率 +1 级。'),
  R('soot-censer', '煤灰香炉', 'rare', 2, 4, '结果与上一锤不同时，剑的基础价值 +20 G。'),
  R('unbroken-oath', '不屈誓言', 'rare', 2, 4, '每次损伤有 70% 概率 +1 级。'),
  R('wirebound-scabbard', '铁丝缠鞘', 'rare', 2, 4, '每天第一次破碎变为损伤。'),
  R('worn-grip', '磨旧的握把', 'rare', 2, 4, '锻造速度 +15%。'),
  R('black-iron-stone', '黑铁石', 'rare', 2, 5, '+8 以上时剑值 +30%。'),
  R('bronze-cog', '青铜齿轮', 'rare', 3, 5, '每次成功使这把剑成功签 +1。'),
  R('dragonscale-tongs', '龙鳞火钳', 'rare', 2, 5, '+6 以上时破碎率降低 25%。'),
  R('echo-hammer', '回声锤', 'rare', 2, 5, '每次成功/大成功有 25% 概率额外 +1 级。'),
  R('giants-spine', '巨人脊骨', 'rare', 2, 5, '每 2 次损伤，把下一次破碎变为损伤（最多储存 1 次）。'),
  R('glass-hourglass', '玻璃沙漏', 'rare', 2, 5, '入神期间大成功 +3 级。'),
  R('golden-cog', '金齿轮', 'rare', 2, 5, '每次成功：剑的基础价值 +30 G。'),
  R('ossuary-kings-scabbard', '骨堂王之鞘', 'rare', 3, 5, '+7 以上的剑破碎时，本局永久获得 1 张它上一锤结果的签。'),
  R('sealed-rebate', '密封回扣', 'rare', 2, 5, '贡额降低 10%。'),
  R('smiths-testament', '铁匠遗嘱', 'rare', 2, 5, '用 +10 以上的剑足额进贡后，次日一把新剑以其 30% 的等级开始。'),
  R('tax-tally', '税务计数板', 'rare', 3, 5, '每次足额进贡：+1 枚剑币。'),
  R('bell-collar', '铃铛项圈', 'rare', 2, 6, '入神期间每一锤：剑值 +5%。'),
  R('headless-bell', '无头铃', 'rare', 2, 6, '入神结束时 +1 级。'),
  R('obsidian-eye', '黑曜石之眼', 'rare', 2, 6, '+8 以上时，2 张成功签变为大成功签。'),
  R('red-hourglass', '红沙漏', 'rare', 2, 6, '入神时间 +1 秒。'),
  R('royal-spike', '王家长钉', 'rare', 2, 6, '成功签 +6。'),
  R('silver-supply-writ', '白银供货令', 'rare', 2, 6, '从下次来访起，幽灵商人的基础剑库存 +2。'),
  R('butterfingers', '笨手笨脚', 'legendary', 3, 6, '破碎签 +3。大成功签 +5。', { unlock: 'broken10' }),
  R('dawn-scabbard', '黎明剑鞘', 'legendary', 3, 6, '剑破碎时，把 40% 的强化等级传给下一把未锻造的 +0 剑；继承时 +4 充能。', { unlock: 'm_holy' }),
  R('dragons-pardon', '巨龙的赦免', 'legendary', 4, 6, '免死一次，怒气 -1，然后消失。', { unlock: 'lastchance' }),
  R('kings-empty-cup', '王的空杯', 'legendary', 3, 6, '每次维持使这把剑大成功签 +1。'),
  R('phoenix-ash', '凤凰灰', 'legendary', 3, 6, '每把剑一次：以 40% 剑值为代价阻止破碎。'),
  R('sickle-and-hammer', '镰刀与锤子', 'legendary', 4, 6, '每种结果的基础签数都设为 5。', { unlock: 'clear' }),
  R('split-twin-mirror', '裂开的双子镜', 'legendary', 3, 6, '每连续 2 次相同结果，重复上一次遗物的价值加成。'),
  R('wandering-ghosts-ledger', '游荡幽灵的账簿', 'legendary', 3, 6, '从下次来访起，幽灵商人多带 2 件商品。', { unlock: 'soldout' }),
  R('pocket-hearth', '口袋火炉', 'rare', 3, 7, '本局每次足额进贡，剑的基础价值 +20 G。'),
  R('abyssal-pearl', '深海之珠', 'legendary', 4, 7, '损伤签 +3。每把剑的前 2 次损伤不掉级（损伤遗物照常触发）。', { unlock: 'm_fish' }),
  R('ceaseless-driveshaft', '永动传动轴', 'legendary', 4, 7, '每 2 次成功：额外 +1 级。', { unlock: 'm_saw' }),
  R('eternal-seed', '永恒之种', 'legendary', 4, 7, '维持签 +6。每次维持：剑的基础价值 +40 G。', { unlock: 'm_tree' }),
  R('perfect-mana-core', '完美魔核', 'legendary', 4, 7, '入神期间大成功签 +6。', { unlock: 'm_rune' }),
  R('possessed-bellows', '附魔风箱', 'legendary', 3, 7, '入神期间锻造速度 +30%。'),
  R('royal-change', '王室找零', 'legendary', 4, 7, '超额进贡的 30% 抵扣下一天的贡额（最多抵扣 30%）。', { unlock: 'triple' }),
  R('unyielding-cornerstone', '不屈基石', 'legendary', 4, 7, '每把剑的第一次破碎变为损伤。', { unlock: 'm_citadel' }),
  R('supply-permit', '供货许可', 'legendary', 4, 8, '从下一天起，每天多送 1 把剑。'),
  R('dragon-heart', '龙之心', 'legendary', 4, 8, '+7 以上时，每次成功/大成功：剑值 +15%。', { unlock: 'm_dragon' }),
  R('seal-of-twins', '双子印', 'legendary', 4, 8, '每次没碎的锻造有 2% 概率复制这把剑。', { unlock: 'm_split' }),
  R('undertakers-ledger', '殡葬人的账簿', 'legendary', 4, 8, '+7 以上的剑破碎时，次日多送 1 把剑（每天最多 2）。', { unlock: 'm_funeral' }),
  R('undying-wick', '不灭灯芯', 'legendary', 4, 8, '入神时间 +2 秒。', { unlock: 'frenzy5' }),
  R('dragon-signet', '龙纹印戒', 'legendary', 3, 9, '+12 以上时剑值 +50%。'),
  R('oracle-die', '神谕骰', 'legendary', 3, 9, '大成功签 +4。'),
  R('lifetime-contract', '终身契约', 'legendary', 5, 10, '送来的剑从 +7 开始，并且不再需要加热。', { unlock: 'overtime3' }),
];
export const RELIC_MAP = Object.fromEntries(RELICS.map(r => [r.id, r]));
export const RARITY = { common: { name: '普通', color: '#ebc270' }, rare: { name: '稀有', color: '#bfd9c7' }, legendary: { name: '传说', color: '#e0b3fa' } };
// 售货机稀有度权重（普通/稀有/传说）
export function shopOdds(day) {
  if (day <= 3) return [85, 15, 0];
  if (day <= 5) return [75, 25, 0];
  if (day === 6) return [70, 25, 5];
  if (day <= 8) return [60, 35, 5];
  if (day <= 12) return [53, 35, 12];
  if (day <= 16) return [36, 42, 22];
  return [28, 42, 30];
}

/* ========================= 消耗品（幽灵商人） ========================= */
// k = 价格占当日贡额的比例；minDay = 最早出现的商人日
export const CONSUMABLES = [
  { id: 'ward', name: '裂开的龙鳞', k: 0.423, min: 1100, minDay: 3, stock: 3, use: true, desc: '按 Q 使用：阻止下一锤的破碎。无论结果如何都会消耗。' },
  { id: 'rewind', name: '悔恨发条', k: 1.53, min: 3980, minDay: 3, stock: 1, use: 'R', desc: '离开铁砧前按 R：撤销上一锤，即使剑已经碎了。' },
  { id: 'chalk', name: '红粉笔', k: 0.561, min: 3200, minDay: 6, stock: 3, use: true, desc: '按 Q 使用：下一锤大成功签翻倍。' },
  { id: 'powder', name: '火药包', k: 0.9, min: 5130, minDay: 6, stock: 1, use: true, legendary: true, desc: '按 Q 使用：下一次普通锻造中，成功和大成功都变成大成功，其余结果都变成破碎。' },
  { id: 'starshard', name: '冷星碎片', k: 0.7, min: 3990, minDay: 6, stock: 3, use: true, desc: '按 Q 使用：+3 充能。入神中不能使用。' },
  { id: 'oblivion', name: '遗忘之香', k: 2.16, min: 27650, minDay: 9, stock: 1, instant: true, legendary: true, desc: '购买即生效：巨龙怒气降低一级。每局一次，仅在有进贡失败时出售。' },
  { id: 'delivery', name: '幽灵送货单', k: 0.91, min: 5190, minDay: 6, stock: 3, instant: true, desc: '购买即生效：下一次送货多 2 把基础剑。' },
];
export const CONS_MAP = Object.fromEntries(CONSUMABLES.map(c => [c.id, c]));

/* ========================= 成就 ========================= */
export const ACHIEVEMENTS = [
  { id: 'm_citadel', name: '城塞剑精通', desc: '把一把城塞剑锻造到 +20。', relic: 'unyielding-cornerstone' },
  { id: 'm_holy', name: '圣剑精通', desc: '把一把圣剑锻造到 +20。', relic: 'dawn-scabbard' },
  { id: 'm_saw', name: '锯刃精通', desc: '把一把锯刃锻造到 +20。', relic: 'ceaseless-driveshaft' },
  { id: 'm_dragon', name: '龙牙精通', desc: '把一把龙牙锻造到 +20。', relic: 'dragon-heart' },
  { id: 'm_rune', name: '符文剑精通', desc: '把一把符文剑锻造到 +20。', relic: 'perfect-mana-core' },
  { id: 'm_split', name: '分裂剑精通', desc: '把一把分裂剑锻造到 +20。', relic: 'seal-of-twins' },
  { id: 'm_tree', name: '世界树精通', desc: '把一把世界树剑锻造到 +20。', relic: 'eternal-seed' },
  { id: 'm_fish', name: '鱼刃精通', desc: '把一把鱼刃锻造到 +20。', relic: 'abyssal-pearl' },
  { id: 'm_funeral', name: '葬仪剑精通', desc: '把一把葬仪剑锻造到 +20。', relic: 'undertakers-ledger' },
  { id: 'm_magma', name: '熔岩巨剑精通', desc: '把一把熔岩巨剑锻造到 +20。' },
  { id: 'm_thunder', name: '雷霆剑精通', desc: '把一把雷霆剑锻造到 +20。' },
  { id: 'm_frost', name: '冰霜剑精通', desc: '把一把冰霜剑锻造到 +20。' },
  { id: 'm_star', name: '星辰剑精通', desc: '把一把星辰剑锻造到 +20。' },
  { id: 'm_clock', name: '机关剑精通', desc: '把一把机关剑锻造到 +20。' },
  { id: 'hidden', name: '不对劲的那一把', desc: '第一次让一把剑进入隐藏家族。' },
  { id: 'holy_v', name: '圣光普照', desc: '得到一把圣辉品相的剑。' },
  { id: 'clear', name: '下班打卡', desc: '撑到 5 月 5 日，完成契约。', relic: 'sickle-and-hammer' },
  { id: 'broken10', name: '笨手笨脚', desc: '一局中敲碎 10 把剑。', relic: 'butterfingers' },
  { id: 'frenzy5', name: '锤不停歇', desc: '一局中进入 5 次入神。', relic: 'undying-wick' },
  { id: 'triple', name: '不用找了', desc: '一次进贡达到贡额的 3 倍。', relic: 'royal-change' },
  { id: 'lastchance', name: '最后的机会', desc: '在怒气最后一级时足额进贡。', relic: 'dragons-pardon' },
  { id: 'soldout', name: '全都要了', desc: '买空幽灵商人一次来访的全部商品。', relic: 'wandering-ghosts-ledger' },
  { id: 'overtime3', name: '终身饭碗', desc: '完成契约后再足额进贡 3 次。', relic: 'lifetime-contract' },
  { id: 'first10', name: '再敲一下？', desc: '第一次把剑锻造到 +10。' },
  { id: 'firstdeath', name: '诚聘铁匠', desc: '第一次死于巨龙之口。' },
  { id: 'firstfrenzy', name: '锤子时间', desc: '第一次进入入神。' },
];
export const ACH_MAP = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

/* ========================= 新手引导台词（巨龙） ========================= */
export const TUTORIAL = [
  { key: 'pick', say: '小铁匠，听好了。先拿起一把剑。', hint: '从送货口旁的剑架拿一把剑（对准剑按 E）', target: 'rack' },
  { key: 'heat', say: '先把它烧热。', hint: '走到西墙的熔炉，按 E 加热', target: 'furnace' },
  { key: 'anvil', say: '烧热了就放上铁砧。', hint: '对准铁砧按 E', target: 'anvil' },
  { key: 'strike', say: '敲。面板会告诉你下一锤的结果概率。', hint: '左键敲击。看清面板上的五种结果', target: 'anvil' },
  { key: 'frenzy', say: '在同一把剑上积满十格。下一锤就会进入入神。', hint: '入神中 4 秒内不会破碎，尽情挥锤', target: 'anvil' },
  { key: 'offer', say: '把剑放到贡台上。我不在乎你献上几把剑，只看总价值。', hint: '拿着剑（铁砧前按 E）走到北面贡台，按 E 放上', target: 'altar' },
  { key: 'bell', say: '然后敲铃。我的耐心在第三次失败时耗尽。', hint: '贡品足额后，对准铃铛按 E', target: 'bell' },
  { key: 'vend', say: '用不上的剑，可以喂给那台机器。在那里，每把剑的价值都一样。', hint: '第一天售货机里的遗物免费，选一件吧', target: 'vend' },
  { key: 'spare', say: '要是紧张，就在架子上留几把备用剑。', hint: '没放上贡台的剑会留到明天', target: 'rack' },
];
