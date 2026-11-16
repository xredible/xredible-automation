"use client";

// Overview: the headline number from every platform for the chosen dates,
// what's going out next, what needs attention, and the best content.

import { useMemo } from "react";
import { ArrowRight, TriangleAlert } from "lucide-react";
import type {
  Kpi,
  QueueData,
  SectionData,
  ToolSummary,
} from "@/lib/dashboard/types";
import { fillDays, fmt } from "./format";
import { Card, Delta, Notice, Skeleton } from "./ui";
import { Sparkline } from "./charts";
import { PLATFORM } from "./brand";
import { QueueRow } from "./schedule-view";
import { useItems } from "./actions";
import { type View } from "./state";
import { useHomeData } from "./home-data";
import { BusinessOverview } from "./workspace-overview";
import { isWorkspace } from "@/lib/dashboard/business-workspace";
import {
  BUSINESSES,
  hubsOf,
  type BusinessKey,
} from "@/lib/dashboard/businesses";
import { GettingStarted } from "@/components/autopilot/account-views";

// The Blog page's own sections: "blogpost" needs a post id, and the overview shows neither.
const HOME_SECTIONS = Object.fromEntries(
  Object.entries(BUSINESSES).map(([key, b]) => [
    key,
    b.sections.filter((s) => !["blog", "blogpost"].includes(s)),
  ]),
);

