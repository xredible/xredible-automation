const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { cookie, reportFixtures } = require("./fixtures.cjs");
const fs = require("node:fs");
const path = require("node:path");
const base = "http://127.0.0.1:4336";
const out = path.resolve(__dirname, "../../docs/dashboard-step5");
fs.mkdirSync(out, { recursive: true });
const cases = [];
const hubViews = {
  home: "overview",
  content: "schedule",
  results: "all-results",
  automations: "automations",
  brand: "ap-brand",
};
async function checkTargets(p) {
  const sizes = await p
    .locator(
      ".dash-bottom-tabs button:visible,.dash-hub-button:visible,.dash-subpage:visible,.dash-avatar-trigger:visible,.dash-mobile-subnav button:visible,.dash-home button:visible",
    )
    .evaluateAll((es) =>
      es.map((e) => ({
        text: e.textContent.trim(),
        w: e.getBoundingClientRect().width,
        h: e.getBoundingClientRect().height,
      })),
    );
  for (const s of sizes) {
    assert(s.w >= 44 && s.h >= 44, JSON.stringify(s));
  }
}
function contrast(a, b) {
  const rgb = (x) =>
    x.startsWith("#")
      ? x
          .slice(1)
          .match(/../g)
          .map((n) => parseInt(n, 16) / 255)
      : x
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
          .map((n) => n / 255);
  const lum = (x) =>
    rgb(x)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
      .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
async function checkContrast(p) {
  const tokens = await p.locator(".dash-root").evaluate((e) => {
    const s = getComputedStyle(e);
    return Object.fromEntries(
      [
        "ink",
        "muted",
        "faint",
        "bg",
        "panel",
        "brand",
        "brand-soft",
        "nav",
        "nav-text",
      ].map((k) => [k, s.getPropertyValue("--" + k).trim()]),
    );
  });
  for (const [a, b] of [
    ["ink", "panel"],
    ["muted", "bg"],
    ["faint", "panel"],
    ["brand", "brand-soft"],
    ["nav-text", "nav"],
  ])
    assert(
      contrast(tokens[a], tokens[b]) >= 4.5,
      `${a}/${b}: ${contrast(tokens[a], tokens[b])}`,
    );
}
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const ctx = await b.newContext({ colorScheme: "light" });
  await ctx.addCookies([cookie("owner@dashboard.invalid")]);
  await reportFixtures(ctx);
  await ctx.route("https://**", (r) => r.abort());
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  for (const biz of ["elevating-christ", "nestoodle"])
    for (const width of [390, 1366]) {
      await p.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const [hub, view] of Object.entries(hubViews)) {
        await p.goto(`${base}/dashboard?biz=${biz}&view=${view}`, {
          waitUntil: "networkidle",
        });
        await p.locator("main").waitFor();
        await p.evaluate(() => document.fonts.ready);
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${biz}/${hub}/${width} overflow`,
        );
        const nav = p.getByRole("navigation", {
          name: width === 390 ? "Workspace tabs" : "Workspace hubs",
          exact: true,
        });
        assert.equal(
          await nav.locator('button[aria-current="true"]').count(),
          1,
        );
        assert.equal(
          (await nav.locator('button[aria-current="true"]').innerText())
            .replace(/\s+/g, " ")
            .trim(),
          {
            home: "Home",
            content: "Content",
            results: "Results",
            automations: width === 390 ? "Automate" : "Automations",
            brand: width === 390 ? "More" : "Brand & settings",
          }[hub],
        );
        if (width === 1366) {
          const fits = await p
            .locator(".dash-brand-name")
            .evaluate(
              (e) =>
                e.scrollWidth <= e.clientWidth + 1 &&
                getComputedStyle(e).whiteSpace === "normal",
            );
          assert(fits, `${biz}: full desktop business name`);
        }
        await checkTargets(p);
        await checkContrast(p);
        await p.screenshot({
          path: path.join(out, `${biz}-${hub}-${width}.png`),
          fullPage: true,
        });
        cases.push(
          `${biz}/${hub}/${width}: correct hub, no overflow, 44px targets`,
        );
      }
    }
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(base + "/dashboard?biz=nestoodle&view=instagram", {
    waitUntil: "networkidle",
  });
  await p
    .getByRole("navigation", { name: "Workspace tabs", exact: true })
    .getByRole("button", { name: "Content", exact: true })
    .click();
  await p.waitForURL(/view=schedule/);
  await p
    .getByRole("navigation", { name: "Content pages", exact: true })
    .getByRole("button", { name: "Ideas", exact: true })
    .click();
  await p.waitForURL(/view=ap-ideas/);
  assert.equal(await p.getByRole("heading", { level: 1 }).innerText(), "Ideas");
  cases.push("Phone hub → existing sub-page navigation and URL: pass");
  await p
    .getByRole("button", { name: "Open account menu", exact: true })
    .click();
  await p.getByRole("button", { name: "My password", exact: true }).waitFor();
  await p.keyboard.press("Escape");
  assert(
    await p
      .getByRole("button", { name: "Open account menu", exact: true })
      .evaluate((e) => document.activeElement === e),
  );
  cases.push("Account menu Escape restores focus: pass");
  await p.keyboard.press("Tab");
  assert(
    await p.evaluate(() => {
      const e = document.activeElement;
      return getComputedStyle(e).outlineStyle !== "none";
    }),
  );
  cases.push("Visible keyboard focus: pass");
  await p
    .getByRole("button", { name: "Open account menu", exact: true })
    .click();
  await p.getByRole("button", { name: "Accounts", exact: true }).click();
  await p.getByRole("dialog").waitFor();
  await p.keyboard.press("Escape");
  cases.push("Admin Accounts remains reachable from avatar: pass");
  // Read-only legacy destinations remain attached to the correct hub, without changing server permissions.
  for (const [biz, view, hub] of [
    ["nestoodle", "ap-ideas", "Content"],
    ["nestoodle", "help", "More"],
    ["elevating-christ", "email", "Results"],
    ["elevating-christ", "automation-whatsapp", "Automate"],
  ]) {
    await p.goto(`${base}/dashboard?biz=${biz}&view=${view}`, {
      waitUntil: "networkidle",
    });
    assert.equal(
      (
        await p
          .getByRole("navigation", { name: "Workspace tabs", exact: true })
          .locator('[aria-current="true"]')
          .innerText()
      ).trim(),
      hub,
    );
  }
  cases.push("Legacy deep links select correct page + hub: pass");
  await p.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await p.goto(base + "/dashboard?biz=nestoodle&view=ap-ideas", {
    waitUntil: "networkidle",
  });
  assert.equal(
    await p
      .locator(".dash-root")
      .evaluate((e) => getComputedStyle(e).getPropertyValue("--bg").trim()),
    "#201c17",
  );
  await checkContrast(p);
  const reduced = await p
    .locator(".dash-bottom-tabs button")
    .first()
    .evaluate((e) => getComputedStyle(e).transitionDuration);
  assert.equal(reduced, "0s");
  await p.screenshot({
    path: path.join(out, "nestoodle-content-dark-390.png"),
    fullPage: true,
  });
  cases.push("Dark brand tokens and reduced motion: pass");
  const member = await b.newContext();
  await member.addCookies([cookie("member@dashboard.invalid")]);
  const mp = await member.newPage();
  await mp.goto(base + "/dashboard?biz=nestoodle&view=help", {
    waitUntil: "networkidle",
  });
  await mp
    .getByRole("button", { name: "Open account menu", exact: true })
    .click();
  assert.equal(
    await mp.getByRole("button", { name: "Accounts", exact: true }).count(),
    0,
  );
  assert.equal(
    (
      await member.request.get(
        base + "/dashboard/workspace?biz=elevating-christ",
      )
    ).status(),
    403,
  );
  cases.push(
    "Member menu hides admin; cross-business access still denied: pass",
  );
  const customer = await b.newContext();
  await customer.route("https://**", (r) => r.abort());
  await customer.addCookies([cookie("customer@dashboard.invalid")]);
  const cp = await customer.newPage();
  await cp.goto(base + "/dashboard?biz=autopilot&view=help", {
    waitUntil: "networkidle",
  });
  await cp.getByRole("heading", { name: "Help", exact: true }).waitFor();
  await cp
    .getByRole("button", { name: "Open account menu", exact: true })
    .click();
  assert.equal(
    await cp.getByRole("button", { name: "Accounts", exact: true }).count(),
    0,
  );
  await cp
    .locator(".dash-account-menu")
    .getByRole("button", { name: "Billing", exact: true })
    .waitFor();
  cases.push(
    "Autopilot customer Help/Billing remain reachable, admin hidden: pass",
  );
  assert.deepEqual(errors, []);
  cases.push(
    "Shell text contrast ≥4.5:1 (light and dark), all shell targets ≥44px",
  );
  cases.push("No browser page errors");
  fs.writeFileSync(path.join(out, "verification.txt"), cases.join("\n") + "\n");
  console.log(cases.join("\n"));
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
