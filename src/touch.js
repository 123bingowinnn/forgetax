// 铸剑大师 - 移动端触屏操作：虚拟摇杆、拖动视角、点按交互、情境按钮
export const IS_TOUCH = /[#&?]touch/.test(location.href) ||
  (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ||
  (navigator.maxTouchPoints > 0 && !(typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches));

/** 把桌面按键提示改写成触屏说法 */
export function touchText(s) {
  if (!IS_TOUCH || !s) return s;
  return String(s)
    .replace(/（对准剑按 E）/g, '（点一下剑，或对准后点「交互」）')
    .replace(/对准([^，。<]*?)按 E/g, '对准$1点「交互」')
    .replace(/按 E/g, '点「交互」')
    .replace(/左键敲击/g, '点屏幕敲击')
    .replace(/P 跳过引导/g, '右上角「跳过」')
    .replace(/按 Q 使用：/g, '').replace(/在铁砧前按 Q 使用/g, '在铁砧前点「道具」使用').replace(/数字键选择 · Q 使用/g, '点道具选择，再点一次使用')
    .replace(/离开铁砧前按 R：/g, '离开铁砧前点「撤销」：').replace(/· R 撤销上一锤/g, '· 「撤销」上一锤').replace(/R 可撤销/g, '可撤销')
    .replace(/按 X 丢弃一件/g, '点「丢弃」扔掉一件').replace(/按 C 查看图鉴/g, '点「图鉴」查看').replace(/关闭（C）/g, '关闭');
}

const ICON = {
  hand: '<svg viewBox="0 0 24 24"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5V4a1.5 1.5 0 0 1 3 0v6m0-4.5a1.5 1.5 0 0 1 3 0V12m0-3.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L3.6 15a1.6 1.6 0 0 1 2.6-1.8L8 15"/></svg>',
  hammer: '<svg viewBox="0 0 24 24"><path d="M14 4l6 6-3 3-6-6zM12.5 8.5L3 18l3 3 9.5-9.5"/></svg>',
};

/**
 * api: {
 *   phase(): 'title'|'play'|'anvil'|'busy'|'modal', modalOpen(): bool,
 *   player, tapAt(x, y), act(), actX(), actInfo(): {label, x}|null,
 *   hammer(), leave(), take(), useCons(), undo(), hasCons(), canUndo(),
 *   relics(), codex(), menu(), skipTut(), hasTut(), resumeAudio()
 * }
 */
export function initTouch(api) {
  if (!IS_TOUCH) return { update() {} };
  document.body.classList.add('touch');

  const ui = document.createElement('div');
  ui.id = 'touchUI';
  ui.innerHTML = `
    <div id="tzMove"></div><div id="tzLook"></div>
    <div id="tJoy" class="hidden"><div class="knob"></div></div>
    <div id="tTop">
      <button class="tb sm" id="tbSkip">跳过</button>
      <button class="tb sm" id="tbRelic">遗物</button>
      <button class="tb sm" id="tbCodex">图鉴</button>
      <button class="tb sm" id="tbMenu">☰</button>
    </div>
    <div id="tRight">
      <button class="tb" id="tbX">丢弃</button>
      <button class="tb big" id="tbAct">${ICON.hand}<span>交互</span></button>
    </div>
    <div id="tAnvil">
      <button class="tb" id="tbUndo">撤销</button>
      <button class="tb" id="tbUse">道具</button>
      <button class="tb" id="tbTake">拿剑离开</button>
      <button class="tb" id="tbLeave">放下离开</button>
      <button class="tb big hit" id="tbHit">${ICON.hammer}<span>敲击</span></button>
    </div>`;
  document.body.appendChild(ui);
  const $ = s => ui.querySelector(s);

  const tap = (id, fn) => {
    const b = $(id);
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); api.resumeAudio(); b.classList.add('down'); fn(e); });
    const up = () => b.classList.remove('down');
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  };
  tap('#tbAct', () => api.act());
  tap('#tbX', () => api.actX());
  tap('#tbHit', () => api.hammer());
  tap('#tbLeave', () => api.leave());
  tap('#tbTake', () => api.take());
  tap('#tbUse', () => api.useCons());
  tap('#tbUndo', () => api.undo());
  tap('#tbRelic', () => api.relics());
  tap('#tbCodex', () => api.codex());
  tap('#tbMenu', () => api.menu());
  tap('#tbSkip', () => api.skipTut());

  /* ---------- 摇杆（左下区域，触点即摇杆中心） ---------- */
  const joy = $('#tJoy'), knob = joy.querySelector('.knob');
  let joyId = null, jx = 0, jy = 0;
  const R = () => Math.max(42, Math.min(70, Math.min(innerWidth, innerHeight) * 0.12));
  const zMove = $('#tzMove');
  zMove.addEventListener('pointerdown', e => {
    api.resumeAudio();
    if (api.phase() !== 'play' || joyId !== null) return;
    joyId = e.pointerId; jx = e.clientX; jy = e.clientY;
    try { zMove.setPointerCapture(e.pointerId); } catch (_) { }
    joy.style.left = jx + 'px'; joy.style.top = jy + 'px';
    joy.style.width = joy.style.height = R() * 2 + 'px';
    joy.classList.remove('hidden');
    knob.style.transform = 'translate(-50%,-50%)';
  });
  zMove.addEventListener('pointermove', e => {
    if (e.pointerId !== joyId) return;
    const r = R();
    let dx = e.clientX - jx, dy = e.clientY - jy;
    const d = Math.hypot(dx, dy);
    if (d > r) { dx *= r / d; dy *= r / d; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const m = Math.min(1, d / r);
    const k = m < 0.12 ? 0 : (m - 0.12) / 0.88;
    api.player.joy.x = d ? dx / Math.min(d, r) * k : 0;
    api.player.joy.y = d ? -dy / Math.min(d, r) * k : 0;
  });
  const endJoy = e => {
    if (e.pointerId !== joyId) return;
    joyId = null; api.player.joy.x = api.player.joy.y = 0; joy.classList.add('hidden');
  };
  zMove.addEventListener('pointerup', endJoy); zMove.addEventListener('pointercancel', endJoy);

  /* ---------- 视角拖动 + 点按（右侧/铁砧时全屏） ---------- */
  const looks = new Map();
  const onLookDown = (zone) => e => {
    api.resumeAudio();
    const ph = api.phase();
    if (ph === 'anvil') { api.hammer(); return; }   // 铁砧前：点哪里都是敲
    if (ph !== 'play') return;
    try { zone.setPointerCapture(e.pointerId); } catch (_) { }
    looks.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 });
  };
  const onLookMove = e => {
    const L = looks.get(e.pointerId); if (!L) return;
    const dx = e.clientX - L.x, dy = e.clientY - L.y;
    L.x = e.clientX; L.y = e.clientY; L.moved += Math.abs(dx) + Math.abs(dy);
    const sens = 0.0055 * Math.max(0.75, Math.min(1.4, 800 / Math.max(innerWidth, innerHeight)));
    api.player.look(dx, dy, sens);
  };
  const onLookUp = e => {
    const L = looks.get(e.pointerId); if (!L) return;
    looks.delete(e.pointerId);
    if (L.moved < 12 && performance.now() - L.t < 350 && api.phase() === 'play') api.tapAt(e.clientX, e.clientY);
  };
  const zLook = $('#tzLook');
  [zLook, zMove].forEach(z => {
    if (z === zLook) z.addEventListener('pointerdown', onLookDown(z));
    z.addEventListener('pointermove', onLookMove);
    z.addEventListener('pointerup', onLookUp);
    z.addEventListener('pointercancel', e => looks.delete(e.pointerId));
  });
  // 左侧区域在铁砧模式下也能敲
  zMove.addEventListener('pointerdown', e => { if (api.phase() === 'anvil') api.hammer(); });

  // 阻止页面滚动/缩放/长按菜单
  ['gesturestart', 'gesturechange'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
  document.addEventListener('contextmenu', e => e.preventDefault());
  let lastTouchEnd = 0;
  document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTouchEnd < 320 && !e.target.closest('#modal')) e.preventDefault(); lastTouchEnd = n; }, { passive: false });

  let lastKey = '';
  return {
    update() {
      const ph = api.phase();
      const modal = api.modalOpen();
      const play = ph === 'play' && !modal, anvil = ph === 'anvil' && !modal;
      const info = play ? api.actInfo() : null;
      const key = [ph, modal, info && info.label, info && info.x, api.hasCons(), api.canUndo(), api.hasTut()].join('|');
      if (key === lastKey) return;
      lastKey = key;
      ui.classList.toggle('off', ph === 'title' || modal);
      $('#tRight').style.display = play ? '' : 'none';
      $('#tAnvil').style.display = anvil ? '' : 'none';
      $('#tTop').style.display = (play || anvil) ? '' : 'none';
      $('#tbSkip').style.display = api.hasTut() ? '' : 'none';
      const act = $('#tbAct');
      act.classList.toggle('dim', !info || !info.label);
      act.querySelector('span').textContent = (info && info.label) || '交互';
      $('#tbX').style.display = info && info.x ? '' : 'none';
      $('#tbUse').style.display = api.hasCons() ? '' : 'none';
      $('#tbUndo').style.display = api.canUndo() ? '' : 'none';
      if (!play && joyId !== null) { joyId = null; api.player.joy.x = api.player.joy.y = 0; joy.classList.add('hidden'); }
    },
  };
}
