import { SOUNDS, HIT_SOUND } from "../data/sounds.js";
import { RECIPES } from "./synth.js";

const PREFS_KEY = "ninja.sfx.v1";

function safeStorage() {
  try { return window.localStorage; } catch { return null; }
}

// Sound engine. Safe to call at any time: before the browser allows audio (first tap/keypress),
// while muted, or with unknown names, play() simply does nothing and never throws.
export function createAudio({
  sounds = SOUNDS,
  recipes = RECIPES,
  ctxFactory = () => new (window.AudioContext || window.webkitAudioContext)(),
  storage = safeStorage(),
  now = () => performance.now(),
  rng = Math.random,
  fetchFn = (...a) => fetch(...a),
} = {}) {
  let ctx = null, master = null, filesRequested = false;
  let volume = 0.7, muted = false;
  const buffers = new Map();     // name -> AudioBuffer[]
  const voices = new Map();      // name -> active count
  const lastPlayed = new Map();  // name -> ms

  try {
    const p = JSON.parse(storage?.getItem(PREFS_KEY) || "null");
    if (p) { volume = Number.isFinite(+p.volume) ? Math.min(1, Math.max(0, +p.volume)) : 0.7; muted = !!p.muted; }
  } catch { /* ignore corrupt prefs */ }
  const savePrefs = () => { try { storage?.setItem(PREFS_KEY, JSON.stringify({ volume, muted })); } catch { /* ignore */ } };
  const applyGain = () => { if (master) master.gain.value = muted ? 0 : volume; };

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      ctx = ctxFactory();
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();   // keeps big fights from clipping
      master.connect(comp); comp.connect(ctx.destination);
      applyGain();
    } catch { ctx = null; }
    return ctx;
  }

  async function loadFiles() {
    if (filesRequested || !ctx) return;
    filesRequested = true;
    await Promise.all(Object.entries(sounds).map(async ([name, def]) => {
      if (!def.files?.length) return;
      const list = [];
      for (const url of def.files) {
        try {
          const res = await fetchFn(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          list.push(await ctx.decodeAudioData(await res.arrayBuffer()));
        } catch (err) {
          console.warn(`[audio] "${name}": could not load ${url}; using built-in sound`, err.message || err);
        }
      }
      if (list.length) buffers.set(name, list);
    }));
  }

  // Call from a user gesture (tap/click/key). Browsers (esp. iOS) keep audio locked until then.
  async function unlock() {
    const c = ensureCtx();
    if (!c) return false;
    if (c.state !== "running") { try { await c.resume(); } catch { /* retry on next gesture */ } }
    loadFiles();
    return c.state === "running";
  }

  function play(name, { volume: v = 1 } = {}) {
    try {
      const def = sounds[name];
      if (!def || muted || !ctx || ctx.state !== "running") return false;
      const t = now();
      if (t - (lastPlayed.get(name) ?? -1e9) < (def.minGapMs ?? 0)) return false;
      const active = voices.get(name) ?? 0;
      if (active >= (def.maxVoices ?? 4)) return false;
      lastPlayed.set(name, t);

      const g = ctx.createGain();
      g.gain.value = (def.volume ?? 1) * v;
      g.connect(master);
      const bend = 1 + (rng() * 2 - 1) * (def.pitchVar ?? 0);
      let dur;
      const bufs = buffers.get(name);
      if (bufs) {
        const src = ctx.createBufferSource();
        src.buffer = bufs[Math.floor(rng() * bufs.length)];
        src.playbackRate.value = bend;
        src.connect(g); src.start();
        dur = src.buffer.duration / bend;
      } else if (recipes[name]) {
        g.gain.value *= 0.92 + 0.16 * rng();       // slight loudness variation too
        dur = recipes[name](ctx, g, bend) / bend;  // bend = random pitch multiplier (pitchVar)
      } else { g.disconnect(); return false; }

      voices.set(name, active + 1);
      setTimeout(() => voices.set(name, Math.max(0, (voices.get(name) ?? 1) - 1)), dur * 1000 + 30);
      return true;
    } catch (err) { console.warn("[audio] play failed", name, err); return false; }
  }

  return {
    unlock, play,
    hit: (hitType) => { const n = HIT_SOUND[hitType]; return n ? play(n) : false; },
    setVolume(v) { volume = Math.min(1, Math.max(0, v)); applyGain(); savePrefs(); },
    setMuted(m) { muted = !!m; applyGain(); savePrefs(); return muted; },
    toggleMute() { return this.setMuted(!muted); },
    get muted() { return muted; },
    get volume() { return volume; },
    get state() { return ctx ? ctx.state : "locked"; },
  };
}
