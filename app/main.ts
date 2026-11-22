import "./tool.css";

type Row = {
  slug: string; entity_name: string; category: string; patient_grid: string;
  shift_fit: string; format: string; editable_fields: string; week1_aids: string;
  wrong_for: string; summary_fact: string;
};
type Answers = { u: string; g: string; s: string; f: string; n: string };

const UNIT_LABEL: Record<string, string> = {
  "med-surg": "Med-surg", telemetry: "Telemetry", stepdown: "Stepdown / PCU", icu: "ICU",
  nicu: "NICU", "l-and-d": "L&D", postpartum: "Postpartum", peds: "Peds", ed: "ED",
  "float-pool": "Float / travel (any unit)"
};
const FORMAT_LABEL: Record<string, string> = {
  "fillable-pdf": "Any tablet / laptop, offline (fillable PDF)",
  "google-sheets": "Desk browser, online (Google Sheets)",
  excel: "Laptop / tablet, Excel",
  goodnotes: "iPad + stylus (GoodNotes)",
  print: "Paper only (print)"
};
const FAMILY: Record<string, string> = {
  "fillable-pdf": "tablet", goodnotes: "tablet", "google-sheets": "desk", excel: "desk", print: "paper"
};
const SHIFT_LABEL: Record<string, string> = { days: "Days", nights: "Nights", rotating: "Rotating", any: "Any / it varies" };
const METHOD = "Fit score = unit 40 + grid 30 (±1 = 18, ±2 = 6) + format 18 (same device family = 6) + shift 12 + orientation 15 (new unit) or 5 (veteran, no clutter). Higher is a closer catalog fit.";
const LIMITS = "Limits: scores fit to your five answers, not clinical suitability or safety. Field counts are build contracts. Follow your facility's device and documentation policy.";

const app = document.getElementById("app") as HTMLElement;
let rows: Row[] = [];
let answers: Answers = { u: "", g: "", s: "", f: "", n: "" };

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function readURL(): Answers {
  const p = new URLSearchParams(location.search);
  return { u: p.get("u") || "", g: p.get("g") || "", s: p.get("s") || "", f: p.get("f") || "", n: p.get("n") || "" };
}
function writeURL() {
  const p = new URLSearchParams();
  (Object.keys(answers) as (keyof Answers)[]).forEach(k => { if (answers[k]) p.set(k, answers[k]); });
  const q = p.toString();
  history.replaceState(null, "", location.pathname + (q ? "?" + q : ""));
}
function complete(): boolean { return Object.values(answers).every(Boolean); }

function score(r: Row, a: Answers) {
  let s = 0;
  const why: { t: string; hit: boolean }[] = [];
  const g = +r.patient_grid, want = +a.g, diff = Math.abs(g - want);
  if (r.category === a.u) { s += 40; why.push({ t: "unit match", hit: true }); }
  else if (r.category === "float-pool") { s += 20; why.push({ t: "unit-agnostic float", hit: true }); }
  else { why.push({ t: "different unit", hit: false }); }
  if (diff === 0) { s += 30; why.push({ t: g + "-column exact", hit: true }); }
  else if (diff === 1) { s += 18; why.push({ t: g + " vs " + want + " (±1)", hit: true }); }
  else if (diff === 2) { s += 6; why.push({ t: g + " vs " + want + " (±2)", hit: false }); }
  else { why.push({ t: g + " vs " + want + " (off)", hit: false }); }
  if (r.format === a.f) { s += 18; why.push({ t: "format match", hit: true }); }
  else if (FAMILY[r.format] === FAMILY[a.f]) { s += 6; why.push({ t: "same device family", hit: true }); }
  else { why.push({ t: "different device", hit: false }); }
  if (r.shift_fit === a.s || r.shift_fit === "any") { s += 12; why.push({ t: "shift fits", hit: true }); }
  else { why.push({ t: "shift differs", hit: false }); }
  const hasW1 = !!r.week1_aids;
  if (a.n === "1") {
    if (hasW1) { s += 15; why.push({ t: "week-1 boxes", hit: true }); }
    else { s -= 10; why.push({ t: "no orientation aids", hit: false }); }
  } else {
    if (!hasW1) { s += 5; why.push({ t: "no orientation clutter", hit: true }); }
  }
  return { s, why };
}

function opt(name: string, value: string, label: string, checked: boolean): string {
  const c = checked ? " checked" : "";
  return "<label class=\"opt\"><input type=\"radio\" name=\"" + name + "\" value=\"" + value + "\"" + c + "><span>" + esc(label) + "</span></label>";
}
function question(legend: string, hint: string, options: string): string {
  return "<fieldset class=\"q\"><legend>" + esc(legend) + "</legend><p class=\"hint\">" + esc(hint) + "</p><div class=\"opts\">" + options + "</div></fieldset>";
}

