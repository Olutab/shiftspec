import { readFileSync, writeFileSync } from "node:fs";

// Read your build script
let code = readFileSync("scripts/build.mjs", "utf8");

// Find the problematic backticks and replace them with safe single quotes
code = code.replace(
  /href=`\/sheets\/\${r.slug}\/`/g, 
  "href=\\'/sheets/\\'+r.slug+\\'/\\'"
);

// Save the fixed script
writeFileSync("scripts/build.mjs", code);
console.log("✅ Fixed! The syntax error is gone. Now run: npm run build");