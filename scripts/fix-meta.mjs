import { readFileSync, writeFileSync } from "node:fs";
let c = readFileSync("scripts/build.mjs", "utf8");

// 1. Fix the length check to measure the escaped text
c = c.replace(/while \(desc\.length < 120\).*?if \(desc\.length > 160\).*?\}/s, 
  `let dEsc = esc(desc);
  while (dEsc.length < 120) { desc += " Organization aids, not clinical guidance."; dEsc = esc(desc); }
  if (dEsc.length > 160) { dEsc = dEsc.slice(0, 157); dEsc = dEsc.slice(0, dEsc.lastIndexOf(" ")) + "…"; }`);

// 2. Fix the meta tag to use the pre-escaped text
c = c.replace(/<meta name="description" content="\$\{esc\(desc\)\}">/g, `<meta name="description" content="\${dEsc}">`);

// 3. Fix the Open Graph tag to use the pre-escaped text
c = c.replace(/<meta property="og:description" content="\$\{esc\(desc\)\}">/g, `<meta property="og:description" content="\${dEsc}">`);

writeFileSync("scripts/build.mjs", c);
console.log("Fix applied! Now run: npm run build");