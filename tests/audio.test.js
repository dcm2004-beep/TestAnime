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
    createGain: node, createDynamicsCompressor: node, createWaveShaper: () => ({ ...node(), curve: null, oversample: "none" }),
    createBuffer: (_c, len) => ({ getChannelData: () => new Float32Array(len), duration: 1 }),
    createBufferSource: () => { const s = { ...node(), playbackRate: { value: 1 }, loop: false, started: null, stopped: null, start(...a) { s.started = a; }, stop(...a) { s.stopped = a; } }; ctx.sources.push(s); return s; },
    createMediaElementSource: () => node(),
    sources: [],
    createOscillator: () => ({ ...node(), frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, start() {}, stop() {} }),
    createBiquadFilter: () => ({ ...node(), frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }),
    async resume() { ctx.state = "running"; },
    decodeAudioData: async () => ({ duration: 0.2 }),
  };
  // gain params need ramp methods for synth
  const origGain = ctx.createGain;
  ctx.createGain = () => { const g = origGain(); g.gain = { value: 1, ramps: [], setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime(v, t) { this.ramps.push([v, t]); }, cancelScheduledValues() {} }; return g; };
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
  assert.ok(a.play("hit"));
});
test("unknown names and muted state never play or throw", async () => {
  const a = mk(); await a.unlock();
  assert.equal(a.play("nope"), false);
  a.setMuted(true); assert.equal(a.play("hit"), false);
  a.setMuted(false); assert.ok(a.play("hit"));
});
test("minGapMs throttles and maxVoices caps overlap", async () => {
  let t = 0;
  const a = createAudio({ ctxFactory: () => fakeCtx(), storage: store(), now: () => t,
    sounds: { x: { minGapMs: 100, maxVoices: 2 }, y: { maxVoices: 2 } }, recipes: { x: () => 5, y: () => 5 } });
  await a.unlock();
  assert.ok(a.play("x"));
  t = 50;  assert.equal(a.play("x"), false);   // too soon
  t = 150; assert.ok(a.play("x"));
  assert.ok(a.play("y")); assert.ok(a.play("y"));
  assert.equal(a.play("y"), false);            // voice cap reached
});
test("hit() maps hit types; poison/burn ticks stay silent", async () => {
  const a = mk(); await a.unlock();
  assert.ok(a.hit("crit"));
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
  assert.ok(a.play("good")); assert.equal(synthCalls, 0);   // used the decoded file
  assert.ok(a.play("bad"));  assert.equal(synthCalls, 1);   // fell back to synth
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

// ---- timing controls on real files
async function withFile(def, opts = {}) {
  const ctx = fakeCtx();
  const a = createAudio({
    ctxFactory: () => ctx, storage: store(), rng: () => 0.5, now: () => 0,
    sounds: { s: { files: ["s.mp3"], ...def } }, recipes: { s: () => 0.2 },
    fetchFn: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }), ...opts,
  });
  ctx.decodeAudioData = async () => ({ duration: 4 });        // a 4-second file
  await a.unlock(); await new Promise((r) => setTimeout(r, 5));
  return { a, ctx };
}
test("duration caps a long file and fades it out (no need to cut the file)", async () => {
  const { a, ctx } = await withFile({});
  const h = a.play("s", { duration: 0.5, fadeOut: 0.1 });
  assert.ok(h);
  const src = ctx.sources.at(-1);
  assert.ok(Math.abs(src.stopped[0] - (0.5 + 0.02)) < 1e-9, "source stops at duration (+fade tail)");
});
test("a file shorter than duration plays in full and is not cut", async () => {
  const { a, ctx } = await withFile({});
  a.play("s", { duration: 10 });
  assert.equal(ctx.sources.at(-1).stopped, null);
});
test("offset skips leading silence; config and per-call both work", async () => {
  const { a, ctx } = await withFile({ offset: 0.3 });
  a.play("s");           assert.equal(ctx.sources.at(-1).started[1], 0.3);
  a.play("s", { offset: 1.2 }); // second voice allowed (default maxVoices 4)
  assert.equal(ctx.sources.at(-1).started[1], 1.2);
});
test("rate shortens playback time", async () => {
  const { a, ctx } = await withFile({ rate: 2, duration: 5 });
  a.play("s");
  assert.equal(ctx.sources.at(-1).playbackRate.value, 2);
});
test("handle.stop() fades and stops a sound early (interrupted boss attack)", async () => {
  const { a, ctx } = await withFile({ loop: true });
  const h = a.play("s");
  const src = ctx.sources.at(-1);
  assert.equal(src.loop, true); assert.equal(src.stopped, null);
  h.stop(0.1);
  assert.ok(src.stopped);
});
test("layerSynth plays the built-in sound under the file", async () => {
  let synth = 0;
  const { a, ctx } = await withFile({ layerSynth: true }, { recipes: { s: () => { synth++; return 0.2; } } });
  a.play("s");
  assert.equal(synth, 1); assert.ok(ctx.sources.at(-1).started);
});

