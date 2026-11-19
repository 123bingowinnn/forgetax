// 截图测试场景：dev.html#shot=<名称>[&lv=12][&fr=1]
const F = window.__ft;
const P = new URLSearchParams(location.hash.slice(1));
const name = P.get('shot');
const lv = +(P.get('lv') || 6);
const { G } = F;
const out = document.documentElement.dataset;

function setup() {
  localStorage.clear();
  F.newRun();
  const st = F.st;
  if (!P.get('tut')) { G.buyVend(st, 0, {}); F.tutorialEvent && document.querySelector('#tutorial').classList.add('hidden'); }
  document.querySelector('#modal').classList.add('hidden');
  F.phase = 'play';
  if (P.get('relics')) st.relics = P.get('relics').split(',');
  F.changed();
  document.querySelector('#resume').classList.add('hidden');
  return st;
}

function anvil(st, level, frenzy) {
  const s = st.swords[0];
  s.level = level; s.peak = level; s.heated = true; s.loc = 'hand';
  if (P.get('form')) { const f = +P.get('form'); for (const k in F.D.FAMILIES) { const i = F.D.FAMILIES[k].forms.indexOf(f); if (i >= 0) { if (F.D.FAMILIES[k].special) { s.family = k; } else { s.lane = F.D.FAMILIES[k].lane; s.branch = F.D.FAMILIES[k].branch; s.hidden = !!F.D.FAMILIES[k].hidden; } } } }
  if (P.get('lane')) s.lane = P.get('lane');
  if (P.get('variant')) s.variant = P.get('variant');
  if (P.get('hidden')) s.hidden = true;
  G.putOnAnvil(st);
  if (frenzy) { st.frenzy = { active: true, timeLeft: 3.2, swordId: s.id, presses: 0 }; }
  st.lastResult = { outcome: 'success', levelDelta: 1, delta: 1234, ratio: 1.5, swordId: s.id };
  F.changed();
  F.enterAnvil();
  F.step(40, 1 / 30);
  F.phase = 'anvil';
  F.changed();
  return s;
}

