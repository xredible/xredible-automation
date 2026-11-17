// Reuse the parity gateway with independent in-memory state and richer read-only blog fixtures.
const fs = require("node:fs");
const path = require("node:path");
const { posts } = require("./fixtures.cjs");
let source = fs.readFileSync(
  path.join(__dirname, "../dashboard-parity/fixture-gateway.cjs"),
  "utf8",
);
source = source
  .replace("posts: [],", `posts: ${JSON.stringify(posts)},`)
  .replace(".listen(4311,", ".listen(4361,")
  .replace(
    "Fixture gateway ready on 4311",
    "Step 5 fixture gateway ready on 4361",
  )
  .replace(
    "const range = {",
    `db.nst_dashboard.push({id: id++, key: "errors:publisher", value: JSON.stringify([{at:now,message:"Fixture: a post needs image review."}])});\nconst range = {`,
  )
  .replace(
    'lastRun: { at: now, status: "success" },',
    'lastRun: { at: now, status: "success" }, schedules: [{cron:"0 * * * *",timezone:"Asia/Kolkata"}],',
  );
new Function("require", source)(require);
