/* 铸剑大师 - 核心规则（不依赖 DOM，可在 Node 中测试） */
(function (G) {
  'use strict';
  const D = G.DATA;

  let rand = Math.random;
  let uid = 1;

  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function newSword(level) {
    return {
      id: 's' + (Date.now() % 100000) + '_' + (uid++),
      level: level || 0,
      mult: Math.pow(1.5, level || 0),
      flat: 0,
      heated: false,
      charge: 0,
      place: 'rack',          // rack / anvil / altar
      dmgCount: 0,
      spliceStacks: 0,
      pearlUsed: 0,
      sealStacks: 0,
      spineCount: 0,
      spineReady: false,
      greatStreak: 0,
      hammers: 0,
    };
  }

  const Game = {};

  Game.setRandom = function (fn) { rand = fn; };

  Game.has = function (st, id) { return st.relics.indexOf(id) >= 0; };

  Game.isUnlocked = function (meta, relic) {
    return !relic.unlock || !!(meta && meta.unlocked && meta.unlocked[relic.unlock]);
  };

  Game.rageMax = function (st) { return D.BASE_RAGE_MAX + (Game.has(st, 'bell') ? 1 : 0); };

  Game.newRun = function (meta) {
    const st = {
      version: 1,
      day: 1,
      gold: 300,
      coins: 0,
      rage: 0,
      swords: [],
      relics: [],
      consumables: {},
      active: { scale: false, oil: false },
      shop: null,
      merchant: null,
      pendingLegacy: 0,
      frenzy: { active: false, timeLeft: 0, swordId: null },
      stats: { hammers: 0, breaks: 0, greats: 0, maxLevel: 0, maxValue: 0, tributeTotal: 0, frenzies: 0 },
      history: [],
      over: null,
      endless: false,
      starterChoices: [],
      lastResult: null,
    };
    for (let i = 0; i < D.DAILY_SWORDS; i++) st.swords.push(newSword(0));
    const pool = D.RELICS.filter(r => Game.isUnlocked(meta, r) && r.price <= 3);
    st.starterChoices = shuffle(pool).slice(0, 3).map(r => r.id);
    Game.rollShop(st, meta);
    return st;
  };

  Game.chooseStarter = function (st, id) {
    if (st.starterChoices.indexOf(id) < 0) return false;
    st.relics.push(id);
    st.starterChoices = [];
    if (st.shop) st.shop.items = st.shop.items.filter(it => it.id !== id);
    return true;
  };

  /* ---------- 剑值 ---------- */
  Game.value = function (st, s) {
    let v = D.BASE_VALUE * s.mult + s.flat;
    if (Game.has(st, 'thorn')) v *= 1.1;
    return Math.max(0, Math.round(v));
  };

  Game.anvilSword = function (st) { return st.swords.find(s => s.place === 'anvil') || null; };

  /* ---------- 概率 ---------- */
  Game.breakChance = function (st, s, frenzy) {
    if (frenzy) return 0;
    let pb = D.baseBreak(s.level);
    if (Game.has(st, 'steady')) pb *= 0.9;
    if (Game.has(st, 'splice')) pb *= 1 - Math.min(0.6, 0.15 * s.spliceStacks);
    if (Game.has(st, 'dice')) pb *= 1.1;
    return Math.min(0.95, pb);
  };

  Game.lots = function (st) {
    const l = Object.assign({}, D.BASE_LOTS);
    if (Game.has(st, 'thorn')) { l.hold -= 2; l.damage += 2; }
    if (Game.has(st, 'pearl')) l.damage += 3;
    if (Game.has(st, 'clumsy')) l.damage += 2;
    if (Game.has(st, 'glove')) l.success += 3;
    if (Game.has(st, 'horseshoe')) l.great += 2;
    if (st.active.oil) l.great *= 3;
    return l;
  };

  Game.isFrenzyFor = function (st, s) {
    return !!(s && st.frenzy.active && st.frenzy.swordId === s.id);
  };

  /** 返回下一锤的五种结果概率（0-1） */
  Game.probs = function (st, s, opts) {
    if (!s) return null;
    const frenzy = (opts && opts.frenzy !== undefined) ? opts.frenzy
      : (Game.isFrenzyFor(st, s) || s.charge >= D.FRENZY_CHARGE);
    const pb = Game.breakChance(st, s, frenzy);
    const l = Game.lots(st);
    const sum = l.damage + l.hold + l.success + l.great;
    const rest = 1 - pb;
    return {
      break: pb,
      damage: l.damage / sum * rest,
      hold: l.hold / sum * rest,
      success: l.success / sum * rest,
      great: l.great / sum * rest,
    };
  };

  function roll(p) {
    let r = rand();
    for (const k of D.OUTCOME_ORDER) {
      if (r < p[k]) return k;
      r -= p[k];
    }
    return 'success';
  }

  function unlock(st, events, key) {
    events.push({ type: 'unlockCheck', key: key });
  }

  function addCharge(st, s, n, frenzy) {
    if (frenzy) return;
    s.charge = Math.min(D.FRENZY_CHARGE, s.charge + n);
  }

  function applyDamage(st, s, fromProtection, frenzy, events) {
    s.dmgCount++;
    let drop = s.level > 0;
    if (Game.has(st, 'pearl') && s.pearlUsed < 2) {
      s.pearlUsed++;
      if (drop) events.push({ type: 'relic', id: 'pearl', text: '深海之珠：本次不掉级' });
      drop = false;
    }
    if (drop) {
      const old = s.mult;
      s.mult /= 1.5;
      s.level -= 1;
      if (Game.has(st, 'crown')) {
        const kept = 0.5 * D.BASE_VALUE * (old - s.mult);
        s.flat += kept;
        events.push({ type: 'relic', id: 'crown', text: '裂冠：保留 ' + Math.round(kept) + ' G' });
      }
    }
    if (Game.has(st, 'apron')) { s.flat += 140; events.push({ type: 'relic', id: 'apron', text: '围裙 +140 G' }); }
    if (Game.has(st, 'splice') && s.spliceStacks < 4) { s.spliceStacks++; events.push({ type: 'relic', id: 'splice', text: '接合片：破碎率 -' + (s.spliceStacks * 15) + '%' }); }
    if (Game.has(st, 'seal')) { s.sealStacks++; events.push({ type: 'relic', id: 'seal', text: '玉玺积存 ' + s.sealStacks + ' 级' }); }
    if (Game.has(st, 'spine') && !fromProtection) {
      s.spineCount++;
      if (s.spineCount >= 2 && !s.spineReady) {
        s.spineReady = true; s.spineCount = 0;
        events.push({ type: 'relic', id: 'spine', text: '巨人脊骨：保护已就绪' });
      }
    }
    if (Game.has(st, 'oath') && rand() < 0.7) {
      s.level += 1; s.mult *= 1.5;
      events.push({ type: 'relic', id: 'oath', text: '不屈誓言：+1 级' });
    }
    if (Game.has(st, 'clumsy')) addCharge(st, s, 1, frenzy);
  }

  /**
   * 挥一锤。返回结果对象，失败时返回 { error }
   */
  Game.hammer = function (st) {
    const s = Game.anvilSword(st);
    if (st.over) return { error: '游戏已结束' };
    if (!s) return { error: '铁砧上没有剑' };
    if (!s.heated) return { error: '剑还是冷的，先加热（F）' };

    const events = [];
    let frenzy = Game.isFrenzyFor(st, s);
    let frenzyStarted = false;
    if (!frenzy && s.charge >= D.FRENZY_CHARGE) {
      st.frenzy = { active: true, timeLeft: D.FRENZY_TIME + (Game.has(st, 'hourglass') ? 2 : 0), swordId: s.id };
      s.charge = 0;
      frenzy = true;
      frenzyStarted = true;
      st.stats.frenzies++;
      unlock(st, events, 'firstFrenzy');
    }

    const p = Game.probs(st, s, { frenzy: frenzy });
    let outcome = roll(p);
    let fromProtection = false;

    if (outcome === 'break') {
      if (st.active.scale) {
        outcome = 'hold';
        events.push({ type: 'cons', id: 'scale', text: '龙鳞挡下了破坏！' });
      } else if (Game.has(st, 'spine') && s.spineReady) {
        s.spineReady = false;
        outcome = 'damage';
        fromProtection = true;
        events.push({ type: 'relic', id: 'spine', text: '巨人脊骨：破碎转为损伤' });
      }
    }
    if (st.active.scale) { st.active.scale = false; events.push({ type: 'consUsed', id: 'scale' }); }
    if (st.active.oil) { st.active.oil = false; events.push({ type: 'consUsed', id: 'oil' }); }

    const before = Game.value(st, s);
    const levelBefore = s.level;
    s.hammers++;
    st.stats.hammers++;

    let broke = false;
    switch (outcome) {
      case 'break': {
        broke = true;
        st.stats.breaks++;
        st.swords = st.swords.filter(x => x !== s);
        if (Game.has(st, 'legacy') && s.level >= 2) {
          st.pendingLegacy = Math.max(st.pendingLegacy, Math.floor(s.level / 2));
          events.push({ type: 'relic', id: 'legacy', text: '断剑传承：下一把剑将继承 +' + st.pendingLegacy });
        }
        if (Game.has(st, 'scrap')) {
          const g = Math.round(before * 0.2);
          st.gold += g;
          events.push({ type: 'relic', id: 'scrap', text: '碎片收集者 +' + g + ' 金币' });
        }
        if (st.frenzy.swordId === s.id) st.frenzy = { active: false, timeLeft: 0, swordId: null };
        unlock(st, events, 'firstBreak');
        break;
      }
      case 'damage':
        applyDamage(st, s, fromProtection, frenzy, events);
        s.greatStreak = 0;
        break;
      case 'hold':
        if (Game.has(st, 'calm')) {
          s.mult *= 1.05;
          addCharge(st, s, 1, frenzy);
          events.push({ type: 'relic', id: 'calm', text: '冷静的呼吸 +5%' });
        }
        s.greatStreak = 0;
        break;
      case 'success':
        s.level += 1;
        s.mult *= 1.5;
        if (Game.has(st, 'whet')) s.flat += 60;
        if (frenzy && Game.has(st, 'idol')) s.mult *= 1.1;
        s.greatStreak = 0;
        break;
      case 'great': {
        const extra = Game.has(st, 'seal') ? s.sealStacks : 0;
        if (extra > 0) events.push({ type: 'relic', id: 'seal', text: '败王玉玺兑现 +' + extra + ' 级' });
        s.level += 2 + extra;
        s.mult *= (Game.has(st, 'dice') ? 3.5 : 2.5) * Math.pow(1.5, extra);
        s.sealStacks = 0;
        if (Game.has(st, 'moon')) addCharge(st, s, 2, frenzy);
        if (frenzy && Game.has(st, 'idol')) s.mult *= 1.1;
        s.greatStreak++;
        st.stats.greats++;
        if (s.greatStreak >= 2) unlock(st, events, 'doubleGreat');
        break;
      }
    }

    if (!broke) {
      addCharge(st, s, 1 + (Game.has(st, 'ember') ? 1 : 0), frenzy);
      st.stats.maxLevel = Math.max(st.stats.maxLevel, s.level);
      if (s.level >= 12) unlock(st, events, 'level12');
    }
    const after = broke ? 0 : Game.value(st, s);
    st.stats.maxValue = Math.max(st.stats.maxValue, after);

    const res = {
      outcome: outcome,
      probs: p,
      swordId: s.id,
      levelBefore: levelBefore,
      levelAfter: broke ? levelBefore : s.level,
      levelDelta: broke ? 0 : s.level - levelBefore,
      before: before,
      after: after,
      delta: after - before,
      ratio: before > 0 ? after / before : 1,
      broke: broke,
      frenzy: frenzy,
      frenzyStarted: frenzyStarted,
      chargeFull: !broke && !frenzy && s.charge >= D.FRENZY_CHARGE,
      events: events,
    };
    st.lastResult = { outcome: outcome, levelDelta: res.levelDelta, delta: res.delta, ratio: res.ratio, swordId: s.id };
    return res;
  };

  Game.tick = function (st, dt) {
    if (!st.frenzy.active) return false;
    st.frenzy.timeLeft -= dt;
    if (st.frenzy.timeLeft <= 0) {
      st.frenzy = { active: false, timeLeft: 0, swordId: null };
      return true; // 入神结束
    }
    return false;
  };

  /* ---------- 剑的移动 ---------- */
  Game.placeOnAnvil = function (st, id) {
    const s = st.swords.find(x => x.id === id);
    if (!s) return { error: '没有这把剑' };
    const cur = Game.anvilSword(st);
    if (cur && cur !== s) {
      if (Game.isFrenzyFor(st, cur)) return { error: '入神中，无法换剑' };
      cur.place = 'rack';
    }
    s.place = 'anvil';
    const out = {};
    if (st.pendingLegacy > 0 && s.level === 0 && s.hammers === 0) {
      s.level = st.pendingLegacy;
      s.mult = Math.pow(1.5, s.level);
      out.legacy = st.pendingLegacy;
      st.pendingLegacy = 0;
    }
    return out;
  };

  Game.takeOffAnvil = function (st) {
    const s = Game.anvilSword(st);
    if (!s) return { error: '铁砧上没有剑' };
    if (Game.isFrenzyFor(st, s)) st.frenzy = { active: false, timeLeft: 0, swordId: null };
    s.place = 'rack';
    return {};
  };

  Game.heat = function (st) {
    const s = Game.anvilSword(st);
    if (!s) return { error: '铁砧上没有剑' };
    s.heated = true;
    return {};
  };

  Game.toggleAltar = function (st, id) {
    const s = st.swords.find(x => x.id === id);
    if (!s) return { error: '没有这把剑' };
    if (s.place === 'altar') { s.place = 'rack'; return { placed: false }; }
    if (s.place === 'anvil') {
      if (Game.isFrenzyFor(st, s)) return { error: '入神中，无法移动' };
    }
    s.place = 'altar';
    return { placed: true };
  };

  Game.altarSwords = function (st) { return st.swords.filter(s => s.place === 'altar'); };

  Game.altarTotal = function (st) {
    let t = Game.altarSwords(st).reduce((a, s) => a + Game.value(st, s), 0);
    if (Game.has(st, 'miser')) t = Math.round(t * 1.15);
    return t;
  };

  /* ---------- 遗物售卖机（剑币） ---------- */
  Game.sellSword = function (st, id) {
    const s = st.swords.find(x => x.id === id);
    if (!s) return { error: '没有这把剑' };
    if (Game.isFrenzyFor(st, s)) return { error: '入神中，无法投入' };
    st.swords = st.swords.filter(x => x !== s);
    st.coins += 1;
    return { coins: 1 };
  };

  Game.refreshCost = function (st) {
    const n = st.shop ? st.shop.refreshes : 0;
    return Math.round(80 * (n + 1) * (1 + 0.25 * (st.day - 1)) / 10) * 10;
  };

  Game.rollShop = function (st, meta) {
    const pool = D.RELICS.filter(r => Game.isUnlocked(meta, r) && st.relics.indexOf(r.id) < 0);
    const items = shuffle(pool).slice(0, 3).map(r => ({ id: r.id, price: r.price, sold: false }));
    st.shop = { items: items, refreshes: st.shop && st.shop.day === st.day ? st.shop.refreshes : 0, day: st.day };
  };

  Game.refreshShop = function (st, meta) {
    const cost = Game.refreshCost(st);
    if (st.gold < cost) return { error: '金币不足' };
    st.gold -= cost;
    const n = st.shop.refreshes + 1;
    Game.rollShop(st, meta);
    st.shop.refreshes = n;
    return { cost: cost };
  };

  Game.buyRelic = function (st, idx, replaceId) {
    const it = st.shop && st.shop.items[idx];
    if (!it || it.sold) return { error: '已售出' };
    if (st.coins < it.price) return { error: '剑币不足（把剑投入售卖机换取剑币）' };
    if (st.relics.length >= D.RELIC_SLOTS) {
      if (!replaceId || st.relics.indexOf(replaceId) < 0) return { error: '遗物栏已满', needReplace: true };
      st.relics = st.relics.filter(r => r !== replaceId);
    }
    st.coins -= it.price;
    it.sold = true;
    st.relics.push(it.id);
    return { id: it.id };
  };

  Game.discardRelic = function (st, id) {
    st.relics = st.relics.filter(r => r !== id);
  };

  /* ---------- 幽灵商人（金币） ---------- */
  Game.rollMerchant = function (st) {
    if (!D.isMerchantDay(st.day)) { st.merchant = null; return; }
    const sc = D.priceScale(st.day);
    st.merchant = {
      day: st.day,
      items: D.CONSUMABLES.map(c => ({
        id: c.id,
        price: Math.round(c.price * sc / 10) * 10,
        stock: c.id === 'pardon' ? 1 : 1 + Math.floor(rand() * 2),
      })),
    };
  };

  Game.buyConsumable = function (st, idx) {
    const it = st.merchant && st.merchant.items[idx];
    if (!it || it.stock <= 0) return { error: '售罄' };
    if (st.gold < it.price) return { error: '金币不足' };
    const c = D.CONS_MAP[it.id];
    if (it.id === 'pardon' && st.rage <= 0) return { error: '巨龙现在并不生气' };
    st.gold -= it.price;
    it.stock--;
    if (it.id === 'sword') st.swords.push(newSword(0));
    else if (it.id === 'pardon') st.rage = Math.max(0, st.rage - 1);
    else st.consumables[it.id] = (st.consumables[it.id] || 0) + 1;
    return { id: it.id, name: c.name };
  };

  Game.useConsumable = function (st, id) {
    if (!st.consumables[id]) return { error: '没有该消耗品' };
    if (id === 'scale') {
      if (st.active.scale) return { error: '龙鳞已经生效' };
      st.active.scale = true;
    } else if (id === 'oil') {
      if (st.active.oil) return { error: '淬火油已经生效' };
      st.active.oil = true;
    } else if (id === 'incense') {
      const s = Game.anvilSword(st);
      if (!s) return { error: '先把剑放上铁砧' };
      if (Game.isFrenzyFor(st, s)) return { error: '已经在入神中' };
      s.charge = D.FRENZY_CHARGE;
    }
    st.consumables[id]--;
    if (st.consumables[id] <= 0) delete st.consumables[id];
    return { id: id };
  };

  /* ---------- 敲响贡铃：结算 ---------- */
  Game.ringBell = function (st) {
    const quota = D.quota(st.day);
    const swords = Game.altarSwords(st);
    const total = Game.altarTotal(st);
    const ok = total >= quota;
    st.swords = st.swords.filter(s => s.place !== 'altar');
    st.stats.tributeTotal += total;
    const events = [];
    let goldGain = 0;
    if (ok) {
      goldGain = total - quota;
      st.gold += goldGain;
    } else {
      st.rage += 1;
      events.push({ type: 'unlockCheck', key: 'firstFail' });
    }
    st.history.push({ day: st.day, quota: quota, paid: total, ok: ok });
    st.frenzy = { active: false, timeLeft: 0, swordId: null };
    if (st.rage >= Game.rageMax(st)) st.over = 'dead';
    else if (ok && st.day === D.CONTRACT_DAYS && !st.endless) st.over = 'win';
    return { day: st.day, quota: quota, total: total, count: swords.length, ok: ok, goldGain: goldGain, rage: st.rage, rageMax: Game.rageMax(st), over: st.over, events: events };
  };

  Game.startNextDay = function (st, meta) {
    st.day += 1;
    const n = D.DAILY_SWORDS + (Game.has(st, 'twin') ? 1 : 0);
    st.swords.forEach(s => { s.heated = false; if (s.place === 'anvil') s.place = 'rack'; });
    for (let i = 0; i < n; i++) st.swords.push(newSword(0));
    st.frenzy = { active: false, timeLeft: 0, swordId: null };
    st.shop = null;
    Game.rollShop(st, meta);
    Game.rollMerchant(st);
    st.lastResult = null;
    return { newSwords: n };
  };

  Game.continueEndless = function (st, meta) {
    st.over = null;
    st.endless = true;
    return Game.startNextDay(st, meta);
  };

  Game.newSword = newSword;
  Game._pick = pick;

  G.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
