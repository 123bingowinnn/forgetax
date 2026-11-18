/* 铸剑大师 - UI 与交互 */
(function () {
  'use strict';
  const D = window.DATA, Game = window.Game, R = window.Renderer, SFX = window.SFX;

  const SAVE_KEY = 'forgetax.save.v1';
  const META_KEY = 'forgetax.meta.v1';

  let st = null;
  let meta = loadMeta();
  let heating = false;
  let selCons = 0;
  let modalOpen = false;
  let modalOnClose = null;
  let pendingUnlocks = [];
  let shownValue = 0, targetValue = 0;

  const $ = s => document.querySelector(s);
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const pct = p => (p * 100).toFixed(1) + '%';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- 存档 ---------------- */
  function loadMeta() {
    try { return Object.assign({ unlocked: {}, runs: 0, bestDay: 0, wins: 0, muted: false }, JSON.parse(localStorage.getItem(META_KEY) || '{}')); }
    catch (e) { return { unlocked: {}, runs: 0, bestDay: 0, wins: 0, muted: false }; }
  }
  function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { } }
  function save() {
    if (!st) return;
    try {
      if (st.over === 'dead') localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, JSON.stringify(st));
    } catch (e) { }
  }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (s && s.version === 1) return s;
    } catch (e) { }
    return null;
  }

  /* ---------------- 工具 UI ---------------- */
  function toast(msg, err) {
    const el = document.createElement('div');
    el.className = 'toast' + (err ? ' err' : '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 2500);
    if (err) SFX.error();
  }

  function floater(text, color, x, y, cls) {
    const el = document.createElement('div');
    el.className = 'floater ' + (cls || '');
    el.style.color = color;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.textContent = text;
    $('#floaters').appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  function banner(text) {
    const b = $('#banner');
    b.textContent = text;
    b.classList.remove('hidden');
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(banner._t);
    banner._t = setTimeout(() => b.classList.add('hidden'), 1400);
  }

  function openModal(html, opts) {
    opts = opts || {};
    const m = $('#modal');
    const box = m.querySelector('.modal-box');
    box.className = 'modal-box ' + (opts.cls || '');
    box.innerHTML = html;
    m.classList.remove('hidden');
    modalOpen = true;
    modalOnClose = opts.onClose || null;
    m.onclick = e => { if (e.target === m && opts.dismissable !== false) closeModal(); };
    return box;
  }
  function closeModal() {
    $('#modal').classList.add('hidden');
    modalOpen = false;
    const cb = modalOnClose; modalOnClose = null;
    if (cb) cb();
    setTimeout(showNextUnlock, 50);
  }

  // 悬浮提示
  const tip = $('#tooltip');
  document.addEventListener('mouseover', e => {
    const t = e.target.closest('[data-tip]');
    if (!t) { tip.classList.add('hidden'); return; }
    tip.innerHTML = t.dataset.tipTitle ? '<div class="tt-title">' + esc(t.dataset.tipTitle) + '</div>' + esc(t.dataset.tip) : esc(t.dataset.tip);
    tip.classList.remove('hidden');
  });
  document.addEventListener('mousemove', e => {
    if (tip.classList.contains('hidden')) return;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });

  /* ---------------- 解锁 ---------------- */
  function checkUnlocks(events) {
    (events || []).forEach(ev => {
      if (ev.type !== 'unlockCheck') return;
      if (meta.unlocked[ev.key]) return;
      meta.unlocked[ev.key] = true;
      saveMeta();
      pendingUnlocks.push(ev.key);
    });
    if (!modalOpen) setTimeout(showNextUnlock, 600);
  }
  function showNextUnlock() {
    if (modalOpen || !pendingUnlocks.length) return;
    if (st && st.frenzy.active) { setTimeout(showNextUnlock, 800); return; }
    const key = pendingUnlocks.shift();
    const u = D.UNLOCKS[key];
    const r = D.RELIC_MAP[u.relic];
    SFX.unlock();
    openModal(`
      <div class="ui">${r.icon}</div>
      <div class="ul">遗物解锁</div>
      <div class="un">${esc(r.name)}</div>
      <div class="sub">${esc(r.desc)}<br><span class="muted">达成：${esc(u.text)} · 之后会出现在遗物售卖机中</span></div>
      <div class="modal-foot" style="justify-content:center"><button class="btn primary" id="ulOk">好</button></div>
    `, { cls: 'unlock-box' });
    $('#ulOk').onclick = closeModal;
  }

  /* ---------------- 渲染 HUD ---------------- */
  function renderCalendar() {
    const grid = $('#calGrid');
    const total = D.CONTRACT_DAYS;
    const endless = st.day > total;
    $('#calTitle').textContent = endless ? '无尽 · 第 ' + st.day + ' 天' : '契约 · 第 ' + st.day + ' 天';
    $('#calSub').textContent = endless ? '' : '/ ' + total;
    let start = 1;
    if (endless) start = st.day - 13;
    let html = '';
    for (let d = start; d < start + 21; d++) {
      const h = st.history.find(x => x.day === d);
      const cls = ['cal-day'];
      if (h) { cls.push('past'); if (h.ok) cls.push('ok'); }
      if (d === st.day) cls.push('today');
      if (d === total) cls.push('final');
      const mk = D.isMerchantDay(d) ? '<span class="mk">👻</span>' : (d === total ? '<span class="mk">🐉</span>' : '');
      const tipTxt = '第 ' + d + ' 天 · 贡额 ' + fmt(D.quota(d)) + ' G' + (D.isMerchantDay(d) ? ' · 幽灵商人' : '') + (h ? (h.ok ? ' · 已缴纳 ' + fmt(h.paid) : ' · 欠贡！') : '');
      html += `<div class="${cls.join(' ')}" data-tip="${tipTxt}">${d}${mk}</div>`;
    }
    grid.innerHTML = html;
    $('#calQuota').textContent = fmt(D.quota(st.day)) + ' G';
    const max = Game.rageMax(st);
    let rh = '';
    for (let i = 0; i < max; i++) rh += `<span class="${i < st.rage ? 'on' : ''}">🔥</span>`;
    $('#rageIcons').innerHTML = rh;
    $('#rageIcons').dataset.tip = '欠贡一次怒气 +1，怒气满 ' + max + ' 点时巨龙会吃掉你';
  }

  function renderPanel() {
    const s = Game.anvilSword(st);
    const pips = $('#pPips');
    if (!s) {
      $('#pName').textContent = '铁砧空着';
      $('#pLevel').textContent = '';
      targetValue = 0;
      $('#pValue').textContent = '—';
      $('#pLast').innerHTML = '<span class="muted">从剑架选一把剑放上铁砧</span>';
      pips.innerHTML = '<i></i>'.repeat(10); pips.className = '';
      $('#pChargeTxt').textContent = '0/10';
      $('#pProbs').innerHTML = '';
      $('#pBar').innerHTML = '';
      $('#pTags').innerHTML = '';
      return;
    }
    $('#pName').textContent = D.swordName(s.level);
    $('#pLevel').textContent = '+' + s.level;
    targetValue = Game.value(st, s);
    const lr = st.lastResult;
    if (lr && lr.swordId === s.id) {
      const o = D.OUTCOMES[lr.outcome];
      const lv = lr.levelDelta > 0 ? ' +' + lr.levelDelta : (lr.levelDelta < 0 ? ' ' + lr.levelDelta : '');
      $('#pLast').innerHTML = `<span style="color:${o.color}">${o.name}${lv}</span><small>${lr.delta >= 0 ? '+' : ''}${fmt(lr.delta)} G · ${lr.ratio.toFixed(lr.ratio >= 10 ? 0 : 2).replace(/\.?0+$/, '')}倍</small>`;
    } else {
      $('#pLast').innerHTML = s.heated ? '<span class="muted">剑已烧红，可以挥锤</span>' : '<span class="muted">剑是冷的 · 先加热</span>';
    }
    const frenzy = Game.isFrenzyFor(st, s);
    let ph = '';
    for (let i = 0; i < 10; i++) ph += `<i class="${i < s.charge || frenzy ? 'on' : ''}"></i>`;
    pips.innerHTML = ph;
    pips.className = (s.charge >= D.FRENZY_CHARGE || frenzy) ? 'full' : '';
    $('#pChargeTxt').textContent = frenzy ? '入神中' : (s.charge >= D.FRENZY_CHARGE ? '下一锤入神！' : s.charge + '/10 充能');

    const p = Game.probs(st, s);
    $('#pProbs').innerHTML = D.OUTCOME_ORDER.map(k => {
      const o = D.OUTCOMES[k];
      return `<div class="prob ${p[k] < 0.0005 ? 'zero' : ''}" style="border-color:${o.color}"><div class="n" style="color:${o.color}">${o.name}</div><div class="v">${pct(p[k])}</div></div>`;
    }).join('');
    $('#pBar').innerHTML = D.OUTCOME_ORDER.map(k => `<div style="width:${p[k] * 100}%;background:${D.OUTCOMES[k].color}"></div>`).join('');

    const tags = [];
    if (st.active.scale) tags.push('<span class="good">🛡️ 龙鳞生效：抵挡下一次破坏</span>');
    if (st.active.oil) tags.push('<span class="good">🛢️ 淬火油：大成功签 ×3</span>');
    if (Game.has(st, 'splice') && s.spliceStacks) tags.push(`<span>🔩 破碎 -${s.spliceStacks * 15}%</span>`);
    if (Game.has(st, 'seal') && s.sealStacks) tags.push(`<span>🗿 玉玺积存 +${s.sealStacks}</span>`);
    if (Game.has(st, 'spine')) tags.push(s.spineReady ? '<span class="good">🦴 保护就绪</span>' : `<span>🦴 ${s.spineCount}/2</span>`);
    if (Game.has(st, 'pearl')) tags.push(`<span>🦪 免掉级 ${2 - s.pearlUsed}/2</span>`);
    if (s.flat > 0) tags.push(`<span>固定价值 +${fmt(s.flat)} G</span>`);
    if (st.pendingLegacy) tags.push(`<span class="good">🗡️ 传承待生效 +${st.pendingLegacy}</span>`);
    if (!s.heated) tags.push('<span class="warn">冷剑</span>');
    $('#pTags').innerHTML = tags.join('');
  }

  function renderRelics() {
    const bar = $('#relicBar');
    let html = '';
    for (let i = 0; i < D.RELIC_SLOTS; i++) {
      const id = st.relics[i];
      if (id) {
        const r = D.RELIC_MAP[id];
        html += `<div class="relic" data-relic="${id}" data-tip-title="${esc(r.icon + ' ' + r.name)}" data-tip="${esc(r.desc)}">${r.icon}</div>`;
      } else html += '<div class="relic empty">·</div>';
    }
    bar.innerHTML = html;
    $('#relicCount').textContent = st.relics.length + '/' + D.RELIC_SLOTS;
  }

  function renderRack() {
    const rack = $('#rack');
    const order = { anvil: 0, rack: 1, altar: 2 };
    const swords = st.swords.slice().sort((a, b) => order[a.place] - order[b.place] || Game.value(st, b) - Game.value(st, a));
    $('#rackCount').textContent = swords.length + ' 把';
    if (!swords.length) {
      rack.innerHTML = '<div class="muted" style="font-size:13px;padding:10px;text-align:center">一把剑也没有了……<br>明天会送来新剑，或找幽灵商人购买。</div>';
      return;
    }
    rack.innerHTML = swords.map(s => {
      const tag = s.place === 'anvil' ? '<span class="tag t-anvil">铁砧</span>' : (s.place === 'altar' ? '<span class="tag t-altar">贡台</span>' : '');
      const hot = s.heated ? '<span class="tag t-hot">热</span>' : '';
      return `<div class="sword-card ${s.place}" data-id="${s.id}">
        <canvas width="260" height="26" data-level="${s.level}"></canvas>
        <div class="sc-name">${esc(D.swordName(s.level))}<b>+${s.level}</b>${tag}${hot}</div>
        <div class="sc-val">${fmt(Game.value(st, s))} G</div>
        <div class="sc-meta">${s.hammers ? '已敲 ' + s.hammers + ' 锤' : '全新'}${s.charge ? ' · 充能 ' + s.charge : ''}</div>
        <div class="sc-btns">
          ${s.place !== 'anvil' ? '<button class="btn small" data-act="anvil">上砧</button>' : ''}
          <button class="btn small" data-act="altar">${s.place === 'altar' ? '取回' : '贡台'}</button>
        </div>
      </div>`;
    }).join('');
    rack.querySelectorAll('canvas').forEach(c => R.drawSwordIcon(c, +c.dataset.level, { heat: 0 }));
  }

  function renderResources() {
    $('#gold').textContent = fmt(st.gold);
    $('#coins').textContent = st.coins;
    const alt = Game.altarSwords(st);
    const total = Game.altarTotal(st);
    const q = D.quota(st.day);
    $('#altarCount').textContent = alt.length + ' 把' + (Game.has(st, 'miser') ? ' · 秤 +15%' : '');
    $('#altarTotal').textContent = fmt(total);
    $('#altarQuota').textContent = fmt(q);
    const f = $('#altarFill');
    f.style.width = Math.min(100, total / q * 100) + '%';
    f.className = total >= q ? 'ok' : '';
  }

  function renderHotbar() {
    const ids = Object.keys(st.consumables);
    const hb = $('#hotbar');
    $('#consHelp').classList.toggle('hidden', !ids.length);
    if (selCons >= ids.length) selCons = 0;
    hb.innerHTML = ids.map((id, i) => {
      const c = D.CONS_MAP[id];
      const active = (id === 'scale' && st.active.scale) || (id === 'oil' && st.active.oil);
      return `<div class="cons ${i === selCons ? 'sel' : ''} ${active ? 'active' : ''}" data-cons="${id}" data-idx="${i}" data-tip-title="${esc(c.name)}" data-tip="${esc(c.desc)}"><span class="k">${i + 1}</span><span class="c">×${st.consumables[id]}</span>${c.icon}<span class="nm">${esc(c.name)}</span></div>`;
    }).join('');
  }

  function renderHint() {
    const s = Game.anvilSword(st);
    let h;
    if (!s) h = st.swords.length ? '点击右侧剑架中的剑，把它放上铁砧' : '没有剑了 —— 去敲响贡铃结束今天吧';
    else if (heating) h = '🔥 正在加热……';
    else if (!s.heated) h = '剑是冷的：按 <kbd>F</kbd> 加热，或直接点击场景自动加热';
    else if (Game.isFrenzyFor(st, s)) h = '<span class="hl">✦ 入神中！破碎已被移除 —— 疯狂挥锤！</span>';
    else if (s.charge >= D.FRENZY_CHARGE) h = '<span class="hl">充能已满！下一锤将进入入神</span>';
    else h = '<kbd>左键</kbd> / <kbd>空格</kbd> 挥锤 · 剑值越高，破碎风险越大';
    $('#hint').innerHTML = h;
  }

  function renderButtons() {
    const s = Game.anvilSword(st);
    $('#btnHeat').disabled = !s || s.heated || heating;
    $('#btnTake').disabled = !s;
    $('#btnAltar').disabled = !s;
    $('#btnGhost').classList.toggle('hidden', !st.merchant);
  }

  function syncView() {
    const s = Game.anvilSword(st);
    R.view.sword = s ? { id: s.id, level: s.level, heated: s.heated } : null;
    R.view.frenzy = Game.isFrenzyFor(st, s);
  }

  function renderAll() {
    if (!st) return;
    renderCalendar();
    renderPanel();
    renderRelics();
    renderRack();
    renderResources();
    renderHotbar();
    renderHint();
    renderButtons();
    syncView();
  }

  /* ---------------- 动作 ---------------- */
  function doHeat(thenHammer) {
    const s = Game.anvilSword(st);
    if (!s || s.heated || heating) return;
    heating = true;
    SFX.heat();
    R.heat();
    renderHint(); renderButtons();
    setTimeout(() => {
      heating = false;
      Game.heat(st);
      save();
      renderAll();
    }, 750);
  }

  function doHammer() {
    if (!st || st.over || modalOpen || heating) return;
    const s = Game.anvilSword(st);
    if (!s) {
      if (st.swords.some(x => x.place === 'rack')) {
        const best = st.swords.find(x => x.place === 'rack');
        placeSword(best.id);
      } else toast('铁砧上没有剑', true);
      return;
    }
    if (!s.heated) { doHeat(); return; }
    const frenzy = Game.isFrenzyFor(st, s) || s.charge >= D.FRENZY_CHARGE;
    R.swing(() => resolveHit(), frenzy);
  }

  function resolveHit() {
    const res = Game.hammer(st);
    if (res.error) { toast(res.error, true); return; }
    SFX.hit(res.outcome);
    R.impact(res.outcome, res.levelBefore, { frenzy: res.frenzy });
    const o = D.OUTCOMES[res.outcome];
    const pos = R.impactScreenPos(res.levelBefore);
    let text = o.name;
    if (res.outcome === 'break') text = '破碎！';
    else if (res.levelDelta > 0) text += ' +' + res.levelDelta;
    else if (res.levelDelta < 0) text += ' ' + res.levelDelta;
    floater(text, o.color, pos.x, pos.y - 30, res.outcome === 'great' || res.outcome === 'break' ? 'huge' : '');
    if (!res.broke && res.delta !== 0) floater((res.delta > 0 ? '+' : '') + fmt(res.delta) + ' G', res.delta > 0 ? '#f3c76b' : '#e8973f', pos.x + 120, pos.y + 20, 'small');
    if (res.frenzyStarted) { SFX.frenzy(); banner('入 神'); }
    let k = 0;
    res.events.forEach(ev => {
      if (ev.type === 'relic' || ev.type === 'cons') {
        const delay = 250 + k++ * 260;
        setTimeout(() => floater(ev.text, '#e9d7ff', pos.x - 60, pos.y + 70, 'small'), delay);
        if (ev.id) {
          const el = document.querySelector(`.relic[data-relic="${ev.id}"]`);
          if (el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
        }
      }
    });
    if (res.broke) {
      R.view.sword = null;
      setTimeout(() => toast('剑碎了……价值 ' + fmt(res.before) + ' G 化为乌有', true), 300);
    }
    if (res.chargeFull) { SFX.charge(); }
    checkUnlocks(res.events);
    save();
    renderAll();
  }

  function placeSword(id) {
    const r = Game.placeOnAnvil(st, id);
    if (r.error) { toast(r.error, true); return; }
    SFX.clang(0.7, 0.4);
    if (r.legacy) toast('🗡️ 断剑传承：这把剑继承了 +' + r.legacy);
    shownValue = 0;
    save(); renderAll();
  }

  function toggleAltar(id) {
    const r = Game.toggleAltar(st, id);
    if (r.error) { toast(r.error, true); return; }
    SFX.click();
    save(); renderAll();
  }

  function useSelectedCons() {
    const ids = Object.keys(st.consumables);
    const id = ids[selCons];
    if (!id) return;
    const r = Game.useConsumable(st, id);
    if (r.error) { toast(r.error, true); return; }
    SFX.coin();
    toast(D.CONS_MAP[id].icon + ' ' + D.CONS_MAP[id].name + ' 已使用');
    save(); renderAll();
  }

  /* ---------------- 遗物售卖机 ---------------- */
  function openShop() {
    if (!st || st.over) return;
    SFX.click();
    const draw = () => {
      const items = st.shop.items.map((it, i) => {
        const r = D.RELIC_MAP[it.id];
        return `<div class="card ${it.sold ? 'sold' : ''}">
          <div class="ci">${r.icon}</div>
          <div class="cn">${esc(r.name)}</div>
          <div class="cd">${esc(r.desc)}</div>
          <div class="ct">${{ damage: '损伤流', general: '通用', frenzy: '入神', economy: '经济', guard: '保护' }[r.tag]}</div>
          <button class="btn ${it.sold ? '' : 'primary'}" data-buy="${i}" ${it.sold ? 'disabled' : ''}>${it.sold ? '已购买' : '<span class="price">' + it.price + '</span> 剑币'}</button>
        </div>`;
      }).join('') || '<div class="muted">售卖机空了</div>';
      const sellable = st.swords.filter(s => !Game.isFrenzyFor(st, s));
      const sell = sellable.map(s => `<div class="sell-row"><span class="grow">${esc(D.swordName(s.level))} <b>+${s.level}</b> <span class="muted">${fmt(Game.value(st, s))} G${s.place === 'altar' ? ' · 贡台' : s.place === 'anvil' ? ' · 铁砧' : ''}</span></span><button class="btn small" data-sell="${s.id}">投入 +1</button></div>`).join('') || '<div class="muted" style="font-size:13px">没有可投入的剑</div>';
      const box = openModal(`
        <div class="shop-head">
          <div><h2>🎰 遗物售卖机</h2><div class="sub" style="margin:0">按剑的数量收取剑币 —— 不管剑有多贵，一把只算一枚。</div></div>
          <div class="wallet"><span>⚔️ <b>${st.coins}</b> 剑币</span><span>🪙 <b>${fmt(st.gold)}</b> 金币</span></div>
        </div>
        <div class="shop-grid">
          <div><div class="cards">${items}</div>
            <div style="text-align:center;margin-top:14px"><button class="btn" id="shopRefresh">🔄 刷新货架（<span class="price">${fmt(Game.refreshCost(st))}</span> 金币）</button></div>
          </div>
          <div class="shop-side">
            <h3>投入剑 → 剑币</h3>
            <div class="sell-list">${sell}</div>
            <div class="muted" style="font-size:12px;margin-top:8px">提示：优先投入不打算继续锻造的低级剑，别把唯一够交贡的好剑换掉。</div>
          </div>
        </div>
        <div class="modal-foot"><button class="btn" id="shopClose">离开 <kbd>Esc</kbd></button></div>
      `);
      box.querySelector('#shopClose').onclick = closeModal;
      box.querySelector('#shopRefresh').onclick = () => {
        const r = Game.refreshShop(st, meta);
        if (r.error) return toast(r.error, true);
        SFX.coin(); save(); renderAll(); draw();
      };
      box.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => {
        const s = st.swords.find(x => x.id === b.dataset.sell);
        if (s && Game.value(st, s) > D.quota(st.day) * 0.5 && !confirm('这把剑值 ' + fmt(Game.value(st, s)) + ' G，确定只换 1 枚剑币吗？')) return;
        const r = Game.sellSword(st, b.dataset.sell);
        if (r.error) return toast(r.error, true);
        SFX.coin(); save(); renderAll(); draw();
      });
      box.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buy(+b.dataset.buy));
    };
    const buy = (idx, replaceId) => {
      const r = Game.buyRelic(st, idx, replaceId);
      if (r.needReplace) return chooseReplace(idx);
      if (r.error) return toast(r.error, true);
      SFX.unlock();
      toast('获得遗物：' + D.RELIC_MAP[r.id].icon + ' ' + D.RELIC_MAP[r.id].name);
      save(); renderAll(); draw();
    };
    const chooseReplace = idx => {
      const newR = D.RELIC_MAP[st.shop.items[idx].id];
      const box = openModal(`
        <h2>遗物栏已满</h2>
        <div class="sub">要获得 ${newR.icon} ${esc(newR.name)}，需要丢弃一件已有遗物：</div>
        <div class="replace-list">${st.relics.map(id => { const r = D.RELIC_MAP[id]; return `<div class="card" data-rep="${id}" data-tip="${esc(r.desc)}"><div class="ci">${r.icon}</div><div class="cn" style="font-size:13px">${esc(r.name)}</div></div>`; }).join('')}</div>
        <div class="modal-foot"><button class="btn" id="repCancel">取消</button></div>
      `);
      box.querySelector('#repCancel').onclick = draw;
      box.querySelectorAll('[data-rep]').forEach(c => c.onclick = () => buy(idx, c.dataset.rep));
    };
    draw();
  }

  /* ---------------- 幽灵商人 ---------------- */
  function openGhost() {
    if (!st || !st.merchant) return;
    SFX.click();
    const draw = () => {
      const items = st.merchant.items.map((it, i) => {
        const c = D.CONS_MAP[it.id];
        return `<div class="card ${it.stock <= 0 ? 'sold' : ''}">
          <div class="ci">${c.icon}</div><div class="cn">${esc(c.name)}</div><div class="cd">${esc(c.desc)}</div>
          <div class="ct">库存 ${it.stock}</div>
          <button class="btn ${it.stock > 0 ? 'primary' : ''}" data-buy="${i}" ${it.stock <= 0 ? 'disabled' : ''}><span class="price">${fmt(it.price)}</span> 金币</button>
        </div>`;
      }).join('');
      const box = openModal(`
        <div class="shop-head">
          <div><h2>👻 幽灵商人</h2><div class="sub" style="margin:0">“嘿嘿……每三天我就会路过一次。金币，我只收金币。”</div></div>
          <div class="wallet"><span>🪙 <b>${fmt(st.gold)}</b> 金币</span></div>
        </div>
        <div class="cards">${items}</div>
        <div class="modal-foot"><button class="btn" id="gClose">离开 <kbd>Esc</kbd></button></div>
      `);
      box.querySelector('#gClose').onclick = closeModal;
      box.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
        const r = Game.buyConsumable(st, +b.dataset.buy);
        if (r.error) return toast(r.error, true);
        SFX.coin(); toast('购买了 ' + r.name);
        save(); renderAll(); draw();
      });
    };
    draw();
  }

  /* ---------------- 贡铃 / 结算 ---------------- */
  function askBell() {
    if (!st || st.over || modalOpen) return;
    const s = Game.anvilSword(st);
    if (s && Game.isFrenzyFor(st, s)) return toast('入神中，先专心打铁', true);
    const total = Game.altarTotal(st);
    const q = D.quota(st.day);
    const n = Game.altarSwords(st).length;
    const enough = total >= q;
    const box = openModal(`
      <h2>🔔 敲响贡铃？</h2>
      <div class="sub">贡台上的剑会被巨龙收走，今天随之结束。没放上贡台的剑会留到明天（需要重新加热）。</div>
      <div class="tribute-result">
        <div class="line">贡台：<b>${n}</b> 把剑，合计 <b style="color:${enough ? '#9fe58c' : '#ff6a55'}">${fmt(total)} G</b> / 贡额 ${fmt(q)} G</div>
        <div class="line">${enough ? '足额！多出的 <b class="price">' + fmt(total - q) + '</b> G 将转为金币。' : '<span class="bad">贡品不足！巨龙怒气将 +1（当前 ' + st.rage + '/' + Game.rageMax(st) + '）</span>'}</div>
      </div>
      <div class="modal-foot"><button class="btn" id="bCancel">再想想</button><button class="btn bell" id="bOk">敲响贡铃</button></div>
    `);
    box.querySelector('#bCancel').onclick = closeModal;
    box.querySelector('#bOk').onclick = () => { closeModal(); ringBell(); };
  }

  function ringBell() {
    SFX.bell();
    const res = Game.ringBell(st);
    checkUnlocks(res.events);
    meta.bestDay = Math.max(meta.bestDay || 0, res.ok ? res.day : res.day - 1);
    saveMeta();
    setTimeout(() => (res.ok ? SFX.coin() : SFX.roar()), 1300);
    R.shake(res.ok ? 6 : 26);
    const rageHtml = Array.from({ length: res.rageMax }, (_, i) => `<span style="font-size:22px;${i < res.rage ? '' : 'filter:grayscale(1) opacity(.3)'}">🔥</span>`).join('');
    const box = openModal(`
      <div class="tribute-scene"><div class="glow"></div><div class="eyes ${res.ok ? 'happy' : 'angry'}"><div class="eye"></div><div class="eye"></div></div><div class="bars"></div></div>
      <div class="tribute-result">
        <div class="big ${res.ok ? 'ok' : 'bad'}">${res.ok ? '巨龙收下了贡品' : '巨龙发出了怒吼！'}</div>
        <div class="line">第 ${res.day} 天 · 献上 ${res.count} 把剑，共 <b>${fmt(res.total)} G</b> / 贡额 ${fmt(res.quota)} G</div>
        <div class="line">${res.ok ? '获得 <b class="price">' + fmt(res.goldGain) + '</b> 金币' : '欠贡！怒气 ' + res.rage + '/' + res.rageMax}</div>
        <div class="line">${rageHtml}</div>
      </div>
      <div class="modal-foot" style="justify-content:center"><button class="btn primary big" id="nextDay">${res.over === 'dead' ? '……' : res.over === 'win' ? '契约完成！' : '迎接第 ' + (res.day + 1) + ' 天'}</button></div>
    `, { dismissable: false });
    box.querySelector('#nextDay').onclick = () => {
      if (res.over === 'dead') return gameOver();
      if (res.over === 'win') return victory();
      closeModal();
      startDay();
    };
    save();
    renderAll();
  }

  function startDay() {
    const r = Game.startNextDay(st, meta);
    save();
    renderAll();
    banner('第 ' + st.day + ' 天');
    toast('送来了 ' + r.newSwords + ' 把新剑 · 今日贡额 ' + fmt(D.quota(st.day)) + ' G');
    if (st.merchant) setTimeout(() => toast('👻 幽灵商人来了！'), 900);
  }

  function statsHtml() {
    const s = st.stats;
    return `<div class="stats-grid">
      <div><b>${st.day}</b>坚持天数</div><div><b>${fmt(s.hammers)}</b>挥锤次数</div><div><b>${fmt(s.breaks)}</b>敲碎的剑</div>
      <div><b>+${s.maxLevel}</b>最高强化</div><div><b>${fmt(s.maxValue)}</b>最高剑值</div><div><b>${fmt(s.tributeTotal)}</b>累计进贡</div>
    </div>`;
  }

  function gameOver() {
    SFX.roar();
    localStorage.removeItem(SAVE_KEY);
    const box = openModal(`
      <div class="tribute-scene" style="background:linear-gradient(#300,#100)"><div class="glow"></div><div class="eyes angry"><div class="eye"></div><div class="eye"></div></div></div>
      <div class="tribute-result"><div class="big bad">你被巨龙吃掉了</div><div class="line">“要么强化出一把神剑，要么一锤敲碎。” —— 这次是后者。</div></div>
      ${statsHtml()}
      <div class="modal-foot" style="justify-content:center"><button class="btn primary big" id="goNew">新的契约</button><button class="btn big" id="goTitle">返回标题</button></div>
    `, { dismissable: false });
    box.querySelector('#goNew').onclick = () => { closeModal(); newRun(); };
    box.querySelector('#goTitle').onclick = () => { closeModal(); showTitle(); };
  }

  function victory() {
    meta.wins = (meta.wins || 0) + 1; saveMeta();
    SFX.unlock();
    const box = openModal(`
      <div class="tribute-result"><div class="big ok">契约完成！</div><div class="line">你撑过了 21 天，满足了巨龙的全部要求。真正的铸剑大师！</div></div>
      ${statsHtml()}
      <div class="modal-foot" style="justify-content:center"><button class="btn primary big" id="vEnd">进入无尽模式</button><button class="btn big" id="vNew">新的契约</button></div>
    `, { dismissable: false });
    box.querySelector('#vEnd').onclick = () => { closeModal(); Game.continueEndless(st, meta); save(); renderAll(); banner('无尽模式'); };
    box.querySelector('#vNew').onclick = () => { closeModal(); newRun(); };
  }

  /* ---------------- 开局 ---------------- */
  function newRun() {
    st = Game.newRun(meta);
    meta.runs = (meta.runs || 0) + 1; saveMeta();
    $('#title').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    renderAll();
    save();
    chooseStarter();
  }

  function chooseStarter() {
    if (!st.starterChoices.length) return;
    const cards = st.starterChoices.map(id => {
      const r = D.RELIC_MAP[id];
      return `<div class="card"><div class="ci">${r.icon}</div><div class="cn">${esc(r.name)}</div><div class="cd">${esc(r.desc)}</div><button class="btn primary" data-pick="${id}">选择</button></div>`;
    }).join('');
    const box = openModal(`
      <h2>与巨龙的契约</h2>
      <div class="sub">接下来 21 天，你每天都要向巨龙献上足额的剑作为贡品。每天会送来 ${D.DAILY_SWORDS} 把旧剑。<br>先从三件遗物中免费选择一件：</div>
      <div class="cards">${cards}</div>
    `, { dismissable: false });
    box.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
      Game.chooseStarter(st, b.dataset.pick);
      SFX.unlock();
      closeModal();
      save(); renderAll();
      banner('第 1 天');
      // 自动把第一把剑放上铁砧，降低上手门槛
      if (!Game.anvilSword(st) && st.swords.length) placeSword(st.swords[0].id);
    });
  }

  function continueRun() {
    st = loadSave();
    if (!st) return newRun();
    st.frenzy = { active: false, timeLeft: 0, swordId: null };
    $('#title').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    renderAll();
    if (st.starterChoices && st.starterChoices.length) chooseStarter();
    else if (st.over === 'win') victory();
  }

  function showTitle() {
    $('#title').classList.remove('hidden');
    $('#hud').classList.add('hidden');
    const s = loadSave();
    $('#btnContinue').classList.toggle('hidden', !s);
    if (s) $('#btnContinue').textContent = '继续契约（第 ' + s.day + ' 天）';
    const n = Object.keys(meta.unlocked || {}).length;
    $('#titleStats').textContent = meta.runs ? `契约 ${meta.runs} 次 · 最远第 ${meta.bestDay || 0} 天 · 完成 ${meta.wins || 0} 次 · 已解锁遗物 ${n}/${Object.keys(D.UNLOCKS).length}` : '';
    R.view.sword = { id: 'title', level: 12, heated: true };
    R.view.frenzy = false;
  }

  function showHelp() {
    const box = openModal(`
      <h2>玩法说明</h2>
      <div class="help">
        <p>你是被巨龙胁迫的铁匠。每天把剑敲得更值钱，然后献给巨龙。敲得越多，价值越高，<b style="color:#e2504a">破碎</b>的风险也越大。</p>
        <h3>一天的流程</h3>
        <p>① 从剑架选一把剑放上铁砧 → ② 按 <kbd>F</kbd> 加热（每把剑每天一次）→ ③ <kbd>左键</kbd>/<kbd>空格</kbd> 挥锤 → ④ 把够数的剑放上贡台 → ⑤ 敲响贡铃结束一天。</p>
        <h3>每一锤的五种结果</h3>
        <table>
          <tr><th style="color:#e2504a">破坏</th><td>剑被毁，价值全失。+0 不会破碎，等级越高越危险。</td></tr>
          <tr><th style="color:#e8973f">损伤</th><td>-1 级（最低 +0），剑值 ÷1.5。损伤流遗物会在此触发。</td></tr>
          <tr><th style="color:#7fc46a">维持</th><td>等级不变。</td></tr>
          <tr><th style="color:#f0b6a0">成功</th><td>+1 级，剑值 ×1.5。</td></tr>
          <tr><th style="color:#c98cf0">大成功</th><td>+2 级，剑值 ×2.5。</td></tr>
        </table>
        <h3>充能与入神</h3>
        <p>同一把剑每挥一锤 +1 充能。满 10 点后，下一锤进入 <b>入神</b>（4 秒）：期间<b>不会破碎</b>，赶紧连续挥锤！但损伤和维持仍会出现。</p>
        <h3>剑、剑币、金币</h3>
        <p>· <b>剑</b>：锻造、进贡、或投入遗物售卖机。<br>· <b>剑币</b>：一把剑换一枚（不论剑值多少），用来买遗物。<br>· <b>金币</b>：进贡超额部分转为金币，用来刷新售卖机、在幽灵商人（每 3 天出现）处买消耗品。</p>
        <h3>巨龙</h3>
        <p>贡额逐日上涨，第 21 天约 23 万 G。欠贡一次怒气 +1，怒气满 3 点你就会被吃掉。撑过 21 天即完成契约，之后可进入无尽模式。</p>
        <h3>快捷键</h3>
        <p><kbd>空格</kbd> 挥锤 · <kbd>F</kbd> 加热 · <kbd>E</kbd> 收回剑 · <kbd>T</kbd> 上贡台 · <kbd>M</kbd> 遗物机 · <kbd>G</kbd> 幽灵商人 · <kbd>B</kbd> 贡铃 · <kbd>1-5</kbd> 选择消耗品 · <kbd>Q</kbd> 使用</p>
      </div>
      <div class="modal-foot"><button class="btn primary" id="hOk">明白了</button></div>
    `);
    box.querySelector('#hOk').onclick = closeModal;
  }

  /* ---------------- 事件绑定 ---------------- */
  $('#scene').addEventListener('mousedown', e => {
    SFX.resume();
    if (e.button !== 0 || !st || $('#hud').classList.contains('hidden')) return;
    doHammer();
  });

  $('#rack').addEventListener('click', e => {
    const card = e.target.closest('.sword-card');
    if (!card) return;
    const id = card.dataset.id;
    const act = e.target.dataset.act;
    if (act === 'altar') return toggleAltar(id);
    const s = st.swords.find(x => x.id === id);
    if (act === 'anvil' || (s && s.place !== 'anvil')) placeSword(id);
  });

  $('#hotbar').addEventListener('click', e => {
    const c = e.target.closest('.cons');
    if (!c) return;
    if (selCons === +c.dataset.idx) useSelectedCons();
    else { selCons = +c.dataset.idx; renderHotbar(); }
  });

  $('#btnHeat').onclick = () => doHeat();
  $('#btnTake').onclick = () => { const r = Game.takeOffAnvil(st); if (r.error) return toast(r.error, true); SFX.click(); save(); renderAll(); };
  $('#btnAltar').onclick = () => { const s = Game.anvilSword(st); if (s) toggleAltar(s.id); };
  $('#btnShop').onclick = openShop;
  $('#btnGhost').onclick = openGhost;
  $('#btnBell').onclick = askBell;
  $('#btnHelp').onclick = showHelp;
  $('#btnHow').onclick = () => { SFX.resume(); showHelp(); };
  $('#btnNew').onclick = () => {
    SFX.resume();
    if (loadSave() && !confirm('开始新的契约会覆盖当前存档，确定吗？')) return;
    newRun();
  };
  $('#btnContinue').onclick = () => { SFX.resume(); continueRun(); };
  $('#btnMenu').onclick = () => { save(); showTitle(); };
  $('#btnMute').onclick = () => {
    meta.muted = !meta.muted; saveMeta();
    SFX.enabled = !meta.muted;
    $('#btnMute').textContent = meta.muted ? '🔇' : '🔊';
  };

  document.addEventListener('keydown', e => {
    SFX.resume();
    if (e.key === 'Escape' && modalOpen) {
      const box = $('#modal .modal-box');
      if (box.querySelector('#nextDay, #goNew, #vEnd, [data-pick]')) return;
      closeModal(); return;
    }
    if (modalOpen || !st || $('#hud').classList.contains('hidden')) return;
    const k = e.key.toLowerCase();
    const s = Game.anvilSword(st);
    if (k === ' ' || k === 'j') {
      e.preventDefault();
      if (e.repeat && !(s && Game.isFrenzyFor(st, s))) return;
      doHammer();
    }
    else if (k === 'f') doHeat();
    else if (k === 'e') $('#btnTake').click();
    else if (k === 't') $('#btnAltar').click();
    else if (k === 'm') openShop();
    else if (k === 'g') openGhost();
    else if (k === 'b') askBell();
    else if (k === 'q') useSelectedCons();
    else if (/^[1-9]$/.test(k)) { selCons = +k - 1; renderHotbar(); }
  });

  /* ---------------- 每帧 ---------------- */
  let lastFrenzy = false;
  R.onTick = function (dt) {
    if (!st) return;
    const ended = Game.tick(st, dt);
    const fb = $('#frenzyBar');
    if (st.frenzy.active) {
      fb.classList.remove('hidden');
      const max = D.FRENZY_TIME + (Game.has(st, 'hourglass') ? 2 : 0);
      fb.querySelector('.fb-fill').style.width = (st.frenzy.timeLeft / max * 100) + '%';
      fb.querySelector('span').textContent = '入神 ' + st.frenzy.timeLeft.toFixed(1) + 's';
    } else fb.classList.add('hidden');
    if (ended || lastFrenzy !== st.frenzy.active) {
      if (ended) toast('入神结束 —— 破碎风险回来了');
      lastFrenzy = st.frenzy.active;
      save(); renderAll();
    }
    // 剑值数字滚动
    if (Math.abs(shownValue - targetValue) > 0.5) {
      shownValue += (targetValue - shownValue) * Math.min(1, dt * 10);
      if (Math.abs(shownValue - targetValue) < 1) shownValue = targetValue;
      if (Game.anvilSword(st)) $('#pValue').textContent = fmt(shownValue) + ' G';
    }
  };

  /* ---------------- 启动 ---------------- */
  R.init($('#scene'));
  SFX.enabled = !meta.muted;
  $('#btnMute').textContent = meta.muted ? '🔇' : '🔊';
  showTitle();

  // 调试入口
  window.__forge = { get state() { return st; }, Game: Game, render: renderAll, hammer: doHammer, openShop: openShop, openGhost: openGhost, askBell: askBell };

  // 开发用：#demo=N 自动开局并敲 N 锤（用于截图测试）
  if (/selftest/.test(location.hash)) {
    const errs = [];
    window.addEventListener('error', e => errs.push(e.message));
    try {
      localStorage.removeItem(SAVE_KEY);
      newRun();
      $('#modal [data-pick]').click();
      for (let day = 0; day < 8; day++) {
        for (let i = 0; i < 40; i++) {
          if (!Game.anvilSword(st)) { const r = st.swords.find(x => x.place === 'rack'); if (!r) break; placeSword(r.id); }
          Game.heat(st);
          resolveHit();
          Game.tick(st, 0.4);
        }
        st.coins += 3; st.gold += 3000;
        openShop();
        const b = $('#modal [data-buy]:not([disabled])'); if (b) b.click();
        const sb = $('#modal [data-sell]'); if (sb) sb.click();
        $('#shopRefresh') && $('#shopRefresh').click();
        closeModal();
        if (st.merchant) { openGhost(); $$('#modal [data-buy]').forEach(x => x.click()); closeModal(); }
        if (st.consumables.scale) { selCons = Object.keys(st.consumables).indexOf('scale'); useSelectedCons(); }
        st.swords.filter(x => x.place === 'rack').forEach(x => toggleAltar(x.id));
        askBell(); $('#bOk').click();
        if (st.over) break;
        $('#nextDay').click();
        st.rage = 0;
      }
      showHelp(); closeModal();
    } catch (e) { errs.push('EXC ' + e.message + ' ' + e.stack); }
    document.title = 'SELFTEST ' + (errs.length ? 'FAIL ' + errs.join(' | ') : 'OK day=' + st.day + ' relics=' + st.relics.length + ' hammers=' + st.stats.hammers);
  }
  function $$(s) { return document.querySelectorAll(s); }

  const m = location.hash.match(/demo=(\d+)/);
  if (m) {
    localStorage.removeItem(SAVE_KEY);
    newRun();
    Game.chooseStarter(st, st.starterChoices[0]);
    closeModal();
    placeSword(st.swords[0].id);
    Game.heat(st);
    if (/frenzy/.test(location.hash)) Game.anvilSword(st).charge = 10;
    if (/big/.test(location.hash)) { const a = Game.anvilSword(st); a.level = 11; a.mult = Math.pow(1.5, 11); }
    if (/break/.test(location.hash)) { const a = Game.anvilSword(st); a.level = 10; a.mult = Math.pow(1.5, 10); Game.setRandom(() => 0.01); resolveHit(); Game.setRandom(Math.random); }
    for (let i = 0; i < +m[1]; i++) if (Game.anvilSword(st)) resolveHit();
    if (/shop/.test(location.hash)) { st.coins = 3; openShop(); }
    if (/ghost/.test(location.hash)) { st.day = 3; st.gold = 5000; Game.rollMerchant(st); renderAll(); openGhost(); }
    if (/bell/.test(location.hash)) { st.swords.forEach(x => Game.toggleAltar(st, x.id)); ringBell(); }
    if (/unlock/.test(location.hash)) { meta.unlocked = {}; checkUnlocks([{ type: 'unlockCheck', key: 'firstBreak' }]); }
    renderAll();
  }
})();
