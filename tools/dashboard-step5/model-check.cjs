const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
function load(file, deps = {}) {
  const m = { exports: {} };
  const code = ts.transpileModule(
    fs.readFileSync(
      path.resolve(__dirname, "../../lib/dashboard", file),
      "utf8",
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  new Function("require", "exports", code)(
    (p) => deps[p] || require(p),
    m.exports,
  );
  return m.exports;
}
const b = load("businesses.ts"),
  s = load("search-jump.ts", { "./businesses": b });
for (const biz of Object.keys(b.BUSINESSES))
  for (const admin of [true, false]) {
    const items = s.jumpEntries(biz, admin, true, (biz, v) => v);
    assert.equal(new Set(items.map((e) => e.id)).size, items.length);
    assert.deepEqual(
      items
        .filter((e) => e.view && e.biz === biz && e.kind !== "Action")
        .map((e) => e.view)
        .sort(),
      b
        .viewsOf(biz)
        .filter((v) => admin || !b.ADMIN_VIEWS.includes(v))
        .sort(),
    );
    if (!admin) {
      assert(
        !items.some(
          (e) =>
            b.ADMIN_VIEWS.includes(e.view) ||
            ["accounts", "customers"].includes(e.panel),
        ),
      );
      assert(!items.some((e) => e.target));
    }
    if (biz !== "nestoodle")
      assert(
        !items.some((e) => e.id === "action:write" || e.id === "action:images"),
      );
    assert(
      !items.some((e) =>
        /^(publish now|pause|resume|send email|delete|sign out)$/i.test(
          e.label,
        ),
      ),
    );
    assert.deepEqual(s.filterJumps(items, "zz-no-match-<script>"), []);
  }
const owner = s.jumpEntries("nestoodle", true, true, (b, v) => v);
assert.equal(s.filterJumps(owner, "WRITE")[0].id, "action:write");
assert.equal(s.filterJumps(owner, "make draft images")[0].id, "action:images");
console.log(
  "All four businesses: assigned pages, role/account gates, safe action allowlist, unique IDs, case/token matching: pass",
);
