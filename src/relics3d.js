// 遗物与消耗品的 3D 小模型（按原作图标 ref/wiki/relics/*.webp 复刻）
// 约定：每个模型约 0.2–0.28m，底部 y=0，水平居中，正面朝 +Z。
// 导出：buildRelic(id) / buildConsumable(id) / RELIC_IDS / CONSUMABLE_IDS / renderIcon / getIcon
// 本文件负责清单 #0–#51；#52–#102 由 ./relics3d_b.js 的 BUILDERS 提供，统一在这里归一化/合并/缓存。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDERS as BUILDERS_B } from './relics3d_b.js';
import {
  PI, G, box, rbox, cyl, sph, tor, ringArc, lathe, tube, ext, disc, shapeFromPts,
  caps, M, C, p, sub, rod, plinth, dyn,
} from './relics_kit.js';

// ───────────────────────── id 表（docs/RELIC_MODELS.md） ─────────────────────────
export const RELIC_IDS = [
  'ash-sieve', 'bent-nail', 'black-knot', 'blunt-mallet', 'bound-idol', 'charcoal-pouch', 'first-brand', 'heavy-paperweight',
  'inspection-stamp', 'iron-signet', 'leather-loop', 'lucky-coal', 'patched-apron', 'patient-weight', 'red-thread', 'relief-sack',
  'sealing-stone', 'wax-effigy', 'worn-whetstone', 'undertakers-chalice', 'blind-die', 'chained-hourglass', 'closed-third-eye', 'cold-teacup',
  'cracked-wristwatch', 'double-knot', 'hungry-molar', 'iron-comb', 'iron-hoop', 'little-wind-bell', 'thorn-weight', 'broken-holy-sword',
  'cracked-crown', 'cracked-splice', 'golden-nail', 'grudge-nail', 'mourning-knot', 'scorched-charm', 'sealed-heart', 'third-hand',
  'worn-voucher', 'burial-coin', 'collectors-hook', 'cracked-bell', 'defeated-kings-seal', 'ember-locket', 'interlocking-weights', 'journeyman-badge',
  'lightning-mark', 'silver-tuning-fork', 'sleeping-ember', 'soot-censer', 'unbroken-oath', 'wirebound-scabbard', 'worn-grip', 'black-iron-stone',
  'bronze-cog', 'dragonscale-tongs', 'echo-hammer', 'giants-spine', 'glass-hourglass', 'golden-cog', 'ossuary-kings-scabbard', 'sealed-rebate',
  'smiths-testament', 'tax-tally', 'bell-collar', 'headless-bell', 'obsidian-eye', 'red-hourglass', 'royal-spike', 'silver-supply-writ',
  'butterfingers', 'dawn-scabbard', 'dragons-pardon', 'kings-empty-cup', 'phoenix-ash', 'sickle-and-hammer', 'split-twin-mirror', 'wandering-ghosts-ledger',
  'pocket-hearth', 'abyssal-pearl', 'ceaseless-driveshaft', 'eternal-seed', 'perfect-mana-core', 'possessed-bellows', 'royal-change', 'unyielding-cornerstone',
  'supply-permit', 'dragon-heart', 'seal-of-twins', 'undertakers-ledger', 'undying-wick', 'dragon-signet', 'oracle-die', 'lifetime-contract',
];
export const CONSUMABLE_IDS = ['ward', 'rewind', 'chalk', 'powder', 'starshard', 'oblivion', 'delivery'];

// ───────────────────────── 常用色 ─────────────────────────
const col = {
  dark: () => M(0x2c2f34, { r: 0.7, m: 0.2 }),
  darkIron: () => M(0x2a2d32, { r: 0.6, m: 0.3 }),
  steel: () => M(0xa4a8a6, { r: 0.5, m: 0.3 }),
  silver: () => M(0xc2c6c4, { r: 0.4, m: 0.35 }),
  copper: () => M(0xb4703a, { r: 0.55, m: 0.25 }),
  maroon: () => M(0x5c2a27, { r: 0.8 }),
  brown: () => M(0x6e3a2c, { r: 0.8 }),
  wood: () => M(0x9a5f32, { r: 0.8 }),
  cream: () => M(0xe6d6ae, { r: 0.8 }),
  sack: () => M(0xe2c690, { r: 0.9 }),
  parch: () => M(0xdcb878, { r: 0.9 }),
  ink: () => M(0x2a2220, { r: 0.8 }),
  redGlow: () => M(0xd02a20, { r: 0.5, e: 0xc01810, ei: 1.2 }),
};

// ───────────────────────── 共用部件 ─────────────────────────
/** 钉子：方头 + 渐细方钉身 */
function nail(g, mat, mark, bend = 0) {
  const b = sub(g, [0, 0, 0], [0, 0, bend]);
  p(b, box(0.42, 0.12, 0.16), mat, [0.02, 0.92, 0], [0, 0, -0.1]);
  p(b, cyl(0.075, 0.012, 0.86, 4), mat, [0, 0.45, 0], [0, PI / 4, 0.04], [1, 1, 0.75]);
  p(b, box(0.015, 0.07, 0.01), mark, [0.04, 0.93, 0.085], [0, 0, -0.5]);
}
/** 硬币/印章圆片：外圈 + 内环 + 一道斜杠 */
function coin(g, face, line) {
  const b = sub(g, [0, 0.46, 0], [-0.12, 0, 0]);
  p(b, disc(0.45, 0.08, 0, 28, 0.025), face);
  p(b, tor(0.42, 0.03, 6, 32), face, [0, 0, 0.06]);
  p(b, tor(0.34, 0.018, 6, 32), line, [0, 0, 0.068]);
  p(b, box(0.035, 0.34, 0.02), line, [0, 0, 0.07], [0, 0, -0.62]);
}
/** 菱形护符：铜环 + 菱形牌 */
function diamondCharm(g) {
  p(g, box(0.48, 0.48, 0.07), col.maroon(), [0, 0.34, 0], [0, 0, PI / 4]);
  p(g, tor(0.12, 0.026, 8, 18), col.copper(), [0, 0.82, 0]);
}
/** 钟形砝码（顶部铜环） */
function bellWeight(g, x, spike) {
  const w = sub(g, [x, 0, 0]);
  p(w, lathe('bellWeight', [[0, 0], [0.24, 0], [0.255, 0.05], [0.235, 0.2], [0.18, 0.36], [0.09, 0.45], [0, 0.465]], 16), col.darkIron());
  p(w, tor(0.095, 0.024, 8, 18), col.copper(), [0, 0.56, 0]);
  if (spike) rod(w, [spike * 0.14, 0.2, 0.12], [spike * 0.33, 0.24, 0.17], 0.028, col.steel(), 6);
}
/** 布袋 */
function sack(g) {
  const s = col.sack();
  p(g, sph(0.36, 16, 12), s, [0, 0.38, 0], [0, 0, 0], [1, 1.06, 0.86]);
  p(g, cyl(0.1, 0.15, 0.12, 12), s, [0, 0.78, 0]);
  p(g, cyl(0.17, 0.1, 0.13, 12), s, [0, 0.89, 0]);
  p(g, ringArc(0.11, 0.016, 0, PI * 2, 6, 16), col.ink(), [0, 0.8, 0]);
  rod(g, [0.08, 0.79, 0.07], [0.3, 0.58, 0.14], 0.014, M(0x6a3428), 5);
}
/** 高脚杯（可带把手） */
function goblet(g, handle) {
  const top = plinth(g, 0.62, 0.42, 0.13);
  const b = sub(g, [0, top, 0]);
  p(b, lathe('goblet', [[0, 0], [0.22, 0], [0.22, 0.03], [0.12, 0.06], [0.055, 0.12], [0.045, 0.3], [0.08, 0.37], [0.2, 0.44], [0.27, 0.6],
    [0.3, 0.84], [0.27, 0.84], [0.245, 0.62], [0.0, 0.5]], 18), M(0x9a9e9a, { r: 0.45, m: 0.35, ds: true }));
  p(b, ringArc(0.29, 0.018, 0, PI * 2, 6, 24), col.wood(), [0, 0.845, 0]);
  if (handle) p(b, tor(0.13, 0.022, 6, 14, PI), col.wood(), [0.29, 0.66, 0], [0, 0, -PI / 2]);
  return b;
}
/** 带孔方印的斜杠按钮 */
function sealButton(parent, pos, r = 0.11) {
  p(parent, disc(r, 0.05, 0, 18, 0.012), col.copper(), pos);
  p(parent, tor(r * 0.8, 0.008, 4, 18), col.ink(), [pos[0], pos[1], pos[2] + 0.034]);
  p(parent, box(0.022, r * 1.1, 0.012), col.ink(), [pos[0], pos[1], pos[2] + 0.036], [0, 0, -0.6]);
}

