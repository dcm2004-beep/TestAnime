import test from "node:test";
import assert from "node:assert/strict";
import { pickBatType, enemyMult, isBossWave } from "../src/data/waves.js";
import { BAT_TYPES } from "../src/data/enemies.js";

test("waves 1-2 only spawn normal bats", () => {
  for (const r of [0, 0.5, 0.99]) { assert.equal(pickBatType(1, r), "normal"); assert.equal(pickBatType(2, r), "normal"); }
});
test("tier boundaries (values captured from the original inline implementation)", () => {
  assert.equal(pickBatType(3, 0.34), "armored");  assert.equal(pickBatType(3, 0.35), "normal");
  assert.equal(pickBatType(4, 0.39), "swarm");    assert.equal(pickBatType(4, 0.4), "armored");  assert.equal(pickBatType(4, 0.6), "normal");
  assert.equal(pickBatType(6, 0.24), "ranged");   assert.equal(pickBatType(6, 0.75), "normal");
  assert.equal(pickBatType(7, 0.04), "elite");    assert.equal(pickBatType(7, 0.17), "exploder");
  assert.equal(pickBatType(7, 0.32), "ranged");   assert.equal(pickBatType(7, 0.52), "armored");
  assert.equal(pickBatType(7, 0.77), "swarm");    assert.equal(pickBatType(7, 0.78), "normal");
  assert.equal(pickBatType(30, 0.04), "elite");
});
test("every type the spawn tables can return exists in BAT_TYPES", () => {
  for (let w = 1; w <= 12; w++) for (let i = 0; i <= 100; i++) assert.ok(BAT_TYPES[pickBatType(w, i / 100)]);
});
test("enemyMult scaling", () => {
  assert.equal(enemyMult(1, 0), 1);
  assert.ok(Math.abs(enemyMult(6, 0) - 1.9) < 1e-12);
  assert.ok(Math.abs(enemyMult(1, 2) - 1.5625) < 1e-12);
});
test("boss every 5th wave", () => {
  assert.deepEqual([1, 4, 5, 6, 10, 15].map(isBossWave), [false, false, true, false, true, true]);
});
