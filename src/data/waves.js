// Wave composition + difficulty scaling (pure functions — no game state, no globals).

export const BOSS_WAVE_INTERVAL = 5;
export const isBossWave = (wave) => wave % BOSS_WAVE_INTERVAL === 0;

// Enemy stat multiplier: +18% per wave past the first, ×1.25 per boss defeated.
export const enemyMult = (wave, bosses) =>
  (1 + 0.18 * (wave - 1)) * Math.pow(1.25, bosses);

// Spawn tables. The first tier whose minWave <= wave applies. Within a tier, roll r in [0,1):
// the first [threshold, type] with r < threshold wins; otherwise "normal".
export const SPAWN_TIERS = [
  { minWave: 7, table: [[0.05, "elite"], [0.18, "exploder"], [0.33, "ranged"], [0.53, "armored"], [0.78, "swarm"]] },
  { minWave: 6, table: [[0.25, "ranged"], [0.5, "armored"], [0.75, "swarm"]] },
  { minWave: 4, table: [[0.4, "swarm"], [0.6, "armored"]] },
  { minWave: 3, table: [[0.35, "armored"]] },
];

export function pickBatType(wave, r) {
  const tier = SPAWN_TIERS.find((t) => wave >= t.minWave);
  if (tier) {
    for (const [threshold, type] of tier.table) if (r < threshold) return type;
  }
  return "normal";
}
