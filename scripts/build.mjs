import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const SITE_URL = (process.env.SITE_URL || "https://shiftspec.example").replace(/\/$/, "");
const BRAND = "ShiftSpec";
const TODAY = new Date().toISOString().slice(0, 10);
const DIST = "dist";
const COLS = ["id","slug","entity_name","alias","category","summary_fact","source_url","source_name","last_checked","auditing_status","image_query","wave","patient_grid","shift_fit","format","detail_tier","editable_fields","unit_sections","handoff_layout","week1_aids","print_spec","wrong_for"];
const WAVE = Number(process.env.WAVE || 1);

function parseMatrix(file) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/).filter(l => l.trim() && !l.startsWith("#"));
  lines.shift();
  return lines.map(l => Object.fromEntries(COLS.map((c, i) => [c, l.split("|")[i].trim()])));
}
const all = parseMatrix("data/matrix.txt");
const rows = all.filter(r => Number(r.wave) <= WAVE && r.auditing_status !== "UNVERIFIED-DRAFT");
const offers = {};
if (existsSync("data/offers.txt")) for (const l of readFileSync("data/offers.txt","utf8").split(/\r?\n/)) {
  if (!l.trim() || l.startsWith("#")) continue;
  const [slug, checkout, etsy, aff, affLabel] = l.split("|").map(s => s.trim());
  offers[slug] = { checkout, etsy, aff, affLabel };
}

mkdirSync("specs", { recursive: true });
for (const d of all) {
  writeFileSync(`specs/${d.slug}.md`,
`# ${d.entity_name} — design spec (first-party)
Slug: ${d.slug}
Category: ${d.category} · Grid: ${d.patient_grid} · Shift: ${d.shift_fit} · Format: ${d.format} · Tier: ${d.detail_tier}
Editable fields: ${d.editable_fields} · Sections: ${d.unit_sections} · Handoff: ${d.handoff_layout}
Week-1 aids: ${d.week1_aids || "none"} · Print: ${d.print_spec}
Wrong for: ${d.wrong_for}
Status: ${d.auditing_status} · Last checked: ${d.last_checked}
Note: these counts are the build contract for the template pack, not measured facts about a shipped file. Update this row if the pack ships differently.
`);
}

try { execFileSync(process.execPath, ["scripts/validate.mjs"], { stdio: "inherit" }); }
catch { console.error("BUILD STOPPED: validator failed."); process.exit(1); }

const hash = s => { let v = 5381; for (const c of s) v = ((v * 33) + c.charCodeAt(0)) >>> 0; return v; };
const pick = (a, seed, salt) => a[(seed + salt) % a.length];
const sections = d => d.unit_sections.split(";");
function neighbors(d) {
  const A = new Set(sections(d));
  return rows.filter(o => o.slug !== d.slug).map(o => {
    const B = new Set(sections(o)); const inter = [...A].filter(x => B.has(x)).length;
    const j = inter / new Set([...A, ...B]).size;
    const s = j * 3 + (o.format === d.format) + (o.shift_fit === d.shift_fit) + (o.detail_tier === d.detail_tier) + 0.5 * (o.category === d.category);
    return { s, o };
  }).sort((a, b) => b.s - a.s || a.o.slug.localeCompare(b.o.slug)).slice(0, 3).map(x => x.o);
}
const DIFF = ["patient_grid","shift_fit","format","detail_tier","editable_fields","unit_sections","handoff_layout","print_spec","week1_aids"];
const specDelta = (a, b) => DIFF.filter(k => a[k] !== b[k]).length;
for (const d of rows) {
  d._nb = neighbors(d);
  const cat = rows.filter(r => r.category === d.category).sort((a, b) => a.patient_grid - b.patient_grid || b.editable_fields - a.editable_fields);
  d._rank = cat.findIndex(r => r.slug === d.slug) + 1; d._catN = cat.length;
  const g = +d.patient_grid, n = +d.editable_fields, ns = sections(d).length;
  d._fpp = n ? Math.round(n / g) : ns; d._boxes = ns * g; d._nsec = ns;
}

