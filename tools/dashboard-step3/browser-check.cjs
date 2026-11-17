const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { cookie, reportFixtures, posts } = require("./fixtures.cjs");
const base = "http://127.0.0.1:4332",
  out = path.resolve(__dirname, "../../docs/dashboard-step3");
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c.addCookies([cookie("owner@dashboard.invalid")]);
  await reportFixtures(c);
  const p = await c.newPage(),
    errors = [],
    writes = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/dashboard/workspace"))
      writes.push(r.postDataJSON());
  });
  await p.goto(base + "/dashboard?biz=nestoodle&view=automations", {
    waitUntil: "networkidle",
  });
  const hub = p.locator(".dash-automation-hub");
  assert.equal(await hub.locator("details").count(), 6);
  assert.equal(await hub.getByText("Held", { exact: true }).count(), 2);
  assert.equal(
    await hub.getByRole("button", { name: /Pause|Resume/ }).count(),
    0,
  );
  await hub.locator("details").nth(2).locator("summary").click();
  await hub
    .getByText("Fixture: a post needs image review.", { exact: true })
    .waitFor();
  await hub
    .getByRole("button", { name: "Open image queue", exact: true })
    .click();
  const drafts = p
    .locator("section")
    .filter({ has: p.getByText("Drafts not queued", { exact: true }) });
  assert.equal(
    await drafts
      .getByRole("button", { name: "Queue images", exact: true })
      .count(),
    3,
  );
  assert.equal(
    await drafts
      .getByText("Already illustrated — sample draft", { exact: true })
      .count(),
    0,
  );
  assert.equal(
    await drafts
      .getByText("Already queued — sample draft", { exact: true })
      .count(),
    0,
  );
  assert.equal(
    await drafts
      .getByText("Completed images — sample draft", { exact: true })
      .count(),
    0,
  );
  await p.getByLabel("Post title or number").fill(posts[0].title);
  await p.getByRole("button", { name: "Make images", exact: true }).click();
  assert.equal(writes.length, 0, "No mutation before confirmation");
  await p.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(writes.length, 0);
  await p.getByRole("button", { name: "Make images", exact: true }).click();
  await p.getByRole("button", { name: "Confirm", exact: true }).click();
  await p.getByRole("button", { name: "Queue all (2)", exact: true }).waitFor();
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], {
    biz: "nestoodle",
    op: "make_images",
    postId: 501,
    confirmed: true,
  });
  await p.getByLabel("Post title or number").fill("501");
  assert(
    await p
      .getByRole("button", { name: "Make images", exact: true })
      .isDisabled(),
  );
  // Bulk calls the existing guarded action sequentially; stop at the first failure.
  let active = 0,
    max = 0;
  await p.route("**/dashboard/workspace", async (r) => {
    if (r.request().method() !== "POST") return r.continue();
    const body = r.request().postDataJSON();
    active++;
    max = Math.max(active, max);
    if (body.postId === 503)
      await r.fulfill({
        status: 400,
        json: {
          ok: false,
          error: "Fixture: draft changed, refresh before retrying.",
        },
      });
    else {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await r.continue();
    }
    active--;
  });
  await p.getByRole("button", { name: "Queue all (2)", exact: true }).click();
  assert.equal(writes.length, 1);
  await p.getByRole("button", { name: "Confirm", exact: true }).click();
  await p
    .getByText(/1 of 2 requests completed.*Fixture: draft changed/)
    .waitFor();
  assert.equal(max, 1);
  assert.deepEqual(
    writes.slice(1).map((x) => x.postId),
    [502, 503],
  );
  await p.getByRole("button", { name: "Queue all (1)", exact: true }).waitFor();
  await p.screenshot({
    path: path.join(out, "image-queue-partial-failure-390.png"),
    fullPage: true,
  });
  await p.unroute("**/dashboard/workspace");
  await p.getByRole("button", { name: "Queue all (1)", exact: true }).click();
  await p.getByRole("button", { name: "Confirm", exact: true }).click();
  await p
    .getByText(
      "No unqueued drafts without featured images in the current list.",
      { exact: true },
    )
    .waitFor();
  assert(
    writes.every(
      (x) =>
        x.op === "make_images" && x.biz === "nestoodle" && x.confirmed === true,
    ),
  );
  // Both Content tab sets use their existing URLs and pages at phone + desktop widths.
  for (const biz of ["nestoodle", "elevating-christ"])
    for (const width of [390, 1366]) {
      await p.setViewportSize({ width, height: 900 });
      await p.goto(`${base}/dashboard?biz=${biz}&view=schedule`, {
        waitUntil: "networkidle",
      });
      const tabs = p.getByRole("navigation", {
        name: "Content pages",
        exact: true,
      });
      assert(await tabs.isVisible());
      assert.equal(
        await tabs.getByRole("button").count(),
        biz === "nestoodle" ? 4 : 3,
      );
      await tabs.getByRole("button", { name: "Ideas", exact: true }).click();
      await p.waitForURL(/view=ap-ideas/);
      await p.getByText("Ideas for the next draft", { exact: true }).waitFor();
      assert.equal(
        await tabs
          .getByRole("button", { name: "Ideas", exact: true })
          .getAttribute("aria-current"),
        "page",
      );
      if (biz === "nestoodle") {
        await tabs
          .getByRole("button", { name: "Blog posts", exact: true })
          .click();
        await p.waitForURL(/view=blog/);
        await p.getByText("Needs your review", { exact: true }).waitFor();
      }
      await tabs
        .getByRole("button", {
          name: biz === "nestoodle" ? "Printables" : "Sermon Notes",
          exact: true,
        })
        .click();
      await p.waitForURL(/view=printables/);
    }
  await p.goto(base + "/dashboard?biz=elevating-christ&view=automations", {
    waitUntil: "networkidle",
  });
  assert.equal(await p.locator(".dash-automation-hub details").count(), 6);
  assert.equal(await p.getByLabel("Post title or number").count(), 0);
  await p.goto(base + "/dashboard?biz=nestoodle&view=automation-images", {
    waitUntil: "networkidle",
  });
  await p.getByLabel("Post title or number").waitFor();
  assert.equal(await p.locator(".dash-automation-hub details").count(), 1);
  const member = await b.newContext();
  await member.addCookies([cookie("member@dashboard.invalid")]);
  await reportFixtures(member);
  const m = await member.newPage();
  await m.goto(base + "/dashboard?biz=nestoodle&view=automations", {
    waitUntil: "networkidle",
  });
  assert(await m.getByLabel("Post title or number").isDisabled());
  assert(
    await m
      .getByRole("button", { name: "Make images", exact: true })
      .isDisabled(),
  );
  const denied = await member.request.post(base + "/dashboard/workspace", {
    headers: { Origin: base },
    data: { biz: "nestoodle", op: "make_images", postId: 999, confirmed: true },
  });
  assert.equal(denied.status(), 403);
  assert.deepEqual(errors, []);
  await b.close();
  fs.writeFileSync(
    path.join(out, "feature-checks.json"),
    JSON.stringify(
      {
        passed: [
          "six cards per business; held writer and explicit source snapshots; per-card History",
          "Image queue title lookup; request rows; exclude queued/done/illustrated/published from Queue all",
          "single and bulk confirmation; no request on Cancel",
          "same per-post action bodies; serial bulk stop/partial-failure/retry",
          "Content tabs phone/desktop and legacy page URLs",
          "EC has no Nestoodle Image panel; member read-only and server 403",
          "no page errors",
        ],
        writes,
      },
      null,
      2,
    ) + "\n",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
