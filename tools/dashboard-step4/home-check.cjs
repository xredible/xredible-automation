// Re-run the existing kept-Home behavior against the shared table/cache refactor.
const fs = require("node:fs"),
  path = require("node:path");
let source = fs.readFileSync(
  path.join(__dirname, "../dashboard-home/browser-check.cjs"),
  "utf8",
);
source = source
  .replaceAll("127.0.0.1:4330", "127.0.0.1:4334")
  .replaceAll("../../docs/dashboard-home", "../../docs/dashboard-step4");
new Function("require", "__dirname", source)(require, __dirname);
