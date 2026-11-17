const crypto = require("node:crypto");
const base = "http://127.0.0.1:4334";
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
const posts = [
  [501, "Quiet winter play — sample draft", "draft", null],
  [502, "Nine-branch menorah craft — sample draft", "draft", null],
  [503, "Thank-you jar — sample draft", "pending", null],
  [
    504,
    "Already illustrated — sample draft",
    "draft",
    "/dashboard/nestoodle-brand.png",
  ],
  [1276, "Already queued — sample draft", "draft", null],
  [2002, "Completed images — sample draft", "draft", null],
  [2003, "Published article — sample", "publish", null],
].map(([id, title, status, featuredImage]) => ({
  id,
  title,
  status,
  featuredImage,
  date: null,
  modified: null,
  link: null,
  slug: `fixture-${id}`,
  excerpt: "Synthetic content, not a production article.",
  category: "Activities",
  words: 250,
  keyword: "winter play",
  automated: true,
}));
async function reportFixtures(ctx, control = {}) {
  await ctx.route("**/dashboard/data?*", async (r) => {
    if (control.wait) await control.wait;
    if (control.fail)
      return r.fulfill({ json: { ok: false, error: "Fixture offline" } });
    const q = new URL(r.request().url()).searchParams;
    const section = q.get("section"),
      biz = q.get("biz");
    const now = new Date().toISOString();
    const day = 86400000;
    const shift = (d, n) =>
      new Date(Date.parse(d) + n * day).toISOString().slice(0, 10);
    const end = q.get("end") || now.slice(0, 10),
      start =
        control.cap && section === "pinterest"
          ? shift(end, -89)
          : q.get("start") || shift(end, -27),
      cmp = q.get("cmp") || "prev";
    const days = Math.max(
      1,
      Math.round((Date.parse(end) - Date.parse(start)) / day) + 1,
    );
    const range = {
      start,
      end,
      cmp: q.get("cmp") || "prev",
      days,
      cstart:
        cmp === "none"
          ? null
          : cmp === "yoy"
            ? `${Number(start.slice(0, 4)) - 1}${start.slice(4)}`
            : shift(start, -days),
      cend:
        cmp === "none"
          ? null
          : cmp === "yoy"
            ? `${Number(end.slice(0, 4)) - 1}${end.slice(4)}`
            : shift(start, -1),
    };
    if (section === "blog")
      return r.fulfill({
        json: {
          ok: true,
          section: "blog",
          posts,
          topics: [],
          generatedAt: now,
        },
      });
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
              caption:
                biz === "nestoodle"
                  ? "Indoor play ideas — sample draft"
                  : "Weekly devotional — sample draft",
              mode: "Auto",
              format: "image",
              preview: null,
              media: [],
              slides: 0,
              isVideo: false,
            },
            ...["Failed", "Ready", "Posted"].map((status, i) => ({
              row: i + 3,
              title: `${biz} ${status.toLowerCase()} sample`,
              caption: `${biz} ${status.toLowerCase()} sample`,
              status,
              platform: "facebook",
              when: new Date(Date.now() - (i + 3) * 3600000).toISOString(),
              postedAt: status === "Posted" ? now : null,
              mode: "Auto",
              format: "image",
              media: [],
              slides: 0,
              isVideo: false,
            })),
          ],
        },
      });
    const series = (first, value, average = false) =>
      Array.from({ length: days }, (_, i) => ({
        d: shift(first, i),
        v: average
          ? value
          : Math.floor(value / days) + (i < value % days ? 1 : 0),
      }));
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
        kpis: Object.entries(labels)
          .filter(([key]) =>
            (
              ({
                ga4: ["activeUsers", "screenPageViews"],
                sessions: ["activeUsers"],
                gsc: ["clicks", "impressions"],
                instagram: ["reach", "views"],
                facebook: ["views"],
                youtube: ["views", "watch"],
                pinterest: ["impression"],
                adsense: ["earnings"],
                ads: ["clicks"],
                email: ["openRate", "members", "subscribers"],
                newsletter: ["openRate", "subscribers"],
              })[section] || ["views"]
            ).includes(key),
          )
          .map(([key, label]) => ({
            key,
            label,
            value: key === "openRate" ? 0.42 : key === "earnings" ? 12 : 648,
            prev:
              q.get("cmp") === "none"
                ? null
                : key === "openRate"
                  ? q.get("cmp") === "yoy"
                    ? 0.3
                    : 0.35
                  : q.get("cmp") === "yoy"
                    ? 390
                    : 520,
            format: key === "openRate" ? "percent" : "number",
            series: series(
              start,
              key === "openRate" ? 0.42 : key === "earnings" ? 12 : 648,
              key === "openRate",
            ),
            cseries:
              cmp === "none"
                ? null
                : series(
                    range.cstart,
                    key === "openRate"
                      ? cmp === "yoy"
                        ? 0.3
                        : 0.35
                      : cmp === "yoy"
                        ? 390
                        : 520,
                    key === "openRate",
                  ),
          })),
        tables:
          section === "email"
            ? [
                {
                  key: "campaigns",
                  title: "Email results by subject",
                  columns: [
                    { key: "subject", label: "Email" },
                    { key: "sent", label: "Sent" },
                    { key: "openRate", label: "Open rate", format: "percent" },
                  ],
                  rows: [
                    {
                      subject: "Welcome — fixture email",
                      sent: 48,
                      openRate: 0.42,
                    },
                  ],
                },
                {
                  key: "subscribers",
                  title: "Synthetic subscribers",
                  columns: [{ key: "email", label: "Email" }],
                  rows: [{ email: "private-fixture@example.invalid" }],
                },
              ]
            : [],
        items: null,
        notes: ["Fixture data — not production results."],
        errors: [],
      },
    });
  });
}
module.exports = { cookie, reportFixtures, posts };