// ───────────────────────── 清单 #0–#51 ─────────────────────────
const R = {};

R['ash-sieve'] = (g) => {
  const b = sub(g, [0, 0.5, 0], [-0.12, 0, 0.04]);
  p(b, tor(0.44, 0.065, 10, 32), M(0x2e3236, { r: 0.6, m: 0.2 }));
  const w = col.silver();
  for (let i = -3; i <= 3; i++) {
    const x = i * 0.11, L = 2 * Math.sqrt(0.44 * 0.44 - x * x);
    p(b, cyl(0.011, 0.011, L, 5), w, [x, 0, 0], [0, 0, 0.06]);
    p(b, cyl(0.011, 0.011, L, 5), w, [0, x, 0.012], [0, 0, PI / 2 + 0.06]);
  }
};

R['bent-nail'] = (g) => nail(g, M(0x9c9e9a, { r: 0.55, m: 0.3 }), col.ink(), -0.12);

R['black-knot'] = (g) => {
  p(g, tor(0.4, 0.045, 8, 32), M(0x2e3236, { r: 0.6, m: 0.2 }), [0, 0.6, 0]);
  p(g, tor(0.14, 0.035, 8, 20), col.brown(), [0.06, 0.26, 0.05]);
  rod(g, [0.12, 0.17, 0.06], [0.24, -0.02, 0.06], 0.032, col.brown(), 6);
};

R['blunt-mallet'] = (g) => {
  p(g, rbox(0.62, 0.3, 0.3, 0.02), M(0xa2a49e, { r: 0.7, m: 0.2 }), [0, 0.84, 0]);
  p(g, box(0.1, 0.13, 0.02), col.ink(), [0, 0.85, 0.15]);
  p(g, cyl(0.045, 0.05, 0.72, 10), col.brown(), [0, 0.36, 0]);
  for (const y of [0.06, 0.11, 0.16]) p(g, ringArc(0.055, 0.012, 0, PI * 2, 4, 12), col.ink(), [0, y, 0]);
};

R['bound-idol'] = (g) => {
  const top = plinth(g, 0.56, 0.42, 0.13);
  const c = col.cream();
  p(g, cyl(0.11, 0.24, 0.56, 18), c, [0, top + 0.28, 0]);
  p(g, cyl(0.05, 0.07, 0.08, 10), c, [0, top + 0.6, 0]);
  p(g, sph(0.1, 14, 10), c, [0, top + 0.7, 0], [0, 0, 0], [1, 1.15, 1]);
  for (const t of [0.22, 0.34, 0.46]) {
    const r = 0.24 + (0.11 - 0.24) * (t / 0.56);
    p(g, ringArc(r + 0.005, 0.014, 0, PI * 2, 4, 18), col.ink(), [0, top + t, 0]);
  }
};

R['charcoal-pouch'] = (g) => {
  sack(g);
  p(g, sph(0.075, 10, 8), M(0x1e1f22, { r: 0.85 }), [0.33, 0.075, 0.24]);
};

R['first-brand'] = (g) => {
  const b = sub(g, [0, 0, 0], [0, 0, -0.05]);
  p(b, tor(0.14, 0.024, 8, 22), col.dark(), [0, 0.86, 0]);
  p(b, box(0.17, 0.028, 0.03), col.dark(), [0, 0.86, 0], [0, 0, 0.75]);
  p(b, cyl(0.035, 0.035, 0.74, 8), col.brown(), [0, 0.37, 0]);
};

R['heavy-paperweight'] = (g) => {
  p(g, box(1.0, 0.06, 0.5), col.wood(), [0, 0.03, 0]);
  p(g, rbox(0.9, 0.4, 0.42, 0.02), M(0x2e3236, { r: 0.8 }), [0, 0.26, 0]);
  p(g, tor(0.13, 0.04, 10, 22), M(0xb8bab4, { r: 0.4, m: 0.35 }), [0, 0.6, 0]);
};

R['inspection-stamp'] = (g) => {
  p(g, box(0.82, 0.08, 0.46), M(0x2b2e33, { r: 0.85 }), [0, 0.04, 0]);
  p(g, box(0.76, 0.05, 0.42), col.wood(), [0, 0.105, 0]);
  p(g, rbox(0.56, 0.12, 0.32, 0.015), col.wood(), [0, 0.19, 0]);
  const d = M(0x5a2c24, { r: 0.75 });
  p(g, cyl(0.07, 0.085, 0.38, 12), d, [0, 0.44, 0]);
  p(g, sph(0.14, 14, 10), d, [0, 0.66, 0], [0, 0, 0], [1.15, 0.75, 1.15]);
};

