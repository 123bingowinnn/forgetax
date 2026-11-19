// 铸剑大师 - 场景内的「文字物件」：锻造信息面板、日历、贡品板、售货机屏幕等（CanvasTexture）
import * as THREE from 'three';
import { OUTCOMES, OUTCOME_ORDER, dateOf } from './data.js';

export const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif';
const fmt = n => Math.round(n).toLocaleString('en-US');

function canvasTex(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { canvas: c, ctx: c.getContext('2d'), tex: t };
}

/** 透明文字层：MeshBasic，不受光照，toneMapped=false 让亮字进入 Bloom */
function textPlane(w, h, pw, ph, glow = 1.0) {
  const ct = canvasTex(pw, ph);
  const mat = new THREE.MeshBasicMaterial({ map: ct.tex, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(glow, glow, glow) });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return Object.assign(ct, { mesh });
}

function woodBoardTexture(w, h, base = [72, 52, 38]) {
  const { canvas, ctx, tex } = canvasTex(w, h);
  ctx.fillStyle = `rgb(${base})`;
  ctx.fillRect(0, 0, w, h);
  // 竖向木纹 + 像素颗粒
  for (let x = 0; x < w; x += 2) {
    const k = Math.sin(x * 0.045) * 6 + Math.sin(x * 0.31) * 3 + (Math.random() - 0.5) * 6;
    ctx.fillStyle = `rgba(${k > 0 ? '255,230,200' : '0,0,0'},${Math.abs(k) / 90})`;
    ctx.fillRect(x, 0, 2, h);
  }
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,220,180'},${Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
  }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,220,170,0.10)');
  g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  return tex;
}

