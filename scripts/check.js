const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(filename);
    else if (filename.endsWith(".js")) {
      const result = spawnSync(process.execPath, ["--check", filename], {
        encoding: "utf8",
      });
      if (result.status !== 0) {
        console.error(result.stderr);
        process.exitCode = 1;
      }
    }
  }
}
for (const directory of ["src", "public/js", "scripts", "tests"])
  scan(directory);
if (!process.exitCode) console.log("Sintaxe JavaScript verificada.");
