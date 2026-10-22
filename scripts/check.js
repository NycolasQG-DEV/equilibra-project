const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      scan(filename);
    } else if (filename.endsWith(".js")) {
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

for (const directory of ["src", "public/js", "scripts", "tests"]) {
  scan(directory);
}

// ── Check for forbidden inline style= or onclick= in public/ ──
function checkNoInlineAttributes(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "vendor") {
        checkNoInlineAttributes(filename);
      }
    } else if (filename.endsWith(".js") || filename.endsWith(".html")) {
      const content = fs.readFileSync(filename, "utf8");
      const onclickMatches = content.match(/onclick=/gi);
      const styleMatches = content.match(/style=["'][^"']*["']/gi);

      if (onclickMatches) {
        console.error(`ERRO: Atributo 'onclick=' inline detectado em ${filename}`);
        process.exitCode = 1;
      }
      if (styleMatches) {
        console.error(`ERRO: Atributo 'style=' inline detectado em ${filename}`);
        process.exitCode = 1;
      }
    }
  }
}

checkNoInlineAttributes("public");

if (!process.exitCode) {
  console.log("Sintaxe JavaScript verificada. Zero atributos inline (onclick/style) em public/.");
}
