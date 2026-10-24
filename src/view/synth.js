// Built-in synthesized sound effects (Web Audio). Used whenever a sound has no real file,
// so the game has audio from day one. Each recipe returns its duration in seconds.

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

// Oscillator with frequency glide f0 -> f1 and a fast attack / exponential decay envelope.
function tone(ctx, out, { type = "sine", f0, f1 = f0, t = 0, dur = 0.15, vol = 0.5, attack = 0.005 }) {
  const t0 = ctx.currentTime + t;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(out);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

// Filtered noise burst with a filter sweep f0 -> f1.
function noise(ctx, out, { filter = "bandpass", f0 = 1000, f1 = f0, q = 1, t = 0, dur = 0.15, vol = 0.5, attack = 0.005 }) {
  const t0 = ctx.currentTime + t;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuffer(ctx);
  f.type = filter; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
}

const arp = (ctx, out, notes, step, o = {}) =>
  notes.forEach((f, i) => tone(ctx, out, { type: "triangle", f0: f, t: i * step, dur: step * 1.8, vol: 0.4, ...o }));

export const RECIPES = {
  swing:      (c, o) => { noise(c, o, { f0: 700, f1: 2600, q: 0.6, dur: 0.12, vol: 1.4 }); return 0.14; },
  swingHeavy: (c, o) => { noise(c, o, { f0: 400, f1: 1800, q: 0.6, dur: 0.22, vol: 0.9 }); tone(c, o, { f0: 120, f1: 60, dur: 0.2, vol: 0.3 }); return 0.25; },
  combo:      (c, o) => { noise(c, o, { f0: 300, f1: 3200, q: 1, dur: 0.35, vol: 0.4 }); tone(c, o, { type: "sawtooth", f0: 180, f1: 700, dur: 0.3, vol: 0.2 }); return 0.4; },
  kick:       (c, o) => { tone(c, o, { type: "sawtooth", f0: 200, f1: 1700, dur: 0.22, vol: 0.3 }); noise(c, o, { filter: "highpass", f0: 2500, dur: 0.25, vol: 0.25, t: 0.05 }); tone(c, o, { type: "square", f0: 90, f1: 40, t: 0.1, dur: 0.2, vol: 0.35 }); return 0.4; },
  dragonFist: (c, o) => { tone(c, o, { f0: 90, f1: 30, dur: 0.7, vol: 0.7 }); noise(c, o, { filter: "lowpass", f0: 2500, f1: 120, dur: 0.6, vol: 0.5, t: 0.05 }); tone(c, o, { type: "sawtooth", f0: 300, f1: 60, dur: 0.5, vol: 0.2 }); return 0.8; },
  heal:       (c, o) => { arp(c, o, [523, 659, 784, 1047], 0.09); return 0.7; },
  dash:       (c, o) => { noise(c, o, { f0: 500, f1: 3500, q: 0.5, dur: 0.18, vol: 1.3 }); return 0.2; },
  jump:       (c, o) => { tone(c, o, { f0: 240, f1: 520, dur: 0.1, vol: 0.6 }); return 0.12; },
  hit:        (c, o) => { noise(c, o, { filter: "lowpass", f0: 1800, f1: 300, dur: 0.1, vol: 0.5 }); tone(c, o, { f0: 160, f1: 60, dur: 0.1, vol: 0.5 }); return 0.12; },
  crit:       (c, o) => { noise(c, o, { filter: "lowpass", f0: 2400, f1: 300, dur: 0.14, vol: 0.55 }); tone(c, o, { f0: 140, f1: 50, dur: 0.16, vol: 0.55 }); tone(c, o, { type: "square", f0: 880, f1: 1480, dur: 0.22, vol: 0.18 }); return 0.26; },
  zap:        (c, o) => { tone(c, o, { type: "sawtooth", f0: 1500, f1: 180, dur: 0.18, vol: 0.3 }); noise(c, o, { filter: "highpass", f0: 3000, dur: 0.12, vol: 0.25 }); return 0.2; },
  comboHit:   (c, o) => { noise(c, o, { filter: "lowpass", f0: 2000, f1: 400, dur: 0.1, vol: 0.45 }); tone(c, o, { type: "square", f0: 220, f1: 90, dur: 0.1, vol: 0.25 }); return 0.12; },
  enemyDie:   (c, o) => { noise(c, o, { filter: "lowpass", f0: 1500, f1: 200, dur: 0.18, vol: 0.4 }); tone(c, o, { f0: 420, f1: 70, dur: 0.22, vol: 0.4 }); return 0.25; },
  boom:       (c, o) => { noise(c, o, { filter: "lowpass", f0: 1800, f1: 80, dur: 0.5, vol: 0.7 }); tone(c, o, { f0: 90, f1: 30, dur: 0.5, vol: 0.7 }); return 0.55; },
  hurt:       (c, o) => { tone(c, o, { type: "sawtooth", f0: 320, f1: 90, dur: 0.22, vol: 0.4 }); noise(c, o, { filter: "lowpass", f0: 1200, f1: 200, dur: 0.15, vol: 0.4 }); return 0.25; },
  dodge:      (c, o) => { noise(c, o, { filter: "highpass", f0: 2500, dur: 0.12, vol: 0.2 }); tone(c, o, { f0: 1400, f1: 1900, dur: 0.1, vol: 0.18 }); return 0.14; },
  death:      (c, o) => { tone(c, o, { type: "sawtooth", f0: 420, f1: 40, dur: 1.0, vol: 0.45 }); noise(c, o, { filter: "lowpass", f0: 900, f1: 60, dur: 1.0, vol: 0.35 }); return 1.05; },
  revive:     (c, o) => { arp(c, o, [262, 392, 523, 784, 1047], 0.1); return 0.8; },
  freeze:     (c, o) => { tone(c, o, { type: "triangle", f0: 2400, f1: 900, dur: 0.4, vol: 0.3 }); noise(c, o, { filter: "highpass", f0: 5000, dur: 0.3, vol: 0.3 }); return 0.45; },
  spit:       (c, o) => { tone(c, o, { f0: 700, f1: 280, dur: 0.1, vol: 0.6 }); return 0.12; },
  beam:       (c, o) => { tone(c, o, { type: "sawtooth", f0: 120, f1: 900, dur: 0.5, vol: 0.45 }); noise(c, o, { f0: 600, f1: 2500, q: 1.2, dur: 0.5, vol: 0.7 }); return 0.55; },
  bossSpawn:  (c, o) => { tone(c, o, { type: "sawtooth", f0: 80, f1: 45, dur: 1.4, vol: 0.5 }); tone(c, o, { type: "square", f0: 60, f1: 40, dur: 1.4, vol: 0.3 }); noise(c, o, { filter: "lowpass", f0: 400, f1: 100, dur: 1.2, vol: 0.4 }); return 1.5; },
  bossDie:    (c, o) => { noise(c, o, { filter: "lowpass", f0: 2200, f1: 60, dur: 1.0, vol: 0.7 }); tone(c, o, { f0: 100, f1: 25, dur: 1.0, vol: 0.7 }); arp(c, o, [392, 523, 659, 784], 0.12, { t: 0.5 }); return 1.2; },
  wave:       (c, o) => { tone(c, o, { type: "sawtooth", f0: 220, dur: 0.22, vol: 0.45 }); tone(c, o, { type: "sawtooth", f0: 330, t: 0.2, dur: 0.35, vol: 0.45 }); return 0.6; },
  levelUp:    (c, o) => { arp(c, o, [392, 494, 587, 784, 988], 0.07); return 0.65; },
  select:     (c, o) => { tone(c, o, { type: "square", f0: 880, f1: 1320, dur: 0.07, vol: 0.45 }); return 0.1; },
};
