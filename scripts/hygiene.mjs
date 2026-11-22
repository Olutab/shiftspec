import { readFileSync, writeFileSync } from "node:fs";
const lines = readFileSync("data/matrix.txt", "utf8").split(/\r?\n/).filter(l => l.trim() && !l.startsWith("#"));
const header = lines.shift();
const rows = lines.map(l => l.split("|"));
const seen = new Map();
const dupes = [];
const kept = [];
for (const parts of rows) {
  const slug = parts[1];
  if (seen.has(slug)) { dupes.push(slug); continue; }
  seen.set(slug, true);
  kept.push(parts);
}
const count = idx => {
  const m = {};
  for (const p of kept) { m[p[idx]] = (m[p[idx]] || 0) + 1; }
  return Object.entries(m).map(([k, v]) => k + ":" + v).join("  ");
};
console.log("ShiftSpec data hygiene");
console.log("total rows: " + rows.length);
console.log("unique slugs: " + seen.size);
console.log("duplicate slugs: " + dupes.length + (dupes.length ? " -> " + dupes.join(", ") : ""));
console.log("category  " + count(4));
console.log("format    " + count(14));
console.log("wave      " + count(11));
console.log("status    " + count(9));
if (dupes.length) {
  writeFileSync("data/matrix.deduped.txt", [header, ...kept.map(p => p.join("|"))].join("\n") + "\n");
  console.log("Wrote data/matrix.deduped.txt — review it, then replace matrix.txt yourself. Source NOT overwritten.");
} else {
  console.log("No duplicates — source file is clean. Nothing written.");
}