R['iron-signet'] = (g) => coin(g, M(0xa8683a, { r: 0.7, m: 0.2 }), col.ink());

R['leather-loop'] = (g) => {
  p(g, tor(0.3, 0.045, 8, 28), col.brown(), [0, 0.42, 0], [0, 0, 0], [0.72, 1.18, 1]);
  p(g, rbox(0.11, 0.11, 0.11, 0.01), M(0xb0b2ae, { r: 0.5, m: 0.3 }), [0, 0.06, 0]);
};

R['lucky-coal'] = (g) => {
  p(g, sph(0.4, 18, 14), M(0x25262a, { r: 0.9 }), [0, 0.4, 0]);
  const s = p(g, box(0.035, 0.3, 0.03), col.redGlow(), [0.04, 0.34, 0.39], [0.15, 0, 0.78]);
  dyn(s, 'glow');
};

R['patched-apron'] = (g) => {
  const b = sub(g, [0, 0, 0], [-0.06, 0, 0]);
  p(b, ext('apronTrap', () => [[-0.42, 0], [0.42, 0], [0.24, 0.8], [-0.24, 0.8]], 0.05, 0.012, 1), M(0x5a2826, { r: 0.85 }));
  p(b, tor(0.12, 0.025, 8, 20), M(0x4a2220, { r: 0.8 }), [0, 0.92, 0]);
  p(b, box(0.18, 0.16, 0.02), M(0xdcc08c, { r: 0.85 }), [0.13, 0.25, 0.04], [0, 0, -0.08]);
  for (const y of [0.22, 0.28]) p(b, box(0.1, 0.015, 0.01), col.ink(), [0.13, y, 0.052], [0, 0, -0.08]);
};

R['patient-weight'] = (g) => {
  p(g, lathe('patientW', [[0, 0], [0.1, 0.1], [0.2, 0.36], [0.22, 0.58], [0.16, 0.74], [0.05, 0.8], [0, 0.8]], 6), M(0x707c82, { r: 0.6, m: 0.25, flat: true }));
  p(g, tor(0.08, 0.022, 8, 18), M(0x2a2d32, { r: 0.6 }), [0, 0.89, 0]);
};

R['red-thread'] = (g) => {
  const pts = [], N = 70;
  for (let i = 0; i <= N; i++) {
    const a = PI * 0.5 + (i / N) * PI * 2 * 2.8;
    const r = 0.33 + 0.035 * Math.sin(i * 0.45);
    pts.push([Math.cos(a) * r + 0.03 * (i / N), 0.58 + Math.sin(a) * r * 1.02, 0.04 * Math.sin(a * 0.5)]);
  }
  pts.push([0.3, 0.22, 0.05], [0.31, 0.0, 0.05]);
  p(g, tube('redThread', pts, 0.013, 120, 4), M(0xc02a2a, { r: 0.6 }), [0, 0, 0], [0.25, 0, 0]);
};

R['relief-sack'] = (g) => {
  sack(g);
  const f = sub(g, [0.02, 0.32, 0.31], [0.12, 0.08, -0.06]);
  p(f, box(0.3, 0.28, 0.02), M(0x4a2626, { r: 0.85 }));
  for (let i = 0; i < 3; i++) p(f, box(0.06, 0.014, 0.01), col.cream(), [-0.08 + i * 0.08, -0.1, 0.012], [0, 0, 0.2]);
};

R['sealing-stone'] = (g) => {
  const b = sub(g, [0, 0.5, 0], [-0.08, 0, 0]);
  p(b, ext('sealStone', () => [[-0.3, 0.46], [0.16, 0.5], [0.44, 0.1], [0.38, -0.4], [-0.14, -0.5], [-0.46, -0.08]], 0.14, 0.02, 1),
    M(0x8e9496, { r: 0.85, flat: true }));
  p(b, box(0.13, 0.96, 0.2), M(0xa02626, { r: 0.75 }), [-0.04, 0, 0], [0, 0, 0.06]);
  sealButton(b, [-0.04, 0.0, 0.11], 0.12);
};

R['wax-effigy'] = (g) => {
  const w = M(0xe6b67a, { r: 0.75 });
  p(g, cyl(0.32, 0.34, 0.04, 20), w, [0, 0.02, 0], [0, 0, 0], [1, 1, 0.65]);
  for (const s of [-1, 1]) {
    p(g, caps(0.06, 0.14, 8), w, [s * 0.08, 0.17, 0], [0, 0, s * 0.08]);
    p(g, caps(0.052, 0.14, 8), w, [s * 0.19, 0.43, 0.02], [0, 0, s * 0.55]);
  }
  p(g, caps(0.12, 0.12, 10), w, [0, 0.4, 0], [0, 0, 0], [1, 1, 0.8]);
  p(g, sph(0.11, 14, 10), w, [0, 0.64, 0]);
  for (const s of [-1, 1]) p(g, sph(0.016, 6, 4), col.ink(), [s * 0.038, 0.655, 0.1]);
  rod(g, [0, 0.74, 0], [0.01, 0.82, 0], 0.006, col.ink(), 4);
  rod(g, [0.02, 0.56, 0.12], [0.06, 0.46, 0.13], 0.008, M(0x8a5a3a), 4);
  p(g, sph(0.018, 6, 4), M(0x8a5a3a), [0.02, 0.565, 0.12]);
};

R['worn-whetstone'] = (g) => {
  p(g, rbox(1.0, 0.22, 0.42, 0.015), M(0x5a2a26, { r: 0.85 }), [0, 0.11, 0]);
  p(g, rbox(0.86, 0.13, 0.32, 0.015), M(0xa8acae, { r: 0.9 }), [0, 0.27, 0]);
  for (let i = 0; i < 7; i++) p(g, box(0.012, 0.06, 0.012), M(0x5e6266), [-0.36 + i * 0.12, 0.31, 0.16]);
};

R['undertakers-chalice'] = (g) => {
  const b = goblet(g, false);
  for (const s of [-1, 1]) p(b, box(0.035, 0.18, 0.02), col.ink(), [s * 0.1, 0.66, 0.26], [0.12, s * 0.35, s * -0.05]);
};

R['blind-die'] = (g) => {
  const b = sub(g, [0, 0.3, 0], [0, 0.1, 0]);
  p(b, rbox(0.6, 0.6, 0.6, 0.05, 2), M(0xe6d6ae, { r: 0.85 }));
  for (const [x, y] of [[-0.15, 0.15], [0.15, 0.15], [0, 0], [-0.15, -0.15], [0.15, -0.15]]) {
    p(b, cyl(0.045, 0.045, 0.02, 12), col.ink(), [x, y, 0.3], [PI / 2, 0, 0]);
  }
};