try {
  const st = setup();
  switch (name) {
    case 'walk': F.tp(0, 0.3); F.lookAt(0, 1.3, 3); break;
    case 'rack': F.tp(1.6, 0.9); F.lookAt(3.5, 1.2, 0.95); break;
    case 'shelf': F.tp(1.8, -1.3); F.lookAt(3.5, 1.2, -1.35); break;
    case 'furnace': F.tp(-1.8, 1.4); F.lookAt(-3.5, 0.9, 1.45); break;
    case 'cage': F.tp(-1.2, -0.6); F.lookAt(-1.2, 1.1, -3); break;
    case 'vend': F.tp(1.6, -0.9); F.lookAt(1.7, 1.2, -3); break;
    case 'room': F.tp(2.6, 2.2); F.lookAt(-1.5, 1.0, -2.0); break;
    case 'room2': F.tp(-2.4, 2.2); F.lookAt(1.5, 1.0, -2.5); break;
    case 'ghost': st.day = +(P.get('day') || 6); G.rollGhost(st); st.gold = 99999; F.changed(); F.tp(-1.4, -0.7); F.lookAt(-3.5, 1.1, -0.75); break;
    case 'hand': G.takeToHand(st, st.swords[0].id); F.changed(); F.tp(0.5, 0.2); F.lookAt(1.7, 1.1, -3); break;
    case 'prompt': F.tp(2.2, 0.9); F.lookAt(3.5, 1.15, 0.9); break;
    case 'anvil': anvil(st, lv, P.get('fr') === '1'); break;
    case 'hit': {
      anvil(st, lv, P.get('fr') === '1');
      for (let i = 0; i < (+P.get('n') || 1); i++) { F.doHammer(); F.step(8, 1 / 60); F.step(12, 1 / 30); }
      break;
    }
    case 'break': {
      anvil(st, lv);
      G.setRandom(() => 0.001);
      F.doHammer(); F.step(10, 1 / 60);
      G.setRandom(Math.random);
      F.step(4, 1 / 30);
      break;
    }
    case 'flow': {
      const log = [];
      const E = () => { F.updatePrompt(); const t = F.findTarget(); const r = F.pressE(); log.push((t ? t.data.kind : 'none') + ':' + r); out.flow = log.join(' ; '); return r; };
      // 1 拿剑
      { const g = F.scene.getObjectByProperty('type', 'Scene'); }
      const sw0 = G.rackSwords(st)[0]; const wp = new F.THREE.Vector3(); F.swordObj(sw0.id).getWorldPosition(wp); log.push('sw0@' + wp.toArray().map(v => v.toFixed(2)).join(','));
      F.tp(2.3, wp.z); F.lookAt(wp.x, wp.y + 0.15, wp.z); F.step(2);
      E(); log.push('hand=' + !!G.handSword(st));
      // 2 熔炉加热（动画用 rAF，这里直接调用逻辑）
      F.tp(-2.2, 1.45); F.lookAt(-3.4, 0.95, 1.45); F.step(2);
      const fp = E(); if (!G.furnaceSword(st)) throw new Error('no furnace sword: ' + log.join(' ; '));
      G.heatSword(st, G.furnaceSword(st).id); G.furnaceSword(st).loc = 'hand'; F.phase = 'play'; F.changed();
      log.push('heated=' + G.handSword(st).heated);
      // 3 放上铁砧
      F.tp(0, 1.4); F.lookAt(0, 0.95, 2.35); F.step(2);
      E(); F.step(30); F.phase = 'anvil';
      let rr = 0; G.setRandom(() => [0.5, 0.95, 0.3, 0.5, 0.97, 0.5][rr++ % 6]);
      for (let i = 0; i < 6; i++) { if (!G.anvilSword(st)) break; F.doHammer(); F.step(10, 1 / 60); F.step(12, 1 / 30); }
      log.push('lvl=' + (G.anvilSword(st) ? G.anvilSword(st).level : 'broken'));
      G.setRandom(Math.random);
      // 4 拿着剑离开 -> 贡台
      if (G.anvilSword(st)) { F.leaveAnvil(true); F.step(30); }
      F.phase = 'play'; F.player.mode = 'walk';
      F.tp(-1.2, -1.2); F.lookAt(-1.2, 0.9, -2.4); F.step(2);
      E(); log.push('altar=' + G.altarTotal(st));
      // 5 投剑
      const s2 = G.rackSwords(st)[0]; G.takeToHand(st, s2.id); F.changed();
      const sp = new F.THREE.Vector3(); F.W.vending.userData.slot.getWorldPosition(sp); log.push('slot@' + sp.toArray().map(v => v.toFixed(2)).join(','));
      F.tp(sp.x, -1.3); F.lookAt(sp.x, sp.y, sp.z); F.step(2);
      log.push('slotPrompt=' + E());
      out.flow = log.join(' ; ');
      break;
    }
    case 'tribute': {
      st.swords.forEach((s, i) => { s.level = s.peak = 4 + i; s.loc = 'hand'; G.putOnAltar(st); });
      F.changed();
      F.tp(-1.2, -1.0); F.lookAt(-1.2, 0.9, -2.4);
      F.ringBell();
      break;
    }
    case 'codex': { const D = F.D; Object.keys(D.FORM_NAMES).forEach((f, i) => { if (i % 3 !== 2) F.meta.codex[f] = 1; }); F.showCodex(P.get('tab') || 'forms'); break; }
    case 'title': F.showTitle(); break;
    case 'touchtest': {
      const log = [];
      const pe = (el, type, x, y, id = 1) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true }));
      const zMove = document.getElementById('tzMove'), zLook = document.getElementById('tzLook');
      log.push('ui=' + !!zMove + '/' + document.body.classList.contains('touch'));
      // 摇杆：向前推 0.5 秒
      const z0 = F.player.pos.z, x0 = F.player.pos.x;
      pe(zMove, 'pointerdown', 100, innerHeight - 100); pe(zMove, 'pointermove', 100, innerHeight - 160);
      F.step(15, 1 / 30);
      pe(zMove, 'pointerup', 100, innerHeight - 160);
      log.push('moved=' + Math.hypot(F.player.pos.z - z0, F.player.pos.x - x0).toFixed(2));
      // 视角拖动
      const yaw0 = F.player.yaw;
      pe(zLook, 'pointerdown', innerWidth - 200, 200, 2); pe(zLook, 'pointermove', innerWidth - 120, 200, 2); pe(zLook, 'pointerup', innerWidth - 120, 200, 2);
      log.push('turned=' + (F.player.yaw - yaw0).toFixed(2));
      // 点按剑架上的剑 → 拿起
      const sw = G.rackSwords(st)[0]; const wp = new F.THREE.Vector3(); F.swordObj(sw.id).getWorldPosition(wp); wp.y += 0.15;
      F.tp(-0.5, 0.2); F.lookAt(wp.x, wp.y, wp.z); F.step(2);   // 远距离点按：应自动走过去再拿
      const v = wp.clone().project(F.camera); const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight;
      pe(zLook, 'pointerdown', sx + 14, sy + 10, 3); pe(zLook, 'pointerup', sx + 14, sy + 10, 3);
      F.step(60, 1 / 30);
      log.push('tapPick=' + !!G.handSword(st) + ' at=' + F.player.pos.x.toFixed(2) + ',' + F.player.pos.z.toFixed(2));
      // 交互按钮：对准熔炉后点「交互」
      F.tp(-2.2, 1.45); F.lookAt(-3.4, 0.95, 1.45); F.step(2);
      const act = document.getElementById('tbAct'); log.push('actLabel=' + act.textContent.trim() + ' phase=' + F.phase + ' tgt=' + (F.findTarget() && F.findTarget().data.kind) + ' pos=' + F.player.pos.x.toFixed(2) + ',' + F.player.pos.z.toFixed(2) + ' mode=' + F.player.mode + ' info=' + JSON.stringify(F.target && F.target.info && F.target.info.act) + ' modal=' + !document.getElementById('modal').classList.contains('hidden'));
      act.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 4, bubbles: true, cancelable: true, pointerType: 'touch' }));
      log.push('inFurnace=' + !!G.furnaceSword(st));
      const fs = G.furnaceSword(st); if (fs) { G.heatSword(st, fs.id); fs.loc = 'hand'; F.phase = 'play'; F.changed(); }
      F.tp(0, 1.4); F.lookAt(0, 0.95, 2.35); F.step(2);
      act.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 5, bubbles: true, cancelable: true, pointerType: 'touch' }));
      F.step(30); F.phase = 'anvil'; F.step(1);
      const h0 = G.anvilSword(st) ? G.anvilSword(st).hammers : -1;
      pe(zLook, 'pointerdown', innerWidth / 2, innerHeight / 2, 6); F.step(10, 1 / 60); F.step(12, 1 / 30);
      document.getElementById('tbHit').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, bubbles: true, cancelable: true, pointerType: 'touch' })); F.step(10, 1 / 60); F.step(12, 1 / 30);
      log.push('hammers=' + h0 + '->' + (G.anvilSword(st) ? G.anvilSword(st).hammers : 'broke'));
      out.flow = log.join(' ; ');
      break;
    }
    case 'help': F.showHelp(); break;
    case 'menu': F.showMenu(); break;
    case 'relist': st.relics = ['patched-apron','cracked-splice','unbroken-oath','giants-spine','dragon-heart','abyssal-pearl']; F.changed(); F.toggleRelicList(true); break;
    case 'tut': F.tp(0.3, 0.6); F.lookAt(3, 1.4, 0.9); break;
    case 'tutflow': {
      const log = [];
      const E = () => { F.updatePrompt(); const r = F.pressE(); log.push((F.tut ? F.tut.i : 'end') + ':' + r); out.flow = log.join(' ; '); return r; };
      const sw0 = G.rackSwords(st)[0]; const wp = new F.THREE.Vector3(); F.swordObj(sw0.id).getWorldPosition(wp);
      F.tp(2.3, wp.z); F.lookAt(wp.x, wp.y + 0.15, wp.z); F.step(2); E();
      F.tp(-2.2, 1.45); F.lookAt(-3.4, 0.95, 1.45); F.step(2); E();
      G.heatSword(st, G.furnaceSword(st).id); G.furnaceSword(st).loc = 'hand'; F.phase = 'play'; F.tutorialEvent('heat'); F.changed();
      F.tp(0, 1.4); F.lookAt(0, 0.95, 2.35); F.step(2); E(); F.step(30); F.phase = 'anvil';
      G.anvilSword(st).charge = 9;
      for (let i = 0; i < 4; i++) { if (!G.anvilSword(st)) break; F.doHammer(); F.step(10, 1 / 60); F.step(12, 1 / 30); }
      log.push('tut=' + (F.tut ? F.tut.i : 'end'));
      if (G.anvilSword(st)) { F.leaveAnvil(true); F.step(30); }
      F.phase = 'play'; F.player.mode = 'walk';
      F.tp(-1.2, -1.2); F.lookAt(-1.2, 0.9, -2.4); F.step(2); E();
      log.push('tut=' + (F.tut ? F.tut.i : 'end'));
      out.flow = log.join(' ; ');
      break;
    }
    case 'bell': {
      st.swords.forEach(s => { s.loc = 'hand'; G.putOnAltar(st); });
      F.changed();
      F.tp(-1.2, -0.9); F.lookAt(-1.2, 0.9, -2.4);
      break;
    }
  }
  const rh = document.getElementById('rotateHint'); if (rh && !P.get('rh')) rh.classList.add('hidden');
  F.step(Number(P.get('steps') || 20), 1 / 30);
  F.render();
  out.prompt = (document.querySelector('#prompt').innerText || '').replace(/\s+/g, ' ');
  out.ok = '1';
} catch (e) {
  out.errs = (out.errs || '') + ' SCENARIO: ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ');
}
