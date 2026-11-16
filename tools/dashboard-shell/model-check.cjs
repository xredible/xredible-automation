const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const file = require("path").resolve(
  __dirname,
  "../../lib/dashboard/businesses.ts",
);
const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleContext = { exports: {} };
vm.runInNewContext(compiled, moduleContext);
const m = moduleContext.exports;
for (const biz of Object.keys(m.BUSINESSES)) {
  const hubs = m.hubsOf(biz);
  assert.equal(hubs.length, 5);
  const pages = hubs.flatMap((h) => h.items);
  const allowed = m.viewsOf(biz).filter((v) => !m.ADMIN_VIEWS.includes(v));
  assert.deepEqual([...pages].sort(), [...allowed].sort());
  assert.equal(new Set(pages).size, pages.length);
  for (const view of allowed) assert(m.hubOf(biz, view).items.includes(view));
  console.log(
    biz +
      ": five hubs; every allowed page maps exactly once; legacy views preserved",
  );
}
