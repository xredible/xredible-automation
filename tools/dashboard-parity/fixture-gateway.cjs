const http = require("http");
const now = new Date().toISOString();
let id = 100;
const users = [
  {
    email: "owner@dashboard.invalid",
    name: "Owner (test fixture)",
    role: "admin",
    businesses: ["nestoodle", "elevating-christ"],
    active: true,
    sessionVersion: 1,
  },
  {
    email: "member@dashboard.invalid",
    name: "Member (test fixture)",
    role: "member",
    businesses: ["nestoodle"],
    active: true,
    sessionVersion: 1,
  },
];
users.push({
  email: "customer@dashboard.invalid",
  name: "Client (test fixture)",
  role: "customer",
  businesses: [],
  active: true,
  sessionVersion: 1,
});
const db = {
  nst_dashboard: [],
  ec_dashboard: [],
  nst_images: [
    {
      id: 1,
      postId: 2002,
      title: "Hanukkah activities — sample task",
      status: "done",
      notes: "Sample completed image task; draft awaits review.",
      requestedAt: now,
    },
    {
      id: 2,
      postId: 1276,
      title: "Indoor winter activities — sample task",
      status: "queued",
      notes: "Waiting for image checks.",
      requestedAt: now,
    },
  ],
};
for (const t of ["nst_dashboard", "ec_dashboard"])
  for (const key of [
    "writer",
    "social",
    "publisher",
    "emails",
    "pinterest",
    "shorts",
    "youtube-pack",
    "whatsapp",
    "live",
    "images",
  ])
    db[t].push({
      id: id++,
      key: "status:" + key,
      value: JSON.stringify({
        active: true,
        observedAt: now,
        lastRun: { at: now, status: "success" },
      }),
    });
const range = {
  start: "2026-10-20",
  end: "2026-11-16",
  cmp: "none",
  days: 28,
  cstart: null,
  cend: null,
};
const section = (name) => ({
  ok: true,
  section: name,
  range,
  generatedAt: now,
  filters: {},
  account: null,
  kpis: [
    {
      key: "sent",
      label: "Emails sent",
      value: 48,
      prev: null,
      format: "number",
    },
    {
      key: "openRate",
      label: "Open rate",
      value: 0.42,
      prev: null,
      format: "percent",
    },
    {
      key: "clickRate",
      label: "Click rate",
      value: 0.12,
      prev: null,
      format: "percent",
    },
  ],
  tables: [
    {
      key: "campaigns",
      title: "Email results by subject",
      columns: [
        { key: "subject", label: "Email" },
        { key: "sent", label: "Sent" },
        { key: "openRate", label: "Open rate", format: "percent" },
        { key: "clickRate", label: "Click rate", format: "percent" },
        { key: "unsubscribes", label: "Unsubscribes" },
      ],
      rows: [
        {
          subject: "Welcome email — sample",
          sent: 28,
          openRate: 0.43,
          clickRate: 0.14,
          unsubscribes: null,
        },
        {
          subject: "Weekly ideas — sample",
          sent: 20,
          openRate: 0.4,
          clickRate: 0.1,
          unsubscribes: null,
        },
      ],
      note: "Fixture data for interface verification. Unsubscribes are not attributed to individual emails.",
    },
  ],
  items: null,
  notes: ["Fixture data — not production results."],
  errors: [],
});
const topics = [
  {
    row: 2,
    id: "sample-1",
    type: "Article",
    status: "Planned",
    writeOn: "2026-11-20",
    publishOn: "2026-11-22",
    title: "Thanksgiving play ideas for a calm afternoon",
    keyword: "thanksgiving activities",
    why: "Seasonal",
    notes: "",
    secondary: "",
    category: "Activities",
    angle: "",
    postId: null,
  },
  {
    row: 3,
    id: "sample-2",
    type: "Article",
    status: "Planned",
    writeOn: "2026-12-01",
    title: "A simple indoor winter routine",
    keyword: "winter routine",
    why: "Seasonal",
    notes: "",
    postId: null,
  },
];
const queue = {
  ok: true,
  section: "queue",
  generatedAt: now,
  items: [
    {
      row: 2,
      title: "Weekly devotional — sample draft",
      status: "Draft",
      platform: "instagram",
      when: null,
      caption: "Sample draft for review",
      type: "image",
      preview: null,
      media: [],
      slides: 0,
      isVideo: false,
      mode: "Auto",
    },
  ],
};
http
  .createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    let b;
    try {
      b = JSON.parse(raw);
    } catch {
      res.writeHead(400);
      return res.end("{}");
    }
    let out = { ok: true };
    if (b.kind === "users") out = { ok: true, users };
    else if (b.kind === "db") {
      const t = db[b.table] || [];
      if (b.op === "list")
        out = {
          ok: true,
          rows: b.filter
            ? t.filter((r) => String(r[b.filter.col]) === String(b.filter.val))
            : t,
        };
      else if (b.op === "insert") {
        const r = { id: id++, ...b.row };
        t.push(r);
        out = { ok: true, row: r };
      } else if (b.op === "update") {
        Object.assign(t.find((r) => r.id === b.id) || {}, b.row);
        out = { ok: true, updated: 1 };
      }
    } else if (b.kind === "proxy") {
      if (b.path === "-ops" && b.body.action === "add_idea") {
        topics.push({
          row: topics.length + 2,
          ...b.body,
          status: "Planned",
          writeOn: b.body.planned,
          notes: "",
          why: "",
        });
        out = { ok: true };
      } else if (b.path === "-ops" && b.body.action === "make_images") {
        db.nst_images.push({
          id: id++,
          postId: b.body.postId,
          title: "Sample owner image task",
          status: "queued",
          notes: "Fixture image-only request",
          requestedAt: now,
        });
        out = { ok: true };
      } else if (b.path === "-ops") out = { ok: true };
      else if (b.path === "-blog") {
        const t = topics.find((t) => t.row === b.body.row);
        if (t) t.status = b.body.action === "write_now" ? "Drafted" : "Skipped";
        out = { ok: true };
      } else if (b.query?.section === "blog")
        out = {
          ok: true,
          section: "blog",
          posts: [],
          topics,
          generatedAt: now,
        };
      else if (b.query?.section === "queue")
        out = {
          ...queue,
          items: queue.items.map((i) => ({
            ...i,
            title:
              b.biz === "nestoodle"
                ? "Indoor play ideas — sample draft"
                : i.title,
          })),
        };
      else out = section(b.query?.section || "email");
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(out));
  })
  .listen(4311, "127.0.0.1", () =>
    console.log("Fixture gateway ready on 4311"),
  );
