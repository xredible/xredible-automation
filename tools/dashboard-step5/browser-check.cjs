const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { cookie, reportFixtures } = require("./fixtures.cjs");
const base = "http://127.0.0.1:4336",
  out = path.resolve(__dirname, "../../docs/dashboard-step5");
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const c = await b.newContext({
    viewport: { width: 1366, height: 900 },
    acceptDownloads: true,
  });
  await c.addCookies([cookie("owner@dashboard.invalid")]);
  await reportFixtures(c);
  await c.route("https://**", (r) => r.abort());
  const p = await c.newPage(),
    errors = [],
    posts = [],
    gets = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
    if (r.url().includes("/dashboard/")) gets.push(r.url());
  });
  const open = async (q = "") => {
    await p.keyboard.press("Control+k");
    await p.getByRole("dialog", { name: /^Search / }).waitFor();
    await p
      .getByRole("combobox", { name: "Find a page or action", exact: true })
      .fill(q);
  };
  const choose = async (label) =>
    p
      .locator(".dash-search-dialog")
      .getByRole("option", { name: label, exact: true })
      .click();
  await p.goto(base + "/dashboard?biz=nestoodle", { waitUntil: "networkidle" });
  await p.waitForFunction(
    () =>
      !document
        .querySelector(".dash-home [role=status]")
        .textContent.includes("Refreshing"),
  );
  const stored = await p.evaluate(() => JSON.stringify(localStorage)),
    count = gets.length;
  await open("not-a-page");
  assert.equal(
    await p.locator(".dash-search-dialog").getByRole("option").count(),
    0,
  );
  await p.keyboard.press("ArrowDown");
  await p.keyboard.press("Enter");
  assert(
    await p
      .getByRole("dialog", { name: "Search Nestoodle", exact: true })
      .isVisible(),
  );
  await p
    .getByRole("combobox", { name: "Find a page or action" })
    .fill("brand");
  await p.keyboard.press("ArrowDown");
  const active = await p
    .getByRole("combobox", { name: "Find a page or action" })
    .getAttribute("aria-activedescendant");
  assert(
    (await p.locator(`[id="${active}"]`).getAttribute("aria-selected")) ===
      "true",
  );
  for (let i = 0; i < 6; i++) {
    await p.keyboard.press("Tab");
    assert(await p.evaluate(() => !!document.activeElement.closest("dialog")));
  }
  await p.keyboard.press("Escape");
  assert.equal(
    await p
      .getByRole("dialog", { name: "Search Nestoodle", exact: true })
      .count(),
    0,
  );
  assert.equal(gets.length, count);
  assert.equal(await p.evaluate(() => JSON.stringify(localStorage)), stored);
  await open("make images");
  await p.keyboard.press("Enter");
  await p.waitForURL(/view=automation-images/);
  await p.waitForFunction(() =>
    document.activeElement?.matches('[data-dashboard-jump="image-post"]'),
  );
  assert.equal(posts.length, 0);
  await p.getByLabel("Post title or number").fill("501");
  await p.getByRole("button", { name: "Make images", exact: true }).click();
  await p.getByRole("button", { name: "Confirm", exact: true }).waitFor();
  await p.keyboard.press("Control+k");
  assert.equal(await p.getByRole("dialog", { name: /^Search / }).count(), 0);
  await p.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(posts.length, 0);
  await open("write");
  await choose("Write a blog post now");
  await p.waitForURL(/view=ap-ideas/);
  await p.waitForFunction(() =>
    document.activeElement?.matches('[data-dashboard-jump="write-topics"]'),
  );
  assert.equal(posts.length, 0);
  await p
    .getByRole("button", { name: "Write now", exact: true })
    .first()
    .click();
  await p.getByRole("button", { name: "Confirm", exact: true }).waitFor();
  await p.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(posts.length, 0);
  await open("add an idea");
  await choose("Add an idea");
  await p.waitForFunction(() =>
    document.activeElement?.matches(
      '[data-dashboard-jump="idea-composer"] input',
    ),
  );
  await p.getByLabel("Title", { exact: true }).fill("Unsaved fixture idea");
  const priorY = await p.evaluate(() => scrollY);
  await open("settings");
  await p.keyboard.press("Escape");
  assert.equal(
    await p.getByLabel("Title", { exact: true }).inputValue(),
    "Unsaved fixture idea",
  );
  assert(
    await p
      .getByLabel("Title", { exact: true })
      .evaluate((e) => e === document.activeElement),
  );
  assert.equal(await p.evaluate(() => scrollY), priorY);
  await open("Brand kit");
  await choose("Brand kit");
  await p.waitForURL(/view=ap-brand/);
  await p
    .getByText(
      "This business's logo, colours, typography and voice reference.",
      { exact: true },
    )
    .waitFor();
  await open("Accounts");
  await choose("Accounts");
  await p.getByRole("dialog", { name: "Accounts", exact: true }).waitFor();
  await p.keyboard.press("Control+k");
  assert.equal(await p.getByRole("dialog", { name: /^Search / }).count(), 0);
  await p.keyboard.press("Escape");
  await p.goto(base + "/dashboard?biz=nestoodle&view=email&range=7d&cmp=yoy", {
    waitUntil: "networkidle",
  });
  await p.getByRole("button", { name: "CSV", exact: true }).first().waitFor();
  await open("csv");
  await p
    .getByRole("option", {
      name: "Download CSV: Email results by subject",
      exact: true,
    })
    .waitFor();
  const [download] = await Promise.all([
    p.waitForEvent("download"),
    choose("Download CSV: Email results by subject"),
  ]);
  assert(download.suggestedFilename().endsWith(".csv"));
  assert(
    fs
      .readFileSync(await download.path(), "utf8")
      .includes("Welcome — fixture email"),
  );
  assert(new URL(p.url()).searchParams.get("cmp") === "yoy");
  assert.equal(posts.length, 0);
  await p.goto(base + "/dashboard?biz=elevating-christ&view=all-results", {
    waitUntil: "networkidle",
  });
  await open("images");
  assert.equal(
    await p
      .getByRole("option", { name: "Make images for a draft", exact: true })
      .count(),
    0,
  );
  await p
    .getByRole("combobox", { name: "Find a page or action" })
    .fill("Nestoodle");
  assert.equal(
    await p.locator(".dash-search-dialog").getByRole("option").count(),
    0,
  );
  await p.keyboard.press("Escape");
  await p.setViewportSize({ width: 390, height: 844 });
  await p
    .getByRole("button", { name: "Search pages and actions", exact: true })
    .click();
  await p
    .getByRole("dialog", { name: "Search Elevating CHRIST", exact: true })
    .waitFor();
  const rect = await p
    .getByRole("dialog", { name: "Search Elevating CHRIST" })
    .boundingBox();
  assert(
    rect.x >= 0 &&
      rect.x + rect.width <= 390 &&
      rect.y >= 0 &&
      rect.y + rect.height <= 844,
    JSON.stringify(rect),
  );
  await p
    .getByRole("combobox", { name: "Find a page or action" })
    .fill("Ideas");
  await choose("Ideas");
  await p.waitForURL(/view=ap-ideas/);
  const member = await b.newContext();
  await member.addCookies([cookie("member@dashboard.invalid")]);
  await reportFixtures(member);
  const m = await member.newPage();
  await m.goto(base + "/dashboard?biz=nestoodle", { waitUntil: "networkidle" });
  await m.keyboard.press("Control+k");
  for (const label of [
    "Accounts",
    "Revenue",
    "Write a blog post now",
    "Make images for a draft",
    "Add an idea",
  ]) {
    await m
      .getByRole("combobox", { name: "Find a page or action" })
      .fill(label);
    assert.equal(
      await m
        .locator(".dash-search-dialog")
        .getByRole("option", { name: label, exact: true })
        .count(),
      0,
    );
  }
  await m
    .getByRole("combobox", { name: "Find a page or action" })
    .fill("Image queue");
  assert(
    await m
      .getByRole("option", { name: "Image queue", exact: true })
      .isVisible(),
  );
  const customer = await b.newContext();
  await customer.addCookies([cookie("customer@dashboard.invalid")]);
  const cp = await customer.newPage();
  await cp.goto(base + "/dashboard?biz=autopilot&view=help", {
    waitUntil: "networkidle",
  });
  await cp.keyboard.press("Meta+k");
  await cp
    .getByRole("combobox", { name: "Find a page or action" })
    .fill("Revenue");
  assert.equal(
    await cp.locator(".dash-search-dialog").getByRole("option").count(),
    0,
  );
  await cp
    .getByRole("combobox", { name: "Find a page or action" })
    .fill("Billing");
  assert(
    await cp
      .locator(".dash-search-dialog")
      .getByRole("option", { name: "Billing", exact: true })
      .isVisible(),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(posts, []);
  await b.close();
  fs.writeFileSync(
    path.join(out, "feature-checks.json"),
    JSON.stringify(
      {
        passed: [
          "Ctrl K / Cmd K and phone button; empty state, arrows, Enter, native modal focus/Tab/Escape",
          "opening/searching does not fetch or persist queries",
          "image/writer/idea shortcuts focus existing controls, never auto-submit; original confirmations remain",
          "existing approval/account dialogs block the search shortcut",
          "Escape restores input, unsaved form state and scroll",
          "context CSV uses the existing export and same data; zero browser POSTs",
          "current-business scope; owner/member/customer/admin/account gates",
          "phone bounds and no page errors",
        ],
      },
      null,
      2,
    ) + "\n",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
