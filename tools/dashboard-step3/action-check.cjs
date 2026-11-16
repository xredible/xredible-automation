// Run the existing action contract suite against this layout without replacing its evidence.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
let source = fs.readFileSync(
  path.join(__dirname, "../dashboard-parity/browser-check.cjs"),
  "utf8",
);
source = source
  .replaceAll("127.0.0.1:4310", "127.0.0.1:4332")
  .replace(
    'require("path").resolve(__dirname, "../../docs/dashboard-parity")',
    JSON.stringify(path.join(os.tmpdir(), "dashboard-step3-action-screens")),
  )
  .replaceAll("WordPress post number", "Post title or number")
  .replace(
    'getByText("Sample owner image task", { exact: false })',
    'getByText("Sample owner image task · #420", { exact: true })',
  );
new Function("require", source)(require);
