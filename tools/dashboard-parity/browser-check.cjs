const { chromium } = require("playwright");
const crypto = require("crypto");
const fs = require("fs");
const assert = require("assert");
const base = "http://127.0.0.1:4310";
const root = require("path").resolve(__dirname, "../../docs/dashboard-parity");
fs.mkdirSync(root, { recursive: true });
function cookie(email) {
  const key = crypto
    .createHmac("sha256", "dashboard-fixture-only")
    .update("xd-dashboard-session-v1")
    .digest("base64url");
  const p = Buffer.from(
    JSON.stringify({ e: email, v: 1, x: Date.now() + 3600000 }),
  ).toString("base64url");
  return {
    name: "xd_dash",
    value:
      p + "." + crypto.createHmac("sha256", key).update(p).digest("base64url"),
    url: base,
    httpOnly: true,
    sameSite: "Lax",
  };
}
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext();
  await ctx.addCookies([cookie("owner@dashboard.invalid")]);
  const page = await ctx.newPage();
  let errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const views = [
    "ap-ideas",
    "automation-publisher",
    "automation-images",
    "email",
    "ap-brand",
    "settings",
    "help",
  ];
  const cases = [];
  for (const biz of ["nestoodle", "elevating-christ"])
    for (const width of [390, 1366]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const view of views.filter(
        (v) => biz === "nestoodle" || v !== "automation-images",
      )) {
        await page.goto(`${base}/dashboard?biz=${biz}&view=${view}`, {
          waitUntil: "networkidle",
        });
        await page.locator("main section").first().waitFor();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        assert(!overflow, `${biz} ${view} overflow at ${width}`);
        await page.screenshot({
          path: `${root}/${biz}-${view}-${width}.png`,
          fullPage: true,
        });
        cases.push(`${biz}/${view}/${width}: pass`);
      }
    }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/dashboard?biz=nestoodle&view=ap-ideas", {
    waitUntil: "networkidle",
  });
  await page.getByLabel("Title", { exact: true }).fill("Test seasonal topic");
  await page.getByRole("button", { name: "Add idea", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page
    .getByText("Test seasonal topic", { exact: true })
    .first()
    .waitFor();
  cases.push(
    "Add idea: confirmation → API → fixture Topics → rendered result: pass",
  );
  await page.goto(base + "/dashboard?biz=nestoodle&view=settings", {
    waitUntil: "networkidle",
  });
  await page.getByLabel("Preferred posting times").fill("18:00 IST");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("status").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.getByLabel("Preferred posting times").inputValue(),
    "18:00 IST",
  );
  cases.push("Business settings persist after reload: pass");
  await page.goto(base + "/dashboard?biz=nestoodle&view=ap-brand", {
    waitUntil: "networkidle",
  });
  await page.getByLabel("Voice", { exact: true }).fill("Updated fixture voice");
  await page
    .getByRole("button", { name: "Save brand kit", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("status").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.getByLabel("Voice", { exact: true }).inputValue(),
    "Updated fixture voice",
  );
  cases.push("Brand kit confirmation and persistence: pass");
  await page.goto(base + "/dashboard?biz=elevating-christ&view=ap-ideas", {
    waitUntil: "networkidle",
  });
  await page.getByLabel("Title", { exact: true }).fill("Church fixture idea");
  await page.getByRole("button", { name: "Add idea", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByText("Church fixture idea", { exact: true }).waitFor();
  const nst = await ctx.request.get(
    base + "/dashboard/workspace?biz=nestoodle&view=ap-ideas",
  );
  assert(
    !(await nst.json()).ideas.some((i) => i.title === "Church fixture idea"),
  );
  cases.push("EC idea persists; Nestoodle data stays isolated: pass");
  await page.goto(base + "/dashboard?biz=nestoodle&view=automation-images", {
    waitUntil: "networkidle",
  });
  await page.getByLabel("WordPress post number").fill("420");
  await page.getByRole("button", { name: "Make images", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByText("Sample owner image task", { exact: false }).waitFor();
  const dup = await ctx.request.post(base + "/dashboard/workspace", {
    headers: { Origin: base },
    data: { biz: "nestoodle", op: "make_images", postId: 420, confirmed: true },
  });
  assert.equal(dup.status(), 400);
  cases.push(
    "Image request confirmation; queued result; duplicate request rejected: pass",
  );
  const wrote = await ctx.request.post(base + "/dashboard/workspace", {
    headers: { Origin: base },
    data: { biz: "nestoodle", op: "write_now", row: 2, confirmed: true },
  });
  assert.equal(wrote.status(), 200);
  const rewrite = await ctx.request.post(base + "/dashboard/workspace", {
    headers: { Origin: base },
    data: { biz: "nestoodle", op: "write_now", row: 2, confirmed: true },
  });
  assert.equal(rewrite.status(), 400);
  cases.push(
    "Write Now uses existing action; already drafted topic cannot be rewritten: pass",
  );
  const ownerPost = await ctx.request.post(base + "/dashboard/workspace", {
    headers: { Origin: base },
    data: {
      biz: "nestoodle",
      op: "hold",
      key: "publisher",
      held: true,
      confirmed: true,
    },
  });
  assert.equal(ownerPost.status(), 400);
  const cross = await ctx.request.post(base + "/dashboard/workspace", {
    headers: { Origin: "https://untrusted.invalid" },
    data: { biz: "nestoodle", op: "add_idea", title: "No", confirmed: true },
  });
  assert.equal(cross.status(), 403);
  const member = await browser.newContext();
  await member.addCookies([cookie("member@dashboard.invalid")]);
  assert.equal(
    (
      await member.request.get(
        base + "/dashboard/workspace?biz=elevating-christ",
      )
    ).status(),
    403,
  );
  assert.equal(
    (
      await member.request.post(base + "/dashboard/workspace", {
        headers: { Origin: base },
        data: {
          biz: "nestoodle",
          op: "add_idea",
          title: "Denied",
          confirmed: true,
        },
      })
    ).status(),
    403,
  );
  const anon = await browser.newContext();
  assert.equal(
    (
      await anon.request.get(base + "/dashboard/workspace?biz=nestoodle")
    ).status(),
    401,
  );
  cases.push(
    "Unauthorized:401; other business:403; non-owner write:403; cross-origin:403; unsupported hold:400",
  );
  assert.deepEqual(errors, []);
  cases.push("No browser page errors");
  fs.writeFileSync(root + "/verification.txt", cases.join("\n") + "\n");
  console.log(cases.join("\n"));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
