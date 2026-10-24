import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { LEGACY_FILES } from "../src/legacy/manifest.js";
import { buildBundle, whereIs } from "../src/legacy/loader.js";

const dir = new URL("../legacy/", import.meta.url);
const read = (n) => fs.readFileSync(new URL(n, dir), "utf8");

test("manifest and legacy/ folder agree (no orphan or missing files, no duplicates)", () => {
  const onDisk = fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
  assert.deepEqual([...LEGACY_FILES].sort(), onDisk);
  assert.equal(new Set(LEGACY_FILES).size, LEGACY_FILES.length);
});
test("the joined legacy bundle is valid JavaScript", () => {
  const { code } = buildBundle(LEGACY_FILES.map((name) => ({ name, text: read(name) })));
  assert.doesNotThrow(() => new vm.Script(code, { filename: "legacy-bundle.js" }));
});
test("line map translates bundle lines back to file:line", () => {
  const files = [{ name: "a.js", text: "1\n2\n3\n" }, { name: "b.js", text: "x\ny\n" }];
  const { code, map } = buildBundle(files);
  const lines = code.split("\n");
  assert.equal(whereIs(map, lines.indexOf("2") + 1), "a.js:2");
  assert.equal(whereIs(map, lines.indexOf("y") + 1), "b.js:2");
});
test("index.html has no inline game script and loads the module entry", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /<script type="module" src="src\/main\.js"><\/script>/);
  assert.doesNotMatch(html, /<script>\s*\n/);
  assert.match(html, /href="styles\/main\.css"/);
});

test("loadLegacy fetches every file, injects ONE script, and exposes the line map", async () => {
  const injected = [];
  globalThis.window = {};
  globalThis.document = {
    createElement: () => ({ remove() {} }),
    head: { appendChild: (el) => injected.push(el) },
  };
  const { loadLegacy } = await import("../src/legacy/loader.js");
  const fetched = [];
  const fetchFn = async (url) => {
    fetched.push(String(url));
    return { ok: true, status: 200, text: async () => read(String(url).split("/").pop()) };
  };
  await loadLegacy({ fetchFn, base: new URL("../legacy/", import.meta.url) });
  assert.equal(fetched.length, LEGACY_FILES.length);
  assert.equal(injected.length, 1);
  assert.doesNotThrow(() => new vm.Script(injected[0].textContent));
  assert.equal(window.__legacyMap.length, LEGACY_FILES.length);
  assert.equal(typeof window.__legacyWhere(100), "string");
  delete globalThis.window; delete globalThis.document;
});
test("loadLegacy surfaces a missing file as an error", async () => {
  globalThis.window = {}; globalThis.document = { createElement: () => ({}), head: { appendChild() {} } };
  const { loadLegacy } = await import("../src/legacy/loader.js");
  await assert.rejects(loadLegacy({ fetchFn: async () => ({ ok: false, status: 404 }) }), /HTTP 404/);
  delete globalThis.window; delete globalThis.document;
});

test("every touch skill/attack button in index.html has a touchstart handler", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const code = LEGACY_FILES.map(read).join("\n");
  const ids = { "touch-attack": "btnAttack", "touch-skill-1": "btnSkill1", "touch-skill-2": "btnSkill2" };
  for (const [id, v] of Object.entries(ids)) {
    assert.ok(html.includes(`id="${id}"`), `${id} missing from html`);
    assert.match(code, new RegExp(`${v}\\.addEventListener\\(\\s*"touchstart"`), `${id} (${v}) has no touchstart handler`);
  }
});
