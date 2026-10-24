// Renders every built-in synthesized sound offline and checks it is audible, not clipping, and the declared duration is sane.
// Optional dev tool: `npm i --no-save node-web-audio-api` then `node tools/audio-render-check.mjs`
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { OfflineAudioContext } = require("node-web-audio-api");
import { RECIPES } from "../src/view/synth.js";
import { SOUNDS } from "../src/data/sounds.js";
const SR = 44100;
const rows = [];
for (const [name, recipe] of Object.entries(RECIPES)) {
  const ctx = new OfflineAudioContext(1, SR * 3, SR);
  const g = ctx.createGain(); g.gain.value = SOUNDS[name].volume;       // same per-sound gain as the engine
  const master = ctx.createGain(); master.gain.value = 0.7;              // default master volume
  const comp = ctx.createDynamicsCompressor();
  g.connect(master); master.connect(comp); comp.connect(ctx.destination);
  const dur = recipe(ctx, g);
  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0);
  let peak = 0, sum = 0, lastLoud = 0;
  for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; if (a > 0.01) lastLoud = i; }
  rows.push({ name, declared: +dur.toFixed(2), audibleEnd: +(lastLoud / SR).toFixed(2), peak: +peak.toFixed(2), rms: +Math.sqrt(sum / d.length).toFixed(3) });
}
console.table(rows);
const bad = rows.filter((r) => r.peak < 0.05 || r.peak > 0.99 || r.audibleEnd > r.declared + 0.15 || r.audibleEnd < r.declared * 0.3);
console.log(bad.length ? "CHECK THESE:" : "all recipes: audible, not clipping, duration matches declared", bad);
