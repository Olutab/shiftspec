import { readFileSync, writeFileSync } from "node:fs";
let s = readFileSync("scripts/build.mjs", "utf8");
const before = s.length;
s = s.split(")}]})").join(")]})");
writeFileSync("scripts/build.mjs", s);
console.log("done. length before:", before, "after:", s.length);