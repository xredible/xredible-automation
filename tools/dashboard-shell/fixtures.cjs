const crypto = require("node:crypto");
const base = "http://127.0.0.1:4320";
function cookie(email, url = base) {
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
    url,
    httpOnly: true,
    sameSite: "Lax",
  };
}
async function reportFixtures(ctx) {
  await ctx.route("**/dashboard/data?*", (r) => {
    const q = new URL(r.request().url()).searchParams;
    const section = q.get("section"),
      biz = q.get("biz");
    const now = new Date().toISOString();
    const range = {
      start: q.get("start"),
      end: q.get("end"),
      cmp: "none",
      days: 28,
      cstart: null,
      cend: null,
    };
    if (section === "queue")
      return r.fulfill({
        json: {
          ok: true,
          section,
          generatedAt: now,
          items: [
            {
              row: 2,
              title:
                biz === "nestoodle"
                  ? "Indoor play ideas — sample draft"
                  : "Weekly devotional — sample draft",
              status: "Draft",
              platform: "instagram",
              when: new Date(Date.now() + 86400000).toISOString(),
              caption: biz === "nestoodle" ? "Indoor play ideas — sample draft" : "Weekly devotional — sample draft",
              mode: "Auto",
              format: "image",
              preview: null,
              media: [],
              slides: 0,
              isVideo: false,
            },
          ],
        },
      });
    const labels = {
      activeUsers: "Website visitors",
      screenPageViews: "Page views",
      views: "Views",
      watch: "Watch hours",
      reach: "Accounts reached",
      clicks: "Search clicks",
      impressions: "Search impressions",
      impression: "Pin impressions",
      members: "Members",
      subscribers: "Subscribers",
      earnings: "Ad earnings",
      openRate: "Open rate",
    };
    return r.fulfill({
      json: {
        ok: true,
        section,
        range,
        generatedAt: now,
        filters: {},
        account: null,
        kpis: Object.entries(labels).map(([key, label]) => ({
          key,
          label,
          value: key === "openRate" ? 0.42 : key === "earnings" ? 12 : 648,
          prev: null,
          format: key === "openRate" ? "percent" : "number",
        })),
        tables: [],
        items: null,
        notes: ["Fixture data — not production results."],
        errors: [],
      },
    });
  });
}
module.exports = { cookie, reportFixtures };
