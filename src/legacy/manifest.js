// Execution order of the not-yet-migrated game code. This list SHRINKS as code moves into src/.
// Order matters: the files are joined and run as ONE classic script (same semantics as the original
// inline <script>: shared top-level scope, hoisting, and load-time ordering).
export const LEGACY_FILES = [
  "00-boot-player-modal.js",
  "01-scene-lighting.js",
  "02-world-scenery.js",
  "03-player-state-assets.js",
  "04-vfx-feedback.js",
  "05-combat-core.js",
  "06-player-skills.js",
  "07-focus.js",
  "08-input-controls.js",
  "09-progression-state.js",
  "10-hud.js",
  "11-upgrades-xp.js",
  "12-skill-heal.js",
  "13-fire-particles.js",
  "14-boss.js",
  "15-status-freeze-burn.js",
  "16-ice-dragon.js",
  "17-main-loop.js",
  "18-player-damage.js",
  "19-bats.js",
  "20-leaderboard-firebase.js",
  "21-mobile-controls.js",
  "22-pwa-register.js",
  "23-tutorial-start.js"
];