const P = {
S1D:["The {name} is a {tierWord} brain sheet for {gridPhrase}, built as a {formatWord} you can {edit}.","{gridPhrase} gets {grid} dedicated columns here, with {fields} {fieldWord} and a {handoffWord} report strip.","This {formatWord} gives {gridPhrase} {grid} columns and {fields} {fieldWord}, organized around a {handoffWord} handoff.","Built for {gridPhrase}, this sheet packs {fields} {fieldWord} into {grid} columns with a {handoffWord} report strip.","Run {gridPhrase}? This {formatWord} maps the whole assignment into {grid} columns and {fields} {fieldWord}."],
S1P:["The {name} is a {tierWord} brain sheet for {gridPhrase}, built as a {formatWord} with {nsec} tracking blocks per column.","{gridPhrase} gets {grid} dedicated columns here, with {nsec} tracking blocks each and a {handoffWord} report strip.","This {formatWord} gives {gridPhrase} {grid} columns of {nsec} tracking blocks, organized around a {handoffWord} handoff.","Built for {gridPhrase}, this paper sheet packs {nsec} tracking blocks into each of {grid} columns with a {handoffWord} report strip.","Run {gridPhrase}? This {formatWord} maps the whole assignment into {grid} columns and {nsec} blocks per column."],
S2:["You get {sectionsList} blocks, so everything you track on {unitWord} stays on one page.","{sectionsList} blocks keep the details in one place instead of scattered across scrap paper.","The layout covers {sectionsList}, the columns you actually reach for during a {unitWord} shift.","Tracking is organized into {sectionsList} blocks rather than one giant notes box.","{sectionsList} each get their own space, which is the point of a hyper-specific sheet."],
S3:["{printSent}","Print output: {printWord}.","The layout is tuned for night shift.","It works for any shift pattern.","Expect about {fpp} fields per patient column."],
S3P:["{printSent}","Print output: {printWord}.","The layout is tuned for night shift.","It works for any shift pattern.","Expect {nsec} blocks per patient column."],
META:["{name}: {grid} columns, {fields} {fieldWord}, {handoffWord} handoff strip. {printSent}","A {grid}-column {unitWord} brain sheet with {fields} {fieldWord} and {sectionsShort} blocks. {editSent}","{gridPhrase} mapped into {fields} {fieldWord} with a {handoffWord} report strip. {printSent}","Hyper-specific {unitWord} brain sheet: {grid} columns, {sectionsShort} blocks, {handoffWord} handoff. {editSent}","{name} — {grid} columns, {sectionsShort} tracking blocks, {handoffWord} report layout. {printSent}"],
METAP:["{name}: {grid} columns, {nsec} blocks each, {handoffWord} handoff strip. {printSent}","A {grid}-column {unitWord} brain sheet with {nsec} tracking blocks and {sectionsShort} space. {editSent}","{gridPhrase} mapped into {nsec} blocks per column with a {handoffWord} report strip. {printSent}","Hyper-specific {unitWord} brain sheet: {grid} columns, {sectionsShort} blocks, {handoffWord} handoff. {editSent}","{name} — {grid} columns, {sectionsShort} tracking blocks, {handoffWord} report layout. {printSent}"],
EXT:["Fully editable.","Prints letter B&W.","Built for night shift.","Week-1 orientation boxes included.","No locked PDF."],
FIT:{deep:["The {tierWord} layout is a deliberate constraint: {grid} columns means each patient gets real depth instead of a skinny lane. If your assignment grows past {grid}, size up before the shift, not during it.","Deep sheets trade breadth for room. With {grid} columns you keep settings, lines and notes in one column without flipping pages, which is the point at this level of detail.","This tier exists because {grid}-patient assignments in {unitWord} carry more detail per patient than a task grid can hold. The columns are wide on purpose.","Count your typical assignment first. This sheet is cut for {grid}; the depth per column is what you are buying, not capacity.","At {grid} patients the bottleneck is detail space, not column count. The {tierWord} tier spends the page on depth."],
balanced:["The balanced tier splits the page between per-patient detail and a task strip. {grid} columns fits the middle of the {unitWord} range without squeezing either side.","{grid} columns is the compromise point: enough room for notes, enough lanes for the assignment. Go deeper only if your unit runs lighter loads.","This layout assumes a {grid}-patient load where you still have time to write. If your shift is pure task churn, the task-grid tier fits better.","Balanced means each column keeps a notes zone and a checks zone. At {grid} patients that is the difference between a sheet and a scratch pad.","Pick this tier when {grid} is your normal assignment, not your worst day. The sheet is cut for the normal case."],
grid:["The task-grid tier spends the page on lanes, not depth. {grid} columns with short checks rows is built for shifts where the task list is the job.","At {grid} patients, detail blocks become clutter. This tier keeps one row per task and one column per patient so a glance answers who is next.","Heavy loads punish deep sheets. {grid} shallow columns beat {grid} deep ones when you are moving fast; the narrative lives elsewhere.","This is a throughput layout: {grid} lanes, short rows, fast scans. If you need narrative space per patient, drop to the balanced tier.","The grid tier assumes you chart detail in the EHR and need a paper-side task map. {grid} columns is the capacity; the rows are the pacing."]},
FORMAT:["As a {formatWord}, it lets you {edit}. Realistically that means {device}. It {offline}.","The format is the workflow: {device}. You {edit}, and it {offline}. Check that against your unit's device policy before you commit.","Device fit: {device}. Because it {offline}, the format decides where this sheet can live on your shift.","You {edit}. The practical constraint is {device}; if that is not what you carry, pick another format of the same grid.","Format first, grid second: this one runs on {device} and {offline}. The grid logic carries across formats, but field counts differ because each format uses space differently."],
HANDOFF:{sbar:["The report strip follows SBAR — situation, background, assessment, recommendation — the TeamSTEPPS handoff structure published by AHRQ. You fill it once and read it straight through at change of shift.","Handoff is a strip, not an afterthought: SBAR order means the oncoming nurse hears the same sequence every time. The structure is the AHRQ TeamSTEPPS SBAR tool, not an invented layout.","SBAR keeps report short: four prompts in a fixed order. The strip sits under the grid so you are not reconstructing the story from scattered boxes.","The SBAR strip is the part you read aloud. Everything above it is the evidence; the strip is the summary. That separation is what makes report faster.","Report order is fixed to SBAR so a float or traveler can hand off without learning a new format. The framework is the AHRQ TeamSTEPPS one."],
systems:["The report rows run systems-based, in a fixed order. You scan top to bottom instead of hunting through boxes.","Systems order means the same sequence every report. The rows mirror how most {unitWord} units already give handoff, so the sheet matches the habit.","The systems strip groups the grid by body system rather than by task. That is the layout most stepdown and ICU reports already follow.","Report runs down the systems rows, not across the tasks. If your unit gives systems report, this strip removes the translation step.","Systems-based rows keep report predictable: one row per system, same order every shift. The grid above holds the detail the rows summarize."],
"head-to-toe":["The report blocks run head-to-toe, the documentation order most {unitWord} charting already uses. The sheet follows the round, not the task list.","Head-to-toe order means you chart in the same sequence you walk the round. The blocks stack so the page reads like the pass itself.","The layout follows a head-to-toe pass: each block is a stop on the round. Report reads down the page in the same order.","Head-to-toe blocks suit units where the round is the structure. You fill as you go, and the report is the page read aloud.","The blocks are ordered head-to-toe so nothing gets skipped on the pass. It is a documentation order, not a clinical instruction."],
"task-list":["The report strip is a task list: what is done, what is pending, what is next. At high turnover that is the report that matters.","Task-list handoff answers three questions fast — done, pending, next. The strip keeps them separate so nothing hides in a notes box.","The strip runs as a checklist rather than a narrative. On a {grid}-column shift, the pending list is the handoff.","Task-list order suits churn: the oncoming nurse needs the queue, not the story. The grid holds the story if they ask.","Report is the pending list. The strip splits done from pending so the queue is visible at a glance."]},
NIGHT:["Night layout: the checks rows assume fewer hands on the unit. The pending list sits where you can read it in the small hours without re-reading the whole grid.","The night variant moves the task strip to the top of each column, because nights run on pacing, not rounds. Detail blocks stay below for the quiet hours.","Nights change what you need from a sheet: fewer interruptions to chart, more reliance on the pending list. This layout puts the queue first.","The night build assumes you are the coverage. The strip is ordered so a glance tells you what cannot wait until day shift.","Night shift reads a sheet differently: you scan for what is due, not what is documented. The layout is ordered for the scan."],
ANYSHIFT:["The layout works across shift patterns: the strip order does not assume rounds or quiet hours. Day or night, the grid reads the same.","No shift-specific assumptions here. The columns and strip work the same at noon and midnight, which is what a float needs.","This build is shift-agnostic on purpose. If you rotate, one sheet format survives the rotation instead of three.","The strip order is neutral: tasks and report read the same on days and nights. Rotating nurses keep one layout.","Shift pattern does not change the grid. That is deliberate — a sheet you relearn every rotation is a sheet you abandon."],
PRINT:["Print reality: {printWord}, one page, normal margins. Test it on the unit printer before your first shift; shared printers love to shrink things.","It prints {printWord}. The layout is cut for one page so you are not taping halves together at the desk.","The print build is {printWord} and fits a single page. If your unit only has A4, check the scale before you print a stack.","Printing is the point of this format: {printWord}, no app, no login, no battery. The unit printer is the only dependency.","One page, {printWord}. The margins assume a standard laser printer; if yours clips edges, scale to fit rather than reprinting."],
DIGITAL:["No print layout here: this one lives on the device. If your unit is paper-only, take the print or fillable-PDF version of the same grid.","Digital-only is a feature, not a gap: no paper to lose, no reprint when the assignment changes. But it assumes your unit allows the device.","This build has no print spec. It is meant to stay on the device it was made for.","If you need paper, this is the wrong format. The same grid exists in printable builds; check the unit hub.","Digital-only means the sheet updates with you. It also means a dead battery is a dead sheet; charge before the shift."],
WEEK1:["Week-1 boxes: {w1List}. They sit outside the patient grid so orientation notes never eat patient space.","The orientation strip carries {w1List}. Fill them on day one and the sheet becomes your unit map for the rest of the contract.","First week on a new unit is a memory problem, not a skill problem. The {w1List} boxes hold the things you would otherwise ask twice.","Orientation prompts included: {w1List}. They are prompts to fill, not pre-filled answers; your unit's details go in, not generic ones.","The week-1 aids are {w1List}. Veterans can ignore them; travelers on a new unit will use them every shift until they do not need to."],
WRONG:["Wrong choice if: {wrong} That is not a flaw in the sheet; it is the boundary of the design.","Skip this one when: {wrong} The unit hub lists the neighboring build that fits instead.","This sheet is the wrong tool when {wrongLower} Buy the fit, not the format.","Be honest about the assignment: {wrong} If that is your normal shift, change size or tier first.","The boundary: {wrong} A sheet that tries to fit every assignment fits none of them."]
};
const FMT = {
"fillable-pdf":{word:"fillable PDF",edit:"fill it on any tablet or laptop",fw:"fillable fields",device:"any PDF app on a tablet, laptop or phone",offline:"works fully offline",editSent:"Fully editable."},
"google-sheets":{word:"Google Sheets workbook",edit:"edit it in your browser",fw:"editable cells",device:"any browser, best on a laptop or tablet",offline:"needs a connection or cached offline files",editSent:"Edit in your browser."},
"excel":{word:"Excel workbook",edit:"edit it in Excel on a laptop or tablet",fw:"editable cells",device:"Excel on a laptop or tablet; cramped on a phone",offline:"works offline once saved locally",editSent:"Fully editable."},
"goodnotes":{word:"GoodNotes template",edit:"annotate it with a stylus or finger",fw:"GoodNotes zones",device:"an iPad with GoodNotes or a compatible annotation app",offline:"works fully offline",editSent:"Stylus-ready."},
"print":{word:"printable paper sheet",edit:"fill it by pen at the desk",fw:"pen-and-paper blocks",device:"any unit printer that takes letter paper",offline:"needs no device at all",editSent:"Pen-and-paper build."}};
const HAND={sbar:"SBAR",systems:"systems-based","head-to-toe":"head-to-toe","task-list":"task-list"};
const UNIT={"med-surg":"med-surg",telemetry:"telemetry",stepdown:"stepdown",icu:"ICU",nicu:"NICU","l-and-d":"L&D",postpartum:"postpartum",peds:"peds",ed:"ED","float-pool":"float"};
const SEC={io:"I/O",drips:"drips",vents:"vents",telemetry:"telemetry",isolation:"isolation",falls:"falls",wounds:"wounds",couplet:"couplet",feedings:"feedings",phototherapy:"phototherapy",glucose:"glucose",pain:"pain",discharge:"discharge","behavior-checks":"behavior checks",chemo:"chemo",access:"access"};
const TIERW={deep:"deep-detail",balanced:"balanced",grid:"task-grid"};
const PRINTW={"letter-bw":"letter B&W","letter-color":"letter color","a4-bw":"A4 B&W",none:""};
const W1W={"phone-tree":"phone tree","unit-map":"unit map","code-cart":"code cart","supply-notes":"supply notes","charge-box":"charge-nurse box","preceptor-questions":"preceptor questions"};
const AHRQ="https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/sbar.html";

