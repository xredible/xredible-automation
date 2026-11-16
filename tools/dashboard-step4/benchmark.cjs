const { chromium } = require("playwright");
const { cookie, reportFixtures } = require("./fixtures.cjs");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const b = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const results = [];
  for (const version of ["before", "after"])
    for (const biz of ["nestoodle", "elevating-christ"])
      for (let run = 0; run < 3; run++) {
        const base =
          version === "before"
            ? "http://127.0.0.1:4335"
            : "http://127.0.0.1:4334";
        const ctx = await b.newContext({
          viewport: { width: 390, height: 844 },
          colorScheme: "light",
        });
        await ctx.addCookies([cookie("owner@dashboard.invalid", base)]);
        await reportFixtures(ctx);
        await ctx.route("https://**", (r) => r.abort());
        const p = await ctx.newPage();
        const cdp = await ctx.newCDPSession(p);
        await cdp.send("Network.enable");
        await cdp.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: 150,
          downloadThroughput: 200000,
          uploadThroughput: 93750,
        });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await p.addInitScript(() => {
          window.fixtureLcp = 0;
          new PerformanceObserver((l) => {
            window.fixtureLcp = l.getEntries().at(-1).startTime;
          }).observe({ type: "largest-contentful-paint", buffered: true });
        });
        await p.goto(`${base}/dashboard?biz=${biz}`, {
          waitUntil: "domcontentloaded",
        });
        const title =
          biz === "nestoodle"
            ? "Indoor play ideas — sample draft"
            : "Weekly devotional — sample draft";
        await p.getByText(title, { exact: true }).first().waitFor();
        const coldReady = await p.evaluate(() => performance.now());
        await p.waitForLoadState("networkidle");
        const cold = await p.evaluate(() => ({
          lcp: window.fixtureLcp,
          jsGzipBytes: performance
            .getEntriesByType("resource")
            .filter((r) => /\.js(?:\?|$)/.test(r.name))
            .reduce((n, r) => n + r.encodedBodySize, 0),
        }));
        const start = await p.evaluate(() => performance.now());
        await p
          .getByRole("navigation", { name: "Workspace tabs", exact: true })
          .getByRole("button", { name: "Content", exact: true })
          .click();
        await p
          .getByRole("heading", {
            level: 1,
            name: "Content calendar",
            exact: true,
          })
          .waitFor();
        const hubMs = await p.evaluate((s) => performance.now() - s, start);
        const homeStart = await p.evaluate(() => performance.now());
        await p
          .getByRole("navigation", { name: "Workspace tabs", exact: true })
          .getByRole("button", { name: "Home", exact: true })
          .click();
        await p.getByText(title, { exact: true }).first().waitFor();
        const cachedHomeReturn = await p.evaluate(
          (s) => performance.now() - s,
          homeStart,
        );
        await p
          .getByRole("navigation", { name: "Workspace tabs", exact: true })
          .getByRole("button", { name: "Results", exact: true })
          .click();
        const channels = p.getByRole("navigation", {
          name: version === "before" ? "Results pages" : "Results channels",
          exact: true,
        });
        await channels
          .getByRole("button", { name: "Instagram", exact: true })
          .click();
        await p
          .locator("main")
          .getByText("Accounts reached", { exact: true })
          .first()
          .waitFor();
        await channels
          .getByRole("button", { name: "Facebook", exact: true })
          .click();
        await p.waitForURL(/view=facebook/);
        await p
          .locator("main")
          .getByText("Views", { exact: true })
          .first()
          .waitFor();
        const resultsStart = await p.evaluate(() => performance.now());
        await channels
          .getByRole("button", { name: "Instagram", exact: true })
          .click();
        await p
          .locator("main")
          .getByText("Accounts reached", { exact: true })
          .first()
          .waitFor();
        const resultsMs = await p.evaluate(
          (s) => performance.now() - s,
          resultsStart,
        );
        results.push({
          version,
          biz,
          run,
          coldReadyMs: Math.round(coldReady),
          lcpMs: Math.round(cold.lcp),
          cachedHomeReturnMs: Math.round(cachedHomeReturn),
          hubSwitchMs: Math.round(hubMs),
          jsGzipBytes: cold.jsGzipBytes,
          cachedResultsSwitchMs: Math.round(resultsMs),
        });
        console.log(JSON.stringify(results.at(-1)));
        await ctx.close();
      }
  fs.writeFileSync(
    path.resolve(__dirname, "../../docs/dashboard-step4/performance.json"),
    JSON.stringify(
      {
        method:
          "Chromium,390x844,150ms RTT,1.6Mbps down,750Kbps up,4x CPU;three runs per business/version. Same local read-only fixture reports and self-hosted font files;not live n8n performance. Cold ready = first fixture queue item visible. Cached Home = in-session return from Calendar using the existing module cache;not persistent storage or a warm HTTP reload. Hub = visible nav control to Calendar heading. Cached Results = Facebook to previously loaded Instagram, until the reach KPI label is visible. HTTP reload cache timings omitted because interception suppresses browser asset caching.",
        results,
      },
      null,
      2,
    ) + "\n",
  );
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
