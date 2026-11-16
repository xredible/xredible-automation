const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { cookie, reportFixtures } = require("./fixtures.cjs");
const base = "http://127.0.0.1:4330";
const out = path.resolve(__dirname, "../../docs/dashboard-home");
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c.addCookies([cookie("owner@dashboard.invalid")]);
  const control = {};
  await reportFixtures(c, control);
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  for (const biz of ["nestoodle", "elevating-christ"]) {
    await p.goto(`${base}/dashboard?biz=${biz}`, { waitUntil: "networkidle" });
    const needs = p
      .locator("section")
      .filter({ has: p.getByText("Needs you", { exact: true }) });
    await needs.getByText(`${biz} failed sample`, { exact: true }).waitFor();
    await needs.getByText(`${biz} ready sample`, { exact: true }).waitFor();
    assert.equal(await needs.locator("li").count(), 3);
    assert.equal(
      await p.getByLabel("Headline results").locator("button").count(),
      4,
    );
    const positions = await p
      .getByText("Needs you", { exact: true })
      .evaluate((e) => e.getBoundingClientRect().top);
    assert(
      positions <
        (await p
          .getByLabel("Headline results")
          .evaluate((e) => e.getBoundingClientRect().top)),
    );
    assert.equal(
      await needs.getByRole("button", { name: /Reschedule/ }).count(),
      3,
    );
    const stored = await p.evaluate(() =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(localStorage).filter(([k]) =>
            k.startsWith("xd-home-v1:"),
          ),
        ),
      ),
    );
    assert(!stored.includes("private-fixture@"));
    assert(stored.includes(biz));
    // A full new document, with every reporting request held, must show saved queue/results.
    let release;
    const gate = new Promise((r) => (release = r));
    control.wait = gate;
    await p.reload({ waitUntil: "domcontentloaded" });
    await p
      .getByText(`${biz} failed sample`, { exact: true })
      .waitFor({ timeout: 5000 });
    assert((await p.getByRole("status").innerText()).includes("Updated"));
    assert.equal(
      await p.getByLabel("Headline results").locator("button").count(),
      4,
    );
    release();
    await p.waitForLoadState("networkidle");
    control.wait = null;
  }
  // Delay a new range; keep the old figures and say which dates they describe.
  let release;
  const gate = new Promise((r) => (release = r));
  control.wait = gate;
  await p.locator(".dash-shell-tools button[aria-expanded]").first().click();
  await p.getByRole("button", { name: "Last 7 days", exact: true }).click();
  await p.getByText(/Older dates remain visible/).waitFor();
  assert.equal(
    await p.getByLabel("Headline results").locator("button").count(),
    4,
  );
  assert.equal(
    await p
      .getByText("elevating-christ failed sample", { exact: true })
      .count(),
    1,
  );
  release();
  await p.waitForLoadState("networkidle");
  control.wait = null;
  // Background failure retains successful data, with an explicit warning.
  control.fail = true;
  await p.getByRole("button", { name: "Refresh", exact: true }).click();
  await p
    .getByText("Some platforms could not refresh", { exact: true })
    .waitFor();
  assert.equal(
    await p.getByLabel("Headline results").locator("button").count(),
    4,
  );
  assert.equal(
    await p
      .getByText("elevating-christ failed sample", { exact: true })
      .count(),
    1,
  );
  await p.screenshot({
    path: path.join(out, "kept-data-refresh-failed-390.png"),
    fullPage: true,
  });
  control.wait = null;
  control.fail = false;
  // Persisted EC data must not appear for an NST-only member or another account.
  await c.addCookies([cookie("member@dashboard.invalid")]);
  control.fail = true;
  await p.goto(`${base}/dashboard?biz=elevating-christ`, {
    waitUntil: "networkidle",
  });
  assert.equal(
    await p
      .getByText("elevating-christ failed sample", { exact: true })
      .count(),
    0,
  );
  assert.equal(
    await p.getByText("nestoodle failed sample", { exact: true }).count(),
    0,
  );
  assert(
    (await p.locator(".dash-root").getAttribute("data-business")) ===
      "nestoodle",
  );
  // An expired cache and invalid JSON are ignored even if the network fails.
  await p.evaluate(() => {
    const owner = JSON.parse(
      localStorage.getItem("xd-home-v1:owner%40dashboard.invalid:nestoodle"),
    );
    for (const e of Object.values(owner)) e.at = 0;
    localStorage.setItem(
      "xd-home-v1:member%40dashboard.invalid:nestoodle",
      JSON.stringify(owner),
    );
  });
  await p.reload({ waitUntil: "networkidle" });
  assert.equal(
    await p.getByText("nestoodle failed sample", { exact: true }).count(),
    0,
  );
  await p.evaluate(() =>
    localStorage.setItem(
      "xd-home-v1:member%40dashboard.invalid:nestoodle",
      "{",
    ),
  );
  await p.reload({ waitUntil: "networkidle" });
  assert.equal(
    await p.getByText("nestoodle failed sample", { exact: true }).count(),
    0,
  );
  // Browser storage may be unavailable. Live data must still work.
  control.fail = false;
  await p.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("Storage unavailable");
    };
    Storage.prototype.setItem = () => {
      throw new Error("Storage unavailable");
    };
  });
  await p.reload({ waitUntil: "networkidle" });
  await p.getByText("nestoodle failed sample", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  await b.close();
  fs.writeFileSync(
    path.join(out, "home-checks.json"),
    JSON.stringify(
      {
        passed: [
          "Needs you: failed + overdue auto + draft due in 3 days, existing Reschedule controls",
          "four headline results after action cards",
          "persistent reload while reports are blocked",
          "subscriber table excluded from localStorage",
          "range change retains results with older-date labels",
          "refresh failure retains results with warning",
          "account and business cache isolation; member permission preserved",
          "expired / corrupt cache ignored; blocked storage falls back to live data",
        ],
        pageErrors: errors,
      },
      null,
      2,
    ) + "\n",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