R['chained-hourglass'] = (g) => {
  const dk = M(0x2a2d32, { r: 0.7 });
  p(g, box(0.52, 0.06, 0.36), dk, [0, 0.03, 0]);
  p(g, box(0.48, 0.04, 0.32), col.wood(), [0, 0.08, 0]);
  p(g, box(0.52, 0.07, 0.36), dk, [0, 0.935, 0]);
  for (const s of [-1, 1]) p(g, box(0.04, 0.8, 0.04), col.wood(), [s * 0.21, 0.5, 0.1]);
  p(g, lathe('chainedGlass', [[0.02, 0.1], [0.17, 0.14], [0.19, 0.3], [0.12, 0.44], [0.035, 0.5], [0.12, 0.56], [0.19, 0.72], [0.17, 0.86], [0.02, 0.9]], 14),
    M(0x34443f, { r: 0.35, m: 0.1, op: 0.82, ds: true }));
  p(g, box(0.014, 0.36, 0.014), M(0xe8e4d8, { r: 0.6, e: 0x404040 }), [0, 0.32, 0]);
  p(g, cyl(0.15, 0.03, 0.1, 12), M(0x1e2422, { r: 0.8 }), [0, 0.6, 0]);
  p(g, cyl(0.03, 0.16, 0.08, 12), M(0x1e2422, { r: 0.8 }), [0, 0.15, 0]);
  for (let i = 0; i < 4; i++) p(g, tor(0.035, 0.009, 4, 10), dk, [-0.29, 0.78 - i * 0.075, 0.05], [0, i % 2 ? PI / 2 : 0, 0]);
};

R['closed-third-eye'] = (g) => {
  const top = plinth(g, 0.76, 0.42, 0.13);
  p(g, sph(0.4, 18, 12), M(0xe6dcc0, { r: 0.75 }), [0, top + 0.19, 0], [0, 0, 0], [1, 0.46, 0.38]);
  p(g, cyl(0.12, 0.12, 0.04, 18), col.ink(), [0, top + 0.19, 0.14], [PI / 2, 0, 0]);
  p(g, rbox(0.56, 0.05, 0.05, 0.015), col.ink(), [0, top + 0.19, 0.13]);
};

R['cold-teacup'] = (g) => goblet(g, true);

R['cracked-wristwatch'] = (g) => {
  const b = sub(g, [0, 0.5, 0], [-0.08, 0, 0.04]);
  p(b, rbox(0.22, 1.0, 0.05, 0.015), M(0x5a2a28, { r: 0.85 }));
  p(b, disc(0.22, 0.06, 0, 24, 0.02), col.copper(), [0, 0.02, 0.04]);
  p(b, tor(0.18, 0.012, 6, 28), col.ink(), [0, 0.02, 0.085]);
  p(b, box(0.026, 0.16, 0.012), col.ink(), [0.05, 0.08, 0.09], [0, 0, -0.75]);
  p(b, box(0.022, 0.1, 0.012), col.ink(), [-0.01, 0.06, 0.092], [0, 0, -0.3]);
  p(b, box(0.03, 0.03, 0.012), col.ink(), [0, 0.02, 0.092]);
};

R['double-knot'] = (g) => {
  const br = col.brown();
  p(g, tor(0.24, 0.042, 8, 26), br, [-0.17, 0.56, 0], [0, 0.35, 0]);
  p(g, tor(0.24, 0.042, 8, 26), br, [0.17, 0.56, 0], [0, -0.35, 0]);
  rod(g, [-0.13, 0.48, 0.12], [0.13, 0.66, 0.12], 0.042, M(0xa86a3a, { r: 0.7 }), 8);
  rod(g, [0.02, 0.5, 0.05], [0.2, 0.15, 0.05], 0.03, M(0x5a2c24, { r: 0.8 }), 6);
};

R['hungry-molar'] = (g) => {
  const b = sub(g, [0, 0.5, 0], [0, 0.25, -0.18]);
  p(b, ext('molar', () => [[-0.24, 0.36], [0.02, 0.5], [0.25, 0.4], [0.25, -0.22], [0.06, -0.5], [-0.25, -0.12]], 0.28, 0.035, 1), M(0xe2cf98, { r: 0.85, flat: true }));
  p(b, rbox(0.3, 0.035, 0.03, 0.01), M(0x4a2420), [0, 0.16, 0.17]);
};

R['iron-comb'] = (g) => {
  p(g, rbox(1.0, 0.13, 0.12, 0.015), M(0x2c2f34, { r: 0.7 }), [0, 0.9, 0], [0, 0, -0.03]);
  const t = M(0x9ea29e, { r: 0.5, m: 0.3 });
  for (let i = 0; i < 8; i++) {
    const L = i === 2 ? 0.44 : 0.6;
    p(g, cyl(0.026, 0.026, L, 8), t, [-0.4 + i * 0.115, 0.84 - L / 2 + 0.008 * i, 0]);
  }
};

R['iron-hoop'] = (g) => {
  const b = sub(g, [0, 0.48, 0], [-0.1, 0, 0]);
  p(b, tor(0.4, 0.075, 8, 28), M(0x2a2d32, { r: 0.6, m: 0.2 }));
  for (const d of [90, 30, -30, -90, -150, 150]) {
    const a = d * PI / 180;
    p(b, sph(0.055, 10, 8), col.silver(), [Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.06]);
  }
};

R['little-wind-bell'] = (g) => {
  p(g, tor(0.07, 0.016, 6, 16), col.dark(), [0, 1.0, 0]);
  p(g, rbox(0.62, 0.07, 0.08, 0.01), col.brown(), [0, 0.89, 0]);
  const tubeM = M(0xb06a2a, { r: 0.6, m: 0.2 });
  for (const [x, top, L] of [[-0.18, 0.7, 0.42], [0, 0.66, 0.52], [0.18, 0.7, 0.4]]) {
    rod(g, [x, 0.855, 0], [x, top, 0], 0.005, col.ink(), 3);
    p(g, cyl(0.032, 0.032, L, 10), tubeM, [x, top - L / 2, 0]);
  }
};

R['thorn-weight'] = (g) => { bellWeight(g, -0.3, -1); bellWeight(g, 0.3, 1); };

