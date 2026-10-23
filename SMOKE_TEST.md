# Smoke test (run once after serving over http: `npm run serve`)

Open DevTools console first. Expect no red errors at any step. A failure to start shows a red overlay.

- [ ] Page loads, name modal appears, leaderboard shows (or fails quietly if offline)
- [ ] Start game and tutorial both work (`startGameMode`, `startTutorialMode`)
- [ ] Move, jump, dash (double-tap), sprint; camera look
- [ ] Punch combo (3-hit finisher), crit shockwave appears sometimes
- [ ] Skill 1, Skill 2, Skill 3 (heal) each cast and go on cooldown; queued skill fires after the current one
- [ ] Focus channel starts and breaks when hit
- [ ] Bats spawn; wave 3+ shows armored, wave 4+ swarm, wave 6+ ranged, wave 7+ exploder/elite
- [ ] Damage numbers, bat HP bars, XP gain, level-up opens upgrade modal; pick an upgrade; resume
- [ ] Wave 5: boss spawns and fights (melee, fireball, dodge, combo, fall); boss dies
- [ ] Ice dragon appears; beams hit; freeze + thaw works
- [ ] Player death -> revive (once) -> death screen -> name/score saved -> restart
- [ ] Mobile: joystick, buttons, camera drag (if testing on touch)
- [ ] Console: `__legacyWhere(1234)` returns a `file:line` string
