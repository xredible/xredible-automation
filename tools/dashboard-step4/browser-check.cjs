const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const { cookie, reportFixtures } = require("./fixtures.cjs");
const base = "http://127.0.0.1:4334",
  out = path.resolve(__dirname, "../../docs/dashboard-step4");
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const c = await b.newContext({ colorScheme: "light" });
  await c.addCookies([cookie("owner@dashboard.invalid")]);
  const control = {};
  await reportFixtures(c, control);
  const p = await c.newPage(),
    errors = [],
    posts = [],
    requests = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
    if (r.url().includes("/dashboard/data?"))
      requests.push(new URL(r.url()).searchParams.toString());
  });
  const waitData = async (fn, section, extra = () => true) =>
    Promise.all([
      p.waitForResponse((r) => {
        const u = new URL(r.url());
        return (
          u.pathname === "/dashboard/data" &&
          u.searchParams.get("section") === section &&
          extra(u.searchParams)
        );
      }),
      fn(),
    ]);
  for (const biz of ["nestoodle", "elevating-christ"])
    for (const width of [390, 1366]) {
      await p.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await p.goto(
        `${base}/dashboard?biz=${biz}&view=all-results&range=90d&cmp=yoy`,
        { waitUntil: "networkidle" },
      );
      assert.equal(
        await p.getByRole("heading", { level: 1 }).innerText(),
        "Results",
      );
      assert.equal(
        await p.getByLabel("Compare with", { exact: true }).count(),
        1,
      );
      assert.equal(
        await p.getByRole("button", { name: /^Date range:/ }).count(),
        1,
      );
      const chips = p.getByRole("navigation", {
        name: "Results channels",
        exact: true,
      });
      assert(await chips.isVisible());
      assert.equal(
        await chips
          .getByRole("button", { name: "YouTube", exact: true })
          .count(),
        biz === "nestoodle" ? 0 : 1,
      );
      assert.equal(
        await chips
          .getByRole("button", { name: "All channels", exact: true })
          .getAttribute("aria-current"),
        "page",
      );
      const picker = p.getByRole("button", { name: /^Date range:/ });
      await picker.click();
      const dialog = p.getByRole("dialog", {
        name: "Choose date range",
        exact: true,
      });
      const rect = await dialog.boundingBox();
      assert(rect.x >= 0 && rect.x + rect.width <= width, JSON.stringify(rect));
      await dialog
        .getByRole("button", { name: "Last 7 days", exact: true })
        .focus();
      await p.keyboard.press("Escape");
      assert(await picker.evaluate((e) => e === document.activeElement));
      await picker.click();
      await waitData(
        () =>
          dialog
            .getByRole("button", { name: "Last 7 days", exact: true })
            .click(),
        "ga4",
        (q) => q.get("cmp") === "yoy",
      );
      await p.waitForLoadState("networkidle");
      assert(new URL(p.url()).searchParams.get("range") === "7d");
      await waitData(
        () =>
          p.getByLabel("Compare with", { exact: true }).selectOption("none"),
        "ga4",
        (q) => q.get("cmp") === "none",
      );
      await p.waitForLoadState("networkidle");
      await p.waitForFunction(
        () =>
          !document
            .querySelector(".dash-results-summary [role=status]")
            .textContent.includes("Refreshing"),
      );
      assert.equal(
        await p
          .locator(".dash-results-summary tbody tr")
          .first()
          .locator("td")
          .nth(1)
          .innerText(),
        "—",
      );
      await chips.getByRole("button", { name: "Website", exact: true }).click();
      await p.waitForURL(/view=ga4/);
      assert.equal(
        await p.getByLabel("Compare with", { exact: true }).inputValue(),
        "none",
      );
      await waitData(
        () => p.getByLabel("Device", { exact: true }).selectOption("mobile"),
        "ga4",
        (q) => q.get("device") === "mobile",
      );
      await chips.getByRole("button", { name: "Search", exact: true }).click();
      await p.waitForURL(/view=gsc/);
      assert.equal(new URL(p.url()).searchParams.get("device"), null);
      await waitData(
        () =>
          p.getByLabel("Search type", { exact: true }).selectOption("video"),
        "gsc",
        (q) => q.get("searchType") === "video",
      );
      await chips.getByRole("button", { name: "Website", exact: true }).click();
      await p.waitForURL(/view=ga4/);
      assert.equal(
        await p.getByLabel("Device", { exact: true }).inputValue(),
        "mobile",
      );
      await picker.click();
      await dialog.getByLabel("From", { exact: true }).fill("2026-11-01");
      await dialog.getByLabel("To", { exact: true }).fill("2026-11-15");
      await waitData(
        () => dialog.getByRole("button", { name: /^Apply/ }).click(),
        "ga4",
        (q) => q.get("start") === "2026-11-01" && q.get("end") === "2026-11-15",
      );
      assert.equal(new URL(p.url()).searchParams.get("range"), "custom");
      assert.equal(new URL(p.url()).searchParams.get("device"), "mobile");
      await waitData(
        () => chips.getByRole("button", { name: "Email", exact: true }).click(),
        "email",
      );
      await p.waitForURL(/view=email/);
      await waitData(
        () => p.getByLabel("Compare with", { exact: true }).selectOption("yoy"),
        "email",
        (q) => q.get("cmp") === "yoy",
      );
      await p.waitForLoadState("networkidle");
      await p
        .locator("main")
        .getByText(/last year/)
        .first()
        .waitFor({ timeout: 10000 });
    }
  await p.setViewportSize({ width: 390, height: 844 });
  control.cap = true;
  await p.goto(base + "/dashboard?biz=nestoodle&view=all-results&range=year", {
    waitUntil: "networkidle",
  });
  await p
    .locator(".dash-results-summary tr")
    .filter({
      has: p.getByRole("button", {
        name: "Pinterest impressions",
        exact: true,
      }),
    })
    .getByText(/Reported dates:/)
    .waitFor();
  control.cap = false;
  // Home and Results persist separately; summaries never persist subscriber tables.
  await p.goto(base + "/dashboard?biz=nestoodle", { waitUntil: "networkidle" });
  const saved = await p.evaluate(() =>
    localStorage.getItem("xd-home-v1:owner%40dashboard.invalid:nestoodle"),
  );
  await p
    .getByRole("navigation", { name: "Workspace tabs", exact: true })
    .getByRole("button", { name: "Results", exact: true })
    .click();
  await p.waitForURL(/view=all-results/);
  await p.waitForLoadState("networkidle");
  const cache = await p.evaluate(() => ({
    home: localStorage.getItem(
      "xd-home-v1:owner%40dashboard.invalid:nestoodle",
    ),
    results: localStorage.getItem(
      "xd-results-v1:owner%40dashboard.invalid:nestoodle",
    ),
  }));
  assert.equal(cache.home, saved);
  assert(!cache.results.includes("private-fixture@"));
  assert(!("queue" in JSON.parse(cache.results)));
  let release;
  control.wait = new Promise((r) => (release = r));
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.locator(".dash-results-summary tbody tr").first().waitFor();
  assert((await p.getByRole("status").innerText()).includes("Updated"));
  release();
  control.wait = null;
  await p.waitForLoadState("networkidle");
  control.fail = true;
  await p.getByRole("button", { name: "Refresh", exact: true }).click();
  await p
    .getByText("Some channels could not refresh", { exact: true })
    .waitFor();
  assert((await p.locator(".dash-results-summary tbody tr").count()) > 0);
  await p.screenshot({
    path: path.join(out, "results-kept-on-failure-390.png"),
    fullPage: true,
  });
  control.fail = false;
  // Legacy links, per-account isolation and unchanged server section/business guards.
  await p.goto(
    base +
      "/dashboard?biz=elevating-christ&view=youtube&range=90d&cmp=yoy&contentType=shorts",
    { waitUntil: "networkidle" },
  );
  assert.equal(
    await p
      .getByRole("navigation", { name: "Results channels", exact: true })
      .getByRole("button", { name: "YouTube", exact: true })
      .getAttribute("aria-current"),
    "page",
  );
  assert.equal(
    await p.getByLabel("Content", { exact: true }).inputValue(),
    "shorts",
  );
  await p.goto(base + "/dashboard?biz=linkedin-agency&view=results", {
    waitUntil: "networkidle",
  });
  assert.equal(
    await p.locator(".dash-root").getAttribute("data-business"),
    "linkedin-agency",
  );
  assert.equal(await p.getByLabel("Compare with", { exact: true }).count(), 1);
  assert.equal(
    await p
      .getByRole("navigation", { name: "Results channels", exact: true })
      .getByRole("button", { name: "Results", exact: true })
      .getAttribute("aria-current"),
    "page",
  );
  const member = await b.newContext();
  await member.addCookies([cookie("member@dashboard.invalid")]);
  await reportFixtures(member, { fail: true });
  const m = await member.newPage();
  await m.goto(base + "/dashboard?biz=elevating-christ&view=all-results", {
    waitUntil: "networkidle",
  });
  await m.getByText("No results loaded.", { exact: true }).waitFor();
  assert.equal(
    await m.locator(".dash-root").getAttribute("data-business"),
    "nestoodle",
  );
  assert.equal(
    await m
      .locator(".dash-results-summary tbody tr td")
      .filter({ hasText: "648" })
      .count(),
    0,
  );
  assert.equal(
    (
      await member.request.get(
        base + "/dashboard/data?biz=elevating-christ&section=ga4",
      )
    ).status(),
    403,
  );
  assert.equal(
    (
      await member.request.get(
        base + "/dashboard/data?biz=nestoodle&section=all-results",
      )
    ).status(),
    400,
  );
  const customer = await b.newContext();
  await customer.addCookies([cookie("customer@dashboard.invalid")]);
  await reportFixtures(customer);
  const cp = await customer.newPage();
  await cp.goto(base + "/dashboard?biz=autopilot&view=instagram", {
    waitUntil: "networkidle",
  });
  assert.equal(await cp.getByLabel("Compare with", { exact: true }).count(), 1);
  assert(
    await cp
      .getByRole("navigation", { name: "Results channels", exact: true })
      .isVisible(),
  );
  assert.equal(
    await cp
      .getByRole("navigation", { name: "Results channels", exact: true })
      .getByRole("button", { name: "All channels", exact: true })
      .count(),
    0,
  );
  assert.deepEqual(posts, []);
  assert.deepEqual(errors, []);
  await b.close();
  fs.writeFileSync(
    path.join(out, "feature-checks.json"),
    JSON.stringify(
      {
        passed: [
          "one date picker and compare selector in DOM at both widths",
          "popup fits phone/desktop and Escape restores focus",
          "presets/custom dates/comparison feed the same existing section queries",
          "chips preserve shared dates/comparison and separate channel filters",
          "Email comparison label follows the report response; shorter source coverage labelled",
          "Home/Results caches separate; no subscriber-table persistence; kept results on reload/failure",
          "legacy URLs; member isolation403/400; customer Results preserved",
          "zero POST requests; no page errors",
        ],
        requests,
      },
      null,
      2,
    ) + "\n",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
