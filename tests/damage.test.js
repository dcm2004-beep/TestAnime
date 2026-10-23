import test from "node:test";
import assert from "node:assert/strict";
import { rollDamage, bloodDebtMult, isBerserk } from "../src/core/damage.js";

test("rng 0.5 gives exactly the base damage (variance = 1.0)", () => {
  assert.equal(rollDamage({ base: 100, dmgMult: 1, rng: () => 0.5 }), 100);
});
test("variance range is 80%..120%", () => {
  assert.equal(rollDamage({ base: 100, dmgMult: 1, rng: () => 0 }), 80);
  assert.equal(rollDamage({ base: 100, dmgMult: 1, rng: () => 0.999999 }), 120);
});
test("multipliers stack and berserk adds x1.5", () => {
  const base = { base: 100, extraMult: 2, dmgMult: 1.5, bloodDebt: 1.09, rng: () => 0.5 };
  assert.equal(rollDamage(base), Math.round(100 * 1 * 1.5 * 2 * 1.09));
  assert.equal(rollDamage({ ...base, berserk: true }), Math.round(100 * 1 * 1.5 * 2 * 1.09 * 1.5));
});
test("blood debt is +3% per stack", () => {
  assert.equal(bloodDebtMult(0), 1);
  assert.ok(Math.abs(bloodDebtMult(15) - 1.45) < 1e-12);
});
test("berserk only below 30% HP, alive, and unlocked", () => {
  const ok = { unlocked: true, dead: false, hp: 299, maxHp: 1000 };
  assert.equal(isBerserk(ok), true);
  assert.equal(isBerserk({ ...ok, hp: 300 }), false);
  assert.equal(isBerserk({ ...ok, dead: true }), false);
  assert.equal(isBerserk({ ...ok, unlocked: false }), false);
});