const joinl = xs => !xs.length ? "" : xs.length === 1 ? xs[0] : xs.slice(0,-1).join(", ") + " and " + xs.at(-1);
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const fill = (t, T) => t.replace(/\{(\w+)\}/g, (_, k) => T[k]);
const wc = s => s.trim().split(/\s+/).length;
function tokens(d) {
  const f = FMT[d.format], g = +d.patient_grid, secs = sections(d).map(s => SEC[s]), u = UNIT[d.category];
  const gp = d.category === "postpartum" ? `a ${g}-couplet postpartum assignment` : d.category === "float-pool" ? `a ${g}-patient float assignment` : `a ${g}-patient ${u} assignment`;
  return { name:d.entity_name, tierWord:TIERW[d.detail_tier], gridPhrase:gp, grid:g, fields:+d.editable_fields, formatWord:f.word, edit:f.edit, fieldWord:f.fw, handoffWord:HAND[d.handoff_layout], sectionsList:joinl(secs), sectionsShort:joinl(secs.slice(0,3)), unitWord:u, nsec:d._nsec, fpp:d._fpp, boxes:d._boxes, printWord:PRINTW[d.print_spec], printSent:d.print_spec!=="none"?`Prints ${PRINTW[d.print_spec]}.`:"Digital only.", editSent:f.editSent, device:f.device, offline:f.offline, wrong:d.wrong_for, night:d.shift_fit==="nights", w1:d.week1_aids?d.week1_aids.split(";").map(x=>W1W[x]):[], slotWord:d.category==="postpartum"?"couplets":"patients" };
}
function answer(d) {
  const T = tokens(d), seed = hash(d.slug), S1 = d.format==="print"?P.S1P:P.S1D, S3 = d.format==="print"?P.S3P:P.S3;
  for (let off = 0; off < 12; off++) {
    const s1 = cap(fill(pick(S1,seed,off),T)), s2 = cap(fill(pick(P.S2,seed,off+3),T));
    let cands = Array.from({length:S3.length},(_,k)=>cap(fill(S3[(seed+off+k)%S3.length],T)));
    cands = cands.filter(x => !(d.print_spec==="none" && x.includes("Print output")));
    cands = cands.filter(x => !(x.includes("tuned for night shift") && !T.night));
    cands = cands.filter(x => !(x.includes("any shift pattern") && T.night));
    for (const s3 of cands) { const a = `${s1} ${s2} ${s3}`; if (wc(a)>=40 && wc(a)<=60) return a; }
  }
  return null;
}
function meta(d) {
  const T = tokens(d), seed = hash(d.slug), M = d.format==="print"?P.METAP:P.META;
  for (let off = 0; off < 10; off++) {
    let m = fill(pick(M,seed,off),T);
    for (const e of P.EXT) {
      if (m.length>=120 && m.length<=160) return m;
      if (m.length<120 && !m.includes(e)) {
        if (e==="Fully editable." && d.format==="print") continue;
        if (e==="Prints letter B&W." && d.print_spec!=="letter-bw") continue;
        if (e==="Built for night shift." && !T.night) continue;
        if (e==="Week-1 orientation boxes included." && !T.w1.length) continue;
        if (e==="No locked PDF." && d.format==="print") continue;
        m += " " + e;
      }
    }
    if (m.length>=120 && m.length<=160) return m;
  }
  return null;
}
function bodyParts(d) {
  const T = tokens(d); T.w1List = joinl(T.w1); T.wrongLower = T.wrong[0].toLowerCase()+T.wrong.slice(1);
  const seed = hash(d.slug), parts = [];
  parts.push({h:"Why this grid size", t:fill(pick(P.FIT[d.detail_tier],seed,1),T)});
  parts.push({h:"Format and device fit", t:fill(pick(P.FORMAT,seed,2),T)});
  parts.push({h:"How handoff reads", t:fill(pick(P.HANDOFF[d.handoff_layout],seed,3),T), cite:d.handoff_layout==="sbar"});
  parts.push({h:T.night?"On nights":"Across shifts", t:fill(pick(T.night?P.NIGHT:P.ANYSHIFT,seed,4),T)});
  parts.push({h:d.print_spec!=="none"?"Print reality":"On-device only", t:fill(pick(d.print_spec!=="none"?P.PRINT:P.DIGITAL,seed,5),T)});
  if (T.w1.length) parts.push({h:"Week-1 orientation boxes", t:fill(pick(P.WEEK1,seed,6),T)});
  parts.push({h:"When this is the wrong sheet", t:fill(pick(P.WRONG,seed,7),T)});
  const math = d.format==="print"
    ? `The math on this build: ${T.nsec} tracking blocks in each of ${T.grid} columns is ${T.boxes} labeled spaces on one page. Pen and paper does not count zones, it counts room. If ${T.boxes} spaces is not enough for your charting style, drop to fewer, deeper columns.`
    : `The math on this build: ${T.fields} ${T.fieldWord} across ${T.grid} columns is about ${T.fpp} per patient column. With ${T.nsec} tracking blocks per column, the whole assignment gets ${T.boxes} labeled spaces. If you need more than ${T.fpp} notes per patient, go a tier deeper.`;
  parts.push({h:"The capacity math", t:math});
  return parts;
}
function faq(d) {
  const T = tokens(d);
  return [
    {q:`How many ${T.slotWord} does this sheet cover?`, a:`It is cut for ${T.grid} ${T.slotWord}. The columns do not stretch; if your assignment runs heavier, pick the next size up in the ${T.unitWord} hub.`},
    {q:"Can I edit it mid-shift?", a:d.format==="print"?"No. This is the pen-and-paper build; editable versions of the same grid exist in the hub.":`Yes. ${T.fields} ${T.fieldWord} take input mid-shift; changes save as you go.`},
    {q:"Does it work offline?", a:`It ${T.offline}. Plan around ${T.device}.`}
  ];
}
function fitMeta(base) {
  const extra = ["Filter by format, shift and grid size.","Built for float, travel and night nurses.","Organization aids, not clinical guidance.","Spec drawings and capacity math on every page."];
  let m = base;
  for (const e of extra) { if (m.length>=120 && m.length<=160) return m; if (m.length<120 && !m.includes(e)) m += " " + e; }
  if (m.length>=120 && m.length<=160) return m;
  if (m.length>160) { m = m.slice(0,157); m = m.slice(0, m.lastIndexOf(" ")) + "…"; }
  return m;
}

