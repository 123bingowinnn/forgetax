/* 铸剑大师 - Canvas 工坊场景：砖墙、熔炉、铁砧、剑、锤子、火花、碎片 */
(function (G) {
  'use strict';

  const VW = 1600, VH = 900;
  const R = {
    view: { sword: null, frenzy: false, frenzyT: 0, chargeFull: false, legacy: false },
  };

  let cv, cx, dpr = 1, scale = 1, offX = 0, offY = 0;
  let wallCache = null;
  let t0 = performance.now(), time = 0;

  // 锤子动画
  const hammer = { phase: 'rest', t: 0, angle: 0, onImpact: null, dur: 0.5 };
  const PIVOT = { x: 1230, y: 1040 };
  const HANDLE = 640;
  const FACE_D = 145;         // 柄端到打击面的距离
  const REST_ANGLE = -1.66;   // 抬起
  let STRIKE_ANGLE = -2.2;    // 落下（按剑的厚度动态计算）
  hammer.angle = REST_ANGLE;

  // 求出让打击面刚好落在剑面上的角度
  function solveStrike(level) {
    const sp = swordPos(level);
    const targetY = sp.y - sp.geo.bw / 2 - 4;
    let best = -2.2, bestErr = 1e9;
    for (let a = -1.8; a >= -2.6; a -= 0.005) {
      const f = strikeFace(a);
      const err = Math.abs(f.y - targetY);
      if (err < bestErr) { bestErr = err; best = a; }
    }
    return best;
  }

  const particles = [];
  const shards = [];
  const floaters = []; // 世界空间漂浮文字（在 DOM 做，这里留空）
  let shake = 0, flash = 0, flashColor = '255,255,255';
  let heatAnim = 0;      // 加热动画 0..1
  let swordIn = 1;       // 放剑滑入 0..1
  let hitBounce = 0;
  let lastSwordId = null;
  let ambientGreen = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    scale = Math.max(w / VW, h / VH);
    offX = (w - VW * scale) / 2;
    offY = (h - VH * scale) / 2;
    buildWall();
  }

  /* ---------------- 砖墙（离屏缓存） ---------------- */
  function buildWall() {
    wallCache = document.createElement('canvas');
    wallCache.width = VW; wallCache.height = VH;
    const g = wallCache.getContext('2d');
    g.fillStyle = '#1a120d';
    g.fillRect(0, 0, VW, VH);
    const bw = 150, bh = 56, gap = 7;
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let row = 0; row * bh < VH; row++) {
      const off = (row % 2) * bw / 2;
      for (let x = -bw; x < VW + bw; x += bw) {
        const bx = x + off, by = row * bh;
        const r = rnd();
        const base = 70 + r * 26;
        g.fillStyle = `rgb(${base + 34},${base * 0.62 + 10},${base * 0.42})`;
        g.fillRect(bx + gap / 2, by + gap / 2, bw - gap, bh - gap);
        // 顶部高光 / 底部阴影，营造低多边形质感
        g.fillStyle = 'rgba(255,220,180,0.07)';
        g.fillRect(bx + gap / 2, by + gap / 2, bw - gap, 6);
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(bx + gap / 2, by + bh - gap / 2 - 7, bw - gap, 7);
        if (rnd() < 0.18) { // 污渍
          g.fillStyle = 'rgba(20,10,5,' + (0.15 + rnd() * 0.2) + ')';
          g.beginPath();
          g.ellipse(bx + rnd() * bw, by + rnd() * bh, 10 + rnd() * 25, 6 + rnd() * 10, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    // 光照：中央暖光
    const lg = g.createRadialGradient(780, 420, 40, 780, 470, 900);
    lg.addColorStop(0, 'rgba(255,180,110,0.28)');
    lg.addColorStop(0.45, 'rgba(120,60,30,0.05)');
    lg.addColorStop(1, 'rgba(0,0,0,0.78)');
    g.fillStyle = lg;
    g.fillRect(0, 0, VW, VH);
  }

  /* ---------------- 熔炉 ---------------- */
  function drawFurnace(g) {
    const x = 60, y = 600;
    // 炉体
    g.fillStyle = '#231a16';
    g.beginPath();
    g.moveTo(x - 80, VH); g.lineTo(x - 80, y + 40); g.quadraticCurveTo(x + 110, y - 90, x + 300, y + 40); g.lineTo(x + 300, VH);
    g.closePath(); g.fill();
    g.strokeStyle = '#3b2c24'; g.lineWidth = 6; g.stroke();
    // 炉口
    const flick = 0.75 + 0.25 * Math.sin(time * 13) * Math.sin(time * 7.3) + heatAnim * 0.8;
    const fg = g.createRadialGradient(x + 110, y + 170, 10, x + 110, y + 170, 170);
    fg.addColorStop(0, `rgba(255,240,170,${0.95 * Math.min(1, flick)})`);
    fg.addColorStop(0.35, `rgba(255,140,40,${0.8 * Math.min(1, flick)})`);
    fg.addColorStop(1, 'rgba(120,30,0,0)');
    g.fillStyle = '#0d0806';
    g.beginPath();
    g.moveTo(x + 10, VH - 30); g.lineTo(x + 10, y + 130); g.quadraticCurveTo(x + 110, y + 50, x + 210, y + 130); g.lineTo(x + 210, VH - 30); g.closePath();
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = fg;
    g.fillRect(x - 60, y, 340, 300);
    // 火舌
    for (let i = 0; i < 7; i++) {
      const fx = x + 30 + i * 26;
      const fh = 50 + 40 * Math.abs(Math.sin(time * (4 + i) + i)) + heatAnim * 60;
      g.fillStyle = `rgba(255,${150 + i * 10},60,0.55)`;
      g.beginPath();
      g.moveTo(fx - 16, VH - 30);
      g.quadraticCurveTo(fx, VH - 30 - fh * 1.3, fx + 16, VH - 30);
      g.fill();
    }
    g.restore();
    // 炉光照亮墙面
    g.save();
    g.globalCompositeOperation = 'lighter';
    const wg = g.createRadialGradient(x + 110, y + 160, 20, x + 110, y + 160, 520);
    wg.addColorStop(0, `rgba(255,120,40,${0.22 * flick})`);
    wg.addColorStop(1, 'rgba(255,80,20,0)');
    g.fillStyle = wg;
    g.fillRect(0, 200, 800, 700);
    g.restore();
  }

  /* ---------------- 铁砧 ---------------- */
  function drawAnvil(g) {
    const top = 660;
    g.save();
    // 阴影
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.beginPath(); g.ellipse(820, 890, 520, 40, 0, 0, Math.PI * 2); g.fill();
    // 底座
    g.fillStyle = '#1d1917';
    g.beginPath();
    g.moveTo(560, 900); g.lineTo(620, 780); g.lineTo(1020, 780); g.lineTo(1090, 900); g.closePath(); g.fill();
    // 腰
    g.fillStyle = '#25201d';
    g.beginPath();
    g.moveTo(640, 790); g.lineTo(700, 710); g.lineTo(960, 710); g.lineTo(1000, 790); g.closePath(); g.fill();
    // 主体（含砧角）
    const body = g.createLinearGradient(0, top, 0, top + 70);
    body.addColorStop(0, '#4a403a');
    body.addColorStop(0.15, '#2e2723');
    body.addColorStop(1, '#1b1714');
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(250, top + 6);          // 砧角尖
    g.quadraticCurveTo(400, top - 4, 470, top - 4);
    g.lineTo(1230, top - 4);
    g.lineTo(1240, top + 60);
    g.lineTo(660, top + 64);
    g.quadraticCurveTo(470, top + 60, 250, top + 6);
    g.closePath();
    g.fill();
    // 顶面高光边
    g.strokeStyle = 'rgba(255,200,150,0.35)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(262, top + 4); g.quadraticCurveTo(400, top - 6, 470, top - 6); g.lineTo(1230, top - 6); g.stroke();
    // 顶面光斑
    const sg = g.createRadialGradient(820, top, 10, 820, top, 380);
    sg.addColorStop(0, 'rgba(255,190,130,0.20)');
    sg.addColorStop(1, 'rgba(255,190,130,0)');
    g.fillStyle = sg;
    g.fillRect(400, top - 10, 840, 40);
    g.restore();
  }

  /* ---------------- 剑 ---------------- */
  function tierOf(level) {
    if (level <= 2) return 0;
    if (level <= 5) return 1;
    if (level <= 9) return 2;
    if (level <= 14) return 3;
    return 4;
  }

  const TIER_COLORS = [
    { light: '#f0a58a', dark: '#b8644c', edge: '#7a3a2a' },   // 生铁/铜色
    { light: '#f4f5f6', dark: '#b9bec4', edge: '#6c737a' },   // 精钢
    { light: '#d9d2c6', dark: '#8f877c', edge: '#4b443d' },   // 厚铁板
    { light: '#fff3d4', dark: '#e1c48c', edge: '#a46c2a' },   // 白金
    { light: '#ffe0ff', dark: '#b48cff', edge: '#5a2a9a' },   // 魔力
  ];

  function rainbow(g, x0, x1, t) {
    const gr = g.createLinearGradient(x0, -60, x1, 60);
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const h = ((i / n) * 360 + t * 240) % 360;
      gr.addColorStop(i / n, `hsl(${h},100%,62%)`);
    }
    return gr;
  }

  /** 剑沿 +x 方向，原点为剑格中心 */
  function swordGeom(level) {
    const L = Math.min(level, 22);
    const tier = tierOf(level);
    const bladeLen = 300 + L * 13;
    const bw = 30 + L * 3.4 + (tier >= 2 ? 10 : 0);
    return { L: L, tier: tier, bladeLen: bladeLen, bw: bw, grip: 80 + L * 2, guardW: 18 + L * 0.8, guardH: bw * 1.9 + 16 };
  }

  function drawSword(g, level, o) {
    const geo = swordGeom(level);
    const c = TIER_COLORS[geo.tier];
    const bl = geo.bladeLen, hw = geo.bw / 2;
    const frenzy = o.frenzy;
    const tipLen = geo.tier === 2 ? hw * 1.1 : hw * 2.4;

    // 发光底
    if (frenzy || geo.tier >= 3 || o.heat > 0.05) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const col = frenzy ? `hsla(${(time * 200) % 360},100%,60%,0.35)` : (geo.tier >= 3 ? 'rgba(255,200,120,0.25)' : `rgba(255,90,30,${0.35 * o.heat})`);
      g.shadowColor = col; g.shadowBlur = 50;
      g.fillStyle = col;
      g.beginPath(); g.ellipse(bl / 2, 0, bl / 2 + 40, hw + 40, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }

    // 握柄
    const grip = geo.grip;
    g.fillStyle = '#3d2618';
    g.fillRect(-grip - geo.guardW / 2, -hw * 0.35 - 4, grip, hw * 0.7 + 8);
    g.fillStyle = '#6b4128';
    for (let i = 0; i < 5; i++) {
      g.fillRect(-grip - geo.guardW / 2 + 6 + i * (grip / 5), -hw * 0.35 - 4, grip / 10, hw * 0.7 + 8);
    }
    // 柄头
    const ph = hw * 0.75 + 8;
    g.fillStyle = geo.tier >= 3 ? '#f2c66d' : '#8a7a6a';
    g.beginPath();
    g.moveTo(-grip - geo.guardW / 2, -ph); g.lineTo(-grip - geo.guardW / 2 - 26, 0); g.lineTo(-grip - geo.guardW / 2, ph); g.closePath(); g.fill();

    // 剑身
    const bodyFill = frenzy ? rainbow(g, 0, bl, time) : null;
    // 上半（亮）
    g.fillStyle = bodyFill || c.light;
    g.beginPath();
    g.moveTo(geo.guardW / 2, -hw);
    g.lineTo(bl - tipLen, -hw);
    g.lineTo(bl, 0);
    g.lineTo(geo.guardW / 2, 0);
    g.closePath(); g.fill();
    // 下半（暗）
    g.fillStyle = bodyFill || c.dark;
    g.beginPath();
    g.moveTo(geo.guardW / 2, 0);
    g.lineTo(bl, 0);
    g.lineTo(bl - tipLen, hw);
    g.lineTo(geo.guardW / 2, hw);
    g.closePath(); g.fill();
    if (frenzy) {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.beginPath(); g.moveTo(geo.guardW / 2, 0); g.lineTo(bl, 0); g.lineTo(bl - tipLen, hw); g.lineTo(geo.guardW / 2, hw); g.closePath(); g.fill();
    }

    // 不同阶段的细节
    g.strokeStyle = c.edge; g.lineWidth = 3;
    if (geo.tier <= 1) {
      // 血槽
      g.strokeStyle = frenzy ? 'rgba(255,255,255,0.6)' : c.edge;
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(geo.guardW / 2 + 20, -3); g.lineTo(bl - tipLen - 20, -3); g.stroke();
    } else if (geo.tier === 2) {
      // 铁板分段 + 铆钉
      const seg = 3 + Math.floor((level - 6) / 2);
      for (let i = 1; i < seg; i++) {
        const sx = geo.guardW / 2 + (bl - tipLen - geo.guardW / 2) * i / seg;
        g.strokeStyle = 'rgba(40,30,25,0.7)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(sx, -hw); g.lineTo(sx, hw); g.stroke();
      }
      g.fillStyle = 'rgba(60,50,40,0.9)';
      for (let i = 0; i < seg; i++) {
        const sx = geo.guardW / 2 + (bl - tipLen - geo.guardW / 2) * (i + 0.5) / seg;
        [-hw * 0.6, hw * 0.6].forEach(yy => { g.beginPath(); g.arc(sx, yy, 4, 0, Math.PI * 2); g.fill(); });
      }
    } else {
      // 发光分段（断了也不散的剑）
      const seg = 3 + Math.min(4, Math.floor((level - 10) / 2));
      for (let i = 1; i < seg; i++) {
        const sx = geo.guardW / 2 + (bl - tipLen - geo.guardW / 2) * i / seg;
        g.strokeStyle = frenzy ? 'rgba(255,255,255,0.8)' : 'rgba(255,140,40,0.95)'; g.lineWidth = 7;
        g.beginPath(); g.moveTo(sx, -hw); g.lineTo(sx, hw); g.stroke();
      }
      g.strokeStyle = 'rgba(255,170,60,0.9)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(geo.guardW / 2 + 8, -hw * 0.45); g.lineTo(bl - tipLen, -hw * 0.45); g.stroke();
    }

    // 加热的红光
    if (o.heat > 0.01) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const hg = g.createLinearGradient(0, 0, bl, 0);
      hg.addColorStop(0, `rgba(255,60,10,${0.15 * o.heat})`);
      hg.addColorStop(0.5, `rgba(255,120,30,${0.55 * o.heat})`);
      hg.addColorStop(1, `rgba(255,200,80,${0.35 * o.heat})`);
      g.fillStyle = hg;
      g.beginPath();
      g.moveTo(geo.guardW / 2, -hw); g.lineTo(bl - tipLen, -hw); g.lineTo(bl, 0); g.lineTo(bl - tipLen, hw); g.lineTo(geo.guardW / 2, hw); g.closePath();
      g.fill();
      g.restore();
    }

    // 剑格
    g.fillStyle = geo.tier >= 3 ? '#f5c66a' : (geo.tier === 0 ? '#e58f6d' : '#d9dde0');
    g.fillRect(-geo.guardW / 2, -geo.guardH / 2, geo.guardW, geo.guardH);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(-geo.guardW / 2, 0, geo.guardW, geo.guardH / 2);
    if (geo.tier >= 3) {
      g.save(); g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,220,140,0.6)';
      g.beginPath(); g.arc(0, 0, geo.guardW, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    return geo;
  }

  // 剑在场景中的位置（剑格中心）
  function swordPos(level) {
    const geo = swordGeom(level);
    const total = geo.grip + geo.bladeLen;
    return { x: 770 - total / 2 + geo.grip, y: 636 - Math.min(10, geo.bw * 0.1), geo: geo };
  }

  /* ---------------- 锤子 ---------------- */
  function hammerHeadPoint(angle) {
    return { x: PIVOT.x + Math.cos(angle) * HANDLE, y: PIVOT.y + Math.sin(angle) * HANDLE };
  }

  function drawHammer(g) {
    const a = hammer.angle;
    g.save();
    g.translate(PIVOT.x, PIVOT.y);
    g.rotate(a);
    // 柄
    g.fillStyle = '#4a2e20';
    g.fillRect(0, -18, HANDLE, 36);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(0, -18, HANDLE, 10);
    // 缠绳（红白相间，致敬原作）
    for (let i = 0; i < 9; i++) {
      const x = 90 + i * 26;
      g.fillStyle = i % 2 ? '#e6d6c8' : '#b8443a';
      g.beginPath();
      g.moveTo(x, -22); g.lineTo(x + 18, -22); g.lineTo(x + 26, 22); g.lineTo(x + 8, 22); g.closePath(); g.fill();
    }
    // 锤头：与柄垂直，打击面朝向“旋转后的 -y”方向
    g.translate(HANDLE, 0);
    const hl = 120, hwid = 190;
    g.fillStyle = '#2b2725';
    g.fillRect(-hl / 2, -hwid * 0.72, hl, hwid);
    g.fillStyle = '#4a4440';
    g.fillRect(-hl / 2, -hwid * 0.72, hl * 0.42, hwid);
    // 打击面
    g.fillStyle = '#6c635c';
    g.fillRect(-hl / 2 - 6, -hwid * 0.72 - 10, hl + 12, 18);
    g.fillStyle = '#1a1716';
    g.fillRect(-hl / 2 - 6, hwid * 0.28 - 8, hl + 12, 16);
    // 铁箍
    g.fillStyle = '#5a524c';
    g.fillRect(-hl / 2 - 3, -hwid * 0.2, hl + 6, 14);
    g.restore();
  }

  // 打击面中心（世界坐标）
  function strikeFace(angle) {
    const end = hammerHeadPoint(angle);
    // 局部 -y 方向旋转后为 (sin a, -cos a)
    const d = FACE_D;
    return { x: end.x + Math.sin(angle) * d, y: end.y - Math.cos(angle) * d };
  }

  /* ---------------- 粒子 ---------------- */
  function sparkBurst(x, y, n, color, power) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
      const sp = (250 + Math.random() * 750) * (power || 1);
      particles.push({
        x: x + (Math.random() - 0.5) * 40, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.8, max: 1.2, color: color || '255,190,90', size: 1.5 + Math.random() * 2.5, kind: 'spark',
      });
    }
  }

  function emberUp() {
    if (Math.random() < 0.3) {
      particles.push({ x: 80 + Math.random() * 180, y: 820, vx: (Math.random() - 0.3) * 40, vy: -40 - Math.random() * 80, life: 2 + Math.random() * 2, max: 4, color: '255,140,50', size: 1 + Math.random() * 2, kind: 'ember' });
    }
    if (R.view.frenzy && Math.random() < 0.8) {
      const sp = swordPos(R.view.sword ? R.view.sword.level : 0);
      particles.push({ x: sp.x + Math.random() * sp.geo.bladeLen, y: sp.y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 60, vy: -60 - Math.random() * 120, life: 0.8 + Math.random(), max: 1.8, color: null, hue: Math.random() * 360, size: 2 + Math.random() * 3, kind: 'ember' });
    }
  }

  function makeShards(level) {
    const sp = swordPos(level);
    const geo = sp.geo;
    const n = 9 + Math.min(10, level);
    const segLen = geo.bladeLen / n;
    const col = TIER_COLORS[geo.tier];
    for (let i = 0; i < n; i++) {
      const x0 = sp.x + geo.guardW / 2 + i * segLen;
      const hw = geo.bw / 2;
      const pts = [
        [0, -hw * (0.6 + Math.random() * 0.4)],
        [segLen * (0.8 + Math.random() * 0.4), -hw * (0.5 + Math.random() * 0.5)],
        [segLen * (0.8 + Math.random() * 0.4), hw * (0.5 + Math.random() * 0.5)],
        [0, hw * (0.6 + Math.random() * 0.4)],
      ];
      shards.push({
        x: x0, y: sp.y, pts: pts,
        vx: (Math.random() - 0.4) * 900, vy: -300 - Math.random() * 700,
        rot: 0, vr: (Math.random() - 0.5) * 18, life: 2.2,
        color: Math.random() < 0.5 ? col.light : col.dark,
      });
    }
    // 剑柄掉落
    shards.push({ x: sp.x - geo.grip, y: sp.y, pts: [[0, -10], [geo.grip, -10], [geo.grip, 10], [0, 10]], vx: -200, vy: -350, rot: 0, vr: -6, life: 2.2, color: '#4a2e20' });
  }

  /* ---------------- 主循环 ---------------- */
  function update(dt) {
    time += dt;
    // 锤子
    if (hammer.phase === 'down') {
      hammer.t += dt / (hammer.dur * 0.45);
      const k = Math.min(1, hammer.t);
      const e = k * k * k;
      hammer.angle = REST_ANGLE + (STRIKE_ANGLE - REST_ANGLE) * e;
      if (k >= 1) {
        hammer.phase = 'up'; hammer.t = 0;
        const cb = hammer.onImpact; hammer.onImpact = null;
        if (cb) cb();
      }
    } else if (hammer.phase === 'up') {
      hammer.t += dt / (hammer.dur * 0.55);
      const k = Math.min(1, hammer.t);
      const e = 1 - Math.pow(1 - k, 2);
      hammer.angle = STRIKE_ANGLE + (REST_ANGLE - STRIKE_ANGLE) * e;
      if (k >= 1) { hammer.phase = 'rest'; hammer.angle = REST_ANGLE; }
    } else {
      hammer.angle = REST_ANGLE + Math.sin(time * 1.6) * 0.012;
    }

    shake = Math.max(0, shake - dt * 60);
    flash = Math.max(0, flash - dt * 2.5);
    hitBounce = Math.max(0, hitBounce - dt * 6);
    heatAnim = Math.max(0, heatAnim - dt * 0.8);
    swordIn = Math.min(1, swordIn + dt * 3.5);
    ambientGreen += ((R.view.frenzy ? 1 : 0) - ambientGreen) * Math.min(1, dt * 5);

    emberUp();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'spark') { p.vy += 1400 * dt; p.vx *= 0.99; if (p.y > 662 && p.vy > 0 && p.x > 260 && p.x < 1240) { p.y = 662; p.vy *= -0.35; p.vx *= 0.6; } }
      else { p.vx += Math.sin(time * 3 + p.y * 0.02) * 10 * dt; }
    }
    for (let i = shards.length - 1; i >= 0; i--) {
      const s = shards[i];
      s.life -= dt;
      if (s.life <= 0) { shards.splice(i, 1); continue; }
      s.vy += 1800 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
      if (s.y > 860) { s.y = 860; s.vy *= -0.3; s.vx *= 0.5; s.vr *= 0.5; }
    }
  }

  function draw() {
    const g = cx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#000';
    g.fillRect(0, 0, cv.width, cv.height);
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (offX + sx * scale), dpr * (offY + sy * scale));

    g.drawImage(wallCache, 0, 0);
    drawFurnace(g);
    drawAnvil(g);

    // 剑
    const v = R.view;
    if (v.sword) {
      if (v.sword.id !== lastSwordId) { swordIn = 0; lastSwordId = v.sword.id; }
      const sp = swordPos(v.sword.level);
      const slide = (1 - swordIn) * -500;
      g.save();
      g.translate(sp.x + slide, sp.y - hitBounce * 10);
      // 轻微透视倾斜
      g.transform(1, 0, -0.08, 0.92, 0, 0);
      const heat = v.sword.heated ? 0.35 + 0.25 * Math.sin(time * 3) * 0.3 + heatAnim * 0.65 : heatAnim;
      // 阴影
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath(); g.ellipse(sp.geo.bladeLen / 2 - 30, sp.geo.bw * 0.6 + 14, sp.geo.bladeLen / 2 + 80, 12, 0, 0, Math.PI * 2); g.fill();
      drawSword(g, v.sword.level, { frenzy: v.frenzy, heat: Math.min(1, heat) });
      g.restore();
    } else {
      lastSwordId = null;
    }

    drawHammer(g);

    // 碎片
    shards.forEach(s => {
      g.save();
      g.translate(s.x, s.y); g.rotate(s.rot);
      g.globalAlpha = Math.min(1, s.life);
      g.fillStyle = s.color;
      g.beginPath();
      s.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
      g.closePath(); g.fill();
      g.restore();
    });

    // 粒子（叠加发光）
    g.save();
    g.globalCompositeOperation = 'lighter';
    particles.forEach(p => {
      const a = Math.min(1, p.life / (p.max * 0.5));
      const col = p.color ? `rgba(${p.color},${a})` : `hsla(${(p.hue + time * 200) % 360},100%,65%,${a})`;
      if (p.kind === 'spark') {
        g.strokeStyle = col; g.lineWidth = p.size;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018); g.stroke();
      } else {
        g.fillStyle = col;
        g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill();
      }
    });
    g.restore();

    // 入神：绿色氛围 + 彩色光束
    if (ambientGreen > 0.01) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(40,200,60,${0.16 * ambientGreen})`;
      g.fillRect(0, 0, VW, VH);
      for (let i = 0; i < 6; i++) {
        const x = ((time * 300 + i * 290) % (VW + 400)) - 200;
        const gr = g.createLinearGradient(x - 60, 0, x + 60, 0);
        gr.addColorStop(0, 'rgba(0,0,0,0)');
        gr.addColorStop(0.5, `hsla(${(i * 60 + time * 120) % 360},100%,60%,${0.08 * ambientGreen})`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(x - 60, 0, 120, VH);
      }
      g.restore();
    }

    // 暗角
    const vg = g.createRadialGradient(VW / 2, VH * 0.55, VH * 0.35, VW / 2, VH * 0.55, VH * 1.0);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.7)');
    g.fillStyle = vg;
    g.fillRect(0, 0, VW, VH);

    // 闪光
    if (flash > 0) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = `rgba(${flashColor},${Math.min(0.6, flash * 0.5)})`;
      g.fillRect(0, 0, cv.width, cv.height);
    }
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    if (R.onTick) R.onTick(dt);
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  /* ---------------- 对外接口 ---------------- */
  R.init = function (canvas) {
    cv = canvas;
    cx = cv.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(loop);
  };

  R.isSwinging = function () { return hammer.phase !== 'rest'; };
  R.canSwing = function () { return hammer.phase === 'rest' || (hammer.phase === 'up' && hammer.t > 0.55); };

  R.swing = function (onImpact, fast) {
    if (!R.canSwing()) return false;
    const wasUp = hammer.phase === 'up';
    hammer.phase = 'down';
    // 从半空中接续挥下，节奏更连贯
    hammer.t = wasUp ? Math.cbrt(Math.max(0, Math.min(1, (REST_ANGLE - hammer.angle) / (REST_ANGLE - STRIKE_ANGLE)))) : 0;
    hammer.dur = fast ? 0.36 : 0.5;
    STRIKE_ANGLE = solveStrike(R.view.sword ? R.view.sword.level : 0);
    hammer.onImpact = onImpact;
    return true;
  };

  const OUTCOME_FX = {
    break:   { color: '255,80,60',  n: 60, shake: 30, flash: 0.9, fc: '255,60,40' },
    damage:  { color: '255,150,60', n: 30, shake: 16, flash: 0.35, fc: '255,140,60' },
    hold:    { color: '255,210,140', n: 22, shake: 8, flash: 0.15, fc: '255,230,190' },
    success: { color: '255,200,110', n: 45, shake: 12, flash: 0.3, fc: '255,220,170' },
    great:   { color: '220,150,255', n: 90, shake: 22, flash: 0.8, fc: '210,160,255' },
  };

  R.impact = function (outcome, level, opts) {
    const fx = OUTCOME_FX[outcome] || OUTCOME_FX.hold;
    const face = strikeFace(STRIKE_ANGLE);
    const sp = swordPos(level);
    const ix = Math.min(Math.max(face.x, sp.x + 40), sp.x + sp.geo.bladeLen - 20);
    sparkBurst(ix, sp.y - 10, fx.n, fx.color, outcome === 'great' ? 1.3 : 1);
    if (opts && opts.frenzy) sparkBurst(ix, sp.y - 10, 30, null, 1.1);
    shake = Math.max(shake, fx.shake);
    flash = fx.flash; flashColor = fx.fc;
    hitBounce = 1;
    if (outcome === 'break') makeShards(level);
  };

  R.heat = function () { heatAnim = 1; };
  R.flash = function (c, a) { flashColor = c; flash = a; };
  R.shake = function (n) { shake = Math.max(shake, n); };

  // 屏幕坐标 -> 撞击点（供 DOM 浮字定位）
  R.impactScreenPos = function (level) {
    const face = strikeFace(STRIKE_ANGLE);
    const sp = swordPos(level || 0);
    const x = Math.min(Math.max(face.x, sp.x + 40), sp.x + sp.geo.bladeLen - 20);
    return { x: offX + x * scale, y: offY + (sp.y - 60) * scale };
  };

  // 供预览缩略图使用
  R.drawSwordIcon = function (canvas, level, opts) {
    const g = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    g.clearRect(0, 0, w, h);
    const geo = swordGeom(level);
    const total = geo.grip + geo.bladeLen + 40;
    const s = Math.min((w - 8) / total, (h - 6) / (geo.guardH + 10));
    g.save();
    const center = (geo.bladeLen - geo.grip - geo.guardW / 2 - 26) / 2;
    g.translate(w / 2 - center * s, h / 2);
    g.scale(s, s);
    drawSword(g, level, opts || { heat: 0 });
    g.restore();
  };

  G.Renderer = R;
})(window);
