"use client";
import { BUSINESSES, type BusinessKey } from "@/lib/dashboard/businesses";
import type { WorkspaceBusiness } from "@/lib/dashboard/business-workspace";
import { useHomeData, type HomeEntry } from "./home-data";
import { PLATFORM } from "./brand";
import { Card, Delta, Notice } from "./ui";
import { fmt } from "./format";
import type { View } from "./state";
const REPORT_SECTIONS = Object.fromEntries(
  Object.entries(BUSINESSES).map(([key, b]) => [
    key,
    b.sections.filter((s) => !["queue", "blog", "blogpost"].includes(s)),
  ]),
);
export function ChannelTable({
  biz,
  entries,
  errors,
  range,
  go,
}: {
  biz: BusinessKey;
  entries: Record<string, HomeEntry>;
  errors: Record<string, string>;
  range: string;
  go: (v: View) => void;
}) {
  const business = BUSINESSES[biz];
  const data = Object.fromEntries(
    Object.entries(entries).map(([key, e]) => [key, e.data]),
  );
  const picks = business.picks.filter(
    (p) => !["ap-ideas", "automation-images"].includes(p.section),
  );
  const channelPicks = [
    ...picks,
    ...REPORT_SECTIONS[biz]
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

  const rangeNote = (section: string) => {
    const entry = entries[section];
    if (!entry) return null;
    const notes: string[] = [];
    if (entry.range !== range)
      notes.push(
        `Showing ${entry.range
          .replace(/\(prev\)$/, "(previous period)")
          .replace(/\(yoy\)$/, "(same dates last year)")
          .replace(/\(none\)$/, "(no comparison)")}.`,
      );
    const d = entry.data;
    if (d.ok && "range" in d) {
      const actual = `${d.range.start} – ${d.range.end}`;
      if (actual !== entry.range.split(" (")[0])
        notes.push(`Reported dates: ${actual}.`);
    }
    return notes.join(" ") || null;
  };
  return (
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
              d?.ok && "kpis" in d ? d.kpis.find((k) => k.key === p.key) : null;
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
  );
}
export function ResultsSummary({
  account,
  biz,
  start,
  end,
  cmp,
  refreshTick,
  go,
}: {
  account: string;
  biz: WorkspaceBusiness;
  start: string;
  end: string;
  cmp: string;
  refreshTick: number;
  go: (v: View) => void;
}) {
  const { entries, errors, range, loading, updated } = useHomeData(
    account,
    biz,
    REPORT_SECTIONS[biz],
    start,
    end,
    cmp,
    refreshTick,
    "results",
  );
  return (
    <div className="dash-results-summary space-y-4">
      <p role="status" className="text-xs text-[var(--muted)]">
        {Object.keys(entries).length
          ? updated
          : loading
            ? "Loading results…"
            : "No results loaded."}
        {loading ? " · Refreshing…" : ""}
      </p>
      <Card
        title="All channels"
        sub="Compare each channel's headline results, then open its full report."
      >
        <ChannelTable
          biz={biz}
          entries={entries}
          errors={errors}
          range={range}
          go={go}
        />
      </Card>
      {Object.keys(errors).length ? (
        <Notice tone="warn" title="Some channels could not refresh">
          {Object.entries(errors)
            .map(([s, e]) => `${PLATFORM[s]?.short || s}: ${e}`)
            .join(" · ")}
          . Last successful results remain visible where available.
        </Notice>
      ) : null}
    </div>
  );
}
