const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const { cookie, reportFixtures } = require("./fixtures.cjs");
const out = path.resolve(__dirname, "../../docs/dashboard-step4");
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const c = await b.newContext({ colorScheme: "light" });
  await c.addCookies([cookie("owner@dashboard.invalid")]);
  await reportFixtures(c);
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  for (const biz of ["nestoodle", "elevating-christ"])
    for (const width of [390, 1366]) {
      await p.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const view of [
        "all-results",
        "instagram",
        "facebook",
        ...(biz === "elevating-christ" ? ["youtube"] : []),
        "pinterest",
        "ga4",
        "sessions",
        "gsc",
        "email",
        "ads",
        ...(biz === "nestoodle" ? ["adsense"] : []),
      ]) {
        await p.goto(
          `http://127.0.0.1:4334/dashboard?biz=${biz}&view=${view}&cmp=yoy`,
          { waitUntil: "networkidle" },
        );
        await p.evaluate(() => document.fonts.ready);
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${biz}/${view}/${width}`,
        );
        assert.equal(
          await p.getByLabel("Compare with", { exact: true }).count(),
          1,
        );
        assert.equal(
          await p.getByRole("button", { name: /^Date range:/ }).count(),
          1,
        );
        for (const rect of await p
          .locator(
            ".dash-results-chips button:visible,.dash-results-controls button:visible,.dash-results-controls select:visible",
          )
          .evaluateAll((es) =>
            es.map((e) => ({
              w: e.getBoundingClientRect().width,
              h: e.getBoundingClientRect().height,
            })),
          ))
          assert(rect.w >= 44 && rect.h >= 44, JSON.stringify(rect));
        if (width === 390) {
          const visible = await p
            .locator('.dash-results-chips button[aria-current="page"]')
            .evaluate((e) => {
              const r = e.getBoundingClientRect();
              return r.left >= 0 && r.right <= innerWidth;
            });
          assert(visible, `${biz}/${view}: selected chip visible on phone`);
        }
        await p.screenshot({
          path: path.join(out, `${biz}-results-${view}-${width}.png`),
          fullPage: true,
        });
      }
    }
  await p.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto("http://127.0.0.1:4334/dashboard?biz=nestoodle&view=ga4", {
    waitUntil: "networkidle",
  });
  await p.getByRole("button", { name: /^Date range:/ }).click();
  await p.screenshot({
    path: path.join(out, "nestoodle-results-dark-date-picker-390.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await b.close();
  console.log(
    "Every assigned Results channel at 390/1366px: one date/compare, 44px targets, no overflow/page errors; dark/reduced-motion date picker: pass",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
