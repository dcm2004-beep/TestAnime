import test from "node:test";
import assert from "node:assert/strict";
import { createBus } from "../src/core/eventBus.js";

test("on/emit/off", () => {
  const bus = createBus(); const seen = [];
  const off = bus.on("hit", (p) => seen.push(p));
  bus.emit("hit", 1); off(); bus.emit("hit", 2);
  assert.deepEqual(seen, [1]);
});
test("once fires a single time", () => {
  const bus = createBus(); let n = 0;
  bus.once("kill", () => n++); bus.emit("kill"); bus.emit("kill");
  assert.equal(n, 1);
});
test("a throwing listener does not block others", () => {
  const bus = createBus(); const orig = console.error; console.error = () => {};
  let ran = false;
  bus.on("x", () => { throw new Error("boom"); }); bus.on("x", () => { ran = true; });
  bus.emit("x"); console.error = orig;
  assert.ok(ran);
});
test("listeners removed during emit do not break iteration", () => {
  const bus = createBus(); const order = [];
  const off = bus.on("e", () => { order.push("a"); off(); });
  bus.on("e", () => order.push("b"));
  bus.emit("e"); bus.emit("e");
  assert.deepEqual(order, ["a", "b", "b"]);
});
