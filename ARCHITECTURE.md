# Architecture

Status: **migration in progress.** The game still runs from `legacy/` (the original ~8,100-line inline
script, split into 24 ordered files). New code lives in `src/` and legacy code moves there piece by piece.

## 1. Review of the DeepSeek layout

Good: layering (data / core / systems / view), "add an enemy = add one object", one place for damage math,
event bus, view separated from logic.

Gaps (each one maps to real code in this game):

| Gap | Why it matters here |
|---|---|
| **No `state/`** | Player and run state are ~40 loose top-level `let`s (`playerHP`, `isPunching`, `isDashing`, `isFrozen`...) plus a 60-field `prog` bag. Without a home for state, every system keeps reaching into globals, and modules cannot share mutable state. This is the real blocker. |
| **No player layer** | Punches, dash, focus, heal, 3 skills and input are roughly 3,000 lines and fit none of the proposed folders. |
| **No place for bosses** | The fire boss and ice dragon are bespoke state machines. `data/enemies.js` can express stat variants (bats), not these. |
| **Data can't express behaviour** | A bat's dive / shoot / explode logic and the armored shield sphere are hard-coded in `spawnBatInstance` / `updateBatFrame`. "One object" only holds if data can name behaviours. |
| **Damage pipeline undefined** | `damageEngine` (math), `combatSystem` (hits) and `displayEngine` (numbers) overlap. On-hit effects (poison, burn, Blood Fist, Whirlwind, Karmic Blast...) would collapse into `damageEngine` as a god module. |
| **View is called, not subscribed** | If logic calls `displayEngine`, logic depends on view. View should only listen to events. |
| **`enemySystem` / `spawnSystem` / `waves.js` overlap** | Wave *composition* is pure data; *pacing* is one system. |
| **Missing areas** | Asset loading (GLTF/Meshopt/skinned clones), world scenery (~600 lines), leaderboard/Firebase, touch input, constants. |
| **No migration path** | A single 9.8k-line file with shared top-level scope cannot become ES modules in one step: module evaluation order differs from source order, and reassigned top-level `let`s cannot be exported. |

## 2. Target layout

```
src/
  main.js              bootstrap (also loads legacy/ until it is empty)
  config/              constants (arena size, timings, caps)
  data/                PURE DATA, no imports of game code
    enemies.js         stat tables + which behaviours/visuals an enemy uses
    waves.js           spawn tiers, difficulty scaling, boss cadence
    upgrades.js        declarative: { id, tier, archetype, mods, flags, apply? }
    skills.js          cooldown, damage coefficients, hit shape
    bosses.js          boss stat tables
  state/               plain objects: player.js, run.js (wave/xp/kills), build.js (stats+flags); resetRun()
  core/
    eventBus.js        pub/sub                                   [done]
    damage.js          PURE damage math                          [started]
    stats.js           resolve build modifiers -> effective stats
    game.js            loop + fixed system order each frame
  systems/             read state, mutate state, emit events
    input.js  player.js  combat.js  status.js  enemies.js  spawn.js  progression.js  boss.js
  behaviors/           chase.js dive.js shoot.js explode.js    (registered by name, used from data/enemies.js)
  bosses/              fireBoss.js iceDragon.js                (explicit state tables)
  assets/              loader.js (GLTF/Meshopt), skinned-mesh clone
  world/               scenery.js (ground, grass, buildings, trees)
  view/                hud.js damageNumbers.js vfx/ camera.js  (SUBSCRIBE to bus; never called by logic)
  net/                 leaderboard.js (Firebase)
legacy/                original code, shrinking. Order = src/legacy/manifest.js
tests/                 node --test
```

### Dependency rules
1. `data/` and `core/damage.js`, `core/stats.js` import nothing from the game. Pure, unit-testable.
2. `state/` imports only `data/`.
3. `systems/` import `state/`, `data/`, `core/`; they talk to each other and to `view/` **only via the bus**.
4. `view/` imports `state/` (read-only) and listens to the bus. Nothing imports `view/` except `main.js`.
5. `behaviors/` and `bosses/` are looked up by name from data; systems never `if (type === "armored")`.

### Damage pipeline (the thing to get right)
`combat.dealDamage(source, target, hit)` runs ordered stages:
`pre-hit hooks (target immunity/dodge, assassinate)` -> `core/damage.js math` -> `apply HP` -> emit `hit` ->
`on-hit effects` (upgrades subscribe to `hit`/`kill`/`dodge`/`damaged`; status system applies poison/burn/slow) ->
view reacts (numbers, bars, shake). Upgrades stop being `if (prog.x)` checks inside combat code.

## 3. Migration approach (why it is safe)

`src/main.js` fetches every file in `src/legacy/manifest.js`, joins them, and runs the result as **one classic
script** — the same semantics as the old inline `<script>` (shared scope, hoisting, microtask timing).
Migrated code is exposed to unmigrated code through `window.Game` / `window.BAT_TYPES`. When a legacy file is
fully migrated, delete it and remove it from the manifest.

Debugging: stack frames show `legacy-bundle.js:LINE`; run `__legacyWhere(LINE)` in the console to get `file:line`.

## 4. Done so far
- Original committed untouched (`git log`, first commit).
- Inline CSS -> `styles/main.css`; inline script -> 24 files in `legacy/`. Verified byte-for-byte identical to the
  original (LF-normalised) before any edit.
- Extracted and tested: `data/enemies.js` (BAT_TYPES), `data/waves.js` (spawn tiers, `enemyMult`, boss cadence),
  `core/damage.js` (`rollDamage`, blood-debt multiplier, berserk check), `core/eventBus.js`.
- Differential check: 52,203 randomized comparisons of the original inline functions vs the new modules, 0 mismatches.
- Unresolved-global check: the only new free names in the bundle are `Game` and `BAT_TYPES` (by design).
- `npm test`: 20 tests.

## 5. Not verified
No browser run was possible in the build environment (no GLB assets, no WebGL). **Run `SMOKE_TEST.md` once.**
If something is off, `git stash`/checkout the first commit to compare; the first commit is the original file.

## 6. Next, in order
1. `state/`: move player flags and `prog` into objects (`player`, `run`, `build`). Unblocks everything.
2. Upgrades -> declarative data + `core/stats.js`; `resetProgression` becomes `resetRun()`.
3. Wire the bus: emit `hit` / `kill` / `dodge` / `damaged`; move Blood Fist, Phantom's Grace, Thorned Hide,
   Blood Debt, Karmic Blast into subscribers.
4. Unified target interface + `dealDamage` pipeline (removes the `isBoss`/`isTutorialDummy` branches in `damageBat`).
5. Status system (poison/burn/slow/freeze for enemies and player).
6. Bat behaviours + boss/dragon state tables.
7. Skills as data; split VFX from damage resolution.
8. Low-coupling leaves to real ES modules any time: `net/leaderboard`, `world/scenery`, touch input.
