// 铸剑大师 - 声音引擎（全部 WebAudio 程序合成，无需音频文件）
// 结构：各类声音 → [sfx | music | amb | voice] 分组 → 混响(地牢) + 干声 → 压缩器 → 输出
// 包含：沉静的地牢背景音乐、炉火/滴水/房间底噪等环境声、巨龙呼吸/低吼/怒吼/咀嚼/说话、全部交互音效。

const A = {
  enabled: true, ctx: null, master: null, at: 0,   // at：调度时间偏移（仅测试用）
  vol: { master: 0.9, music: 0.5, sfx: 0.85, amb: 0.7 },
  listener: { x: 0, z: 0, yaw: 0 },
  src: { furnace: { x: -3.2, z: 1.45 }, dragon: { x: -1.2, z: -4.0 }, ghost: null },
};
let C = null, out = null, bus = {}, rev = null, started = false;

function ctx() {
  if (!C) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    C = new AC();
    A.ctx = C;
    build();
  }
  if (C.state === 'suspended') C.resume();
  return C;
}

/* ============================== 混音总线 ============================== */
function impulse(sec, decay) {
  const len = Math.floor(C.sampleRate * sec);
  const b = C.createBuffer(2, len, C.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // 早期反射 + 指数衰减尾巴，略带低通感（越往后越暗）
      const er = i < C.sampleRate * 0.04 && Math.random() < 0.02 ? 0.8 : 0;
      d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, decay) + er) * (1 - t * 0.3);
    }
  }
  return b;
}
function build() {
  const comp = C.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.22;
  out = C.createGain(); out.gain.value = A.vol.master;
  out.connect(comp); comp.connect(C.destination);
  // 地牢混响
  rev = C.createConvolver(); rev.buffer = impulse(3.2, 3.2);
  const revLP = C.createBiquadFilter(); revLP.type = 'lowpass'; revLP.frequency.value = 3200;
  const revG = C.createGain(); revG.gain.value = 0.55;
  rev.connect(revLP); revLP.connect(revG); revG.connect(out);
  const mk = (name, v, wet) => {
    const g = C.createGain(); g.gain.value = v;
    g.connect(out);
    const s = C.createGain(); s.gain.value = wet; g.connect(s); s.connect(rev);
    bus[name] = g;
  };
  mk('sfx', A.vol.sfx, 0.28);
  mk('music', 0, 0.45);
  mk('amb', A.vol.amb, 0.35);
  mk('voice', 0.9, 0.5);
}

/* ============================== 基础合成器 ============================== */
let noiseBuf = null, brownBuf = null;
function noiseSrc(brown) {
  if (!noiseBuf) {
    const n = C.sampleRate * 2;
    noiseBuf = C.createBuffer(1, n, C.sampleRate);
    brownBuf = C.createBuffer(1, n, C.sampleRate);
    const d = noiseBuf.getChannelData(0), b = brownBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; d[i] = w; last = (last + 0.02 * w) / 1.02; b[i] = last * 3.5; }
  }
  const s = C.createBufferSource(); s.buffer = brown ? brownBuf : noiseBuf; s.loop = true;
  return s;
}
function env(g, t, a, peak, d, sustain = 0.0001) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
}
function dest(o) { return (o && o.bus && bus[o.bus]) || bus.sfx; }
function pan(node, p) {
  if (!p || !C.createStereoPanner) return node;
  const sp = C.createStereoPanner(); sp.pan.value = Math.max(-1, Math.min(1, p)); node.connect(sp); return sp;
}
function tone(freq, dur, o = {}) {
  const c = ctx(); if (!c || !A.enabled) return;
  const t = c.currentTime + (o.delay || 0) + A.at;
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + (o.slideT || dur));
  if (o.detune) osc.detune.value = o.detune;
  env(g, t, o.attack || 0.004, o.vol || 0.2, dur);
  let n = osc;
  if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 0.7; osc.connect(f); n = f; }
  n.connect(g); pan(g, o.pan).connect(dest(o));
  osc.start(t); osc.stop(t + (o.attack || 0.004) + dur + 0.1);
}
function burst(dur, o = {}) {
  const c = ctx(); if (!c || !A.enabled) return;
  const t = c.currentTime + (o.delay || 0) + A.at;
  const n = noiseSrc(o.brown), f = c.createBiquadFilter(), g = c.createGain();
  f.type = o.filter || 'bandpass';
  f.frequency.setValueAtTime(o.freq || 3000, t);
  if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t + dur);
  f.Q.value = o.q || 1;
  env(g, t, o.attack || 0.003, o.vol || 0.2, dur);
  n.connect(f); f.connect(g); pan(g, o.pan).connect(dest(o));
  n.start(t, Math.random() * 1.5); n.stop(t + (o.attack || 0.003) + dur + 0.1);
}
// 金属撞击：非谐波泛音（铁砧的「当——」）
function metal(pitch = 1, vol = 1, o = {}) {
  const base = 330 * pitch;
  [[1, 1.4], [2.32, 1.0], [4.25, 0.7], [6.63, 0.45], [9.1, 0.3]].forEach(([m, d], i) => tone(base * m * (0.99 + Math.random() * 0.02), d * (o.ring || 1), { vol: 0.11 * vol / (i * 0.7 + 1), type: i ? 'sine' : 'triangle', delay: o.delay, pan: o.pan }));
  burst(0.05, { freq: 5200, q: 0.6, vol: 0.22 * vol, delay: o.delay, pan: o.pan });
  tone(85 * pitch, 0.2, { vol: 0.32 * vol, slide: 45, delay: o.delay });
}

