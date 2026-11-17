const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { cookie, reportFixtures } = require("./fixtures.cjs");
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const c = await b.newContext();
  const control = {};
  await c.addCookies([cookie("owner@dashboard.invalid")]);
  await reportFixtures(c, control);
  const p = await c.newPage();
  await p.goto(
    "http://127.0.0.1:4334/dashboard?biz=nestoodle&view=all-results",
    { waitUntil: "networkidle" },
  );
  await p.waitForFunction(() => {
    const data = localStorage.getItem(
      "xd-results-v1:owner%40dashboard.invalid:nestoodle",
    );
    return data && JSON.parse(data).email;
  });
  assert(
    (await p.locator(".dash-results-summary tbody").innerText()).includes(
      "648",
    ),
  );
  await c.addCookies([cookie("member@dashboard.invalid")]);
  control.fail = true;
  await p.reload({ waitUntil: "networkidle" });
  await p.getByText("No results loaded.", { exact: true }).waitFor();
  assert(
    !(await p.locator(".dash-results-summary tbody").innerText()).includes(
      "648",
    ),
  );
  assert(
    await p.evaluate(
      () =>
        !!localStorage.getItem(
          "xd-results-v1:owner%40dashboard.invalid:nestoodle",
        ),
    ),
  );
  await b.close();
  console.log(
    "Results cache: same-browser account change cannot display the prior account's saved figures: pass",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
