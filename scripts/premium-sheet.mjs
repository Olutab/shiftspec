import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("dist/premium-sheet", { recursive: true });

const PHASES = [
  ["Pre-shift", "Review assignments, labs and med times due, scan overnight events."],
  ["Start-of-shift", "Baseline vitals, introduce yourself, locate supplies and lines."],
  ["Mid-shift", "Reassess priorities, chart what is overdue, anticipate discharges."],
  ["Pre-handoff", "Update totals, flag unresolved items, draft your report."],
  ["Handoff", "Give SBAR at the bedside, confirm every question is answered."],
  ["Post-shift", "Debrief yourself, restock, note one improvement for next time."]
];
const LANES = [
  ["#9A3412", "RED — act now", "Unstable vitals, new orders, time-critical meds this hour."],
  ["#B45309", "AMBER — this shift", "Must finish before handoff, not this minute."],
  ["#047857", "GREEN — routine", "Scheduled checks and documentation on normal cadence."],
  ["#334155", "SLATE — delegate / defer", "Pass it on or let it wait for the next phase."]
];

function phaseCards() {
  return PHASES.map((p, i) =>
    `<div class="phase"><div class="phead"><input type="checkbox" data-c="ph${i}"><strong>${p[0]}</strong></div><p class="focus">${p[1]}</p><div class="f notes" data-f="phn${i}" contenteditable="true"></div></div>`
  ).join("");
}
function laneRows(color, i) {
  let rows = "";
  for (let r = 0; r < 3; r++) {
    rows += `<div class="task"><span class="f room" data-f="l${i}r${r}a" contenteditable="true"></span><span class="f what" data-f="l${i}r${r}b" contenteditable="true"></span><span class="f time" data-f="l${i}r${r}c" contenteditable="true"></span></div>`;
  }
  return rows;
}
function lanes() {
  return LANES.map((L, i) =>
    `<div class="lane" style="--lane:${L[0]}"><div class="lhead"><span class="swatch"></span><strong>${L[1]}</strong><em>${L[2]}</em></div>${laneRows(L[0], i)}</div>`
  ).join("");
}
function patientCols() {
  let cols = "";
  for (let c = 0; c < 5; c++) {
    cols += `<div class="pcol"><div class="f pt" data-f="p${c}a" contenteditable="true"></div>
      <label>Room / Pt</label><div class="f" data-f="p${c}b" contenteditable="true"></div>
      <label>Status / code</label><div class="f" data-f="p${c}c" contenteditable="true"></div>
      <label>Lines / drips</label><div class="f" data-f="p${c}d" contenteditable="true"></div>
      <label>Vitals due</label><div class="f" data-f="p${c}e" contenteditable="true"></div>
      <label>Meds / times</label><div class="f" data-f="p${c}f" contenteditable="true"></div>
      <label>I/O</label><div class="f" data-f="p${c}g" contenteditable="true"></div>
      <label>Tasks / notes</label><div class="f tall" data-f="p${c}h" contenteditable="true"></div></div>`;
  }
  return cols;
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,follow">
<title>Master Shift Command Center — Live Sheet</title>
<style>
:root{--ink:#182430;--rule:#C9D4DE;--accent:#0B5FA5}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:#EEF1F4;color:var(--ink);font:14px/1.45 "Public Sans",system-ui,sans-serif}
.toolbar{position:sticky;top:0;z-index:5;background:#182430;color:#E8EEF4;padding:.6rem 1rem;display:flex;gap:.6rem;align-items:center}
.toolbar button{font:700 .85rem sans-serif;padding:.5rem 1rem;border-radius:6px;border:0;background:#7FB4E8;color:#182430;cursor:pointer}
.toolbar .hint{font-size:.8rem;opacity:.8;margin-left:auto}
.sheet{max-width:1000px;margin:1rem auto;background:#fff;border:1px solid var(--rule);padding:1.2rem}
.cover{border:3px solid var(--ink);padding:1rem;margin-bottom:1rem}
.cover h1{margin:0 0 .2rem;font-size:1.5rem}
.cover .brand{font:700 .8rem monospace;color:var(--accent);letter-spacing:.12em}
.meta{display:flex;flex-wrap:wrap;gap:.8rem;margin-top:.6rem}
.meta div{flex:1;min-width:120px}
.meta label{display:block;font:700 .68rem monospace;color:var(--accent)}
.f{border-bottom:1px solid var(--rule);min-height:1.4em;padding:.15rem .2rem}
.f:focus{outline:2px solid var(--accent);background:#F3F7FB}
h2{font-size:1rem;margin:1.2rem 0 .5rem;border-bottom:2px solid var(--ink);padding-bottom:.2rem}
.timeline{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem}
.phase{border:1px solid var(--rule);border-radius:6px;padding:.5rem}
.phead{display:flex;gap:.4rem;align-items:center}
.focus{font-size:.75rem;opacity:.75;margin:.2rem 0}
.notes{min-height:2.2em;font-size:.85rem}
.lane{border:1px solid var(--rule);border-left:6px solid var(--lane);border-radius:4px;padding:.5rem;margin-bottom:.6rem}
.lhead{display:flex;gap:.5rem;align-items:baseline;flex-wrap:wrap}
.swatch{width:14px;height:14px;background:var(--lane);border-radius:3px;display:inline-block}
.lhead em{font-size:.72rem;opacity:.75;font-style:normal}
.task{display:grid;grid-template-columns:90px 1fr 70px;gap:.5rem;margin-top:.3rem}
.task .f{font-size:.85rem}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:.5rem}
.pcol{border:1px solid var(--rule);border-radius:4px;padding:.4rem}
.pcol .pt{font-weight:700;border-bottom:2px solid var(--accent);margin-bottom:.3rem}
.pcol label{display:block;font:700 .62rem monospace;color:var(--accent);margin-top:.3rem}
.pcol .f{font-size:.8rem;min-height:1.3em}
.pcol .tall{min-height:3.5em}
.dump .f{min-height:5em}
.sbar{display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem}
.sbar .f{min-height:4em;font-size:.85rem}
.sbar label{font:700 .7rem monospace;color:var(--accent)}
footer{margin-top:1rem;font-size:.75rem;opacity:.7;display:flex;justify-content:space-between}
.pagebreak{page-break-before:always}
@media print{.toolbar{display:none}body{background:#fff}.sheet{border:0;margin:0;max-width:none}}
</style></head><body>
<div class="toolbar no-print"><button id="print">Print / Save as PDF</button><button id="clear">Clear sheet</button><span class="hint">Auto-saves in this browser as you type.</span></div>
<div class="sheet">
<header class="cover"><span class="brand">SHIFTSPEC · MASTER SERIES</span><h1>The Master Shift Command Center</h1>
<div class="meta">
<div><label>NURSE</label><div class="f" data-f="nurse" contenteditable="true"></div></div>
<div><label>UNIT</label><div class="f" data-f="unit" contenteditable="true"></div></div>
<div><label>DATE</label><div class="f" data-f="date" contenteditable="true"></div></div>
<div><label>SHIFT</label><div class="f" data-f="shift" contenteditable="true"></div></div>
<div><label>LOAD</label><div class="f" data-f="load" contenteditable="true"></div></div>
</div></header>
<h2>1 · Shift phase timeline</h2><div class="timeline">${phaseCards()}</div>
<div class="pagebreak"></div>
<h2>2 · Color-coded priority board</h2>${lanes()}
<h2>3 · Assignment grid</h2><div class="grid">${patientCols()}</div>
<div class="pagebreak"></div>
<h2>4 · Brain dump / overflow</h2><div class="dump"><div class="f" data-f="dump" contenteditable="true"></div></div>
<h2>5 · Handoff (SBAR)</h2><div class="sbar">
<div><label>SITUATION</label><div class="f" data-f="sbar-s" contenteditable="true"></div></div>
<div><label>BACKGROUND</label><div class="f" data-f="sbar-b" contenteditable="true"></div></div>
<div><label>ASSESSMENT</label><div class="f" data-f="sbar-a" contenteditable="true"></div></div>
<div><label>RECOMMENDATION</label><div class="f" data-f="sbar-r" contenteditable="true"></div></div>
</div>
<footer><span>Organization aid — not clinical guidance. Follow your facility's protocol.</span><span>shiftspec.vercel.app/premium</span></footer>
</div>
<script>
var KEY="shiftspec-master-v1";
function load(){try{var d=JSON.parse(localStorage.getItem(KEY)||"{}");
document.querySelectorAll("[data-f]").forEach(function(el){var v=d[el.getAttribute("data-f")];if(v!=null)el.textContent=v;});
document.querySelectorAll("[data-c]").forEach(function(el){el.checked=d[el.getAttribute("data-c")]===1;});}catch(e){}}
function save(){var d={};
document.querySelectorAll("[data-f]").forEach(function(el){d[el.getAttribute("data-f")]=el.textContent;});
document.querySelectorAll("[data-c]").forEach(function(el){d[el.getAttribute("data-c")]=el.checked?1:0;});
localStorage.setItem(KEY,JSON.stringify(d));}
document.addEventListener("input",save);
document.addEventListener("change",save);
document.getElementById("print").onclick=function(){window.print();};
document.getElementById("clear").onclick=function(){if(confirm("Clear everything on this sheet?")){localStorage.removeItem(KEY);location.reload();}};
load();
</script>
</body></html>`;

writeFileSync("dist/premium-sheet/index.html", html);
console.log("✓ Premium product sheet written to dist/premium-sheet/index.html");