/* ================= 锻造信息面板（对照原作 ss2 / k_11 的版式与配色） ================= */
// 原作：深色烟熏铁板（暖灰褐），细边框，右侧两颗小方钉；奶白文字，五色结果栏与底部堆叠概率条
const PANEL_COL = {
  title: '#f3ede2', dim: 'rgba(236,228,214,0.86)', value: '#f1e9da',
  break: '#ff9b80', damage: '#f2b35e', hold: '#bfe38a', success: '#a3d7f2', great: '#e2a6f6',
  rule: { break: '#ff8a5c', damage: '#f0aa4e', hold: '#b4e07a', success: '#8fd0f0', great: '#df9cf5' },
};
function panelPlateTexture(w, h) {
  const { ctx, tex } = canvasTex(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#6a5b4d'); g.addColorStop(0.5, '#5a4c40'); g.addColorStop(1, '#473c33');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // 竖向的烟熏/拉丝条纹 + 像素颗粒（原作的面板有明显的低分辨率噪点）
  for (let x = 0; x < w; x += 4) {
    const k = Math.sin(x * 0.021) * 0.5 + Math.sin(x * 0.13 + 1.7) * 0.3 + (Math.random() - 0.5) * 0.6;
    ctx.fillStyle = k > 0 ? `rgba(255,236,210,${k * 0.035})` : `rgba(0,0,0,${-k * 0.06})`;
    ctx.fillRect(x, 0, 4, h);
  }
  for (let i = 0; i < 9000; i++) {
    const s = 3 + (Math.random() * 2 | 0) * 2;
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${Math.random() * 0.05})` : `rgba(255,230,200,${Math.random() * 0.025})`;
    ctx.fillRect((Math.random() * w / s | 0) * s, (Math.random() * h / s | 0) * s, s, s);
  }
  // 内侧暗角，让文字区更沉
  const v = ctx.createRadialGradient(w * 0.55, h * 0.45, h * 0.2, w * 0.55, h * 0.5, w * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  // 细边：上沿亮线、下沿暗线
  ctx.fillStyle = 'rgba(255,235,205,0.16)'; ctx.fillRect(0, 0, w, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, h - 4, w, 4);
  return tex;
}

export class InfoPanel {
  constructor() {
    this.W = 1.26; this.H = 0.58;
    this.group = new THREE.Group();
    const face = new THREE.MeshStandardMaterial({ map: panelPlateTexture(768, 354), roughness: 0.7, metalness: 0.1, color: 0xffffff, emissive: 0x1e1814, emissiveIntensity: 1 });
    const edge = new THREE.MeshStandardMaterial({ color: 0x1f1a16, roughness: 0.85, metalness: 0.2 });
    // 板体 + 背后略大的深色衬板（原作面板有一圈突出的暗色边）
    const back = new THREE.Mesh(new THREE.BoxGeometry(this.W + 0.04, this.H + 0.035, 0.02), edge);
    back.position.z = -0.012;
    const board = new THREE.Mesh(new THREE.BoxGeometry(this.W, this.H, 0.03), [edge, edge, edge, edge, face, edge]);
    this.group.add(back, board);
    // 右侧上下两颗浅色方钉
    const nailM = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.45, metalness: 0.3, emissive: 0x2a2620 });
    [[this.W / 2 + 0.006, this.H / 2 - 0.02], [this.W / 2 + 0.006, -this.H / 2 + 0.02]].forEach(([x, y]) => {
      const n = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.012), nailM);
      n.position.set(x, y, 0.016); this.group.add(n);
    });
    // 挂杆（面板上方的两根细铁杆，接到墙上）
    const rod = new THREE.MeshStandardMaterial({ color: 0x2b2622, roughness: 0.7, metalness: 0.3 });
    [-0.4, 0.4].forEach(x => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.06), rod); r.position.set(x * this.W, this.H / 2 - 0.03, -0.04); this.group.add(r); });
    this.text = textPlane(this.W, this.H, 2048, 944, 1.0);
    this.text.mesh.position.z = 0.0165;
    this.group.add(this.text.mesh);
    this.key = '';
  }

  /** vm: { name, level, value, last:{outcome,levelDelta,delta,ratio}|null, charge, frenzy:{t,frac}|null, probs, empty, tags:[] } */
  draw(vm) {
    const key = JSON.stringify(vm);
    if (key === this.key) return;
    this.key = key;
    const { ctx, canvas, tex } = this.text;
    const W = canvas.width, H = canvas.height;
    const P = PANEL_COL;
    ctx.clearRect(0, 0, W, H);
    const L = W * 0.078, R = W * 0.948;
    const Y = f => H * f;
    ctx.textBaseline = 'alphabetic';
    const soft = (c = 'rgba(0,0,0,0.5)', b = 6) => { ctx.shadowColor = c; ctx.shadowBlur = b; ctx.shadowOffsetY = 2; };
    const glow = (c, b = 14) => { ctx.shadowColor = c; ctx.shadowBlur = b; ctx.shadowOffsetY = 0; };
    soft();
    ctx.textAlign = 'left';
    if (vm.empty) {
      ctx.fillStyle = P.title; ctx.font = `600 ${Y(0.12)}px ${FONT}`;
      ctx.fillText('铁砧空着', L, Y(0.24));
      ctx.fillStyle = P.dim; ctx.font = `500 ${Y(0.05)}px ${FONT}`;
      ctx.fillText('拿一把烧热的剑放上来', L, Y(0.36));
      tex.needsUpdate = true; return;
    }
    // 第一行：名字 / 等级
    ctx.fillStyle = P.title;
    ctx.font = `600 ${Y(0.118)}px ${FONT}`;
    let name = vm.name;
    while (ctx.measureText(name).width > (R - L) * 0.72 && name.length > 2) name = name.slice(0, -1);
    ctx.fillText(name, L, Y(0.215));
    ctx.textAlign = 'right';
    ctx.font = `600 ${Y(0.125)}px ${FONT}`;
    ctx.fillText('+' + vm.level, R, Y(0.215));
    // 第二行：上贡价值 / 数值
    ctx.textAlign = 'left';
    ctx.fillStyle = P.dim; ctx.font = `600 ${Y(0.042)}px ${FONT}`;
    ctx.fillText('上贡价值', L + 4, Y(0.355));
    ctx.textAlign = 'right';
    ctx.fillStyle = P.value; ctx.font = `600 ${Y(0.15)}px ${FONT}`;
    ctx.fillText(fmt(vm.value) + ' G', R, Y(0.405));
    // 第三行：上一锤结果
    ctx.textAlign = 'left';
    if (vm.last) {
      const o = OUTCOMES[vm.last.outcome];
      const c = P[vm.last.outcome];
      glow(c, 4); ctx.fillStyle = c; ctx.font = `600 ${Y(0.064)}px ${FONT}`;
      const lv = vm.last.levelDelta > 0 ? '   +' + vm.last.levelDelta : (vm.last.levelDelta < 0 ? '   ' + vm.last.levelDelta : '');
      ctx.fillText(o.name + lv, L + 4, Y(0.53));
      soft(); ctx.fillStyle = P.dim; ctx.font = `500 ${Y(0.042)}px ${FONT}`;
      const r = vm.last.ratio;
      const rs = r >= 10 ? r.toFixed(0) : r.toFixed(2).replace(/\.?0+$/, '');
      ctx.fillText((vm.last.delta >= 0 ? '+' : '') + fmt(vm.last.delta) + ' G   ·   ' + rs + '倍', L + 10, Y(0.6));
    } else if (vm.tags && vm.tags.length) {
      ctx.fillStyle = P.dim; ctx.font = `500 ${Y(0.042)}px ${FONT}`;
      ctx.fillText(vm.tags.join('   '), L + 6, Y(0.56));
    }
    // 充能：10 个小方块 + "n / 10"
    const n = 10, pw = Y(0.038), gap = Y(0.034);
    const px0 = R - n * pw - (n - 1) * gap - Y(0.02);
    ctx.textAlign = 'right';
    ctx.font = `600 ${Y(0.046)}px ${FONT}`;
    if (vm.frenzy) { glow('rgba(160,255,140,0.9)', 12); ctx.fillStyle = '#c4ffb0'; ctx.fillText('入神 ' + vm.frenzy.t.toFixed(1) + 's', R - Y(0.02), Y(0.53)); }
    else { ctx.fillStyle = P.dim; ctx.fillText(vm.charge + ' / 10', R - Y(0.02), Y(0.53)); }
    for (let i = 0; i < n; i++) {
      const on = vm.frenzy ? (i < Math.ceil(vm.frenzy.frac * 10)) : i < vm.charge;
      const x = px0 + i * (pw + gap), y = Y(0.575);
      if (on) { glow(vm.frenzy ? 'rgba(150,255,130,1)' : 'rgba(255,190,100,1)', 18); ctx.fillStyle = vm.frenzy ? '#d6ffc6' : '#fff0c8'; }
      else { ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(20,16,13,0.85)'; }
      ctx.fillRect(x, y, pw, pw * 0.82);
      if (!on) { ctx.fillStyle = 'rgba(255,230,200,0.10)'; ctx.fillRect(x, y, pw, 2); }
    }
    // 五种结果：彩色细线 + 名称 + 概率
    const colW = (R - L) / 5;
    OUTCOME_ORDER.forEach((k, i) => {
      const o = OUTCOMES[k];
      const x0 = L + i * colW + colW * 0.04, x1 = L + (i + 1) * colW - colW * 0.06, cx = (x0 + x1) / 2;
      glow(P.rule[k], 6); ctx.fillStyle = P.rule[k];
      ctx.fillRect(x0, Y(0.655), x1 - x0, Y(0.0065));
      soft('rgba(0,0,0,0.45)', 4);
      ctx.textAlign = 'center'; ctx.fillStyle = P[k];
      ctx.font = `600 ${Y(0.05)}px ${FONT}`;
      ctx.fillText(o.name, cx, Y(0.735));
      ctx.font = `600 ${Y(0.064)}px ${FONT}`;
      ctx.fillText((vm.probs[k] * 100).toFixed(1) + '%', cx, Y(0.825));
    });
    // 底部堆叠概率条
    let x = L;
    const bw = R - L, by = Y(0.905), bh = Y(0.0075);
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(L, by, bw, bh);
    OUTCOME_ORDER.forEach(k => {
      const w = vm.probs[k] * bw;
      if (w <= 0.5) return;
      glow(P.rule[k], 12); ctx.fillStyle = P.rule[k];
      ctx.fillRect(x, by, w, bh);
      x += w;
    });
    ctx.shadowBlur = 0;
    tex.needsUpdate = true;
  }
}

/* ================= 日历 ================= */
export class Calendar {
  constructor() {
    this.W = 0.62; this.H = 0.74;
    this.group = new THREE.Group();
    const ct = canvasTex(620, 740);
    this.ct = ct;
    const mat = new THREE.MeshStandardMaterial({ map: ct.tex, roughness: 0.95, side: THREE.DoubleSide });
    // 轻微弯曲的纸
    const geo = new THREE.PlaneGeometry(this.W, this.H, 8, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / this.W + 0.5) * Math.PI) * 0.012);
    geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(geo, mat);
    this.group.add(this.mesh);
    // 两颗图钉
    const pinM = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 });
    [-1, 1].forEach(sx => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.01), pinM);
      p.position.set(sx * (this.W / 2 - 0.035), this.H / 2 - 0.03, 0.015);
      this.group.add(p);
    });
    this.key = '';
  }

  /** today: 当前周期首日（day 序号）；due: 进贡日 day；history: 已进贡记录 */
  draw(today, dueDays, merchantToday) {
    const key = today + '|' + dueDays.join(',');
    if (key === this.key) return;
    this.key = key;
    const { ctx, canvas, tex } = this.ct;
    const W = canvas.width, H = canvas.height;
    // 纸
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#efe6cf'); g.addColorStop(1, '#d9ccab');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '90,70,40' : '255,255,240'},${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    // 折痕
    ctx.strokeStyle = 'rgba(120,100,70,0.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W * 0.52, 0); ctx.lineTo(W * 0.48, H); ctx.stroke();

    const td = dateOf(today);
    const month = td.month;
    ctx.fillStyle = '#4a4440';
    ctx.font = `400 92px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(month + '月', W / 2, 118);
    ctx.fillRect(56, 148, W - 112, 3);

    const cols = 7, cw = (W - 80) / cols, rh = 92;
    const x0 = 40, y0 = 222;
    const daysIn = month === 4 ? 30 : 31;
    const firstDayIndex = month === 4 ? 1 - (15 - 1) : 1 + 16; // day 序号 -> 当月 1 日对应的 day 序号
    for (let d = 1; d <= Math.min(daysIn, 35); d++) {
      const r = Math.floor((d - 1) / cols), c = (d - 1) % cols;
      const cx = x0 + c * cw + cw / 2, cy = y0 + r * rh;
      const dayIdx = month === 4 ? d - 14 : d + 16;
      ctx.font = `400 46px ${FONT}`;
      ctx.fillStyle = '#4b4540';
      ctx.fillText(String(d), cx, cy);
      // 划掉过去的日子
      if (dayIdx < today) {
        ctx.strokeStyle = 'rgba(170,40,30,0.85)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - 24, cy - 40); ctx.lineTo(cx + 22, cy + 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 20, cy - 42); ctx.lineTo(cx - 22, cy + 8); ctx.stroke();
      }
      if (dayIdx === today) {
        ctx.strokeStyle = 'rgba(150,40,30,0.9)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(cx, cy - 16, 36, 34, 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (dayIdx === 1 && today <= 1) {
        ctx.font = `600 18px ${FONT}`; ctx.fillStyle = '#7a2a20';
        ctx.fillText('开始', cx - 2, cy + 26);
      }
      // 进贡日：蓝色天平
      if (dueDays.includes(dayIdx)) drawScale(ctx, cx, cy + 26);
      // 下划线
      ctx.fillStyle = 'rgba(80,70,60,0.25)';
      ctx.fillRect(cx - cw / 2 + 6, cy + 40, cw - 12, 2);
    }
    tex.needsUpdate = true;
  }
}

