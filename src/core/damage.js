// Damage math (pure). Everything that turns "base damage" into a number lives here.
// Inputs are plain values so this is testable without the game running.

// Blood Debt: +3% damage per stack (expiry/stack bookkeeping stays with the caller for now).
export const bloodDebtMult = (stacks) => 1 + 0.03 * stacks;

// Berserker: active below 30% HP while alive and unlocked.
export const isBerserk = ({ unlocked, dead, hp, maxHp }) =>
  !!unlocked && !dead && hp < maxHp * 0.3;

// ±20% variance, multiplicative stat stack, optional berserk ×1.5, rounded.
// NOTE: multiplication order is kept identical to the original inline code so results match exactly.
export function rollDamage({ base, extraMult = 1, dmgMult, bloodDebt = 1, berserk = false, rng = Math.random }) {
  const variance = 0.8 + rng() * 0.4;
  let finalDmg = base * variance * dmgMult * extraMult * bloodDebt;
  if (berserk) finalDmg *= 1.5;
  return Math.round(finalDmg);
}
