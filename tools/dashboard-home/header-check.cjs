const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { cookie, reportFixtures } = require("./fixtures.cjs");
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c.addCookies([cookie("owner@dashboard.invalid")]);
  await reportFixtures(c);
  const p = await c.newPage();
  await p.goto("http://127.0.0.1:4330/dashboard?biz=nestoodle&view=schedule", {
    waitUntil: "networkidle",
  });
  await p.evaluate(() => scrollTo(0, 500));
  await p.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const got = await p.evaluate(() => ({
    scroll: scrollY,
    header: document.querySelector(".dash-shell-header").getBoundingClientRect()
      .top,
    chips: document.querySelector(".dash-mobile-subnav").getBoundingClientRect()
      .top,
  }));
  assert(got.scroll > 200, JSON.stringify(got));
  assert(Math.abs(got.header + got.scroll) < 2, JSON.stringify(got));
  assert(Math.abs(got.chips) < 2, JSON.stringify(got));
  console.log("Phone header scrolls away; page chips remain pinned: pass");
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
