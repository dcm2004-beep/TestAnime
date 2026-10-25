import { SOUNDS, MUSIC, HIT_SOUND } from "../data/sounds.js";
import { RECIPES } from "./synth.js";

const PREFS_KEY = "ninja.sfx.v1";

function safeStorage() {
  try { return window.localStorage; } catch { return null; }
}

// Sound engine. Safe to call at any time: before the browser allows audio (first tap/keypress),
// while muted, or with unknown names, play() simply does nothing and never throws.
//
// play(name, opts) returns a handle { stop(fadeSeconds) } when a sound started, otherwise false.
// Per-sound config (data/sounds.js) and per-call opts both accept:
//   offset   start this many seconds into the file (skip leading silence)
//   duration play for at most this many seconds, then fade out (no need to cut the file)
//   fadeOut  length of that fade in seconds (default 0.08)
//   loop     repeat until stop() or duration
//   rate     playback speed multiplier (also changes pitch)
//   volume   extra loudness multiplier (per-call only)
// Config only: layerSynth (also play the built-in synth sound under the file), synthVolume.
export function createAudio({
  sounds = SOUNDS,
  tracks = MUSIC,
  recipes = RECIPES,
  ctxFactory = () => new (window.AudioContext || window.webkitAudioContext)(),
  audioElementFactory = (url) => new Audio(url),
  storage = safeStorage(),
  now = () => performance.now(),
  rng = Math.random,
  fetchFn = (...a) => fetch(...a),
} = {}) {
  let ctx = null, master = null, musicBus = null, duckGain = null, filesRequested = false;
  let volume = 0.7, musicVolume = 0.6, muted = false;
  const buffers = new Map();     // name -> AudioBuffer[]
  const voices = new Map();      // name -> active count
  const lastPlayed = new Map();  // name -> ms

  try {
    const p = JSON.parse(storage?.getItem(PREFS_KEY) || "null");
    if (p) {
      if (Number.isFinite(+p.volume)) volume = Math.min(1, Math.max(0, +p.volume));
      if (Number.isFinite(+p.musicVolume)) musicVolume = Math.min(1, Math.max(0, +p.musicVolume));
      muted = !!p.muted;
    }
  } catch { /* ignore corrupt prefs */ }
  const savePrefs = () => { try { storage?.setItem(PREFS_KEY, JSON.stringify({ volume, musicVolume, muted })); } catch { /* ignore */ } };
  const applyGain = () => {
    if (master) master.gain.value = muted ? 0 : volume;
    if (musicBus) musicBus.gain.value = muted ? 0 : musicVolume;
  };

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      ctx = ctxFactory();
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();   // keeps big fights from clipping
      master.connect(comp); comp.connect(ctx.destination);
      duckGain = ctx.createGain();                   // music -> duck -> bus -> speakers (bypasses the compressor)
      musicBus = ctx.createGain();
      duckGain.connect(musicBus); musicBus.connect(ctx.destination);
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

  // Fade a sound part to silence starting at time `at`, then stop its source.
  function fadeAndStop(part, at, fade) {
    try {
      const gp = part.g.gain;
      gp.setValueAtTime(gp.value, at);
      gp.linearRampToValueAtTime(0.0001, at + Math.max(0.005, fade));
      if (part.src) part.src.stop(at + Math.max(0.005, fade) + 0.02);
    } catch { /* already stopped */ }
  }

  function play(name, opts = {}) {
    try {
      const def = sounds[name];
      if (!def || muted || !ctx || ctx.state !== "running") return false;
      const t = now();
      if (t - (lastPlayed.get(name) ?? -1e9) < (def.minGapMs ?? 0)) return false;
      const active = voices.get(name) ?? 0;
      if (active >= (def.maxVoices ?? 4)) return false;

      const v = opts.volume ?? 1;
      const bend = 1 + (rng() * 2 - 1) * (def.pitchVar ?? 0);
      const rate = (opts.rate ?? def.rate ?? 1) * bend;
      const t0 = ctx.currentTime;
      const parts = [];
      let natural = 0;                                   // how long it would play on its own (seconds)

      const bufs = buffers.get(name);
      if (bufs) {
        const buf = bufs[Math.floor(rng() * bufs.length)];
        const offset = Math.min(Math.max(0, opts.offset ?? def.offset ?? 0), Math.max(0, buf.duration - 0.01));
        const loop = opts.loop ?? def.loop ?? false;
        const g = ctx.createGain();
        g.gain.value = (def.volume ?? 1) * v;
        g.connect(master);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.playbackRate.value = rate; src.loop = loop;
        src.connect(g); src.start(t0, offset);
        natural = loop ? Infinity : (buf.duration - offset) / rate;
        parts.push({ g, src });
      }
      if ((!bufs || def.layerSynth) && recipes[name]) {
        const g = ctx.createGain();
        g.gain.value = (bufs ? (def.synthVolume ?? 0.6) : 1) * (def.volume ?? 1) * v * (0.92 + 0.16 * rng());
        g.connect(master);
        const d = recipes[name](ctx, g, bend) / bend;
        natural = Math.max(natural, d);
        parts.push({ g });
      }
      if (!parts.length) return false;

      lastPlayed.set(name, t);
      let life = natural;
      const cap = opts.duration ?? def.duration;         // max seconds to play (wall clock)
      if (cap != null && cap < natural) {
        life = cap;
        const fade = Math.min(opts.fadeOut ?? def.fadeOut ?? 0.08, cap);
        for (const p of parts) fadeAndStop(p, t0 + cap - fade, fade);
      }

      voices.set(name, active + 1);
      let released = false;
      const release = () => { if (!released) { released = true; voices.set(name, Math.max(0, (voices.get(name) ?? 1) - 1)); } };
      if (Number.isFinite(life)) setTimeout(release, life * 1000 + 30);
      return {
        stop(fade = 0.05) {
          for (const p of parts) fadeAndStop(p, ctx.currentTime, fade);
          setTimeout(release, fade * 1000 + 30);
        },
      };
    } catch (err) { console.warn("[audio] play failed", name, err); return false; }
  }

  // ---------------- Music (streamed through an <audio> element, looped) ----------------
  let current = null;       // { name, el, gain }
  let wanted = null;        // what the game asked for (starts once audio is unlocked)
  let musicPaused = false;

  function ramp(param, to, seconds) {
    try {
      param.setValueAtTime(param.value, ctx.currentTime);
      param.linearRampToValueAtTime(to, ctx.currentTime + Math.max(0.01, seconds));
    } catch { param.value = to; }
  }
  function retire(tr, fade) {
    if (!tr) return;
    ramp(tr.gain.gain, 0.0001, fade);
    setTimeout(() => { try { tr.el.pause(); } catch { /* ignore */ } try { tr.gain.disconnect(); } catch { /* ignore */ } }, fade * 1000 + 50);
  }
  function startMusic(name, fade) {
    const def = tracks[name];
    if (!def || !ctx || ctx.state !== "running") return false;
    if (current && current.name === name) {
      if (musicPaused) { musicPaused = false; current.el.play?.()?.catch?.(() => {}); }
      return true;
    }
    try {
      const el = audioElementFactory(def.file);
      el.loop = def.loop !== false;
      el.preload = "auto";
      el.addEventListener?.("error", () => console.warn(`[audio] music "${name}": could not load ${def.file}`));
      const src = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(gain); gain.connect(duckGain);
      el.play?.()?.catch?.(() => {});
      ramp(gain.gain, def.volume ?? 1, fade);
      retire(current, fade);
      current = { name, el, gain };
      musicPaused = false;
      return true;
    } catch (err) { console.warn("[audio] music failed", name, err); return false; }
  }
  const music = {
    // Request a track. If audio is still locked it starts automatically after the first tap/key.
    play(name, { fade = 1.2 } = {}) { wanted = { name, fade }; return startMusic(name, fade); },
    stop(fade = 1) { wanted = null; retire(current, fade); current = null; },
    // Lower (or restore) the music, e.g. duck(0.3) while paused, duck(1) to restore.
    duck(level = 0.3, fade = 0.35) { if (duckGain) ramp(duckGain.gain, level, fade); else duckLevel = level; },
    // Pause/resume the stream itself (use when the tab is hidden: iOS PWAs keep playing in the background).
    pause() { if (current && !musicPaused) { musicPaused = true; try { current.el.pause(); } catch { /* ignore */ } } },
    resume() { if (current && musicPaused) { musicPaused = false; current.el.play?.()?.catch?.(() => {}); } },
    get playing() { return !!current && !musicPaused; },
    get track() { return current ? current.name : null; },
  };
  let duckLevel = 1;

  // Call from a user gesture (tap/click/key). Browsers (esp. iOS) keep audio locked until then.
  async function unlock() {
    const c = ensureCtx();
    if (!c) return false;
    if (c.state !== "running") { try { await c.resume(); } catch { /* retry on next gesture */ } }
    loadFiles();
    if (c.state === "running") {
      if (duckLevel !== 1 && duckGain) { duckGain.gain.value = duckLevel; duckLevel = 1; }
      if (wanted && !current) startMusic(wanted.name, wanted.fade);
    }
    return c.state === "running";
  }

  return {
    unlock, play, music,
    hit: (hitType) => { const n = HIT_SOUND[hitType]; return n ? play(n) : false; },
    setVolume(v) { volume = Math.min(1, Math.max(0, v)); applyGain(); savePrefs(); },
    setMusicVolume(v) { musicVolume = Math.min(1, Math.max(0, v)); applyGain(); savePrefs(); },
    setMuted(m) { muted = !!m; applyGain(); savePrefs(); return muted; },
    toggleMute() { return this.setMuted(!muted); },
    get muted() { return muted; },
    get volume() { return volume; },
    get musicVolume() { return musicVolume; },
    get state() { return ctx ? ctx.state : "locked"; },
  };
}