R['broken-holy-sword'] = (g) => {
  const top = plinth(g, 0.84, 0.42, 0.13);
  p(g, box(0.09, 0.36, 0.07), col.brown(), [0, top + 0.18, 0]);
  p(g, rbox(0.72, 0.08, 0.1, 0.015), M(0xa8683a, { r: 0.75 }), [0, top + 0.4, 0]);
  p(g, ext('holyBlade', () => [[-0.09, 0], [0.09, 0], [0.09, 0.4], [0.065, 0.52], [0.035, 0.38], [-0.01, 0.45], [-0.09, 0.6]], 0.045, 0.01, 1),
    M(0xb4b8b6, { r: 0.5, m: 0.3 }), [0, top + 0.44, 0]);
  p(g, box(0.02, 0.38, 0.01), M(0x7e8482), [0.0, top + 0.66, 0.035]);
};

R['cracked-crown'] = (g) => {
  const top = plinth(g, 1.0, 0.56, 0.14);
  const cu = M(0xb06a32, { r: 0.65, m: 0.2, ds: true });
  const ts = 0.5, tl = PI * 2 - 0.25;
  p(g, cyl(0.38, 0.4, 0.2, 24, true, ts, tl), cu, [0, top + 0.1, 0]);
  p(g, ringArc(0.4, 0.022, ts, tl, 4, 24), cu, [0, top + 0.01, 0]);
  const hs = [0.5, 0.42, 0.62, 0.4, 0.58, 0.46, 0.55];
  hs.forEach((h, i) => {
    const a = ts + (i + 0.5) * tl / hs.length;
    p(g, ext('crownSpike', () => [[-0.16, 0], [0.16, 0], [0.02, 1]], 0.035, 0.008, 1), cu,
      [Math.sin(a) * 0.385, top + 0.16, Math.cos(a) * 0.385], [-0.04, a, 0], [1, h, 1]);
  });
  for (const a of [-0.35, 0.2]) p(g, cyl(0.025, 0.025, 0.02, 8), col.ink(), [Math.sin(a) * 0.4, top + 0.1, Math.cos(a) * 0.4], [PI / 2, 0, -a]);
};

R['cracked-splice'] = (g) => {
  const b = sub(g, [0, 0.5, 0], [-0.05, 0, -0.22]);
  const gr = M(0xa2a6a6, { r: 0.75, m: 0.2 });
  p(b, rbox(0.2, 1.0, 0.06, 0.012), gr, [-0.11, 0, 0]);
  p(b, rbox(0.2, 1.0, 0.06, 0.012), gr, [0.11, -0.02, 0]);
  for (const y of [-0.35, 0, 0.35]) p(b, rbox(0.52, 0.06, 0.09, 0.01), M(0x2a2d32, { r: 0.7 }), [0, y, 0]);
};

R['golden-nail'] = (g) => nail(g, M(0xb27840, { r: 0.7, m: 0.15 }), M(0x6a4020), 0);

R['grudge-nail'] = (g) => {
  const dk = M(0x2a2e33, { r: 0.75 });
  p(g, box(0.76, 0.08, 0.5), dk, [0, 0.04, 0]);
  for (const [x, z] of [[-0.33, 0.2], [0.33, 0.2], [-0.33, -0.2], [0.33, -0.2]]) p(g, sph(0.022, 6, 4), col.silver(), [x, 0.085, z]);
  p(g, box(0.72, 0.03, 0.46), col.wood(), [0, 0.095, 0]);
  p(g, rbox(0.5, 0.4, 0.36, 0.03), dk, [0, 0.31, 0]);
  const cy = M(0x40d8e8, { r: 0.4, e: 0x20c0d8, ei: 1.4 });
  for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
    dyn(p(g, box(0.03, 0.09, 0.015), cy, [-0.15 + i * 0.1, 0.38 - r * 0.13, 0.185], [0, 0, 0.2]), 'glow');
  }
  const hp = [];
  for (let i = 0; i <= 50; i++) { const a = (i / 50) * PI * 2 * 5; hp.push([Math.cos(a) * 0.1, 0.5 + 0.2 * i / 50, Math.sin(a) * 0.1]); }
  p(g, tube('grudgeSpring', hp, 0.014, 70, 4), col.copper());
  const n = sub(g, [0, 0.5, 0], [0, 0, -0.1]);
  p(n, box(0.08, 0.46, 0.05), M(0xa8aca8, { r: 0.5, m: 0.3 }), [0, 0.23, 0]);
  p(n, rbox(0.16, 0.06, 0.08, 0.01), dk, [0, 0.48, 0]);
};

R['mourning-knot'] = (g) => {
  p(g, tor(0.4, 0.04, 8, 32), M(0x2e3236, { r: 0.6 }), [0, 0.6, 0]);
  for (const d of [150, 120, 90, 60, 30]) {
    const a = d * PI / 180;
    p(g, cyl(0.032, 0.032, 0.13, 8), M(0xe6d4a8, { r: 0.8 }), [Math.cos(a) * 0.31, 0.6 + Math.sin(a) * 0.31, 0.02], [0, 0, a - PI / 2]);
  }
  p(g, tor(0.12, 0.03, 8, 18), col.brown(), [0.04, 0.3, 0.05]);
  rod(g, [0.1, 0.22, 0.06], [0.2, 0.08, 0.06], 0.026, col.brown(), 6);
  p(g, ext('mournRibbon', () => [[-0.12, 0.26], [0.12, 0.26], [0.13, -0.02], [0.0, 0.07], [-0.13, -0.02]], 0.02, 0.005, 1),
    M(0x26282c, { r: 0.8 }), [-0.02, 0.02, 0.03]);
};

R['scorched-charm'] = (g) => {
  diamondCharm(g);
  const cu = col.copper();
  p(g, box(0.03, 0.22, 0.02), cu, [-0.04, 0.32, 0.045], [0, 0, -0.32]);
  p(g, box(0.03, 0.22, 0.02), cu, [0.04, 0.32, 0.045], [0, 0, 0.32]);
};

R['sealed-heart'] = (g) => {
  const top = plinth(g, 0.86, 0.42, 0.13);
  const h = sub(g, [0, top + 0.43, 0], [0, 0, 0.04]);
  p(h, ext('heart', () => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.45);
    s.bezierCurveTo(-0.1, -0.3, -0.5, -0.05, -0.45, 0.2);
    s.bezierCurveTo(-0.4, 0.45, -0.1, 0.45, 0, 0.28);
    s.bezierCurveTo(0.1, 0.45, 0.4, 0.45, 0.45, 0.2);
    s.bezierCurveTo(0.5, -0.05, 0.1, -0.3, 0, -0.45);
    return s;
  }, 0.14, 0.03, 7), M(0xb0302c, { r: 0.7 }));
  const k = M(0x2c2a2a, { r: 0.7 });
  p(h, rbox(0.42, 0.06, 0.04, 0.01), k, [0.0, 0.22, 0.1], [0, 0, -0.22]);
  p(h, rbox(0.34, 0.05, 0.04, 0.01), k, [-0.12, 0.04, 0.1], [0, 0, -0.15]);
  p(h, rbox(0.62, 0.06, 0.04, 0.01), k, [0.02, -0.1, 0.1], [0, 0, -0.22]);
  sealButton(h, [0.02, 0.06, 0.12], 0.08);
};