export function Overview({
  account,
  biz,
  start,
  end,
  cmp,
  compareLabel,
  go,
  refreshTick,
}: {
  account: string;
  biz: BusinessKey;
  start: string;
  end: string;
  cmp: string;
  compareLabel: string | null;
  go: (v: View) => void;
  refreshTick: number;
}) {
  const business = BUSINESSES[biz];
  const { entries, errors, loading, range, updated, now } = useHomeData(
    account,
    biz,
    HOME_SECTIONS[biz],
    start,
    end,
    cmp,
    refreshTick,
  );
  const data = useMemo(
    () =>
      Object.fromEntries(Object.entries(entries).map(([s, e]) => [s, e.data])),
    [entries],
  );
  const picks = business.picks.filter(
    (p) => !["ap-ideas", "automation-images"].includes(p.section),
  );
  const channelPicks = [
    ...picks,
    ...HOME_SECTIONS[biz]
      .filter(
        (section) =>
          section !== "queue" && !picks.some((p) => p.section === section),
      )
      .map((section) => {
        const d = data[section];
        const k = d?.ok && "kpis" in d ? d.kpis[0] : null;
        return {
          section: section as View,
          key: k?.key || "",
          label: `${PLATFORM[section]?.short || section}${k ? `: ${k.label}` : ""}`,
        };
      }),
  ];
  const headlineKeys =
    biz === "elevating-christ"
      ? [
          "youtube:views",
          "instagram:reach",
          "ga4:activeUsers",
          "email:openRate",
        ]
      : biz === "nestoodle"
        ? ["ga4:activeUsers", "gsc:clicks", "instagram:views", "email:openRate"]
        : picks.slice(0, 4).map((p) => `${p.section}:${p.key}`);
  const headlines = headlineKeys
    .map((key) => picks.find((p) => `${p.section}:${p.key}` === key)!)
    .filter(Boolean);
  const older = Object.values(entries).some((e) => e.range !== range);
  const rangeNote = (section: string) =>
    entries[section] && entries[section].range !== range
      ? `Showing ${entries[section].range}.`
      : null;

  const rawQueue =
    data.queue && data.queue.ok ? (data.queue as QueueData) : null;
  const liveItems = useItems(rawQueue?.items ?? []);
  const queue = rawQueue ? { ...rawQueue, items: liveItems } : null;
  const next = queue
    ? queue.items
        .filter(
          (x) =>
            x.when &&
            Date.parse(x.when) >= now &&
            !/posted|failed/i.test(x.status),
        )
        .sort((a, b) => (a.when as string).localeCompare(b.when as string))
        .slice(0, 6)
    : [];
  const recent = queue
    ? queue.items
        .filter((x) => /posted/i.test(x.status))
        .sort((a, b) =>
          (b.postedAt || b.when || "").localeCompare(
            a.postedAt || a.when || "",
          ),
        )
        .slice(0, 6)
    : [];
  const attention = queue
    ? queue.items.filter(
        (x) =>
          /failed/i.test(x.status) ||
          (x.when &&
            Date.parse(x.when) < now - 2 * 3600_000 &&
            /ready|processing/i.test(x.status) &&
            /auto/i.test(x.mode)) ||
          (x.when &&
            /draft/i.test(x.status) &&
            Date.parse(x.when) - now < 3 * 86400_000 &&
            Date.parse(x.when) > now),
      )
    : [];
  const week = queue
    ? queue.items.filter(
        (x) =>
          x.when &&
          Date.parse(x.when) >= now &&
          Date.parse(x.when) < now + 7 * 86400_000 &&
          !/posted/i.test(x.status),
      )
    : [];

  const best = useMemo(() => {
    const out: {
      platform: string;
      title: string;
      url: string;
      thumb: string | null;
      metric: string;
      value: number;
    }[] = [];
    const ig =
      data.instagram && data.instagram.ok
        ? (data.instagram as SectionData)
        : null;
    const yt =
      data.youtube && data.youtube.ok ? (data.youtube as SectionData) : null;
    const fb =
      data.facebook && data.facebook.ok ? (data.facebook as SectionData) : null;
    const ga = data.ga4 && data.ga4.ok ? (data.ga4 as SectionData) : null;
    const top = (s: SectionData | null, k: string) =>
      (s?.items?.rows || [])
        .filter((r) => typeof r[k] === "number")
        .sort((a, b) => (b[k] as number) - (a[k] as number))[0];
    const y = top(yt, "views");
    if (y)
      out.push({
        platform: "youtube",
        title: y.title,
        url: y.url,
        thumb: y.thumb,
        metric: "views",
        value: y.views as number,
      });
    const i = top(ig, "reach");
    if (i)
      out.push({
        platform: "instagram",
        title: i.title,
        url: i.url,
        thumb: i.thumb,
        metric: "accounts reached",
        value: i.reach as number,
      });
    const f = top(fb, "views");
    if (f)
      out.push({
        platform: "facebook",
        title: f.title,
        url: f.url,
        thumb: f.thumb,
        metric: "views",
        value: f.views as number,
      });
    const nl =
      data.newsletter && data.newsletter.ok
        ? (data.newsletter as SectionData)
        : null;
    const n = top(nl, "opens");
    if (n && (n.opens as number) > 0)
      out.push({
        platform: "newsletter",
        title: n.title,
        url: n.url,
        thumb: null,
        metric: "people opened",
        value: n.opens as number,
      });
    const pages = ga?.tables.find((t) => t.key === "pages")?.rows || [];
    const pg = pages
      .filter((r) => r.path !== "/")
      .sort((a, b) => (b.views as number) - (a.views as number))[0];
    if (pg)
      out.push({
        platform: "ga4",
        title: String(pg.title || pg.path).replace(
          / \| (Elevating CHRIST|Nestoodle)$/,
          "",
        ),
        url: business.site + pg.path,
        thumb: null,
        metric: "page views",
        value: pg.views as number,
      });
    return out;
  }, [data, business.site]);

  return (
    <div className="dash-home space-y-6">
      <div role="status" className="text-xs text-[var(--muted)]">
        {updated}
        {loading ? " · Refreshing…" : ""}
        {older
          ? " · Older dates remain visible below until the selected range loads."
          : ""}
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card
          title={
            <span className="inline-flex items-center gap-2">
              <TriangleAlert
                aria-hidden
                className="h-4 w-4 text-[var(--bad)]"
              />
              Needs you
            </span>
          }
          sub="Failed posts, overdue posts and drafts due within 3 days"
        >
          {rangeNote("queue") ? (
            <p className="mb-2 text-xs text-[var(--muted)]">
              {rangeNote("queue")}
            </p>
          ) : null}
          {!data.queue ? (
            errors.queue ? (
              <p className="py-5 text-sm text-[var(--muted)]">
                Queue unavailable. Open Calendar to retry.
              </p>
            ) : (
              <Skeleton className="h-40" />
            )
          ) : attention.length ? (
            <ul className="divide-y divide-[var(--line-soft)]">
              {[...attention]
                .sort(
                  (a, b) =>
                    (/failed/i.test(a.status)
                      ? 0
                      : /draft/i.test(a.status)
                        ? 2
                        : 1) -
                    (/failed/i.test(b.status)
                      ? 0
                      : /draft/i.test(b.status)
                        ? 2
                        : 1),
                )
                .map((x) => (
                  <QueueRow key={x.row} item={x} showDate />
                ))}
            </ul>
          ) : (
            <p className="py-5 text-sm text-[var(--muted)]">
              Nothing needs your attention right now.
            </p>
          )}
          {errors.queue ? (
            <p className="mt-2 text-xs text-[var(--bad)]">
              Queue could not refresh: {errors.queue}
            </p>
          ) : null}
        </Card>
        <Card
          title="Next up"
          action={
            <button
              type="button"
              onClick={() => go("schedule")}
              className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-[var(--brand)] hover:underline"
            >
              Calendar <ArrowRight aria-hidden className="h-3 w-3" />
            </button>
          }
        >
          {rangeNote("queue") ? (
            <p className="mb-2 text-xs text-[var(--muted)]">
              {rangeNote("queue")}
            </p>
          ) : null}
          {!data.queue ? (
            errors.queue ? (
              <p className="py-5 text-sm text-[var(--muted)]">
                Queue unavailable. Open Calendar to retry.
              </p>
            ) : (
              <Skeleton className="h-40" />
            )
          ) : next.length ? (
            <ul className="divide-y divide-[var(--line-soft)]">
              {next.slice(0, 3).map((x) => (
                <QueueRow key={x.row} item={x} showDate />
              ))}
            </ul>
          ) : (
            <p className="py-5 text-sm text-[var(--muted)]">
              Nothing scheduled in the {business.sheetName}.
            </p>
          )}
          {queue ? (
            <p className="mt-3 rounded-lg bg-[var(--chip)] p-3 text-xs text-[var(--muted)]">
              <strong className="text-[var(--ink)]">{week.length}</strong>{" "}
              {week.length === 1 ? "post" : "posts"} in the next 7 days
            </p>
          ) : null}
          {recent.length ? (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-[var(--muted)]">
                Recently posted
              </h3>
              <ul>
                {recent.slice(0, 1).map((x) => (
                  <QueueRow key={x.row} item={x} showDate actions={false} />
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>
      <div
        aria-label="Headline results"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        {headlines.map((p) => {
          const d = data[p.section];
          const meta = PLATFORM[p.section];
          if (!d && !errors[p.section])
            return <Skeleton key={p.label} className="h-[132px]" />;
          const report = d?.ok && "kpis" in d ? (d as SectionData) : null;
          return (
            <div key={p.label} className="flex min-w-0 flex-col">
              <OverviewTile
                label={p.label}
                k={report?.kpis.find((k) => k.key === p.key)}
                d={report}
                error={errors[p.section] || null}
                color={meta.color}
                icon={meta.icon}
                onClick={() => go(p.section)}
                compareLabel={
                  entries[p.section]?.range === range ? compareLabel : null
                }
              />
              {rangeNote(p.section) || errors[p.section] ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {rangeNote(p.section)}
                  {errors[p.section]
                    ? " Refresh failed; last result kept."
                    : ""}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <Card
        title="All channels"
        sub="Headline results for each channel. Open a channel for its full report."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--line)] text-[var(--muted)]">
              <tr>
                <th scope="col" className="py-3 pr-3">
                  Channel / metric
                </th>
                <th scope="col" className="p-3 text-right">
                  Now
                </th>
                <th scope="col" className="p-3 text-right">
                  Before
                </th>
                <th scope="col" className="py-3 pl-3 text-right">
                  Change
                </th>
              </tr>
            </thead>
            <tbody>
              {channelPicks.map((p) => {
                const d = data[p.section];
                const k =
                  d?.ok && "kpis" in d
                    ? d.kpis.find((k) => k.key === p.key)
                    : null;
                return (
                  <tr
                    key={`${p.section}:${p.key}`}
                    className="border-b border-[var(--line-soft)] last:border-0"
                  >
                    <th scope="row" className="py-1 pr-3 font-normal">
                      <button
                        type="button"
                        onClick={() => go(p.section)}
                        className="min-h-11 text-left font-medium text-[var(--brand)] hover:underline"
                      >
                        {p.label}
                      </button>
                      {rangeNote(p.section) || errors[p.section] ? (
                        <span className="block pb-2 text-[var(--muted)]">
                          {rangeNote(p.section)}
                          {errors[p.section] ? " Refresh unavailable." : ""}
                        </span>
                      ) : null}
                    </th>
                    <td className="p-3 text-right tabular-nums">
                      {k
                        ? fmt(k.value, k.format, true)
                        : d || errors[p.section]
                          ? "—"
                          : "…"}
                    </td>
                    <td className="p-3 text-right tabular-nums text-[var(--muted)]">
                      {k?.prev != null ? fmt(k.prev, k.format, true) : "—"}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      {k && k.prev != null ? (
                        <Delta cur={k.value} prev={k.prev} invert={k.invert} />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card
        title="Automation shortcuts"
        sub="Open an automation to review its status and existing controls."
      >
        <div className="flex flex-wrap gap-2">
          {hubsOf(biz)
            .find((h) => h.key === "automations")
            ?.items.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => go(v)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-[var(--hover)]"
              >
                {PLATFORM[v]?.icon}
                {business.labels?.[v] || PLATFORM[v]?.label || v}
                <ArrowRight aria-hidden className="h-3 w-3" />
              </button>
            ))}
        </div>
      </Card>
      {isWorkspace(biz) ? (
        <BusinessOverview
          key={`${biz}-${refreshTick}`}
          biz={biz}
          go={go}
          compact
        />
      ) : null}
      {biz === "autopilot" && rawQueue?.tools ? (
        <GettingStarted tools={rawQueue.tools} go={go} />
      ) : null}
      {biz === "autopilot" ? (
        <Automations tools={rawQueue?.tools ?? null} go={go} />
      ) : null}
      {best.length ? (
        <Card title="Best content in these dates">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {best.map((b) => {
              const meta = PLATFORM[b.platform];
              return (
                <li key={b.platform} className="min-w-0">
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-full flex-col rounded-lg border border-[var(--line)] p-3 transition hover:border-[var(--line-strong)] hover:bg-[var(--hover)]"
                  >
                    <span
                      className="flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: meta.color }}
                    >
                      {meta.icon}
                      {meta.short}
                    </span>
                    {b.thumb ? (
                      <img
                        onError={(e) => {
                          e.currentTarget.style.visibility = "hidden";
                        }}
                        src={b.thumb}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="mt-2 aspect-video w-full rounded-md bg-[var(--chip)] object-cover"
                      />
                    ) : null}
                    <span className="mt-2 line-clamp-2 text-sm leading-snug text-[var(--ink)]">
                      {b.title}
                    </span>
                    <span className="mt-auto pt-2 text-xs text-[var(--muted)]">
                      <span className="font-semibold tabular-nums text-[var(--ink)]">
                        {fmt(b.value)}
                      </span>{" "}
                      {b.metric}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {Object.keys(errors).length ? (
        <Notice tone="warn" title="Some platforms could not refresh">
          {Object.entries(errors)
            .map(
              ([s, error]) =>
                `${PLATFORM[s === "queue" ? "schedule" : s]?.short || s}: ${error}`,
            )
            .join(" · ")}
          . Last successful results remain visible where available.
        </Notice>
      ) : null}
    </div>
  );
}

function OverviewTile({
  label,
  k,
  d,
  error,
  color,
  icon,
  onClick,
  compareLabel,
}: {
  label: string;
  k?: Kpi;
  d: SectionData | null;
  error: string | null;
  color: string;
  icon: React.ReactNode;
  onClick: () => void;
  compareLabel: string | null;
}) {
  const series =
    k?.series && d ? fillDays(k.series, d.range.start, d.range.end, 0) : [];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-col rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3.5 text-left transition hover:border-[var(--line-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:p-4"
    >
      <span className="flex items-start gap-1.5 text-[12.5px] font-medium leading-snug text-[var(--muted)]">
        <span className="mt-[2px]" style={{ color }}>
          {icon}
        </span>
        <span className="line-clamp-2">{label}</span>
      </span>
      {k ? (
        <>
          <span className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[1.55rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--ink)]">
              {fmt(k.value, k.format, true)}
            </span>
            <Delta cur={k.value} prev={k.prev} invert={k.invert} />
          </span>
          <span className="mt-1 truncate text-[11.5px] text-[var(--faint)]">
            {k.prev !== null && compareLabel
              ? `${fmt(k.prev, k.format, true)} ${compareLabel}`
              : " "}
          </span>
          <span className="mt-2">
            {series.length > 1 ? (
              <Sparkline data={series} color={color} />
            ) : (
              <span className="block h-[30px]" />
            )}
          </span>
        </>
      ) : (
        <span className="mt-2 line-clamp-3 text-xs leading-snug text-[var(--muted)]">
          {error ? `Not loading: ${error}` : "No data for these dates yet."}
        </span>
      )}
    </button>
  );
}

const TOOL_VIEWS: Record<ToolSummary["product"], View> = {
  linkedin: "ap-linkedin",
  meta: "ap-meta",
  blog: "ap-blog",
  newsletter: "ap-newsletter",
};

/** Autopilot: each tool's plan, posts left, and what's waiting, with a way in. */
function Automations({
  tools,
  go,
}: {
  tools: ToolSummary[] | null;
  go: (v: View) => void;
}) {
  if (!tools) return <Skeleton className="h-[104px]" />;
  return (
    <Card
      title="Your automations"
      sub="Every automation starts with 3 free posts. Approve drafts and they go out on schedule."
    >
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tools.map((t) => {
          const v = TOOL_VIEWS[t.product];
          const meta = PLATFORM[v];
          const state = !t.connected
            ? "Not connected"
            : t.drafts
              ? `${t.drafts} to review`
              : t.scheduled
                ? `${t.scheduled} scheduled`
                : "Up to date";
          return (
            <li key={t.product}>
              <button
                type="button"
                onClick={() => go(v)}
                className="flex h-full w-full flex-col rounded-lg border border-[var(--line)] p-3 text-left transition hover:border-[var(--line-strong)] hover:bg-[var(--hover)]"
              >
                <span
                  className="flex items-center gap-1.5 text-[13px] font-semibold"
                  style={{ color: meta.color }}
                >
                  {meta.icon}
                  {t.name}
                </span>
                <span className="mt-2 text-xs text-[var(--muted)]">
                  {t.plan} ·{" "}
                  <span className="font-semibold tabular-nums text-[var(--ink)]">
                    {t.left}
                  </span>{" "}
                  of {t.limit} left
                </span>
                <span
                  className={`mt-1 text-xs font-medium ${!t.connected ? "text-[var(--faint)]" : t.drafts ? "text-[var(--brand)]" : "text-[var(--good)]"}`}
                >
                  {t.live || !t.connected
                    ? state
                    : "Plan paused · subscribe to continue"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