// ---- music
function fakeEl() { return { loop: false, paused: false, played: 0, addEventListener() {}, play() { this.played++; this.paused = false; return Promise.resolve(); }, pause() { this.paused = true; } }; }
test("music requested while locked starts after unlock, loops, and fades in", async () => {
  const els = [];
  const a = createAudio({ ctxFactory: () => fakeCtx(), storage: store(), tracks: { battle: { file: "b.mp3", volume: 0.6 } }, audioElementFactory: () => { const e = fakeEl(); els.push(e); return e; } });
  assert.equal(a.music.play("battle"), false);       // locked: remembered, not started
  assert.equal(els.length, 0);
  await a.unlock();
  assert.equal(els.length, 1); assert.equal(els[0].loop, true); assert.equal(els[0].played, 1);
  assert.equal(a.music.track, "battle"); assert.equal(a.music.playing, true);
});
test("same track is not restarted; pause/resume control the stream", async () => {
  const els = [];
  const a = createAudio({ ctxFactory: () => fakeCtx("running"), storage: store(), tracks: { battle: { file: "b.mp3" } }, audioElementFactory: () => { const e = fakeEl(); els.push(e); return e; } });
  await a.unlock();
  a.music.play("battle"); a.music.play("battle");
  assert.equal(els.length, 1);
  a.music.pause(); assert.equal(els[0].paused, true); assert.equal(a.music.playing, false);
  a.music.resume(); assert.equal(els[0].paused, false);
});
test("switching tracks and stop() retire the old stream", async () => {
  const els = [];
  const a = createAudio({ ctxFactory: () => fakeCtx("running"), storage: store(), tracks: { a: { file: "a.mp3" }, b: { file: "b.mp3" } }, audioElementFactory: () => { const e = fakeEl(); els.push(e); return e; } });
  await a.unlock();
  a.music.play("a", { fade: 0.01 }); a.music.play("b", { fade: 0.01 });
  assert.equal(els.length, 2); assert.equal(a.music.track, "b");
  await new Promise((r) => setTimeout(r, 90));
  assert.equal(els[0].paused, true);
  a.music.stop(0.01); assert.equal(a.music.track, null);
});
test("music volume persists and unknown tracks are ignored", async () => {
  const s = store();
  const a = createAudio({ ctxFactory: () => fakeCtx("running"), storage: s });
  await a.unlock();
  assert.equal(a.music.play("nope"), false);
  a.setMusicVolume(0.25);
  const b = createAudio({ ctxFactory: () => fakeCtx(), storage: s });
  assert.equal(b.musicVolume, 0.25);
});
test("legacy only references music tracks and handles that exist", async () => {
  const fs = await import("node:fs");
  const { MUSIC } = await import("../src/data/sounds.js");
  const { LEGACY_FILES } = await import("../src/legacy/manifest.js");
  const code = LEGACY_FILES.map((f) => fs.readFileSync(new URL(`../legacy/${f}`, import.meta.url), "utf8")).join("\n");
  for (const m of code.matchAll(/music\.play\("([A-Za-z]+)"/g)) assert.ok(MUSIC[m[1]], `unknown track ${m[1]}`);
});