R['third-hand'] = (g) => {
  const top = plinth(g, 0.66, 0.4, 0.12);
  p(g, rbox(0.4, 0.16, 0.26, 0.015), M(0x4e2220, { r: 0.85 }), [0, top + 0.08, 0]);
  const c = M(0xe8dcbc, { r: 0.8 }), jt = col.ink();
  const y0 = top + 0.16;
  p(g, cyl(0.07, 0.08, 0.08, 10), c, [0, y0 + 0.04, 0]);
  p(g, sph(0.16, 14, 10), c, [0, y0 + 0.2, 0], [0, 0, 0], [1, 1.05, 0.55]);
  const fx = [-0.105, -0.035, 0.035, 0.105], fl = [0.8, 1, 0.95, 0.75];
  fx.forEach((x, i) => {
    const f = sub(g, [x, y0 + 0.33, 0], [0, 0, (i - 1.5) * -0.08], fl[i]);
    p(f, caps(0.032, 0.08, 6), c, [0, 0.06, 0]);
    p(f, sph(0.03, 6, 4), jt, [0, 0.14, 0]);
    p(f, caps(0.03, 0.06, 6), c, [0, 0.2, 0]);
    p(f, sph(0.028, 6, 4), jt, [0, 0.27, 0]);
  });
  const th = sub(g, [-0.13, y0 + 0.2, 0.02], [0, 0, 0.85]);
  p(th, caps(0.035, 0.08, 6), c, [0, 0.07, 0]);
  p(th, sph(0.03, 6, 4), jt, [0, 0.15, 0]);
  p(th, caps(0.032, 0.05, 6), c, [0, 0.21, 0]);
};

R['worn-voucher'] = (g) => {
  const b = sub(g, [0, 0.3, 0], [-0.12, 0, -0.06]);
  p(b, ext('voucher', () => [[-0.5, 0.3], [0.36, 0.3], [0.4, 0.18], [0.5, 0.13], [0.44, 0.0], [0.5, -0.12], [0.42, -0.26], [-0.46, -0.3]], 0.03, 0.008, 1),
    col.parch());
  for (const [y, w] of [[0.12, 0.4], [0.0, 0.62], [-0.12, 0.6]]) p(b, box(w, 0.022, 0.01), col.ink(), [-0.08 - (0.62 - w) / 2 + 0.02, y, 0.025]);
  for (let i = 0; i < 5; i++) p(b, cyl(0.02, 0.02, 0.01, 8), col.ink(), [0.33, 0.2 - i * 0.1, 0.024], [PI / 2, 0, 0]);
};

R['burial-coin'] = (g) => coin(g, M(0x2c2f34, { r: 0.7, m: 0.2 }), M(0x1a1c20, { r: 0.7 }));

R['collectors-hook'] = (g) => {
  rod(g, [-0.06, 0.0, 0], [0.0, 0.44, 0], 0.048, M(0x5a2a26, { r: 0.85 }), 10);
  p(g, cyl(0.052, 0.052, 0.04, 10), col.silver(), [0.0, 0.45, 0]);
  const gr = M(0xa4a8a6, { r: 0.55, m: 0.3 });
  const pts = [[0.0, 0.47], [0.005, 0.56], [0.01, 0.65], [0.015, 0.74]];
  const cx = 0.17, cy = 0.76, R0 = 0.155;
  for (let i = 0; i <= 10; i++) { const a = PI - (i / 10) * (PI + 0.9); pts.push([cx + Math.cos(a) * R0, cy + Math.sin(a) * R0]); }
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const k = 0.12;
    rod(g, [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, 0], [x1 - (x1 - x0) * k, y1 - (y1 - y0) * k, 0], 0.03, gr, 7);
  }
};

R['cracked-bell'] = (g) => {
  const top = plinth(g, 0.84, 0.46, 0.13);
  p(g, lathe('crackedBell', [[0, 0.8], [0.07, 0.79], [0.13, 0.73], [0.19, 0.55], [0.25, 0.33], [0.3, 0.16], [0.35, 0.07], [0.38, 0.0], [0.33, 0.01], [0, 0.06]], 20),
    M(0xb47844, { r: 0.65, m: 0.2 }), [0, top, 0]);
  p(g, tor(0.09, 0.024, 8, 18), col.dark(), [0, top + 0.9, 0]);
  p(g, box(0.014, 0.12, 0.01), col.ink(), [0.17, top + 0.3, 0.24], [0, 0.6, 0.15]);
};

R['defeated-kings-seal'] = (g) => {
  const top = plinth(g, 0.78, 0.46, 0.13);
  p(g, rbox(0.6, 0.13, 0.38, 0.015), col.wood(), [0, top + 0.065, 0]);
  p(g, box(0.4, 0.08, 0.02), M(0x2e4a4c, { r: 0.6 }), [0, top + 0.07, 0.195]);
  p(g, box(0.2, 0.012, 0.01), M(0x8a5530), [0, top + 0.09, 0.207]);
  const hb = M(0x4a2820, { r: 0.8 });
  p(g, cyl(0.08, 0.09, 0.32, 12), hb, [0, top + 0.29, 0]);
  p(g, ringArc(0.095, 0.024, 0, PI * 2, 6, 18), M(0xe6dcc0, { r: 0.7 }), [0, top + 0.3, 0]);
  const br = M(0x6e4430, { r: 0.85 });
  p(g, sph(0.14, 14, 10), br, [0, top + 0.55, 0], [0, 0, 0], [1, 0.95, 0.9]);
  for (const s of [-1, 1]) p(g, sph(0.05, 8, 6), br, [s * 0.1, top + 0.67, 0]);
  p(g, sph(0.05, 8, 6), M(0x8a5a40, { r: 0.85 }), [0, top + 0.52, 0.12]);
};

R['ember-locket'] = (g) => {
  diamondCharm(g);
  dyn(p(g, sph(0.12, 14, 10), M(0xb02a22, { r: 0.45, e: 0x601008, ei: 1 }), [0, 0.32, 0.04], [0, 0, 0], [0.75, 1, 0.35]), 'glow');
};

R['interlocking-weights'] = (g) => { bellWeight(g, -0.3, 0); bellWeight(g, 0.3, 0); };

