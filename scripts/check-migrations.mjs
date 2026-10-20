import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("Tesbo-Backend-Nest/migrations");
const files = fs.readdirSync(dir).filter(name => name.endsWith(".sql"));
const versions = new Map();
for (const name of files) {
  const m = /^V([1-9]\d*)_[a-zA-Z0-9_]+\.sql$/.exec(name);
  if (!m) {
    console.error("Invalid SQL migration filename:", name);
    process.exitCode = 1;
    continue;
  }
  const version = Number(m[1]);
  if (versions.has(version)) {
    console.error(`Duplicate migration version V${version}: ${versions.get(version)} and ${name}`);
    process.exitCode = 1;
  }
  versions.set(version, name);
  if (!fs.readFileSync(path.join(dir, name), "utf8").trim()) {
    console.error("Empty SQL migration:", name);
    process.exitCode = 1;
  }
}
const sorted = [...versions.keys()].sort((a,b)=>a-b);
for (let v=1;v<=Math.max(0,...sorted);v++) {
  if (!versions.has(v)) {
    console.error(`Gap in migration sequence: V${v}`);
    process.exitCode = 1;
  }
}
if (!process.exitCode) console.log(`Validated ${versions.size} non-empty SQL migrations V1..V${Math.max(...sorted)}.`);