/* ============================== 音效 ============================== */
A.clang = (p, v) => metal(p, v);
A.hit = function (outcome) {
  switch (outcome) {
    case 'great':
      metal(1.12, 1.15, { ring: 1.3 });
      [0, 7, 12, 19].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 1.2, { delay: 0.05 + i * 0.06, vol: 0.06, type: 'triangle' }));
      burst(0.6, { filter: 'highpass', freq: 6000, vol: 0.05, delay: 0.05, attack: 0.05 });
      break;
    case 'success': metal(1.0, 1); tone(988, 0.5, { delay: 0.04, vol: 0.035, type: 'triangle' }); break;
    case 'hold': metal(0.92, 0.75, { ring: 0.8 }); break;
    case 'damage':
      metal(0.72, 0.9, { ring: 0.6 });
      tone(110, 0.45, { vol: 0.18, type: 'sawtooth', slide: 60, lp: 400 });
      burst(0.15, { freq: 900, q: 2, vol: 0.12, delay: 0.03 });
      break;
    case 'break': A.shatter(); break;
  }
};
A.shatter = function () {
  metal(0.85, 1.25, { ring: 0.4 });
  for (let i = 0; i < 9; i++) {
    burst(0.1 + Math.random() * 0.25, { delay: 0.02 + i * 0.035 + Math.random() * 0.03, freq: 2500 + Math.random() * 6000, q: 4, vol: 0.12, pan: Math.random() - 0.5 });
    tone(2000 + Math.random() * 3500, 0.25, { delay: 0.05 + i * 0.05, vol: 0.03, pan: Math.random() - 0.5 });
  }
  // 碎片落地
  for (let i = 0; i < 6; i++) metal(1.6 + Math.random(), 0.18, { delay: 0.45 + i * 0.09 + Math.random() * 0.05, ring: 0.25, pan: Math.random() - 0.5 });
  tone(70, 1.2, { vol: 0.28, type: 'sawtooth', slide: 32, lp: 300 });
};
A.heat = function () {
  burst(1.4, { filter: 'lowpass', freq: 300, freqTo: 1400, vol: 0.32, attack: 0.25, brown: true });
  burst(1.0, { filter: 'bandpass', freq: 1800, q: 0.6, vol: 0.05, attack: 0.3, delay: 0.15 });
  for (let i = 0; i < 6; i++) burst(0.02, { delay: 0.2 + Math.random() * 1.1, freq: 2500 + Math.random() * 2000, q: 3, vol: 0.06 });
};
A.sizzle = () => burst(1.1, { filter: 'highpass', freq: 3500, vol: 0.07, attack: 0.04 });
A.frenzy = function () {
  tone(110, 1.6, { vol: 0.12, type: 'sawtooth', slide: 440, slideT: 0.8, lp: 1200, attack: 0.1 });
  [0, 3, 7, 10, 12, 15, 19].forEach((s, i) => tone(392 * Math.pow(2, s / 12), 0.9, { delay: i * 0.05, vol: 0.05, type: 'triangle' }));
  burst(1.2, { filter: 'bandpass', freq: 800, freqTo: 6000, q: 0.8, vol: 0.08, attack: 0.3 });
  A.musicIntensity(1);
};
A.frenzyEnd = () => { A.musicIntensity(0); tone(330, 0.8, { vol: 0.05, slide: 165, type: 'triangle' }); };
A.charge = () => tone(1318, 0.25, { vol: 0.035, type: 'triangle' });
A.coin = function () {
  [0, 0.06, 0.13].forEach((d, i) => tone(1568 + i * 330, 0.35, { vol: 0.05, type: 'square', lp: 4000, delay: d }));
};
A.click = () => tone(820, 0.05, { vol: 0.04, type: 'triangle' });
A.error = () => { tone(196, 0.16, { vol: 0.06, type: 'square', lp: 900 }); tone(185, 0.16, { vol: 0.06, type: 'square', lp: 900, delay: 0.09 }); };
A.unlock = function () {
  [0, 4, 7, 11, 14].forEach((s, i) => tone(392 * Math.pow(2, s / 12), 1.4, { delay: i * 0.11, vol: 0.06, type: 'triangle' }));
  tone(98, 2, { vol: 0.08, attack: 0.3 });
};
A.step = function () {
  // 石地板脚步：低闷的冲击 + 少许沙砾
  const p = 0.85 + Math.random() * 0.3;
  burst(0.09, { filter: 'lowpass', freq: 380 * p, vol: 0.13, brown: true });
  burst(0.05, { freq: 2200 * p, q: 1.2, vol: 0.02, delay: 0.01 });
};
A.pickup = () => { burst(0.12, { freq: 2600, q: 2, vol: 0.05 }); metal(1.9, 0.12, { ring: 0.3 }); };
A.putdown = () => { metal(0.95, 0.35, { ring: 0.6 }); burst(0.06, { filter: 'lowpass', freq: 500, vol: 0.12 }); };
A.insert = function () {
  burst(0.35, { freq: 1600, freqTo: 500, q: 2, vol: 0.1 });
  metal(1.4, 0.25, { delay: 0.3, ring: 0.4 });
  tone(140, 0.25, { delay: 0.38, vol: 0.12, type: 'square', lp: 500 });
};
A.vend = function () {
  // 售货机：机械齿轮转动 + 落下的咔嗒 + 一声柔和的提示
  for (let i = 0; i < 7; i++) burst(0.025, { delay: i * 0.055, freq: 1400 + (i % 2) * 400, q: 6, vol: 0.06 });
  burst(0.45, { filter: 'lowpass', freq: 260, vol: 0.18, brown: true });
  metal(1.2, 0.3, { delay: 0.42, ring: 0.5 });
  tone(659, 0.6, { delay: 0.5, vol: 0.04, type: 'triangle' }); tone(988, 0.8, { delay: 0.6, vol: 0.035, type: 'triangle' });
};
A.servicebell = function () {
  // 前台服务铃「叮——」：高而纯、长余音
  [1, 2.76, 5.4, 8.9].forEach((m, i) => tone(1760 * m, 2.6 - i * 0.6, { vol: 0.12 / (i + 1), attack: 0.002 }));
  burst(0.02, { freq: 7000, q: 1, vol: 0.08 });
};
A.hatch = function () {
  // 送货口：木门上滑 + 剑落下
  burst(0.6, { freq: 500, freqTo: 900, q: 1.5, vol: 0.08 });
  for (let i = 0; i < 3; i++) { metal(1.3 + i * 0.15, 0.22, { delay: 0.7 + i * 0.18, ring: 0.5 }); burst(0.06, { filter: 'lowpass', freq: 400, vol: 0.1, delay: 0.7 + i * 0.18 }); }
};
A.thrown = function () { for (let i = 0; i < 3; i++) { metal(1.1 + i * 0.2, 0.5, { delay: i * 0.12, ring: 0.6 }); burst(0.08, { filter: 'lowpass', freq: 300, vol: 0.25, delay: i * 0.12, brown: true }); } };
A.page = () => burst(0.12, { freq: 4500, q: 0.5, vol: 0.04, attack: 0.02 });
A.refresh = function () { for (let i = 0; i < 10; i++) burst(0.02, { delay: i * 0.04, freq: 1900, q: 8, vol: 0.05 }); tone(523, 0.3, { delay: 0.45, vol: 0.04, type: 'triangle' }); };
A.ghost = function () {
  // 幽灵商人：空灵的上行滑音 + 轻笑
  tone(660, 1.6, { vol: 0.035, slide: 990, type: 'sine', attack: 0.3, bus: 'amb' });
  tone(667, 1.6, { vol: 0.03, slide: 1000, type: 'sine', attack: 0.35, bus: 'amb' });
  for (let i = 0; i < 4; i++) tone(520 - i * 30, 0.09, { delay: 0.9 + i * 0.11, vol: 0.04, type: 'triangle', lp: 1800 });
};
A.relicPop = () => { tone(1047, 0.5, { vol: 0.04, type: 'triangle' }); tone(1568, 0.6, { vol: 0.03, type: 'triangle', delay: 0.04 }); };
A.evolve = function () {
  [0, 5, 7, 12].forEach((s, i) => tone(330 * Math.pow(2, s / 12), 1.5, { delay: i * 0.09, vol: 0.06, type: 'triangle' }));
  burst(1.2, { filter: 'highpass', freq: 5000, vol: 0.05, attack: 0.2 });
};

