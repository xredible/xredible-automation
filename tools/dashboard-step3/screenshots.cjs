const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const { cookie, reportFixtures } = require("./fixtures.cjs");
const out = path.resolve(__dirname, "../../docs/dashboard-step3");
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const c = await b.newContext({ colorScheme: "light" });
  await c.addCookies([cookie("owner@dashboard.invalid")]);
  await reportFixtures(c);
  const p = await c.newPage();
  for (const biz of ["nestoodle", "elevating-christ"])
    for (const width of [390, 1366]) {
      await p.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const view of biz === "nestoodle"
        ? ["ap-ideas", "blog", "printables"]
        : ["ap-ideas", "printables"]) {
        await p.goto(
          `http://127.0.0.1:4332/dashboard?biz=${biz}&view=${view}`,
          { waitUntil: "networkidle" },
        );
        await p.evaluate(() => document.fonts.ready);
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await p.screenshot({
          path: path.join(out, `${biz}-content-${view}-${width}.png`),
          fullPage: true,
        });
      }
    }
  await p.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(
    "http://127.0.0.1:4332/dashboard?biz=nestoodle&view=automations",
    { waitUntil: "networkidle" },
  );
  const summary = p.locator(".dash-automation-hub summary").first();
  await summary.focus();
  await p.keyboard.press("Enter");
  assert(await summary.evaluate((e) => e.parentElement.open));
  assert(
    await summary.evaluate((e) => getComputedStyle(e).outlineStyle === "solid"),
  );
  await p.screenshot({
    path: path.join(out, "nestoodle-automations-dark-history-390.png"),
    fullPage: true,
  });
  for (const rect of await p
    .locator(
      ".dash-automation-hub button:visible,.dash-automation-hub input:visible,.dash-automation-hub summary:visible",
    )
    .evaluateAll((es) =>
      es.map((e) => ({
        w: e.getBoundingClientRect().width,
        h: e.getBoundingClientRect().height,
      })),
    ))
    assert(rect.w >= 44 && rect.h >= 44, JSON.stringify(rect));
  await b.close();
  console.log(
    "Content tab screenshots, no overflow, native History keyboard/focus, 44px automation controls and dark/reduced motion: pass",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
