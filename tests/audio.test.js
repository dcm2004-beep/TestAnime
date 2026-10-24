import test from "node:test";
import assert from "node:assert/strict";
import { createAudio } from "../src/view/audio.js";
import { SOUNDS, HIT_SOUND } from "../src/data/sounds.js";
import { RECIPES } from "../src/view/synth.js";

// Minimal fake Web Audio context
function fakeCtx(state = "suspended") {
  const node = () => ({ connect(n) { return n || node(); }, disconnect() {}, gain: { value: 1 }, frequency: {}, Q: {} });
  const ctx = {
    state, currentTime: 0, sampleRate: 100, destination: node(),
    createGain: node, createDynamicsCompressor: node,
    createBuffer: (_c, len) => ({ getChannelData: () => new Float32Array(len), duration: 1 }),
    createBufferSource: () => ({ ...node(), playbackRate: { value: 1 }, start() {}, stop() {} }),
    createOscillator: () => ({ ...node(), frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, start() {}, stop() {} }),
    createBiquadFilter: () => ({ ...node(), frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }),
    async resume() { ctx.state = "running"; },
    decodeAudioData: async () => ({ duration: 0.2 }),
  };
  // gain params need ramp methods for synth
  const origGain = ctx.createGain;
  ctx.createGain = () => { const g = origGain(); g.gain = { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }; return g; };
  return ctx;
}
const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const mk = (over = {}) => createAudio({ ctxFactory: () => fakeCtx(), storage: store(), now: () => over.t ?? 0, ...over });

test("every sound has a synth recipe; every hit type maps to a known sound", () => {
  for (const n of Object.keys(SOUNDS)) assert.equal(typeof RECIPES[n], "function", `missing recipe: ${n}`);
  for (const n of Object.values(HIT_SOUND)) assert.ok(SOUNDS[n], `unknown sound ${n}`);
});
test("silent (and safe) until unlocked", async () => {
  const a = mk();
  assert.equal(a.play("hit"), false);
  assert.equal(a.state, "locked");
  assert.equal(await a.unlock(), true);
  assert.equal(a.play("hit"), true);
});
test("unknown names and muted state never play or throw", async () => {
  const a = mk(); await a.unlock();
  assert.equal(a.play("nope"), false);
  a.setMuted(true); assert.equal(a.play("hit"), false);
  a.setMuted(false); assert.equal(a.play("hit"), true);
});
test("minGapMs throttles and maxVoices caps overlap", async () => {
  let t = 0;
  const a = createAudio({ ctxFactory: () => fakeCtx(), storage: store(), now: () => t,
    sounds: { x: { minGapMs: 100, maxVoices: 2 }, y: { maxVoices: 2 } }, recipes: { x: () => 5, y: () => 5 } });
  await a.unlock();
  assert.equal(a.play("x"), true);
  t = 50;  assert.equal(a.play("x"), false);   // too soon
  t = 150; assert.equal(a.play("x"), true);
  assert.equal(a.play("y"), true); assert.equal(a.play("y"), true);
  assert.equal(a.play("y"), false);            // voice cap reached
});
test("hit() maps hit types; poison/burn ticks stay silent", async () => {
  const a = mk(); await a.unlock();
  assert.equal(a.hit("crit"), true);
  assert.equal(a.hit("poison"), false);
});
test("mute/volume persist across instances", () => {
  const s = store();
  const a = createAudio({ ctxFactory: () => fakeCtx(), storage: s });
  a.setMuted(true); a.setVolume(0.3);
  const b = createAudio({ ctxFactory: () => fakeCtx(), storage: s });
  assert.equal(b.muted, true); assert.equal(b.volume, 0.3);
});
test("corrupt saved prefs fall back to defaults", () => {
  const s = { getItem: () => "{not json", setItem() {} };
  const a = createAudio({ ctxFactory: () => fakeCtx(), storage: s });
  assert.equal(a.muted, false); assert.equal(a.volume, 0.7);
});
test("a real file replaces the synth; a failing file falls back to synth", async () => {
  const sounds = { good: { files: ["a.mp3"] }, bad: { files: ["b.mp3"] } };
  let synthCalls = 0;
  const fetchFn = async (url) => url === "a.mp3"
    ? { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } : { ok: false, status: 404 };
  const warn = console.warn; console.warn = () => {};
  const a = createAudio({ ctxFactory: () => fakeCtx(), storage: store(), sounds, fetchFn, recipes: { good: () => { synthCalls++; return 0.1; }, bad: () => { synthCalls++; return 0.1; } } });
  await a.unlock(); await new Promise((r) => setTimeout(r, 10));
  console.warn = warn;
  assert.equal(a.play("good"), true); assert.equal(synthCalls, 0);   // used the decoded file
  assert.equal(a.play("bad"), true);  assert.equal(synthCalls, 1);   // fell back to synth
});
test("legacy code only calls sounds that exist", async () => {
  const fs = await import("node:fs");
  const { LEGACY_FILES } = await import("../src/legacy/manifest.js");
  const code = LEGACY_FILES.map((f) => fs.readFileSync(new URL(`../legacy/${f}`, import.meta.url), "utf8")).join("\n");
  const names = [...code.matchAll(/Game\.audio\.play\("([A-Za-z]+)"/g)].map((m) => m[1]);
  assert.ok(names.length >= 20);
  for (const n of names) assert.ok(SOUNDS[n], `legacy plays unknown sound "${n}"`);
});

test("every synth recipe runs without throwing and reports a positive duration", () => {
  const ctx = fakeCtx("running");
  const out = ctx.createGain();
  for (const [name, fn] of Object.entries(RECIPES)) {
    const d = fn(ctx, out);
    assert.ok(d > 0 && d < 3, `${name} returned ${d}`);
  }
});