function drawScale(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = '#3a8fb0'; ctx.fillStyle = '#3a8fb0'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 18, y - 2); ctx.lineTo(x + 18, y - 2); ctx.stroke();
  [-1, 1].forEach(s => {
    ctx.beginPath(); ctx.moveTo(x + s * 18, y - 2); ctx.lineTo(x + s * 18 - 7, y + 8); ctx.lineTo(x + s * 18 + 7, y + 8); ctx.closePath(); ctx.stroke();
  });
  ctx.fillRect(x - 10, y + 14, 20, 3);
  ctx.restore();
}

/* ================= 贡品板 ================= */
export class TributeBoard {
  constructor(face) {
    this.W = 0.72; this.H = 0.24;
    this.group = new THREE.Group();
    this.key = '';
    if (face) {
      const ct = canvasTex(920, 320);
      face.material = new THREE.MeshBasicMaterial({ map: ct.tex, toneMapped: false, color: new THREE.Color(0.9, 0.9, 0.9) });
      this.text = ct;
      return;
    }
    const frameM = new THREE.MeshStandardMaterial({ color: 0x3b2a20, roughness: 0.9 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(this.W + 0.04, this.H + 0.04, 0.025), frameM);
    this.group.add(frame);
    this.text = textPlane(this.W, this.H, 900, 300, 0.95);
    this.text.mesh.position.z = 0.014;
    this.group.add(this.text.mesh);
    this.key = '';
  }
  draw(due, offered) {
    const key = due + '|' + offered;
    if (key === this.key) return;
    this.key = key;
    const { ctx, canvas, tex } = this.text;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(40, H / 2 - 1, W - 80, 2);
    ctx.fillStyle = '#e9e4dc';
    ctx.font = `500 40px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('应缴贡品', 56, 92);
    ctx.fillText('已献上', 56, 232);
    ctx.textAlign = 'right';
    ctx.font = `500 52px ${FONT}`;
    ctx.fillText(fmt(due), W - 120, 96);
    ctx.font = `600 66px ${FONT}`;
    ctx.fillText(fmt(offered), W - 70, 240);
    // 指示灯
    const ok = offered >= due;
    ctx.shadowBlur = 20; ctx.shadowColor = ok ? '#7dff6a' : '#ff5040';
    ctx.fillStyle = ok ? '#8dff7a' : '#c43a2a';
    ctx.beginPath(); ctx.arc(W - 72, 80, 16, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    tex.needsUpdate = true;
  }
}

/* ================= 售货机上的小屏幕 ================= */
function swordGlyph(ctx, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -30); ctx.lineTo(6, -18); ctx.lineTo(6, 8); ctx.lineTo(-6, 8); ctx.lineTo(-6, -18); ctx.closePath(); ctx.fill();
  ctx.fillRect(-13, 8, 26, 5);
  ctx.fillRect(-3, 13, 6, 14);
  ctx.restore();
}

export function makeScreen(pw, ph) {
  const ct = canvasTex(pw, ph);
  ct.mat = new THREE.MeshBasicMaterial({ map: ct.tex, toneMapped: false });
  return ct;
}

export function drawCounter(screen, n) {
  const { ctx, canvas, tex } = screen;
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, W, H);
  swordGlyph(ctx, W * 0.17, H * 0.5, H / 70, '#e8dcb0');
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(W * 0.34, 8, 3, H - 16); ctx.fillRect(W * 0.67, 8, 3, H - 16);
  ctx.fillStyle = '#f2f0ea';
  ctx.font = `500 ${H * 0.72}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(Math.min(99, n)).padStart(2, '0'), W * 0.66, H * 0.54);
  tex.needsUpdate = true;
}

export function drawPrice(screen, price, sold, label) {
  const { ctx, canvas, tex } = screen;
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#0c0c0c'; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  if (sold) {
    ctx.fillStyle = '#7d776c';
    ctx.font = `500 ${H * 0.42}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('售罄', W / 2, H / 2);
  } else {
    swordGlyph(ctx, W * 0.33, H * 0.5, H / 80, '#efe2b4');
    ctx.fillStyle = '#f2f0ea';
    ctx.font = `500 ${H * 0.5}px ${FONT}`;
    ctx.fillText(String(price), W * 0.52, H * 0.53);
  }
  tex.needsUpdate = true;
}

export function drawLabel(screen, text, opts = {}) {
  const { ctx, canvas, tex } = screen;
  const W = canvas.width, H = canvas.height;
  if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, W, H); } else ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = opts.color || '#f2f0ea';
  ctx.font = `${opts.weight || 500} ${H * (opts.size || 0.6)}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H * 0.54);
  tex.needsUpdate = true;
}

export function drawSwapHint(screen) {
  const { ctx, canvas, tex } = screen;
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#0c0c0c'; ctx.fillRect(0, 0, W, H);
  swordGlyph(ctx, W * 0.16, H * 0.5, H / 75, '#d0533a');
  ctx.strokeStyle = '#e6dcc6'; ctx.lineWidth = H * 0.06;
  ctx.beginPath(); ctx.moveTo(W * 0.3, H * 0.5); ctx.lineTo(W * 0.56, H * 0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W * 0.5, H * 0.36); ctx.lineTo(W * 0.58, H * 0.5); ctx.lineTo(W * 0.5, H * 0.64); ctx.stroke();
  swordGlyph(ctx, W * 0.68, H * 0.5, H / 75, '#efe2b4');
  ctx.fillStyle = '#e6dcc6'; ctx.font = `500 ${H * 0.36}px ${FONT}`; ctx.textBaseline = 'middle';
  ctx.fillText('×1', W * 0.78, H * 0.56);
  tex.needsUpdate = true;
}


