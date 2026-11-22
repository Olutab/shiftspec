import { readFileSync, existsSync } from "node:fs";

const FILE = process.argv[2] ?? "data/matrix.txt";
const COLS = ["id","slug","entity_name","alias","category","summary_fact","source_url","source_name","last_checked","auditing_status","image_query","wave","patient_grid","shift_fit","format","detail_tier","editable_fields","unit_sections","handoff_layout","week1_aids","print_spec","wrong_for"];
const ENUMS = {
  category: ["med-surg","telemetry","stepdown","icu","nicu","l-and-d","postpartum","peds","ed","pacu","oncology","psych","ltc","rehab","dialysis","float-pool"],
  auditing_status: ["SOURCED","HUMAN-CHECKED","ESTIMATED","UNVERIFIED-DRAFT"],
  shift_fit: ["days","nights","rotating","any"],
  format: ["fillable-pdf","google-sheets","excel","goodnotes","print"],
  detail_tier: ["deep","balanced","grid"],
  handoff_layout: ["sbar","systems","head-to-toe","task-list"],
  print_spec: ["letter-bw","letter-color","a4-bw","none"],
};
const SECTIONS = new Set(["drips","vents","telemetry","isolation","falls","io","wounds","couplet","feedings","phototherapy","chemo","access","behavior-checks","glucose","pain","discharge"]);
const WEEK1 = new Set(["phone-tree","unit-map","code-cart","supply-notes","charge-box","preceptor-questions"]);
const SITE_SUFFIX = " | ShiftSpec";
const TODAY = new Date().toISOString().slice(0, 10);

const errors = [], warnings = [];
const err = (id, col, msg) => errors.push(`row ${id} [${col}]: ${msg}`);
const warn = (id, col, msg) => warnings.push(`row ${id} [${col}]: ${msg}`);

const lines = readFileSync(FILE, "utf8").split(/\r?\n/).filter(l => l.trim() && !l.startsWith("#"));
const header = lines.shift()?.split("|");
if (!header || header.join("|") !== COLS.join("|")) {
  console.error("FATAL: header does not match the 22-column schema."); process.exit(1);
}

