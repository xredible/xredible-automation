const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const { cookie, reportFixtures } = require("./fixtures.cjs");
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
  const p = await c.newPage();
  for (const [scheme, width] of [
    ["light", 390],
    ["light", 1366],
    ["dark", 390],
  ]) {
    await p.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await p.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await p.goto(
      "http://127.0.0.1:4332/dashboard?biz=nestoodle&view=automations",
      { waitUntil: "networkidle" },
    );
    await p.evaluate(() => document.fonts.ready);
    const colors = await p
      .getByLabel("Post title or number")
      .evaluate((e) => ({
        fg: getComputedStyle(e, "::placeholder").color,
        bg: getComputedStyle(e).backgroundColor,
        opacity: getComputedStyle(e, "::placeholder").opacity,
      }));
    assert(contrast(colors.fg, colors.bg) >= 4.5, JSON.stringify(colors));
    assert.equal(colors.opacity, "1");
    if (scheme === "dark") {
      const s = p.locator(".dash-automation-hub summary").first();
      await s.focus();
      await p.keyboard.press("Enter");
    }
    await p.screenshot({
      path: path.resolve(
        __dirname,
        "../../docs/dashboard-step3",
        scheme === "dark"
          ? "nestoodle-automations-dark-history-390.png"
          : `nestoodle-automations-${width}.png`,
      ),
      fullPage: true,
    });
  }
  await b.close();
  console.log("Title-input placeholder contrast ≥4.5:1, light and dark: pass");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