function renderForm() {
  const units = [...new Set(rows.map(r => r.category))];
  const grids = [...new Set(rows.map(r => r.patient_grid))].sort((a, b) => +a - +b);
  const formats = [...new Set(rows.map(r => r.format))];
  const shifts = ["days", "nights", "rotating", "any"];
  const answered = Object.values(answers).filter(Boolean).length;
  const unitOpts = units.map(u => opt("u", u, UNIT_LABEL[u] || u, answers.u === u)).join("");
  const gridOpts = grids.map(g => opt("g", g, g + (answers.u === "postpartum" ? " couplets" : " patients"), answers.g === g)).join("");
  const shiftOpts = shifts.map(s => opt("s", s, SHIFT_LABEL[s], answers.s === s)).join("");
  const fmtOpts = formats.map(f => opt("f", f, FORMAT_LABEL[f] || f, answers.f === f)).join("");
  const newOpts = opt("n", "1", "Yes — first week / travel", answers.n === "1") + opt("n", "0", "No — I know this unit", answers.n === "0");
  const gridHint = answers.u === "postpartum" ? "Postpartum counts couplets (mom-baby pairs)." : "How many patients you are responsible for this shift.";
  let html = "<div class=\"bar\"><span class=\"progress\">Step " + answered + " of 5 answered</span></div>";
  html += "<form class=\"finder\" id=\"finder\">";
  html += question("1 · Your unit", "Pick the unit you are on this contract or shift.", unitOpts);
  html += question("2 · Assignment size", gridHint, gridOpts);
  html += question("3 · Shift", "Nights layouts put the pending list first.", shiftOpts);
  html += question("4 · What you chart on", "This decides the format that survives your device policy.", fmtOpts);
  html += question("5 · New to this unit?", "Week-one builds add phone-tree, unit-map and charge-nurse boxes.", newOpts);
  html += "<div class=\"bar\"><button class=\"btn\" type=\"submit\"" + (complete() ? "" : " disabled") + ">Rank my shortlist</button>";
  html += "<button class=\"btn ghost\" type=\"button\" id=\"reset\">Reset</button>";
  html += "<button class=\"btn ghost\" type=\"button\" id=\"share\"" + (complete() ? "" : " disabled") + ">Copy share link</button></div></form>";
  app.innerHTML = html;
  app.querySelectorAll("input[type=radio]").forEach(inp => {
    inp.addEventListener("change", () => {
      const el = inp as HTMLInputElement;
      answers[el.name as keyof Answers] = el.value;
      writeURL();
      renderForm();
    });
  });
  const reset = document.getElementById("reset");
  if (reset) reset.addEventListener("click", () => { answers = { u: "", g: "", s: "", f: "", n: "" }; writeURL(); renderForm(); });
  const share = document.getElementById("share");
  if (share) share.addEventListener("click", async () => {
    writeURL();
    try { await navigator.clipboard.writeText(location.href); share.textContent = "Link copied"; }
    catch { share.textContent = location.href; }
  });
  const form = document.getElementById("finder");
  if (form) form.addEventListener("submit", (e) => { e.preventDefault(); if (complete()) renderResults(); });
}

function renderResults() {
  const ranked = rows.map(r => ({ r, ...score(r, answers) }))
    .sort((a, b) => b.s - a.s || (+b.r.editable_fields) - (+a.r.editable_fields) || a.r.slug.localeCompare(b.r.slug))
    .slice(0, 3);
  let html = "<div class=\"bar\"><span class=\"progress\">Shortlist · " + esc(UNIT_LABEL[answers.u] || answers.u) + " · " + answers.g + (answers.u === "postpartum" ? " couplets" : " patients") + " · " + esc(SHIFT_LABEL[answers.s] || answers.s) + "</span>";
  html += "<button class=\"btn ghost\" type=\"button\" id=\"edit\">Edit answers</button>";
  html += "<button class=\"btn ghost\" type=\"button\" id=\"share2\">Copy share link</button></div>";
  ranked.forEach((x, i) => {
    const chips = x.why.map(w => "<li class=\"" + (w.hit ? "hit" : "") + "\">" + (w.hit ? "✓ " : "· ") + esc(w.t) + "</li>").join("");
    html += "<article class=\"result\">";
    html += "<span class=\"stamp\" aria-label=\"fit score " + x.s + "\">" + x.s + "</span>";
    html += "<h3>" + (i + 1) + ". <a href=\"/sheets/" + x.r.slug + "/\">" + esc(x.r.entity_name) + "</a></h3>";
    html += "<p>" + esc(x.r.summary_fact) + "</p>";
    html += "<ul class=\"why\">" + chips + "</ul>";
    html += "<p class=\"boundary\"><strong>Wrong choice if:</strong> " + esc(x.r.wrong_for) + "</p>";
    html += "<details class=\"method\"" + (i === 0 ? " open" : "") + "><summary>Method &amp; limits</summary><p>" + esc(METHOD) + "</p><p>" + esc(LIMITS) + "</p></details>";
    html += "</article>";
  });
  html += "<p class=\"method\">" + esc(METHOD) + " " + esc(LIMITS) + "</p>";
  app.innerHTML = html;
  const edit = document.getElementById("edit");
  if (edit) edit.addEventListener("click", renderForm);
  const share2 = document.getElementById("share2");
  if (share2) share2.addEventListener("click", async () => { writeURL(); try { await navigator.clipboard.writeText(location.href); } catch {} });
  app.scrollIntoView({ block: "start" });
}

async function init() {
  try {
    const res = await fetch("/matrix.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    rows = await res.json();
  } catch (e) {
    app.innerHTML = "<p class=\"err\">Could not load the catalog (/matrix.json): " + esc((e as Error).message) + ". Run npm run build first.</p>";
    return;
  }
  answers = readURL();
  if (complete()) renderResults(); else renderForm();
}
init();