const rows = [], seenSlug = new Map(), seenName = new Map(), seenId = new Map();
for (const line of lines) {
  const parts = line.split("|");
  if (parts.length !== COLS.length) { errors.push(`line has ${parts.length} fields, expected ${COLS.length}: ${line.slice(0, 60)}…`); continue; }
  const d = Object.fromEntries(COLS.map((c, i) => [c, parts[i].trim()]));
  rows.push(d);
  const id = d.id || "?";

  for (const c of COLS) if (c !== "week1_aids" && !d[c]) err(id, c, "empty required field");
  if (!/^\d+$/.test(d.id)) err(id, "id", "must be an integer");
  for (const [key, map, label] of [[d.slug, seenSlug, "slug"], [d.entity_name.toLowerCase(), seenName, "entity_name"], [d.id, seenId, "id"]]) {
    if (map.has(key)) err(id, label, `duplicate of row ${map.get(key)}`); else map.set(key, id);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug)) err(id, "slug", "must be lowercase kebab-case");
  for (const [c, vals] of Object.entries(ENUMS)) if (d[c] && !vals.includes(d[c])) err(id, c, `"${d[c]}" not in enum`);
  if (d.unit_sections && !d.unit_sections.split(";").every(s => SECTIONS.has(s))) err(id, "unit_sections", "unknown section token");
  if (d.week1_aids && !d.week1_aids.split(";").every(s => WEEK1.has(s))) err(id, "week1_aids", "unknown aid token");

  const g = Number(d.patient_grid), f = Number(d.editable_fields), w = Number(d.wave);
  if (!Number.isInteger(g) || g < 1 || g > 8) err(id, "patient_grid", "must be integer 1-8");
  if (!Number.isInteger(f) || f < 0) err(id, "editable_fields", "must be integer >= 0");
  if (!Number.isInteger(w) || w < 1) err(id, "wave", "must be integer >= 1");
  const tierOK = { deep: g <= 2, balanced: g >= 3 && g <= 4, grid: g >= 5 && g <= 8 };
  if (d.detail_tier in tierOK && !tierOK[d.detail_tier]) err(id, "detail_tier", `tier "${d.detail_tier}" inconsistent with grid=${g}`);

  if (d.format === "print") {
    if (f !== 0) err(id, "editable_fields", "print format must have 0 editable fields");
    if (d.print_spec === "none") err(id, "print_spec", "print format needs a paper spec");
    if (/editable|fillable/i.test(d.entity_name + " " + d.summary_fact)) err(id, "claim", "print format cannot claim editable/fillable");
  } else if (d.format && f <= 0) err(id, "editable_fields", "digital formats need > 0 editable fields");

  if (d.entity_name.includes("Night") !== (d.shift_fit === "nights")) err(id, "shift_fit", "name says Night but shift_fit differs (or vice versa)");
  if (d.entity_name.includes("Couplet") && d.category !== "postpartum") err(id, "category", "Couplet naming only for postpartum");

  const titleLen = (d.entity_name + SITE_SUFFIX).length;
  if (titleLen > 60) err(id, "title", `${titleLen} chars > 60`);
  if (d.wrong_for.length > 120) err(id, "wrong_for", `${d.wrong_for.length} chars > 120`);
  if (d.summary_fact.length > 180) err(id, "summary_fact", `${d.summary_fact.length} chars > 180`);
  if (d.alias.length > 60) err(id, "alias", `${d.alias.length} chars > 60`);

  const blob = [d.entity_name, d.alias, d.summary_fact, d.wrong_for].join(" ");
  if (/\b\d+(\.\d+)?\s?(mg|mcg|mEq|units\/kg|ml\/hr)\b|\btitrate\b|\bnormal range\b|\bdos(e|ing)\b/i.test(blob)) err(id, "ymyl-firewall", "clinical claim detected — cut or give full YMYL treatment");
  if (/game-changer|nurse life|healthcare heroes/i.test(blob)) err(id, "voice", "banned phrase");

  if (["SOURCED", "HUMAN-CHECKED"].includes(d.auditing_status)) {
    if (!d.source_url || !d.source_name || !d.last_checked) err(id, "source", "indexable row missing source fields");
    const firstParty = /^specs\/[a-z0-9-]+\.md$/.test(d.source_url);
    if (!d.source_url.startsWith("https://") && !firstParty) err(id, "source_url", "must be https URL or specs/<slug>.md");
    if (firstParty && !d.source_name.includes("first-party")) err(id, "source_name", "specs path requires first-party label");
    if (firstParty && !existsSync(d.source_url)) warn(id, "source_url", `${d.source_url} not on disk yet (generated in Phase 2)`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.last_checked) || Number.isNaN(Date.parse(d.last_checked))) err(id, "last_checked", "not an ISO date");
    else if (d.last_checked > TODAY) err(id, "last_checked", "date is in the future");
  } else if (d.auditing_status === "ESTIMATED") {
    if (d.source_url || d.source_name || d.last_checked) err(id, "source", "ESTIMATED rows leave source fields empty");
    if (!/estimat/i.test(d.summary_fact)) err(id, "summary_fact", "ESTIMATED row must state it is an estimate with its basis");
  }
}

const drafts = rows.filter(r => r.auditing_status === "UNVERIFIED-DRAFT");
const count = (c) => Object.entries(rows.reduce((m, r) => (m[r[c]] = (m[r[c]] ?? 0) + 1, m), {})).map(([k, v]) => `${k}:${v}`).join("  ");
console.log(`ShiftSpec validator — ${FILE}`);
console.log(`rows: ${rows.length} | errors: ${errors.length} | warnings: ${warnings.length}`);
console.log(`category  ${count("category")}`);
console.log(`format    ${count("format")}`);
console.log(`tier      ${count("detail_tier")}`);
console.log(`status    ${count("auditing_status")}`);
console.log(`wave      ${count("wave")}`);
console.log(`max title: ${Math.max(...rows.map(r => (r.entity_name + SITE_SUFFIX).length))} (limit 60)`);
if (drafts.length) console.log(`\nNOINDEX CANDIDATES (Rule 0 — your decision, never silent): ${drafts.length}\n` + drafts.map(r => `  ${r.slug}`).join("\n"));
for (const w of warnings) console.log("WARN " + w);
for (const e of errors) console.log("ERR  " + e);
console.log(errors.length ? "\nRESULT: FAIL" : "\nRESULT: PASS");
process.exit(errors.length ? 1 : 0);