// Built-in synthesized sound effects (Web Audio). Used whenever a sound has no real file.
// Design goals: weight and grit, not bleeps. Impacts = saturated low "thump" + gritty low-passed noise +
// a tiny high "crack". Saturation (waveshaper) matters: it adds harmonics at 150-800 Hz so the low end is
// still audible on laptop and phone speakers, which cannot reproduce true sub-bass.
// Each recipe returns its duration in seconds.

let P = 1; // pitch multiplier for the sound currently being built (random variation per play)

const noiseCache = new WeakMap();
function noiseBuffer(ctx) {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

const curves = new Map();
function satCurve(k) {
  if (!curves.has(k)) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = Math.tanh((i / (n - 1) * 2 - 1) * k);
    curves.set(k, c);
  }
  return curves.get(k);
}
function shaper(ctx, k) {
  const s = ctx.createWaveShaper();
  s.curve = satCurve(k);
  s.oversample = "2x";
  return s;
}
function envelope(ctx, t0, dur, vol, attack) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  return g;
}

// Oscillator with glide f0 -> f1. lp = optional low-pass cutoff (Hz), sat = optional saturation amount.
function tone(ctx, out, { type = "sine", f0, f1 = f0, t = 0, dur = 0.15, vol = 0.5, attack = 0.004, lp, sat }) {
  const t0 = ctx.currentTime + t;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0 * P, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1 * P), t0 + dur);
  let node = o;
  if (sat) { const s = shaper(ctx, sat); node.connect(s); node = s; }
  if (lp) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(lp, t0); node.connect(f); node = f; }
  node.connect(envelope(ctx, t0, dur, vol, attack)).connect(out);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

// Filtered noise with a filter sweep f0 -> f1. sat = optional saturation (grit).
function noise(ctx, out, { filter = "bandpass", f0 = 1000, f1 = f0, q = 1, t = 0, dur = 0.15, vol = 0.5, attack = 0.004, sat }) {
  const t0 = ctx.currentTime + t;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter();
  s.buffer = noiseBuffer(ctx);
  f.type = filter; f.Q.value = q;
  f.frequency.setValueAtTime(f0 * P, t0);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(1, f1 * P), t0 + dur);
  let node = s.connect(f);
  if (sat) node = node.connect(shaper(ctx, sat));
  node.connect(envelope(ctx, t0, dur, vol, attack)).connect(out);
  s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
}

// Building blocks
const thump  = (c, o, { f0, f1, dur, vol = 0.9, sat = 3, t = 0 }) => tone(c, o, { f0, f1, dur, vol, sat, t });
const crack  = (c, o, { vol = 0.3, t = 0, f = 3200 } = {}) => noise(c, o, { filter: "highpass", f0: f, dur: 0.025, vol, t, attack: 0.001 });
const grit   = (c, o, { f0, f1, dur, vol = 0.8, sat = 3.5, t = 0, q = 0.7 }) => noise(c, o, { filter: "lowpass", f0, f1, dur, vol, sat, t, q });
const whoosh = (c, o, { f0, f1, dur, vol = 1.1, attack = 0.05, t = 0, q = 0.8 }) => noise(c, o, { f0, f1, dur, vol, attack, t, q });
const pad = (c, o, notes, { dur = 0.9, attack = 0.15, vol = 0.22, step = 0.04, lp = 1200, type = "sine" } = {}) =>
  notes.forEach((f, i) => tone(c, o, { type, f0: f, t: i * step, dur, attack, vol, lp }));

