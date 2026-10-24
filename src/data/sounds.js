// Sound definitions (data only).
//   volume    0..1 relative loudness
//   pitchVar  random +/- pitch variation (0.1 = +/-10%) so repeats don't sound identical
//   maxVoices how many copies may overlap      minGapMs  minimum time between plays
//   files     OPTIONAL list of real audio files. If omitted (or a file fails to load) the built-in
//             synthesized version in view/synth.js is used. Several files = random variant per play.
//
// To use your own sound: drop it in assets/sfx/ and add   files: ["assets/sfx/punch.mp3"]
// (use .mp3 or .m4a for iOS/Safari safety; .ogg does not play on all iPhones).
export const SOUNDS = {
  // --- player attacks
  swing:      { volume: 0.5,  pitchVar: 0.12, maxVoices: 2, minGapMs: 50 },
  swingHeavy: { volume: 0.6,  pitchVar: 0.08, maxVoices: 2, minGapMs: 80 },
  combo:      { volume: 0.7,  pitchVar: 0.04, maxVoices: 1, minGapMs: 150 },
  kick:       { volume: 0.7,  pitchVar: 0.04, maxVoices: 1, minGapMs: 150 },
  dragonFist: { volume: 0.85, pitchVar: 0.03, maxVoices: 1, minGapMs: 300 },
  heal:       { volume: 0.5,  pitchVar: 0,    maxVoices: 1, minGapMs: 300 },
  dash:       { volume: 0.45, pitchVar: 0.1,  maxVoices: 2, minGapMs: 120 },
  jump:       { volume: 0.3,  pitchVar: 0.1,  maxVoices: 1, minGapMs: 150 },
  // --- hits (many per second in fights: keep voices low)
  hit:        { volume: 0.5,  pitchVar: 0.15, maxVoices: 4, minGapMs: 40 },
  crit:       { volume: 0.7,  pitchVar: 0.06, maxVoices: 2, minGapMs: 60 },
  zap:        { volume: 0.55, pitchVar: 0.1,  maxVoices: 3, minGapMs: 50 },
  comboHit:   { volume: 0.55, pitchVar: 0.12, maxVoices: 3, minGapMs: 40 },
  enemyDie:   { volume: 0.55, pitchVar: 0.15, maxVoices: 3, minGapMs: 60 },
  boom:       { volume: 0.7,  pitchVar: 0.08, maxVoices: 2, minGapMs: 120 },
  // --- player state
  hurt:       { volume: 0.7,  pitchVar: 0.06, maxVoices: 2, minGapMs: 100 },
  dodge:      { volume: 0.4,  pitchVar: 0.06, maxVoices: 1, minGapMs: 150 },
  death:      { volume: 0.8,  pitchVar: 0,    maxVoices: 1, minGapMs: 1000 },
  revive:     { volume: 0.7,  pitchVar: 0,    maxVoices: 1, minGapMs: 1000 },
  freeze:     { volume: 0.6,  pitchVar: 0.03, maxVoices: 1, minGapMs: 500 },
  // --- enemies / world
  spit:       { volume: 0.35, pitchVar: 0.15, maxVoices: 3, minGapMs: 80 },
  beam:       { volume: 0.6,  pitchVar: 0.05, maxVoices: 2, minGapMs: 200 },
  bossSpawn:  { volume: 0.9,  pitchVar: 0,    maxVoices: 1, minGapMs: 2000 },
  bossDie:    { volume: 0.8,  pitchVar: 0,    maxVoices: 1, minGapMs: 2000 },
  wave:       { volume: 0.55, pitchVar: 0,    maxVoices: 1, minGapMs: 1000 },
  // --- UI
  levelUp:    { volume: 0.6,  pitchVar: 0,    maxVoices: 1, minGapMs: 500 },
  select:     { volume: 0.5,  pitchVar: 0.03, maxVoices: 2, minGapMs: 80 },
};

// damageBat/damageBoss hitType -> sound. Unknown types (poison, burn ticks...) are silent on purpose.
export const HIT_SOUND = {
  normal: "hit",
  crit: "crit",
  "electric-crit": "crit",
  electric: "zap",
  combo: "comboHit",
  reflect: "hit",
};
