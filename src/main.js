import { BAT_TYPES } from "./data/enemies.js";
import * as waves from "./data/waves.js";
import * as damage from "./core/damage.js";
import { createBus } from "./core/eventBus.js";
import { loadLegacy } from "./legacy/loader.js";

// Bridge for code that has not been migrated yet. New code should import, not use these globals.
window.BAT_TYPES = BAT_TYPES;
window.Game = { bus: createBus(), waves, damage, data: { BAT_TYPES } };

loadLegacy().catch((err) => {
  console.error("Failed to start game:", err);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<pre style="position:fixed;inset:0;z-index:99999;margin:0;padding:16px;background:#200;color:#fcc;white-space:pre-wrap">Failed to start game:\n${String(err && err.message || err)}\n\n(Serve the folder over http, e.g. "npx serve" — module scripts do not work from file://)</pre>`,
  );
});
