const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  Module = require("node:module");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  return original.call(
    this,
    request.startsWith("@/")
      ? path.join(__dirname, "..", request.slice(2))
      : request,
    parent,
    ...rest,
  );
};
require.extensions[".ts"] = function (module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  module._compile(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
};