const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
function specSVG(d) {
  const g = +d.patient_grid, secs = sections(d), W = 800, H = 520, colW = (W-80)/g;
  let cells = "";
  for (let c = 0; c < g; c++) {
    const x = 40 + c*colW;
    cells += `<rect x="${x}" y="90" width="${colW-8}" height="330" class="col"/>`;
    cells += `<text x="${x+8}" y="112" class="lbl">${d.category==="postpartum"?"Couplet":"Patient"} ${c+1}</text>`;
    secs.forEach((s, i) => { cells += `<text x="${x+8}" y="${140+i*26}" class="sec">${esc(SEC[s])}</text><line x1="${x+8}" y1="${146+i*26}" x2="${x+colW-16}" y2="${146+i*26}" class="rule"/>`; });
  }
  const w1 = d.week1_aids ? `<rect x="40" y="430" width="${W-80}" height="40" class="w1"/><text x="48" y="455" class="lbl">Week-1: ${esc(d.week1_aids.split(";").map(x=>W1W[x]).join(" · "))}</text>` : "";
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="svgt-${d.slug}" class="spec">
<title id="svgt-${d.slug}">Spec drawing of ${esc(d.entity_name)}: ${g} columns, ${secs.length} tracking blocks, ${HAND[d.handoff_layout]} report strip.</title>
<rect x="8" y="8" width="${W-16}" height="${H-16}" class="frame"/>
<text x="40" y="48" class="title">${esc(d.entity_name)}</text>
<text x="40" y="70" class="sub">${esc(d.slug)} · ${TIERW[d.detail_tier]} · ${d.format}</text>
${cells}
<rect x="40" y="${d.week1_aids?395:430}" width="${W-80}" height="30" class="strip"/>
<text x="48" y="${d.week1_aids?415:450}" class="lbl">${HAND[d.handoff_layout]} report strip</text>
${w1}
<text x="${W-40}" y="${H-24}" class="stamp" text-anchor="end">${d.editable_fields} fields · ${d._boxes} spaces</text>
</svg>`;
}
const LOGO = `<svg viewBox="0 0 32 32" class="logo" aria-hidden="true"><rect x="3" y="3" width="26" height="26" rx="3" class="lg-frame"/><line x1="16" y1="3" x2="16" y2="29" class="lg-line"/><line x1="3" y1="16" x2="29" y2="16" class="lg-line"/><rect x="18" y="18" width="9" height="9" class="lg-fill"/></svg>`;

const CSS = `:root{--bg:#F3F5F7;--surface:#FFFFFF;--ink:#182430;--accent:#0B5FA5;--warning:#9A3412;--rule:#C9D4DE;--mono:ui-monospace,SFMono-Regular,Menlo,monospace;--sans:"Public Sans",system-ui,sans-serif;--disp:"Space Grotesk",var(--sans)}
@media (prefers-color-scheme:dark){:root{--bg:#0E1620;--surface:#16222E;--ink:#E8EEF4;--accent:#7FB4E8;--warning:#E8A17F;--rule:#2C3E50}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.6 var(--sans)}
h1,h2,h3{font-family:var(--disp);line-height:1.15}h1{font-size:1.9rem;margin:.2em 0}h2{font-size:1.25rem;margin:1.6em 0 .5em;border-bottom:1px solid var(--rule);padding-bottom:.2em}
a{color:var(--accent)}a:focus-visible,button:focus-visible,select:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.wrap{max-width:960px;margin:0 auto;padding:1rem}
header.site{display:flex;align-items:center;gap:.6rem;padding:.8rem 1rem;border-bottom:2px solid var(--ink);background:var(--surface)}
header.site .brand{font-family:var(--disp);font-weight:700;font-size:1.2rem;text-decoration:none;color:var(--ink);display:flex;align-items:center;gap:.5rem}
header.site nav{margin-left:auto;display:flex;gap:1rem;flex-wrap:wrap}header.site nav a{text-decoration:none;font-size:.95rem}
.logo{width:28px;height:28px}.lg-frame{fill:none;stroke:var(--ink);stroke-width:2}.lg-line{stroke:var(--ink);stroke-width:1.5}.lg-fill{fill:var(--accent)}
.crumb{font:400 .8rem var(--mono);color:var(--ink);opacity:.8;margin:.6rem 0}.crumb a{color:var(--accent)}
.answer{font-size:1.08rem;background:var(--surface);border-left:4px solid var(--accent);padding:.9rem 1rem;border-radius:0 6px 6px 0}
.spec{width:100%;height:auto;background:var(--surface);border:1px solid var(--rule);border-radius:6px;margin:1rem 0}
.spec .frame{fill:none;stroke:var(--ink);stroke-width:1.5}.spec .col{fill:none;stroke:var(--rule);stroke-width:1}.spec .strip{fill:none;stroke:var(--accent);stroke-width:1.5}.spec .w1{fill:none;stroke:var(--warning);stroke-width:1.2;stroke-dasharray:4 3}
.spec .title{font:700 20px var(--disp);fill:var(--ink)}.spec .sub,.spec .stamp{font:400 12px var(--mono);fill:var(--ink);opacity:.75}.spec .lbl{font:600 13px var(--mono);fill:var(--accent)}.spec .sec{font:400 13px var(--sans);fill:var(--ink)}.spec .rule{stroke:var(--rule);stroke-width:1}
table{border-collapse:collapse;width:100%;margin:.8rem 0;font-size:.95rem}th,td{border:1px solid var(--rule);padding:.45rem .6rem;text-align:left}th{background:var(--surface);font-family:var(--disp)}
.card{background:var(--surface);border:1px solid var(--rule);border-radius:6px;padding:.9rem}.grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
.tag{font:600 .72rem var(--mono);color:var(--accent);border:1px solid var(--accent);border-radius:3px;padding:.1rem .4rem;display:inline-block;margin:.1rem}
.warn{color:var(--warning);border-left:4px solid var(--warning);padding:.6rem 1rem;background:var(--surface);border-radius:0 6px 6px 0}
.cta{display:inline-block;background:var(--accent);color:var(--bg);font-family:var(--disp);font-weight:700;padding:.6rem 1.1rem;border-radius:6px;text-decoration:none;margin:.3rem .3rem 0 0}
.scope{font-size:.85rem;opacity:.85;border-top:1px solid var(--rule);margin-top:2rem;padding-top:.8rem}
footer.site{border-top:2px solid var(--ink);margin-top:2rem;padding:1rem;font-size:.85rem;background:var(--surface)}
.facets{display:flex;gap:.6rem;flex-wrap:wrap;margin:.8rem 0}.facets label{font:600 .8rem var(--mono)}.facets select{font:inherit;padding:.3rem;background:var(--surface);color:var(--ink);border:1px solid var(--rule);border-radius:4px}
.faq dt{font-family:var(--disp);font-weight:700;margin-top:.8rem}.faq dd{margin:.2rem 0 0}
@media (prefers-reduced-motion:no-preference){.card{transition:border-color .12s}.card:hover{border-color:var(--accent)}}
@media print{header.site,footer.site,.facets,.cta,.crumb nav{display:none}body{background:#fff;color:#000;font-size:12px}.spec{border:1px solid #000}.answer{border-left:3px solid #000}a{color:#000;text-decoration:none}}
`;

const pageSet = new Set();
const url = slug => slug === "home" ? "/" : slug === "glossary" ? "/glossary/" : slug === "shop" ? "/shop/" : slug === "credits" ? "/credits/" : slug === "changelog" ? "/changelog/" : slug.startsWith("hub-") ? `/units/${slug.slice(4)}/` : slug.startsWith("guide-") ? `/formats/${slug.slice(6)}/` : `/sheets/${slug}/`;
function shell({ title, desc, slug, body, jsonld, noindex = false, hub = false }) {
  pageSet.add(slug);
  const canonical = SITE_URL + url(slug);
  const ld = jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow">'}
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:url" content="${canonical}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">${ld}</head>
<body><header class="site"><a class="brand" href="/">${LOGO}${BRAND}</a><nav><a href="/">Home</a><a href="/tool/">Finder</a><a href="/glossary/">Glossary</a><a href="/shop/">Shop</a></nav></header>
<div class="wrap">${body}</div>
<footer class="site"><p>${BRAND} — hyper-specific, fully editable nurse brain-sheet specs. Organization aids, not clinical guidance; follow your facility's policy.</p>
<p><a href="/credits/">Photo credits</a> · <a href="/changelog/">Changelog</a> · Data as of ${TODAY}.</p></footer>
${hub ? FACET_JS : ""}</body></html>`;
}
const FACET_JS = `<script>document.querySelectorAll('.facets select').forEach(s=>s.addEventListener('change',()=>{const f={};document.querySelectorAll('.facets select').forEach(x=>f[x.dataset.k]=x.value);document.querySelectorAll('[data-card]').forEach(c=>{const ok=Object.entries(f).every(([k,v])=>!v||c.dataset[k]===v);c.style.display=ok?'':'none';});}));</script>`;
const crumb = items => `<p class="crumb">${items.map((x,i)=>i?` / ${x.href?`<a href="${x.href}">${esc(x.t)}</a>`:esc(x.t)}`:`<a href="/">Home</a>`).join("")}</p>`;
const bcLd = items => ({ "@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:items.map((x,i)=>({"@type":"ListItem",position:i+1,name:x.t,item:x.href?SITE_URL+x.href:undefined})) });

const tplOf = d => d.week1_aids ? "orientation" : d.detail_tier;
function entityPage(d) {
  const T = tokens(d), a = answer(d), m = meta(d), parts = bodyParts(d), qs = faq(d), tpl = tplOf(d);
  const hubSlug = "hub-" + d.category, guideSlug = "guide-" + d.format;
  const offer = offers[d.slug] || {};
  const cta = [offer.checkout && `<a class="cta" href="${offer.checkout}" rel="noopener">Get this pack</a>`, offer.etsy && `<a class="cta" href="${offer.etsy}" rel="noopener">Buy on Etsy</a>`, offer.aff && `<a class="cta" href="${offer.aff}" rel="sponsored noopener">${esc(offer.affLabel||"Recommended gear")}</a>`].filter(Boolean).join("");
  const nbRows = d._nb.map(o => `<tr><td><a href="${url(o.slug)}">${esc(o.entity_name)}</a></td><td>${o.patient_grid}</td><td>${o.editable_fields}</td><td>${specDelta(d,o)}</td></tr>`).join("");
  const secTable = `<table><thead><tr><th>Spec</th><th>Value</th></tr></thead><tbody>
<tr><td>Patient grid</td><td>${d.patient_grid} ${T.slotWord}</td></tr><tr><td>Editable fields</td><td>${d.editable_fields}</td></tr>
<tr><td>Tracking blocks</td><td>${esc(T.sectionsList)}</td></tr><tr><td>Handoff layout</td><td>${HAND[d.handoff_layout]}</td></tr>
<tr><td>Format</td><td>${FMT[d.format].word}</td></tr><tr><td>Print</td><td>${d.print_spec==="none"?"Digital only":PRINTW[d.print_spec]}</td></tr>
<tr><td>Shift</td><td>${d.shift_fit}</td></tr><tr><td>Rank in ${UNIT[d.category]}</td><td>${d._rank} of ${d._catN} by grid size</td></tr></tbody></table>`;
  const cite = parts.some(p=>p.cite) ? `<p class="crumb">SBAR structure: <a href="${AHRQ}" rel="noopener">AHRQ TeamSTEPPS SBAR tool</a>.</p>` : "";
  const sectionHtml = p => `<h2>${esc(p.h)}</h2><p>${esc(p.t)}</p>`;
  const faqHtml = `<h2>Quick answers</h2><dl class="faq">${qs.map(x=>`<dt>${esc(x.q)}</dt><dd>${esc(x.a)}</dd>`).join("")}</dl>`;
  const nbHtml = `<h2>Closest builds</h2><p>The three nearest specs by shared tracking blocks and format:</p><table><thead><tr><th>Build</th><th>Grid</th><th>Fields</th><th>Differing specs</th></tr></thead><tbody>${nbRows}</tbody></table>`;
  const wrongHtml = `<div class="warn"><strong>Wrong choice if:</strong> ${esc(d.wrong_for)}</div>`;
  const wrongPart = parts.find(p=>p.h==="When this is the wrong sheet");
  const rest = parts.filter(p=>p!==wrongPart);
  const answerBlock = `<p class="answer">${esc(a)}</p>`;
  const svg = specSVG(d);
  const links = `<p>More in the <a href="${url(hubSlug)}">${UNIT[d.category]} hub</a> · <a href="${url(guideSlug)}">${FMT[d.format].word} guide</a>.</p>`;
  let main;
  if (tpl === "orientation") { const w1p = rest.find(p=>p.h.startsWith("Week-1")); const fitp = rest.find(p=>p.h==="Why this grid size"); main = [answerBlock, svg, wrongHtml, w1p?sectionHtml(w1p):"", fitp?sectionHtml(fitp):"", secTable, ...rest.filter(p=>p!==w1p&&p!==fitp).map(sectionHtml), nbHtml, faqHtml, cite, cta, links].join("\n"); }
  else if (tpl === "deep") main = [answerBlock, secTable, svg, ...rest.map(sectionHtml), wrongHtml, nbHtml, faqHtml, cite, cta, links].join("\n");
  else if (tpl === "grid") main = [answerBlock, svg, ...rest.slice(0,2).map(sectionHtml), secTable, ...rest.slice(2).map(sectionHtml), wrongHtml, nbHtml, faqHtml, cite, cta, links].join("\n");
  else main = [answerBlock, svg, ...rest.map(sectionHtml), secTable, wrongHtml, nbHtml, faqHtml, cite, cta, links].join("\n");
  const body = crumb([{t:"Units"},{t:UNIT[d.category],href:url(hubSlug)},{t:d.entity_name}]) + `<h1>${esc(d.entity_name)}</h1>` + main +
    `<p class="scope">Limits of this page: a documentation-organization spec, not clinical guidance. Field counts are the build contract for this pack. Source: <a href="/specs/${d.slug}.md">${esc(d.source_name)}</a>, checked ${d.last_checked}.</p>`;
  const jsonld = [
    {"@context":"https://schema.org","@type":"Article",headline:d.entity_name,description:m,dateModified:d.last_checked,author:{"@type":"Organization",name:BRAND},mainEntityOfPage:SITE_URL+url(d.slug)},
    bcLd([{t:"Home",href:"/"},{t:UNIT[d.category],href:url(hubSlug)},{t:d.entity_name}]),
    {"@context":"https://schema.org","@type":"FAQPage",mainEntity:qs.map(x=>({"@type":"Question",name:x.q,acceptedAnswer:{"@type":"Answer",text:x.a}}))},
    {"@context":"https://schema.org","@type":"Dataset",name:d.entity_name+" spec",description:d.summary_fact,variableMeasured:["patient_grid","editable_fields","unit_sections","handoff_layout","print_spec"]}
  ];
  return { slug:d.slug, html:shell({title:d.entity_name+" | "+BRAND, desc:m, slug:d.slug, body, jsonld}), a, m, parts, qs, d };
}

const HUB_INTRO = {
"med-surg":"Med-surg is the highest-census adult floor: the sheet problem is lanes, not depth. These builds range from 3-patient balanced grids to 6-patient task matrices.",
telemetry:"Telemetry adds a monitoring layer to a med-surg load. Every build here carries a telemetry block alongside the standard I/O and falls tracking.",
stepdown:"Stepdown sits between floor and ICU: fewer patients, more lines and drips. These builds keep systems report rows and drip space without ICU-level depth.",
icu:"ICU is a depth problem: one or two patients, each with lines, vents and settings. These builds spend the page on per-patient room, not column count.",
nicu:"NICU tracking centers on feedings, weights and phototherapy. These builds keep those blocks first and carry systems report rows.",
"l-and-d":"L&D sheets follow the labor round: I/O, pain and falls in deep columns. Couplet care after delivery lives in the postpartum hub.",
postpartum:"Postpartum counts couplets, not patients: each column is a mom-baby pair. These builds keep feedings and couplet blocks together.",
peds:"Peds adds feedings and family presence to a floor load. These builds keep head-to-toe or task report with pediatric tracking blocks.",
ed:"ED is turnover: the sheet is a queue, not a chart. These builds lead with a task-list strip and discharge tracking.",
"float-pool":"Float and travel builds are unit-agnostic and orientation-first: phone tree, unit map and charge-nurse boxes sit outside the patient grid."};
function hubPage(cat) {
  const items = rows.filter(r => r.category === cat);
  const grids = items.map(i=>+i.patient_grid), fmts = [...new Set(items.map(i=>i.format))];
  const cards = items.map(d=>`<div class="card" data-card data-format="${d.format}" data-shift="${d.shift_fit}" data-tier="${d.detail_tier}">
<h3><a href="${url(d.slug)}">${esc(d.entity_name)}</a></h3><p>${esc(d.summary_fact)}</p>
<span class="tag">${d.patient_grid} ${d.category==="postpartum"?"couplets":"pts"}</span><span class="tag">${d.format}</span><span class="tag">${d.shift_fit}</span></div>`).join("");
  const start = items.find(i=>i.week1_aids) || items.slice().sort((a,b)=>a.patient_grid-b.patient_grid)[0];
  const body = crumb([{t:"Units"},{t:UNIT[cat]}]) + `<h1>${UNIT[cat]} brain sheets</h1><p>${HUB_INTRO[cat]}</p>
<p>${items.length} builds · grid ${Math.min(...grids)}–${Math.max(...grids)} · formats: ${fmts.map(f=>FMT[f].word).join(", ")}.</p>
<p><strong>Start here:</strong> <a href="${url(start.slug)}">${esc(start.entity_name)}</a>. New to the unit? Take the orientation build first.</p>
<div class="facets"><label>Format <select data-k="format"><option value="">all</option>${fmts.map(f=>`<option value="${f}">${f}</option>`).join("")}</select></label>
<label>Shift <select data-k="shift"><option value="">all</option><option value="nights">nights</option><option value="any">any</option></select></label>
<label>Tier <select data-k="tier"><option value="">all</option><option value="deep">deep</option><option value="balanced">balanced</option><option value="grid">grid</option></select></label></div>
<div class="grid">${cards}</div><p class="scope">Organization aids, not clinical guidance. See the <a href="/glossary/">glossary</a> for terms.</p>`;
  const jsonld = [{"@context":"https://schema.org","@type":"CollectionPage",name:UNIT[cat]+" brain sheets",description:HUB_INTRO[cat]},{"@context":"https://schema.org","@type":"ItemList",itemListElement:items.map((d,i)=>({"@type":"ListItem",position:i+1,url:SITE_URL+url(d.slug),name:d.entity_name}))},bcLd([{t:"Home",href:"/"},{t:UNIT[cat]}])];
  const desc = fitMeta(`${items.length} editable ${UNIT[cat]} brain-sheet builds, grid ${Math.min(...grids)}-${Math.max(...grids)}, in ${fmts.length} formats.`);
  return { slug:"hub-"+cat, html:shell({title:UNIT[cat]+" Brain Sheets | "+BRAND, desc, slug:"hub-"+cat, body, jsonld, hub:true}) };
}

const GUIDE = {
"fillable-pdf":"A fillable PDF is the most portable editable format: any PDF app on tablet, laptop or phone takes typed input, and it prints clean on letter paper. It works fully offline, which matters on units with dead wifi. The trade-off is layout rigidity — you fill the boxes that exist; you do not rearrange them. Pick this when you want one file that survives any device and any printer.",
"google-sheets":"A Google Sheets workbook is the most flexible grid: edit cells in any browser, restructure rows, and share a copy with a preceptor. The cost is connectivity — it needs a connection or cached offline files, so a dead spot at the bedside becomes a dead sheet. Pick this when you chart at a desk with reliable wifi and want the grid to bend to your workflow.",
"excel":"An Excel workbook is a desk tool: full editing power, offline once saved locally, and familiar to anyone who lives in spreadsheets. It is cramped on a phone, so it suits laptop-or-tablet nurses rather than pocket-only workflows. Pick this when you want maximum control and your unit allows a personal device at the desk.",
"goodnotes":"A GoodNotes template is the stylus-first build: annotate with an Apple Pencil or finger on an iPad, fully offline, with the feel of paper and the undo of digital. It assumes an iPad and GoodNotes or a compatible annotation app, and it has no print layout. Pick this when you already chart on an iPad and want handwriting without losing the file.",
"print":"The print build is pen-and-paper by design: one letter B&W page, no app, no login, no battery. It is the only format that works on any unit regardless of device policy. The trade-off is zero editability — you cannot rearrange fields mid-shift. Pick this when your unit is paper-only or you simply trust ink more than a screen."};
const GUIDE_META = {
"fillable-pdf":"Fillable PDF brain sheets: type into fields on any tablet or laptop, works offline, prints clean on letter paper.",
"google-sheets":"Google Sheets brain sheets: edit cells in any browser and reshape the grid; needs a connection or cached offline files.",
"excel":"Excel brain sheets: full editing on a laptop or tablet, offline once saved; cramped on a phone.",
"goodnotes":"GoodNotes brain sheets: stylus-first on iPad, fully offline, paper feel with digital undo; no print layout.",
"print":"Printable brain sheets: one letter B&W page, pen and paper, no app or battery; works under any device policy."};
function guidePage(fmt) {
  const items = rows.filter(r=>r.format===fmt);
  const body = crumb([{t:"Formats"},{t:FMT[fmt].word}]) + `<h1>${FMT[fmt].word} brain sheets</h1><p>${GUIDE[fmt]}</p>
<h2>Builds in this format</h2><div class="grid">${items.map(d=>`<div class="card"><h3><a href="${url(d.slug)}">${esc(d.entity_name)}</a></h3><span class="tag">${d.patient_grid} pts</span><span class="tag">${UNIT[d.category]}</span></div>`).join("")}</div>
<p class="scope">Format facts are general tool behavior, not measured benchmarks. Organization aids, not clinical guidance.</p>`;
  const jsonld = [
    {"@context":"https://schema.org","@type":"Article",headline:FMT[fmt].word+" brain sheets",description:GUIDE_META[fmt]},
    bcLd([{t:"Home",href:"/"},{t:FMT[fmt].word}])
  ];
  return { slug:"guide-"+fmt, html:shell({title:FMT[fmt].word+" Brain Sheets | "+BRAND, desc:fitMeta(GUIDE_META[fmt]), slug:"guide-"+fmt, body, jsonld}) };
}

const GLOSS = [["Brain sheet","A single-page personal organizer a nurse fills during a shift to track patients, tasks and handoff. Not a legal chart and not clinical guidance."],["Report sheet","Another name for a brain sheet, emphasizing the handoff (report) it supports at change of shift."],["Handoff","The transfer of patient responsibility between nurses; the moment a brain sheet's report strip is read aloud."],["SBAR","Situation, Background, Assessment, Recommendation — a fixed handoff order from AHRQ TeamSTEPPS. See the AHRQ SBAR tool."],["Float pool","A group of nurses assigned across units as needed; their sheets must be unit-agnostic and orientation-first."],["Travel nurse","A nurse on a short contract at a new facility; week-one orientation aids matter more than deep unit detail."],["Couplet","A mother-baby pair counted as one assignment slot on postpartum; a 4-couplet grid tracks 4 pairs."],["Charge nurse","The nurse coordinating a unit's flow; a charge-nurse box holds their name and number for the shift."],["Preceptor","The nurse orienting a new hire or traveler; preceptor-questions prompts hold what to ask them."],["I/O","Intake and output — the fluids-in, fluids-out tracking block on a brain sheet."],["Telemetry block","A space to note cardiac monitoring details for a patient on a tele unit."],["Drips block","A space to list continuous infusions running for a patient; a tracking label, not dosing guidance."],["Vents block","A space to note ventilator settings for a patient; a tracking label, not clinical instruction."],["Systems report","A handoff ordered by body system rather than by task; common in stepdown and ICU."],["Head-to-toe","A documentation order that follows the assessment pass from head to feet."],["Task-list report","A handoff ordered as done / pending / next; common in high-turnover ED work."],["Fillable PDF","A PDF with typed-input fields; editable in any PDF app and printable."],["GoodNotes","An iPad annotation app used here as a stylus-first template format."],["Deep-detail tier","A brain-sheet layout for 1-2 patients with maximum per-patient room."],["Balanced tier","A layout for 3-4 patients splitting space between detail and a task strip."],["Task-grid tier","A layout for 5-8 patients with shallow lanes and short checks rows."],["EHR","The electronic health record — the legal chart; a brain sheet is a personal aid beside it, not a replacement."],["Orientation strip","The week-one boxes (phone tree, unit map, code cart, supply notes) outside the patient grid."],["Print spec","The paper size and color a build is cut for, e.g. letter B&W."]];
function glossaryPage() {
  const body = crumb([{t:"Glossary"}]) + `<h1>Brain-sheet glossary</h1><p>Plain-language terms used across the catalog. Definitions describe documentation workflow, not clinical practice.</p>
<dl class="faq">${GLOSS.map(([t,d])=>`<dt>${esc(t)}</dt><dd>${esc(d)}${t==="SBAR"?` <a href="${AHRQ}" rel="noopener">AHRQ source</a>.`:""}</dd>`).join("")}</dl>`;
  const jsonld = [
    {"@context":"https://schema.org","@type":"DefinedTermSet",name:"Brain-sheet glossary",hasDefinedTerm:GLOSS.map(([t,d])=>({"@type":"DefinedTerm",name:t,description:d}))},
    bcLd([{t:"Home",href:"/"},{t:"Glossary"}])
  ];
  return { slug:"glossary", html:shell({title:"Brain-Sheet Glossary | "+BRAND, desc:"Plain-language definitions of brain-sheet, handoff and nursing-workflow terms: SBAR, couplet, float pool, tiers, formats and orientation strips.", slug:"glossary", body, jsonld}) };
}

function homePage() {
  const cats = [...new Set(rows.map(r=>r.category))];
  const body = `<h1>Brain sheets, drawn to spec</h1>
<p class="answer">${BRAND} catalogs hyper-specific, fully editable nurse brain-sheet builds by unit, patient load, shift and format. Every page shows the actual grid as a spec drawing, the capacity math, and the three closest builds — so you pick the sheet that fits your assignment, not a generic PDF.</p>
<h2>Start here</h2><div class="grid">
<div class="card"><h3>Float or travel, week one</h3><p>Orientation-first builds with phone-tree and unit-map boxes.</p><a href="${url("hub-float-pool")}">Float-pool hub →</a></div>
<div class="card"><h3>Night shift, heavy grid</h3><p>Task-grid builds with the pending list first.</p><a href="${url("hub-med-surg")}">Med-surg hub →</a></div>
<div class="card"><h3>Format first</h3><p>Pick by device: PDF, Sheets, Excel, GoodNotes or print.</p><a href="${url("guide-fillable-pdf")}">Format guides →</a></div>
<div class="card"><h3>Not sure? Take the Finder</h3><p>Five questions → a ranked shortlist scored on fit.</p><a href="/tool/">Open the Sheet Finder →</a></div></div>
<h2>Units</h2><div class="grid">${cats.map(c=>`<div class="card"><h3><a href="${url("hub-"+c)}">${UNIT[c]}</a></h3><p>${rows.filter(r=>r.category===c).length} builds</p></div>`).join("")}</div>
<p class="scope">Organization aids, not clinical guidance; follow your facility's policy. <a href="/glossary/">Glossary</a>.</p>`;
  return { slug:"home", html:shell({title:BRAND+" — Hyper-Specific Nurse Brain Sheets", desc:fitMeta("Hyper-specific, fully editable nurse brain sheets by unit, patient load, shift and format, with spec drawings."), slug:"home", body, jsonld:[{"@context":"https://schema.org","@type":"WebSite",name:BRAND,url:SITE_URL+"/"}]}) };
}
function shopPage() {
  const list = rows.map(d=>{const o=offers[d.slug]||{};const btn=[o.checkout&&`<a class="cta" href="${o.checkout}">Get this pack</a>`,o.etsy&&`<a class="cta" href="${o.etsy}">Etsy</a>`].filter(Boolean).join("");return `<div class="card"><h3><a href="${url(d.slug)}">${esc(d.entity_name)}</a></h3><p>${esc(d.summary_fact)}</p>${btn||"<p>Checkout link not set yet.</p>"}</div>`;}).join("");
  const body = crumb([{t:"Shop"}]) + `<h1>Shop the packs</h1><p>Each pack is built to the spec on its page. Checkout and delivery are handled by the payment provider; no card data touches this site.</p><div class="grid">${list}</div>`;
  return { slug:"shop", html:shell({title:"Shop | "+BRAND, desc:fitMeta("Buy the editable brain-sheet packs; checkout and file delivery handled by the payment provider."), slug:"shop", body, jsonld:[bcLd([{t:"Home",href:"/"},{t:"Shop"}])], noindex:true}) };
}
function creditsPage() {
  const body = crumb([{t:"Credits"}]) + `<h1>Credits</h1><p>No third-party photos are published yet. All spec drawings and the logo are original ${BRAND} SVG illustrations. Photo credits will appear here when the image pipeline adds licensed photos.</p>`;
  return { slug:"credits", html:shell({title:"Credits | "+BRAND, desc:fitMeta("Image and illustration credits: every photo with creator, license and original source link."), slug:"credits", body, jsonld:[bcLd([{t:"Home",href:"/"},{t:"Credits"}])], noindex:true}) };
}
function changelogPage() {
  const body = crumb([{t:"Changelog"}]) + `<h1>Changelog</h1><ul><li><strong>${TODAY}</strong> — Wave 1: ${rows.length} entity specs, ${[...new Set(rows.map(r=>r.category))].length} unit hubs, glossary and 5 format guides published.</li></ul>`;
  return { slug:"changelog", html:shell({title:"Changelog | "+BRAND, desc:fitMeta("ShiftSpec changelog: dated wave releases, data updates and prune-or-improve decisions."), slug:"changelog", body, jsonld:[bcLd([{t:"Home",href:"/"},{t:"Changelog"}])], noindex:true}) };
}

execFileSync(process.execPath, ["scripts/homepage.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/about.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/contact.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/privacy.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/faq.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/shop.mjs"], { stdio: "inherit" });

mkdirSync(DIST, { recursive: true });
const pages = [homePage(), glossaryPage(), shopPage(), creditsPage(), changelogPage(),
  ...[...new Set(rows.map(r=>r.category))].map(hubPage),
  ...Object.keys(FMT).map(guidePage),
  ...rows.map(entityPage)];
  pageSet.add("tool"); // the Finder is built by Vite, not by shell()
function writePage(p) {
  const u = url(p.slug), dir = path.join(DIST, u);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.html"), p.html);
}
pages.forEach(writePage);
writeFileSync(path.join(DIST,"style.css"), CSS);
mkdirSync(path.join(DIST,"specs"),{recursive:true});
for (const d of all) copyFileSync(`specs/${d.slug}.md`, path.join(DIST,"specs",`${d.slug}.md`));

const errs = [];
const pubVals = d => COLS.map(c=>d[c]).join(" ");
const allowedNums = d => { const T=tokens(d); const s=new Set([...(pubVals(d).match(/\d+/g)||[]), String(T.fpp),String(T.boxes),String(T.nsec),String(d._rank),String(d._catN)]); for(const o of d._nb) for(const n of (pubVals(o).match(/\d+/g)||[])) s.add(n); return s; };
for (const p of pages) {
  const title = p.html.match(/<title>(.*?)<\/title>/)[1];
  if (title.length > 60) errs.push(`${p.slug}: title ${title.length}>60`);
  const desc = p.html.match(/name="description" content="(.*?)"/)[1];
  if (desc.length < 120 || desc.length > 160) errs.push(`${p.slug}: meta ${desc.length} outside 120-160`);
  for (const m of p.html.matchAll(/href="(\/[^"]*)"/g)) {
    const t = m[1].replace(/\/$/,"") || "/";
    const ok = [...pageSet].some(s => (url(s).replace(/\/$/,"")||"/") === t) || t==="/style.css" || t.startsWith("/specs/") || t==="/tool";
    if (!ok) errs.push(`${p.slug}: broken internal link ${m[1]}`);
  }
  for (const m of p.html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try { const j=JSON.parse(m[1]); if(!j["@type"]) errs.push(`${p.slug}: JSON-LD missing @type`); }
    catch { errs.push(`${p.slug}: invalid JSON-LD`); }
  }
  if (/undefined|\{[a-z]+\}|TODO|PLACEHOLDER/i.test(p.html)) errs.push(`${p.slug}: placeholder/undefined in output`);
}
for (const p of pages.filter(x=>x.d)) {
  const { a, m, parts, qs, d } = p;
  if (!a || wc(a)<40 || wc(a)>60) errs.push(`${d.slug}: answer word count`);
  const uw = wc(a) + parts.reduce((s,x)=>s+wc(x.t),0) + qs.reduce((s,x)=>s+wc(x.a),0);
  if (uw < 250) errs.push(`${d.slug}: unique words ${uw}<250`);
  const blob = [a,m,...parts.map(x=>x.t),...qs.map(x=>x.a)].join(" ");
  const nums = new Set(blob.match(/\d+/g)||[]);
  for (const n of nums) if (!allowedNums(d).has(n)) errs.push(`${d.slug}: untraced number ${n}`);
  if (/game-changer|nurse life|healthcare heroes/i.test(blob)) errs.push(`${d.slug}: banned phrase`);
  if (/\b\d+(\.\d+)?\s?(mg|mcg|mEq|units\/kg|ml\/hr)\b|\btitrate\b|\bnormal range\b|\bdos(e|ing)\b/i.test(blob)) errs.push(`${d.slug}: clinical firewall`);
}

writeFileSync(path.join(DIST,"matrix.json"), JSON.stringify(rows.map(d=>{ const {_nb,_rank,_catN,_fpp,_boxes,_nsec,...pub}=d; return {...pub, neighbors:_nb.map(o=>o.slug), rank:_rank, category_count:_catN, fields_per_patient:_fpp, total_spaces:_boxes, template:tplOf(d)}; }), null, 2));
const indexable = pages.filter(p=>!p.html.includes('content="noindex'));
writeFileSync(path.join(DIST,"llms.txt"), `# ${BRAND}\n> Hyper-specific, fully editable nurse brain-sheet template specs for float, travel and night-shift nurses. Organization aids, not clinical guidance.\n\n## Sections\n- Home: ${SITE_URL}/\n- Unit hubs: ${SITE_URL}/units/<unit>/\n- Format guides: ${SITE_URL}/formats/<format>/\n- Glossary: ${SITE_URL}/glossary/\n- Entity specs: ${SITE_URL}/sheets/<slug>/\n- Data: ${SITE_URL}/matrix.json\n\n## Notes\nField counts are first-party build contracts. SBAR structure cites AHRQ TeamSTEPPS. ${indexable.length} indexable pages, wave ${WAVE}.\n`);
writeFileSync(path.join(DIST,"robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
const urls = indexable.map(p=>`<url><loc>${SITE_URL+url(p.slug)}</loc><lastmod>${TODAY}</lastmod></url>`).join("") + `<url><loc>${SITE_URL}/tool/</loc><lastmod>${TODAY}</lastmod></url>`;
writeFileSync(path.join(DIST,"sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
mkdirSync("reports",{recursive:true});
const report = { date:TODAY, wave:WAVE, rows:rows.length, pages:pages.length, indexable:indexable.length, noindex:pages.filter(p=>p.html.includes('content="noindex')).map(p=>p.slug), templates:Object.fromEntries(["deep","balanced","grid","orientation"].map(t=>[t,rows.filter(r=>tplOf(r)===t).length])), errors:errs };
writeFileSync("reports/build-report.json", JSON.stringify(report,null,2));
console.log(`BUILD ${errs.length?"FAIL":"OK"} — ${pages.length} pages (${indexable.length} indexable), wave ${WAVE}`);
console.log("noindex:", report.noindex.join(", "));
console.log("templates:", JSON.stringify(report.templates));
if (SITE_URL.includes(".example")) console.log("WARN: SITE_URL is a placeholder. Set SITE_URL=https://yourdomain before deploy.");
for (const e of errs) console.log("ERR " + e);
process.exit(errs.length?1:0);