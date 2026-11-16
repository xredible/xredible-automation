const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  path = require("node:path");
const { cookie, reportFixtures } = require("./fixtures.cjs");
const out = path.resolve(__dirname, "../../docs/dashboard-step5");
function contrast(a, b) {
  const lum = (c) =>
    c
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const c = await b.newContext({ colorScheme: "light" });
  await c.addCookies([cookie("owner@dashboard.invalid")]);
  await reportFixtures(c);
  await c.route("https://**", (r) => r.abort());
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  async function check() {
    const d = p.locator(".dash-search-dialog");
    const rect = await d.boundingBox();
    const size = p.viewportSize();
    assert(
      rect.x >= 0 &&
        rect.y >= 0 &&
        rect.x + rect.width <= size.width + 1 &&
        rect.y + rect.height <= size.height + 1,
      JSON.stringify(rect),
    );
    for (const s of await d
      .locator("button,input")
      .evaluateAll((es) =>
        es.map((e) => ({
          w: e.getBoundingClientRect().width,
          h: e.getBoundingClientRect().height,
        })),
      ))
      assert(s.w >= 44 && s.h >= 44, JSON.stringify(s));
    const colors = await d.evaluate((e) => ({
      panel: getComputedStyle(e).backgroundColor,
      placeholder: getComputedStyle(e.querySelector("input"), "::placeholder")
        .color,
      fg: getComputedStyle(e.querySelector('[aria-selected="true"]')).color,
      bg: getComputedStyle(e.querySelector('[aria-selected="true"]'))
        .backgroundColor,
    }));
    assert(
      contrast(colors.placeholder, colors.panel) >= 4.5,
      JSON.stringify(colors),
    );
    assert(contrast(colors.fg, colors.bg) >= 4.5, JSON.stringify(colors));
  }
  for (const biz of ["nestoodle", "elevating-christ"])
    for (const width of [390, 1366]) {
      await p.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await p.goto(`http://127.0.0.1:4336/dashboard?biz=${biz}`, {
        waitUntil: "networkidle",
      });
      await p
        .getByRole("button", { name: "Search pages and actions", exact: true })
        .click();
      await p.locator(".dash-search-dialog[open]").waitFor();
      await p.evaluate(() => document.fonts.ready);
      await check();
      await p.screenshot({
        path: path.join(out, `${biz}-search-pages-${width}.png`),
      });
      await p
        .getByRole("combobox", { name: "Find a page or action" })
        .fill(biz === "nestoodle" ? "draft" : "idea");
      await check();
      await p.screenshot({
        path: path.join(out, `${biz}-search-actions-${width}.png`),
      });
      await p
        .getByRole("combobox", { name: "Find a page or action" })
        .fill("zz-no-match");
      await p.getByText(new RegExp(`No matches in`)).waitFor();
      await p.screenshot({
        path: path.join(out, `${biz}-search-empty-${width}.png`),
      });
      await p.keyboard.press("Escape");
      await p.goto(`http://127.0.0.1:4336/dashboard?biz=${biz}&view=email`, {
        waitUntil: "networkidle",
      });
      await p
        .getByRole("button", { name: "CSV", exact: true })
        .first()
        .waitFor();
      await p.keyboard.press("Control+k");
      await p
        .getByRole("combobox", { name: "Find a page or action" })
        .fill("csv");
      await check();
      await p.screenshot({
        path: path.join(out, `${biz}-search-csv-${width}.png`),
      });
      await p.mouse.click(2, 2);
      await p.locator(".dash-search-dialog").waitFor({ state: "detached" });
    }
  await p.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto("http://127.0.0.1:4336/dashboard?biz=nestoodle", {
    waitUntil: "networkidle",
  });
  await p.keyboard.press("Control+k");
  await p
    .getByRole("combobox", { name: "Find a page or action" })
    .fill("draft");
  await check();
  await p.screenshot({ path: path.join(out, "nestoodle-search-dark-390.png") });
  await p.setViewportSize({ width: 390, height: 430 });
  await p.getByRole("combobox", { name: "Find a page or action" }).fill("");
  await p.keyboard.press("Control+End");
  await p.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await check();
  await p.screenshot({
    path: path.join(out, "search-small-viewport-390x430.png"),
  });
  assert.deepEqual(errors, []);
  await b.close();
  console.log(
    "Search screenshots: both businesses390/1366, pages/actions/empty/CSV; light/dark contrast≥4.5;44px; backdrop; reduced motion and small viewport bounds: pass",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