R['journeyman-badge'] = (g) => {
  p(g, rbox(0.36, 0.42, 0.04, 0.012), M(0x5a2a28, { r: 0.85 }), [0, 0.78, -0.01]);
  p(g, ext('badgeShield', () => [[-0.3, 0.3], [0.3, 0.3], [0.3, -0.08], [0, -0.42], [-0.3, -0.08]], 0.05, 0.012, 1), M(0xc08a50, { r: 0.75 }), [0, 0.43, 0.02]);
  p(g, box(0.18, 0.06, 0.02), col.ink(), [0, 0.5, 0.06]);
  p(g, box(0.04, 0.2, 0.02), col.ink(), [0, 0.38, 0.06]);
};

R['lightning-mark'] = (g) => {
  p(g, ext('star5', () => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = PI / 2 + i * PI / 5, r = i % 2 ? 0.2 : 0.5;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  }, 0.1, 0.02, 1), M(0xc0804a, { r: 0.75 }), [0, 0.41, 0], [-0.08, 0, 0]);
};

R['silver-tuning-fork'] = (g) => {
  const s = M(0xb8bcba, { r: 0.4, m: 0.35 });
  for (const x of [-0.14, 0.14]) p(g, cyl(0.035, 0.035, 0.56, 10), s, [x, 0.74, 0]);
  p(g, cyl(0.04, 0.04, 0.32, 10), s, [0, 0.45, 0], [0, 0, PI / 2]);
  for (const x of [-0.14, 0.14]) p(g, sph(0.04, 10, 8), s, [x, 0.45, 0]);
  p(g, cyl(0.035, 0.035, 0.4, 10), s, [0.01, 0.2, 0], [0, 0, 0.03]);
};

R['sleeping-ember'] = (g) => {
  const top = plinth(g, 1.0, 0.44, 0.14);
  const blk = M(0x24252a, { r: 0.85 });
  for (const [x, z, r] of [[-0.29, -0.02, 0.2], [0.0, 0.05, 0.18], [0.29, 0.0, 0.2]]) {
    p(g, sph(r, 16, 12), blk, [x, top + r - 0.01, z]);
    dyn(p(g, box(0.028, r * 0.7, 0.02), col.redGlow(), [x + 0.02, top + r - 0.03, z + r - 0.005], [0.1, 0, 0.85]), 'glow');
  }
};

R['soot-censer'] = (g) => {
  const top = plinth(g, 0.84, 0.44, 0.13);
  p(g, lathe('censer', [[0, 0], [0.07, 0], [0.13, 0.04], [0.3, 0.24], [0.34, 0.32], [0.31, 0.33], [0.0, 0.27]], 18), M(0xb07040, { r: 0.6, m: 0.2 }), [0, top, 0]);
  const st = M(0x26282c, { r: 0.8 });
  for (const [x, tilt] of [[-0.09, 0.08], [0, 0], [0.09, -0.08]]) {
    rod(g, [x, top + 0.24, 0], [x - tilt * 0.8, top + 0.86, 0], 0.012, st, 4);
    dyn(p(g, sph(0.018, 6, 4), M(0xff7a30, { e: 0xff5a10, ei: 1.5 }), [x - tilt * 0.8, top + 0.87, 0]), 'glow');
  }
};

// 未知 id：问号宝石
function unknown(g) {
  p(g, ext('unkGem', () => [[0, -0.42], [0.3, 0], [0, 0.42], [-0.3, 0]], 0.2, 0.06, 1), M(0x7a4aa8, { r: 0.35, e: 0x1a0a30, flat: true }), [0, 0.48, 0]);
  const w = M(0xffffff, { r: 0.5, e: 0xffffff, ei: 0.6 });
  p(g, tor(0.08, 0.025, 6, 12, PI * 1.3), w, [0, 0.56, 0.17], [0, 0, -PI * 0.3]);
  p(g, box(0.05, 0.08, 0.04), w, [0, 0.44, 0.17]);
  p(g, box(0.05, 0.05, 0.04), w, [0, 0.34, 0.17]);
}

// ───────────────────────── 动画 ─────────────────────────
/** 默认：带 'glow' 标记的部件做呼吸光 */
const pulse = (dmap) => {
  const ms = dmap.glow || [];
  const base = ms.map((m) => m.material.emissiveIntensity);
  const ph = Math.random() * 10;
  return (dt, t) => { ms.forEach((m, i) => { m.material.emissiveIntensity = base[i] * (0.75 + 0.25 * Math.sin(t * 2.2 + ph)); }); };
};

// ───────────────────────── 构建、合并、归一化 ─────────────────────────
const TARGET = {
  'worn-whetstone': 0.26, 'heavy-paperweight': 0.24, 'sleeping-ember': 0.26, 'thorn-weight': 0.26, 'interlocking-weights': 0.26,
  'cracked-crown': 0.26, 'iron-comb': 0.24,
};

function bake(inner) {
  inner.updateMatrixWorld(true);
  const buckets = new Map(), dyns = [];
  inner.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.dyn) { dyns.push(o); return; }
    const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', src.getAttribute('position').clone());
    ng.setAttribute('normal', src.getAttribute('normal').clone());
    const uv = src.getAttribute('uv');
    ng.setAttribute('uv', uv ? uv.clone() : new THREE.BufferAttribute(new Float32Array(src.getAttribute('position').count * 2), 2));
    ng.applyMatrix4(o.matrixWorld);
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(ng);
  });
  const body = new THREE.Group();
  const entries = [...buckets.entries()].sort((a, b) => (a[0].transparent ? 1 : 0) - (b[0].transparent ? 1 : 0));
  for (const [mat, list] of entries) {
    const geo = list.length === 1 ? list[0] : mergeGeometries(list, false);
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = !mat.transparent;
    if (mat.transparent) m.renderOrder = 1;
    body.add(m);
  }
  for (const o of dyns) {
    const m = new THREE.Mesh(o.geometry, o.material);
    o.matrixWorld.decompose(m.position, m.quaternion, m.scale);
    m.name = o.name || o.userData.dyn;
    m.userData.dyn = o.userData.dyn;
    m.castShadow = true;
    body.add(m);
  }
  return body;
}

const _box = new THREE.Box3(), _v = new THREE.Vector3(), _c = new THREE.Vector3();
function make(kind, id, fn, target) {
  const inner = new THREE.Group();
  const out = fn(inner);
  const src = out && out.isObject3D ? out : inner;
  const tgt = src.userData.target ?? target ?? 0.24;
  const anim = src.userData.anim;
  src.position.set(0, 0, 0); src.rotation.set(0, 0, 0); src.scale.set(1, 1, 1);
  const body = bake(src);
  _box.setFromObject(body);
  _box.getSize(_v);
  _box.getCenter(_c);
  const s = tgt / Math.max(_v.x, _v.y, _v.z);
  body.scale.setScalar(s);
  body.position.set(-_c.x * s, -_box.min.y * s, -_c.z * s);
  const root = new THREE.Group();
  root.name = `${kind}:${id}`;
  root.add(body);
  let tris = 0, hasGlow = false;
  body.traverse((o) => {
    if (!o.isMesh) return;
    tris += (o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute('position').count) / 3;
    if (o.userData.dyn === 'glow') hasGlow = true;
  });
  root.userData = { kind, id, tris: Math.round(tris), size: { x: _v.x * s, y: _v.y * s, z: _v.z * s } };
  return { root, anim: anim || (hasGlow ? pulse : null) };
}

