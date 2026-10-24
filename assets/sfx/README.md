# Sound effects

The game ships with built-in synthesized sounds, so this folder can stay empty.

To use your own sound for an effect:
1. Put the file here (`.mp3` or `.m4a` — `.ogg` does not play on every iPhone).
2. In `src/data/sounds.js`, add `files` to that sound, e.g.
   `swing: { volume: 0.5, pitchVar: 0.12, maxVoices: 2, minGapMs: 50, files: ["assets/sfx/swing.mp3"] }`
   Several files in the list = a random variant is played each time.
3. If a file fails to load, that sound falls back to the built-in version (a warning appears in the console).

Sound names used by the game: see `src/data/sounds.js`. Tune `volume`, `pitchVar` (random pitch change),
`maxVoices` (overlap limit) and `minGapMs` (minimum time between plays) there.
