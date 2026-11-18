// 铸剑大师 - WebAudio 合成音效（无需音频文件）
const A = { enabled: true, ctx: null, master: null };

  function ctx() {
    if (!A.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      A.ctx = new C();
      A.master = A.ctx.createGain();
      A.master.gain.value = 0.55;
      A.master.connect(A.ctx.destination);
    }
    if (A.ctx.state === 'suspended') A.ctx.resume();
    return A.ctx;
  }

  let noiseBuf = null;
  function noise(c) {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    return s;
  }

  function tone(freq, dur, opts) {
    const c = ctx(); if (!c || !A.enabled) return;
    opts = opts || {};
    const t = c.currentTime + (opts.delay || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol || 0.3, t + (opts.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function burst(dur, opts) {
    const c = ctx(); if (!c || !A.enabled) return;
    opts = opts || {};
    const t = c.currentTime + (opts.delay || 0);
    const n = noise(c);
    const f = c.createBiquadFilter();
    f.type = opts.filter || 'bandpass';
    f.frequency.setValueAtTime(opts.freq || 3000, t);
    if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(opts.freqTo, t + dur);
    f.Q.value = opts.q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol || 0.3, t + (opts.attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(A.master);
    n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.05);
  }

  // 金属撞击：一组非谐泛音
  A.clang = function (pitch, vol) {
    pitch = pitch || 1; vol = vol || 1;
    const base = 420 * pitch;
    [1, 2.76, 5.4, 8.93].forEach((m, i) => tone(base * m * (0.98 + Math.random() * 0.04), 0.5 - i * 0.08, { vol: 0.16 * vol / (i + 1), type: i ? 'sine' : 'triangle' }));
    burst(0.08, { freq: 4500, q: 0.7, vol: 0.35 * vol });
    tone(90, 0.18, { vol: 0.35 * vol, slide: 50 });
  };

  A.hit = function (outcome) {
    switch (outcome) {
      case 'great':
        A.clang(1.2, 1.1);
        [0, 4, 7, 12].forEach((s, i) => tone(660 * Math.pow(2, s / 12), 0.5, { delay: 0.06 + i * 0.07, vol: 0.14, type: 'triangle' }));
        break;
      case 'success':
        A.clang(1.05, 1);
        tone(880, 0.25, { delay: 0.05, vol: 0.08, type: 'triangle' });
        break;
      case 'hold':
        A.clang(0.9, 0.7);
        break;
      case 'damage':
        A.clang(0.65, 0.9);
        tone(140, 0.35, { vol: 0.3, type: 'sawtooth', slide: 70 });
        break;
      case 'break':
        A.shatter();
        break;
    }
  };

  A.shatter = function () {
    A.clang(0.8, 1.2);
    for (let i = 0; i < 7; i++) {
      burst(0.12 + Math.random() * 0.15, { delay: 0.03 + i * 0.045, freq: 3000 + Math.random() * 5000, q: 3, vol: 0.18 });
      tone(1800 + Math.random() * 3000, 0.15, { delay: 0.04 + i * 0.05, vol: 0.05 });
    }
    tone(110, 0.8, { vol: 0.35, type: 'sawtooth', slide: 35 });
  };

  A.heat = function () {
    burst(1.2, { filter: 'lowpass', freq: 400, freqTo: 1500, vol: 0.35, attack: 0.3 });
    burst(1.0, { filter: 'bandpass', freq: 2000, q: 0.5, vol: 0.06, attack: 0.2, delay: 0.1 });
  };

  A.frenzy = function () {
    tone(220, 0.9, { vol: 0.18, type: 'sawtooth', slide: 880, attack: 0.1 });
    [0, 3, 7, 10, 12, 15].forEach((s, i) => tone(440 * Math.pow(2, s / 12), 0.4, { delay: i * 0.06, vol: 0.09, type: 'triangle' }));
  };

  A.charge = function () { tone(1200, 0.12, { vol: 0.05, type: 'triangle' }); };

  A.coin = function () {
    tone(1318, 0.12, { vol: 0.12, type: 'square' });
    tone(1760, 0.3, { delay: 0.07, vol: 0.12, type: 'square' });
  };

  A.click = function () { tone(700, 0.05, { vol: 0.06, type: 'triangle' }); };

  A.bell = function () {
    [1, 2.0, 2.4, 3.0, 4.2].forEach((m, i) => tone(196 * m, 3 - i * 0.4, { vol: 0.2 / (i + 1), attack: 0.005 }));
  };

  A.roar = function () {
    const c = ctx(); if (!c || !A.enabled) return;
    tone(70, 1.8, { vol: 0.4, type: 'sawtooth', slide: 40, attack: 0.15 });
    tone(95, 1.6, { vol: 0.25, type: 'sawtooth', slide: 55, attack: 0.2 });
    burst(1.8, { filter: 'lowpass', freq: 700, freqTo: 150, vol: 0.5, attack: 0.15 });
  };

  A.unlock = function () {
    [0, 4, 7, 11, 14].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.7, { delay: i * 0.09, vol: 0.12, type: 'triangle' }));
  };

  A.error = function () { tone(180, 0.15, { vol: 0.12, type: 'square' }); };

  A.resume = function () { ctx(); };

  A.step = function () { burst(0.08, { filter: 'lowpass', freq: 500, vol: 0.08 }); };
  A.pickup = function () { tone(520, 0.08, { vol: 0.06, type: 'triangle' }); burst(0.05, { freq: 3000, vol: 0.05 }); };
  A.putdown = function () { A.clang(0.6, 0.35); };
  A.insert = function () { burst(0.25, { freq: 1800, freqTo: 600, q: 2, vol: 0.15 }); tone(300, 0.2, { delay: 0.2, vol: 0.12, type: 'square' }); };
  A.vend = function () { burst(0.4, { filter: 'lowpass', freq: 300, vol: 0.3 }); tone(880, 0.3, { delay: 0.3, vol: 0.1, type: 'triangle' }); };
  A.sizzle = function () { burst(0.9, { filter: 'highpass', freq: 3000, vol: 0.12, attack: 0.02 }); };
  A.servicebell = function () { [1, 2.76, 5.4].forEach((m, i) => tone(1400 * m, 1.6 - i * 0.4, { vol: 0.18 / (i + 1) })); };

export default A;