const RAW = {
  // --- player attacks
  swing:      (c, o) => { whoosh(c, o, { f0: 260, f1: 1100, dur: 0.16, vol: 2.6, attack: 0.03 }); tone(c, o, { f0: 90, f1: 60, dur: 0.14, vol: 0.25, sat: 2 }); return 0.2; },
  swingHeavy: (c, o) => { whoosh(c, o, { f0: 180, f1: 800, dur: 0.28, vol: 2.4, attack: 0.07, q: 0.7 }); tone(c, o, { f0: 80, f1: 45, dur: 0.25, vol: 0.45, sat: 2 }); return 0.3; },
  combo:      (c, o) => { whoosh(c, o, { f0: 150, f1: 1600, dur: 0.4, vol: 1.1, attack: 0.14 }); thump(c, o, { f0: 100, f1: 38, dur: 0.3, vol: 0.8, t: 0.22 }); crack(c, o, { t: 0.22 }); return 0.55; },
  kick:       (c, o) => { thump(c, o, { f0: 120, f1: 38, dur: 0.3, vol: 0.9 }); noise(c, o, { f0: 2000, f1: 700, q: 1.5, dur: 0.18, vol: 0.5, t: 0.02, sat: 5 }); tone(c, o, { type: "sawtooth", f0: 220, f1: 70, dur: 0.22, vol: 0.3, t: 0.02, lp: 900, sat: 2 }); crack(c, o, { vol: 0.4 }); return 0.35; },
  dragonFist: (c, o) => { whoosh(c, o, { f0: 200, f1: 1400, dur: 0.25, vol: 0.9, attack: 0.1 }); tone(c, o, { f0: 75, f1: 24, dur: 0.9, vol: 0.7, sat: 3, t: 0.22 }); grit(c, o, { f0: 2200, f1: 55, dur: 0.8, vol: 0.65, t: 0.22 }); tone(c, o, { type: "sawtooth", f0: 95, f1: 32, dur: 0.7, vol: 0.35, lp: 400, t: 0.22 }); crack(c, o, { vol: 0.5, t: 0.22 }); return 1.1; },
  heal:       (c, o) => { pad(c, o, [196, 247, 294, 392], { dur: 0.95, attack: 0.18, vol: 0.22 }); tone(c, o, { f0: 784, dur: 0.8, attack: 0.3, vol: 0.05, lp: 1500 }); return 1.0; },
  dash:       (c, o) => { whoosh(c, o, { f0: 220, f1: 1300, dur: 0.22, vol: 2.8, attack: 0.04, q: 0.7 }); return 0.24; },
  jump:       (c, o) => { grit(c, o, { f0: 900, f1: 300, dur: 0.09, vol: 1.0, sat: 2 }); tone(c, o, { f0: 130, f1: 210, dur: 0.09, vol: 0.55, lp: 600 }); return 0.12; },
  // --- impacts
  hit:        (c, o) => { thump(c, o, { f0: 150, f1: 48, dur: 0.22, vol: 0.9, sat: 2.5 }); grit(c, o, { f0: 1600, f1: 140, dur: 0.12, vol: 0.8 }); crack(c, o, { vol: 0.25 }); return 0.24; },
  crit:       (c, o) => { thump(c, o, { f0: 130, f1: 34, dur: 0.38, vol: 0.85 }); grit(c, o, { f0: 2600, f1: 110, dur: 0.2, vol: 0.7 }); tone(c, o, { type: "sawtooth", f0: 62, f1: 38, dur: 0.3, vol: 0.45, lp: 320 }); crack(c, o, { vol: 0.45, f: 3500 }); return 0.4; },
  comboHit:   (c, o) => { thump(c, o, { f0: 170, f1: 55, dur: 0.16, vol: 0.8, sat: 2.5 }); grit(c, o, { f0: 1800, f1: 200, dur: 0.1, vol: 0.7, sat: 3 }); crack(c, o, { vol: 0.2 }); return 0.18; },
  zap:        (c, o) => { noise(c, o, { f0: 2200, f1: 900, q: 2, dur: 0.16, vol: 0.5, sat: 5 }); tone(c, o, { type: "sawtooth", f0: 55, f1: 50, dur: 0.2, vol: 0.4, lp: 500, sat: 3 }); thump(c, o, { f0: 120, f1: 50, dur: 0.12, vol: 0.5 }); return 0.22; },
  enemyDie:   (c, o) => { thump(c, o, { f0: 130, f1: 38, dur: 0.32, vol: 0.8 }); grit(c, o, { f0: 1100, f1: 90, dur: 0.26, vol: 0.8, sat: 4 }); tone(c, o, { type: "sawtooth", f0: 110, f1: 40, dur: 0.25, vol: 0.3, lp: 400 }); return 0.35; },
  boom:       (c, o) => { tone(c, o, { f0: 70, f1: 24, dur: 0.8, vol: 1.0, sat: 3 }); grit(c, o, { f0: 1700, f1: 50, dur: 0.65, vol: 1.0 }); return 0.85; },
  // --- player state
  hurt:       (c, o) => { thump(c, o, { f0: 110, f1: 42, dur: 0.24, vol: 0.85 }); grit(c, o, { f0: 900, f1: 110, dur: 0.16, vol: 0.7 }); tone(c, o, { type: "sawtooth", f0: 150, f1: 70, dur: 0.22, vol: 0.35, lp: 500, sat: 2 }); return 0.28; },
  dodge:      (c, o) => { whoosh(c, o, { f0: 1000, f1: 2200, dur: 0.14, vol: 1.5, attack: 0.03, q: 1.2 }); return 0.16; },
  death:      (c, o) => { tone(c, o, { type: "sawtooth", f0: 160, f1: 28, dur: 1.3, vol: 0.6, lp: 500, sat: 2 }); tone(c, o, { f0: 80, f1: 22, dur: 1.3, vol: 0.8, sat: 3 }); grit(c, o, { f0: 1000, f1: 50, dur: 1.2, vol: 0.5, sat: 2 }); return 1.4; },
  revive:     (c, o) => { pad(c, o, [130.8, 196, 261.6, 392], { dur: 1.0, attack: 0.35, vol: 0.28, step: 0.07, lp: 1400 }); return 1.1; },
  freeze:     (c, o) => { noise(c, o, { f0: 4200, f1: 1600, q: 6, dur: 0.35, vol: 0.5, sat: 2 }); noise(c, o, { filter: "highpass", f0: 5500, dur: 0.25, vol: 0.35 }); thump(c, o, { f0: 90, f1: 45, dur: 0.2, vol: 0.5 }); return 0.45; },
  // --- enemies / world
  spit:       (c, o) => { tone(c, o, { f0: 320, f1: 90, dur: 0.12, vol: 0.6, sat: 2 }); grit(c, o, { f0: 1400, f1: 300, dur: 0.1, vol: 0.4, sat: 2 }); return 0.14; },
  beam:       (c, o) => { tone(c, o, { type: "sawtooth", f0: 65, f1: 240, dur: 0.6, vol: 0.5, lp: 700, sat: 3 }); whoosh(c, o, { f0: 250, f1: 1300, dur: 0.6, vol: 0.9, attack: 0.1, q: 1 }); return 0.65; },
  bossSpawn:  (c, o) => { tone(c, o, { type: "sawtooth", f0: 52, f1: 34, dur: 1.8, vol: 0.6, lp: 260, sat: 2 }); tone(c, o, { f0: 42, f1: 30, dur: 1.8, vol: 0.9, sat: 2 }); grit(c, o, { f0: 350, f1: 80, dur: 1.6, vol: 0.6, sat: 2 }); return 1.9; },
  bossDie:    (c, o) => { tone(c, o, { f0: 65, f1: 22, dur: 1.2, vol: 1.0, sat: 3 }); grit(c, o, { f0: 2000, f1: 45, dur: 1.0, vol: 0.9 }); tone(c, o, { type: "sawtooth", f0: 120, f1: 30, dur: 1.2, vol: 0.4, lp: 350, t: 0.1 }); return 1.3; },
  wave:       (c, o) => { tone(c, o, { type: "sawtooth", f0: 110, dur: 0.5, attack: 0.06, vol: 0.5, lp: 650 }); tone(c, o, { type: "sawtooth", f0: 165, dur: 0.5, attack: 0.06, vol: 0.35, lp: 650 }); tone(c, o, { type: "sawtooth", f0: 147, t: 0.25, dur: 0.6, attack: 0.06, vol: 0.5, lp: 650 }); tone(c, o, { type: "sawtooth", f0: 220, t: 0.25, dur: 0.6, attack: 0.06, vol: 0.35, lp: 650 }); return 0.9; },
  // --- UI
  levelUp:    (c, o) => { pad(c, o, [196, 247, 294, 392, 494], { type: "triangle", dur: 0.38, attack: 0.012, vol: 0.34, step: 0.07, lp: 1100 }); tone(c, o, { f0: 98, dur: 0.55, attack: 0.02, vol: 0.3, lp: 400 }); return 0.75; },
  select:     (c, o) => { grit(c, o, { f0: 1200, f1: 300, dur: 0.05, vol: 0.4, sat: 2 }); tone(c, o, { f0: 320, f1: 220, dur: 0.06, vol: 0.35, sat: 2 }); return 0.08; },
};

// Public recipes take (ctx, out, pitch = 1). pitch scales every frequency (used for random variation).
export const RECIPES = Object.fromEntries(
  Object.entries(RAW).map(([name, fn]) => [name, (ctx, out, pitch = 1) => {
    P = pitch;
    try { return fn(ctx, out); } finally { P = 1; }
  }]),
);