const _proto = new Map();
function instance(kind, id) {
  const local = kind === 'relic' ? R[id] : undefined;
  const fn = local || BUILDERS_B[id];
  const key = fn ? `${kind}:${id}` : `${kind}:?`;
  let proto = _proto.get(key);
  if (!proto) {
    try {
      proto = fn ? make(kind, id, fn, TARGET[id]) : make(kind, '?', unknown, 0.22);
    } catch (e) {
      console.error(`[relics3d] build ${kind}:${id} failed`, e);
      proto = make(kind, '?', unknown, 0.22);
    }
    _proto.set(key, proto);
  }
  const g = proto.root.clone(); // 共享几何与材质
  g.userData.id = id;
  if (proto.anim) {
    const dmap = {}, cloned = new Map();
    g.traverse((o) => {
      if (!o.isMesh || !o.userData.dyn) return;
      if (!cloned.has(o.material)) cloned.set(o.material, o.material.clone()); // 动画材质每实例独立
      o.material = cloned.get(o.material);
      (dmap[o.userData.dyn] ||= []).push(o);
    });
    g.userData.update = proto.anim(dmap);
  }
  return g;
}

/** 构建遗物模型（约 0.2–0.28m，底部 y=0，水平居中，正面 +Z）。未知 id 返回问号宝石。 */
export function buildRelic(id) { return instance('relic', id); }
/** 构建消耗品模型（同上约定）。 */
export function buildConsumable(id) { return instance('consumable', id); }
/** 某 id 是否已有专门模型 */
export function hasModel(kind, id) { return !!((kind === 'relic' && R[id]) || BUILDERS_B[id]); }

// ───────────────────────── 图标渲染 ─────────────────────────
let _rig = null;
function rig() {
  if (_rig) return _rig;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.01, 10);
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x2a2020, 1.2));
  const key = new THREE.DirectionalLight(0xffe6c8, 2.4); key.position.set(-1.0, 2.0, 2.6);
  const fill = new THREE.DirectionalLight(0xb0c0ff, 0.7); fill.position.set(2.2, 0.6, 1.4);
  const rim = new THREE.DirectionalLight(0xffd0a0, 1.6); rim.position.set(0.8, 1.6, -2.5);
  scene.add(key, fill, rim);
  _rig = { scene, camera, rts: new Map() };
  return _rig;
}

/**
 * 把模型渲染成透明背景的小图标（略俯视的 3/4 正面、自带三点打光），返回 PNG dataURL。
 * group 可以已在场景中：渲染期间会临时移出并复位其局部变换，结束后放回原父节点原位置。
 */
export function renderIcon(renderer, group, size = 128) {
  const { scene, camera, rts } = rig();
  const ss = size * 2;
  let rt = rts.get(ss);
  if (!rt) {
    rt = new THREE.WebGLRenderTarget(ss, ss, { colorSpace: THREE.SRGBColorSpace, samples: 4, depthBuffer: true });
    rts.set(ss, rt);
  }
  const parent = group.parent;
  const idx = parent ? parent.children.indexOf(group) : -1;
  const pos = group.position.clone(), quat = group.quaternion.clone(), scl = group.scale.clone();
  const vis = group.visible;
  group.position.set(0, 0, 0); group.quaternion.identity(); group.scale.set(1, 1, 1); group.visible = true;
  scene.add(group);
  group.updateMatrixWorld(true);

  const bb = new THREE.Box3().setFromObject(group);
  const sphere = bb.getBoundingSphere(new THREE.Sphere());
  const dir = new THREE.Vector3(0.25, 0.3, 1).normalize();
  const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.98;
  camera.position.copy(sphere.center).addScaledVector(dir, dist);
  camera.near = dist * 0.05; camera.far = dist * 4;
  camera.updateProjectionMatrix();
  camera.lookAt(sphere.center);

  const prevRT = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const prevAuto = renderer.autoClear;
  const buf = new Uint8Array(ss * ss * 4);
  try {
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = true;
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(rt, 0, 0, ss, ss, buf);
  } finally {
    renderer.setRenderTarget(prevRT);
    renderer.setClearColor(prevColor, prevAlpha);
    renderer.autoClear = prevAuto;
    scene.remove(group);
    group.position.copy(pos); group.quaternion.copy(quat); group.scale.copy(scl); group.visible = vis;
    if (parent) {
      parent.add(group);
      const ch = parent.children;
      ch.splice(ch.indexOf(group), 1);
      ch.splice(Math.max(0, idx), 0, group);
    }
  }

  // 翻转 Y + 去预乘
  const c1 = document.createElement('canvas');
  c1.width = c1.height = ss;
  const ctx1 = c1.getContext('2d');
  const img = ctx1.createImageData(ss, ss);
  const row = ss * 4;
  for (let y = 0; y < ss; y++) {
    const src = (ss - 1 - y) * row, dst = y * row;
    for (let x = 0; x < row; x += 4) {
      const a = buf[src + x + 3];
      const k = a > 0 && a < 255 ? 255 / a : 1;
      img.data[dst + x] = Math.min(255, buf[src + x] * k);
      img.data[dst + x + 1] = Math.min(255, buf[src + x + 1] * k);
      img.data[dst + x + 2] = Math.min(255, buf[src + x + 2] * k);
      img.data[dst + x + 3] = a;
    }
  }
  ctx1.putImageData(img, 0, 0);
  const c2 = document.createElement('canvas');
  c2.width = c2.height = size;
  const ctx2 = c2.getContext('2d');
  ctx2.imageSmoothingEnabled = true;
  ctx2.imageSmoothingQuality = 'high';
  ctx2.drawImage(c1, 0, 0, size, size);
  return c2.toDataURL('image/png');
}

const _icons = new Map();
/** 便捷：按 id 缓存图标。kind: 'relic' | 'consumable' */
export function getIcon(renderer, kind, id, size = 128) {
  const key = `${kind}:${id}:${size}`;
  if (!_icons.has(key)) _icons.set(key, renderIcon(renderer, kind === 'relic' ? buildRelic(id) : buildConsumable(id), size));
  return _icons.get(key);
}
