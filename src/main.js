import { BAT_TYPES } from "./data/enemies.js";
import * as waves from "./data/waves.js";
import * as damage from "./core/damage.js";
import { createBus } from "./core/eventBus.js";
import { createAudio } from "./view/audio.js";
import { loadLegacy } from "./legacy/loader.js";

const audio = createAudio();

// Bridge for code that has not been migrated yet. New code should import, not use these globals.
window.BAT_TYPES = BAT_TYPES;
window.Game = { bus: createBus(), waves, damage, audio, data: { BAT_TYPES } };

// --- Sound: browsers (iOS especially) keep audio locked until a user gesture. Listen in the capture
// phase so buttons that call stopPropagation() still count. unlock() is cheap once audio is running.
for (const ev of ["pointerdown", "touchend", "click", "keydown"]) {
  window.addEventListener(ev, () => audio.unlock(), { capture: true, passive: true });
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) audio.music.pause();
  else { audio.unlock(); audio.music.resume(); }
});

// Mute button (under the pause button) + "M" key.
{
  const btn = document.getElementById("sfx-toggle");
  const render = () => { if (btn) { btn.textContent = audio.muted ? "🔇" : "🔊"; btn.classList.toggle("off", audio.muted); } };
  const toggle = () => { audio.unlock(); audio.toggleMute(); render(); };
  if (btn) {
    const fire = (e) => { e.preventDefault(); e.stopPropagation(); toggle(); };
    btn.addEventListener("touchstart", fire, { passive: false });
    btn.addEventListener("mousedown", fire);
  }
  window.addEventListener("keydown", (e) => {
    if (e.repeat || (e.key !== "m" && e.key !== "M")) return;
    const t = e.target;
    if (window.isNameModalOpen || (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA"))) return;
    toggle();
  });
  render();
}

loadLegacy().catch((err) => {
  console.error("Failed to start game:", err);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<pre style="position:fixed;inset:0;z-index:99999;margin:0;padding:16px;background:#200;color:#fcc;white-space:pre-wrap">Failed to start game:\n${String(err && err.message || err)}\n\n(Serve the folder over http, e.g. "npx serve" — module scripts do not work from file://)</pre>`,
  );
});
