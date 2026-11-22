// Read-only probe: what photos does Wikimedia Commons have for our hub pages?
// No downloads, no installs, no changes to your site. Just looks and reports.
const UA = "ShiftSpec-PhotoProbe/1.0 (checking available images; contact: site owner)";
const PAGES = [
  ["home", "hospital corridor empty", "corridor", "hospital"],
  ["glossary", "hospital ward interior", "ward", "hospital"],
  ["hub-med-surg", "hospital ward corridor", "corridor", "hospital"],
  ["hub-telemetry", "hospital monitoring room", "room", "hospital"],
  ["hub-stepdown", "hospital intermediate care room", "room", "hospital"],
  ["hub-icu", "intensive care unit hospital room", "room", "intensive care"],
  ["hub-nicu", "neonatal intensive care unit hospital", "unit", "neonatal"],
  ["hub-l-and-d", "hospital delivery room", "room", "hospital"],
  ["hub-postpartum", "hospital postpartum room", "room", "hospital"],
  ["hub-peds", "children hospital ward", "ward", "hospital"],
  ["hub-ed", "emergency department hospital corridor", "corridor", "emergency"],
  ["hub-float-pool", "nurses station hospital", "station", "nurses"],
];
const AVOID = ["patient","person","people","face","crowd","portrait","doctor","baby","infant","child","family","body","birth"];
const strip = s => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
function licenseOK(l) {
  l = l.toLowerCase();
  if (/nc|nd|non-commercial|no derivative|all rights reserved/.test(l)) return false;
  return /public domain|pd-old|pd-self|cc0|cc by/.test(l);
}
async function search(q) {
  const url = "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch="
    + encodeURIComponent("filetype:bitmap " + q)
    + "&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*";
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  return Object.values(data?.query?.pages || {});
}
let clean = 0;
for (const [slug, q, head, ctx] of PAGES) {
  try {
    const pages = await search(q);
    let found = null;
    for (const p of pages) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const em = ii.extmetadata || {};
      const lic = strip(em.LicenseShortName?.value || em.UsageTerms?.value || "");
      const text = (strip(p.title) + " " + strip(em.ImageDescription?.value)).toLowerCase();
      if (!licenseOK(lic)) continue;
      if (!text.includes(head)) continue;
      if (!text.includes(ctx)) continue;
      if (AVOID.some(a => text.includes(a))) continue;
      found = { title: strip(p.title).replace(/^File:/, ""), lic };
      break;
    }
    if (found) { clean++; console.log(`OK   ${slug}: "${found.title}" (${found.lic})`); }
    else console.log(`NONE ${slug}: no clean match for "${q}"`);
  } catch (e) {
    console.log(`ERR  ${slug}: network problem (${e.message})`);
  }
  await sleep(1000);
}
console.log(`\n${clean} of ${PAGES.length} hub queries have at least one clean, licensed, people-free match.`);
console.log(clean >= 8
  ? "Good coverage — we can fetch real photos next (your call)."
  : "Thin coverage — recommend keeping the clean SVG look (already approved), or adding free Pexels/Unsplash/Pixabay keys.");