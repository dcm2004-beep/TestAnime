# Sound effects and music

The game ships with built-in synthesized sounds, so this folder can stay empty.
Use `.mp3` or `.m4a` (`.ogg` does not play on every iPhone). Mono, 44.1 kHz is plenty for effects.

## Your own sound for an effect
Edit the sound in `src/data/sounds.js` and add `files`:

    crit: { volume: 0.7, pitchVar: 0.05, maxVoices: 2, minGapMs: 60,
            files: ["assets/sfx/big_punch.mp3"], layerSynth: true, synthVolume: 0.5 },

You do NOT need to cut files to match an animation:

| option | what it does |
|---|---|
| `offset: 0.15` | start 0.15 s into the file (skip leading silence) |
| `duration: 0.6` | play at most 0.6 s, then fade out (`fadeOut`, default 0.08 s) |
| `loop: true` | repeat until stopped (set `maxVoices: 1`) |
| `rate: 1.2` | faster/higher (0.8 = slower/lower) |
| `layerSynth: true` | also play the built-in sound underneath for extra weight |
| `files: [a, b, c]` | a random variant is played each time |

The same options (`offset`, `duration`, `fadeOut`, `loop`, `rate`, `volume`) can be passed per call from game code,
which is how the boss flame matches its animation exactly:

    b.fireSfx = Game.audio.play("bossFlame", { duration: secondsLeftInAnimation });
    b.fireSfx.stop(0.1);   // cut it if the attack is interrupted

`play()` returns a handle with `stop(fadeSeconds)`, or `false` if nothing played (locked, muted, throttled).
If a file fails to load, that sound falls back to the built-in version and a warning is logged.

## Music
Add tracks to `MUSIC` in `src/data/sounds.js`; start with `Game.audio.music.play("battle")`.
Music streams (it is not decoded into memory), loops, fades in/out, ducks while paused or dead, and pauses when the
tab is hidden. API: `music.play(name)`, `music.stop(fade)`, `music.duck(level)`, `music.pause()`, `music.resume()`.