/* ============================== 巨龙 ============================== */
// 低频怪物声：锯齿 + 噪声经过共振峰滤波，配合颤动
function beast(dur, o = {}) {
  const c = ctx(); if (!c || !A.enabled) return;
  const t = c.currentTime + (o.delay || 0) + A.at;
  const g = c.createGain(); env(g, t, o.attack || 0.25, o.vol || 0.3, dur);
  const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = o.formant || 320; f1.Q.value = 2.5;
  const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.setValueAtTime(o.lp || 900, t); if (o.lpTo) f2.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur);
  const mix = c.createGain();
  // 喉音
  const base = o.f || 55;
  [1, 1.007, 2.01].forEach((m, i) => {
    const osc = c.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * m, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide * m, t + dur);
    const og = c.createGain(); og.gain.value = i === 2 ? 0.25 : 0.5;
    // 颤音（喉咙的抖动）
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = o.wobble || 13; lg.gain.value = base * 0.06;
    lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.6);
    osc.connect(og); og.connect(mix); osc.start(t); osc.stop(t + dur + 0.6);
  });
  const n = noiseSrc(true), ng = c.createGain(); ng.gain.value = o.breath ?? 0.6; n.connect(ng); ng.connect(mix);
  n.start(t, Math.random()); n.stop(t + dur + 0.6);
  mix.connect(f1); mix.connect(f2); f1.connect(g); f2.connect(g);
  g.connect(bus.voice);
}
A.dragonBreath = (k = 1) => {
  // 一次深呼吸：吸（高通噪声上扬）→ 呼（低沉气流）
  burst(1.6, { filter: 'bandpass', freq: 300, freqTo: 600, q: 0.6, vol: 0.12 * k, attack: 0.8, brown: true, bus: 'voice' });
  burst(2.2, { filter: 'lowpass', freq: 500, freqTo: 140, vol: 0.2 * k, attack: 0.2, delay: 1.7, brown: true, bus: 'voice' });
};
A.dragonEye = () => {
  // 睁眼：潮湿的眼睑 + 低频嗡鸣
  burst(0.5, { freq: 700, freqTo: 300, q: 3, vol: 0.06, bus: 'voice' });
  tone(41, 3, { vol: 0.22, attack: 0.6, bus: 'voice' });
  tone(61.7, 3, { vol: 0.1, attack: 0.8, bus: 'voice' });
};
A.growl = () => beast(2.2, { f: 48, vol: 0.32, formant: 260, lp: 700, wobble: 11, attack: 0.4 });
A.roar = () => {
  beast(2.6, { f: 70, slide: 42, vol: 0.5, formant: 420, lp: 1800, lpTo: 400, wobble: 17, attack: 0.15, breath: 0.9 });
  burst(2.4, { filter: 'lowpass', freq: 1200, freqTo: 180, vol: 0.35, attack: 0.1, brown: true, bus: 'voice' });
  tone(32, 2.8, { vol: 0.3, attack: 0.2, bus: 'voice' });
};
A.content = () => beast(1.8, { f: 40, slide: 36, vol: 0.22, formant: 200, lp: 400, wobble: 6, attack: 0.5, breath: 0.4 });
A.crunch = () => {
  // 巨龙把贡品拖进黑暗：铁链拖动 + 咀嚼金属
  for (let i = 0; i < 6; i++) burst(0.08, { delay: i * 0.13, freq: 1800 + Math.random() * 1500, q: 4, vol: 0.06, bus: 'voice' });
  for (let i = 0; i < 4; i++) { metal(0.7 + Math.random() * 0.4, 0.3, { delay: 0.9 + i * 0.32, ring: 0.3 }); burst(0.18, { filter: 'lowpass', freq: 600, vol: 0.18, delay: 0.9 + i * 0.32, brown: true, bus: 'voice' }); }
};
/** 巨龙说话：每个字一个低沉的喉音音节（类似动物森友会的「语音」，但是低沉嘶哑） */
A.dragonSyllable = (ch, i) => {
  if (/[\s，。、！？…—“”"'.,!?]/.test(ch)) return;
  const code = ch.charCodeAt(0);
  const f = 46 + (code % 7) * 3 + (i % 3) * 2;
  beast(0.16, { f, vol: 0.2, formant: 240 + (code % 5) * 40, lp: 650, wobble: 9, attack: 0.02, breath: 0.35 });
};
A.whisperSyllable = (ch, i) => {
  if (/[\s，。、！？…—“”"'.,!?]/.test(ch)) return;
  burst(0.05, { freq: 1800 + (ch.charCodeAt(0) % 9) * 120, q: 4, vol: 0.025 });
};

/* ============================== 环境声（持续层） ============================== */
const amb = {};
function startAmbience() {
  const c = C;
  // 房间底噪：极低的褐噪声
  const room = noiseSrc(true), rf = c.createBiquadFilter(), rg = c.createGain();
  rf.type = 'lowpass'; rf.frequency.value = 180; rg.gain.value = 0.06;
  room.connect(rf); rf.connect(rg); rg.connect(bus.amb); room.start();
  // 炉火：低频轰鸣 + 噼啪，随距离衰减、随方位偏移
  const fire = noiseSrc(true), ff = c.createBiquadFilter(), fg = c.createGain(), fp = c.createStereoPanner ? c.createStereoPanner() : null;
  ff.type = 'lowpass'; ff.frequency.value = 420; fg.gain.value = 0;
  fire.connect(ff); ff.connect(fg); (fp ? (fg.connect(fp), fp) : fg).connect(bus.amb); fire.start();
  const flick = c.createOscillator(), flg = c.createGain(); flick.frequency.value = 0.7; flg.gain.value = 120; flick.connect(flg); flg.connect(ff.frequency); flick.start();
  amb.fire = { g: fg, p: fp };
  // 巨龙在铁栏后的呼吸（很远很低，靠近铁栏时更清楚）
  const br = noiseSrc(true), bf = c.createBiquadFilter(), bg = c.createGain(), bl = c.createGain(), bp = c.createStereoPanner ? c.createStereoPanner() : null;
  bf.type = 'lowpass'; bf.frequency.value = 260; bg.gain.value = 0; bl.gain.value = 0;
  br.connect(bf); bf.connect(bl); bl.connect(bg); (bp ? (bg.connect(bp), bp) : bg).connect(bus.voice); br.start();
  const lfo = c.createOscillator(), lfoG = c.createGain(); lfo.frequency.value = 0.16; lfoG.gain.value = 0.5; lfo.connect(lfoG); lfoG.connect(bl.gain);
  const off = c.createConstantSource ? c.createConstantSource() : null; if (off) { off.offset.value = 0.5; off.connect(bl.gain); off.start(); }
  lfo.start();
  amb.breath = { g: bg, p: bp };
  // 随机的环境细节：滴水、炉火噼啪、远处铁链
  const loop = () => {
    if (!A.enabled) { amb.timer = setTimeout(loop, 1000); return; }
    const r = Math.random();
    const fd = amb.fireNear || 0;
    if (r < 0.45 && fd > 0.05) for (let i = 0; i < 1 + Math.random() * 3; i++) burst(0.015 + Math.random() * 0.03, { delay: Math.random() * 0.3, freq: 1500 + Math.random() * 3000, q: 2, vol: 0.05 * fd, bus: 'amb', pan: amb.firePan });
    else if (r < 0.62) { const p = 1600 + Math.random() * 900; tone(p, 0.35, { vol: 0.025, slide: p * 0.55, slideT: 0.08, bus: 'amb', pan: Math.random() * 1.6 - 0.8 }); }
    else if (r < 0.66) for (let i = 0; i < 4; i++) metal(2.2 + Math.random() * 0.4, 0.05, { delay: i * 0.09, ring: 0.3, pan: -0.6 });
    amb.timer = setTimeout(loop, 600 + Math.random() * 1800);
  };
  loop();
}
/** 每帧调用：根据玩家位置更新环境声 */
A.update = function (x, z, yaw, opts = {}) {
  if (!C || !started) return;
  const t = C.currentTime;
  const rel = (sx, sz) => {
    const dx = sx - x, dz = sz - z, d = Math.hypot(dx, dz);
    // 相机前方 = (-sin yaw, -cos yaw)，右方 = (cos yaw, -sin yaw)
    const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    return { d, pan: d > 0.01 ? Math.max(-0.85, Math.min(0.85, right / d)) : 0 };
  };
  const f = rel(A.src.furnace.x, A.src.furnace.z);
  const fireK = Math.min(1, 1.6 / (0.6 + f.d * f.d * 0.35)) * (opts.fireBoost || 1);
  amb.fire.g.gain.setTargetAtTime(0.32 * fireK, t, 0.3);
  if (amb.fire.p) amb.fire.p.pan.setTargetAtTime(f.pan, t, 0.2);
  amb.fireNear = fireK; amb.firePan = f.pan;
  const b = rel(A.src.dragon.x, A.src.dragon.z);
  const brK = Math.min(1, 2.4 / (0.8 + b.d * b.d * 0.3)) * (opts.dragonAwake ? 2.2 : 1);
  amb.breath.g.gain.setTargetAtTime(0.16 * brK, t, 0.6);
  if (amb.breath.p) amb.breath.p.pan.setTargetAtTime(b.pan, t, 0.3);
};

/* ============================== 背景音乐 ============================== */
// 沉静、低沉的地牢氛围：D 小调慢速和弦铺底 + 稀疏的八音盒/钢片琴旋律 + 偶尔的大提琴长音
const mus = { layers: [], intensity: 0, next: 0, bar: 0 };
const N = s => 440 * Math.pow(2, (s - 69) / 12);
// 和弦（MIDI）：Dm - B♭ - Gm - A(sus) - Dm - F - C - A
const CHORDS = [[50, 57, 62, 65], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 61], [50, 57, 62, 65], [41, 48, 53, 57], [48, 55, 60, 64], [45, 52, 57, 61]];
const SCALE = [62, 64, 65, 67, 69, 70, 72, 74, 76, 77];
function pad(notes, t, dur) {
  const c = C;
  notes.forEach((m, i) => {
    [-7, 7].forEach(det => {
      const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = i === 0 ? 'triangle' : 'sawtooth'; o.frequency.value = N(m - (i === 0 ? 12 : 0)); o.detune.value = det;
      f.type = 'lowpass'; f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(700 + mus.intensity * 900, t + dur * 0.5); f.frequency.linearRampToValueAtTime(380, t + dur); f.Q.value = 0.5;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime((i === 0 ? 0.05 : 0.022), t + dur * 0.35);
      g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.15);
      o.connect(f); f.connect(g); g.connect(bus.music);
      o.start(t); o.stop(t + dur * 1.2);
    });
  });
}
function bell(m, t, v = 0.05) {
  // 钢片琴：基音 + 2.76 倍泛音，带柔和起音
  [[1, 1], [2.0, 0.35], [2.76, 0.18], [5.4, 0.06]].forEach(([k, a]) => {
    const o = C.createOscillator(), g = C.createGain();
    o.frequency.value = N(m) * k; o.type = 'sine';
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * a, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6 / Math.sqrt(k));
    o.connect(g); g.connect(bus.music); o.start(t); o.stop(t + 3);
  });
}
function cello(m, t, dur) {
  const o = C.createOscillator(), g = C.createGain(), f = C.createBiquadFilter(), v = C.createOscillator(), vg = C.createGain();
  o.type = 'sawtooth'; o.frequency.value = N(m);
  v.frequency.value = 5; vg.gain.value = 2.5; v.connect(vg); vg.connect(o.frequency);
  f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 1.2;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(f); f.connect(g); g.connect(bus.music);
  o.start(t); v.start(t); o.stop(t + dur + 0.1); v.stop(t + dur + 0.1);
}
function scheduleMusic() {
  const c = C;
  const barDur = mus.intensity > 0.5 ? 3.2 : 6.4;
  while (mus.next < c.currentTime + 1.5) {
    const t = mus.next;
    const ch = CHORDS[mus.bar % CHORDS.length];
    pad(ch, t, barDur);
    // 旋律：沉静时稀疏的几个音，入神时变成连续琶音
    if (mus.intensity > 0.5) {
      for (let i = 0; i < 16; i++) bell(ch[(i % 3) + 1] + 12 + (i % 4 === 3 ? 12 : 0), t + i * barDur / 16, 0.035);
    } else {
      const n = Math.random() < 0.3 ? 0 : 1 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) {
        const m = Math.random() < 0.6 ? ch[1 + (Math.random() * 3 | 0)] + 12 : SCALE[Math.random() * SCALE.length | 0];
        bell(m, t + (0.5 + i * 1.5 + Math.random() * 0.6) * barDur / 6.4, 0.035 + Math.random() * 0.02);
      }
      if (mus.bar % 4 === 2) cello(ch[0] - 12, t + 0.4, barDur * 1.6);
    }
    mus.bar++;
    mus.next += barDur;
  }
  mus.timer = setTimeout(scheduleMusic, 400);
}
A.musicIntensity = k => { mus.intensity = k; };
A.setMusic = function (on) {
  if (!C) return;
  bus.music.gain.setTargetAtTime(on && A.enabled ? A.vol.music : 0, C.currentTime, 1.5);
};
A.duck = function (k, sec = 2) {
  // 进贡时压低音乐，突出巨龙
  if (!C || !A.enabled) return;
  const t = C.currentTime;
  bus.music.gain.cancelScheduledValues(t);
  bus.music.gain.setTargetAtTime(A.vol.music * k, t, 0.4);
  bus.music.gain.setTargetAtTime(A.vol.music, t + sec, 1.2);
};

/* ============================== 启动 / 开关 ============================== */
A.resume = function () {
  const c = ctx(); if (!c) return;
  if (!started) {
    started = true;
    startAmbience();
    mus.next = c.currentTime + 0.2;
    scheduleMusic();
    A.setMusic(true);
  }
};
A.setEnabled = function (on) {
  A.enabled = on;
  if (!C) return;
  out.gain.setTargetAtTime(on ? A.vol.master : 0, C.currentTime, 0.2);
};
A.setVolume = function (k, v) {
  A.vol[k] = v;
  if (!C) return;
  if (k === 'master') out.gain.setTargetAtTime(A.enabled ? v : 0, C.currentTime, 0.1);
  else if (bus[k]) bus[k].gain.setTargetAtTime(v, C.currentTime, 0.1);
};

export default A;
