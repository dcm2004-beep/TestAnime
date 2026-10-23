import { LEGACY_FILES } from "./manifest.js";

// Join legacy files into one script text, with marker comments and a line map for stack traces.
export function buildBundle(files) {
  let code = "";
  let line = 1;
  const map = [];
  for (const { name, text } of files) {
    code += `/* ===== legacy/${name} ===== */\n`;
    line += 1;
    map.push({ name, startLine: line });
    code += text;
    line += (text.match(/\n/g) || []).length;
  }
  code += "\n//# sourceURL=legacy-bundle.js\n";
  return { code, map };
}

// Translate a line number from a "legacy-bundle.js:LINE" stack frame to "file:line".
export function whereIs(map, bundleLine) {
  let hit = map[0];
  for (const m of map) if (m.startLine <= bundleLine) hit = m;
  return hit ? `${hit.name}:${bundleLine - hit.startLine + 1}` : "unknown";
}

export async function loadLegacy({ fetchFn = fetch, base = new URL("../../legacy/", import.meta.url) } = {}) {
  const files = await Promise.all(
    LEGACY_FILES.map(async (name) => {
      const res = await fetchFn(new URL(name, base), { cache: "no-cache" });
      if (!res.ok) throw new Error(`legacy/${name}: HTTP ${res.status}`);
      return { name, text: await res.text() };
    }),
  );
  const { code, map } = buildBundle(files);
  window.__legacyMap = map;
  window.__legacyWhere = (line) => whereIs(map, line); // e.g. __legacyWhere(4321)
  // Run as a single classic script, exactly like the old inline <script>.
  const el = document.createElement("script");
  el.textContent = code;
  document.head.appendChild(el);
  el.remove();
}
