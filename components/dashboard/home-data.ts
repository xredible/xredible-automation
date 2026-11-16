"use client";

import { useEffect, useRef, useState } from "react";
import type { AnySection } from "@/lib/dashboard/types";
import type { BusinessKey } from "@/lib/dashboard/businesses";
import { limited, loadKey, sectionKey } from "./state";

export type HomeEntry = { data: AnySection; range: string; at: number };
const PREFIX = "xd-home-v1:";
const DAY = 86400_000;
const rangeKey = (start: string, end: string, cmp: string) =>
  `${start} – ${end} (${cmp})`;
const storageKey = (account: string, biz: BusinessKey) =>
  PREFIX + encodeURIComponent(account) + ":" + biz;

// Only Home's queue and aggregate report data are retained. Subscriber/contact
// tables and content reports never enter persistent storage. Storage is optional.
function save(key: string, entries: Record<string, HomeEntry>) {
  try {
    const safe = Object.fromEntries(
      Object.entries(entries)
        .filter(([, e]) => e.data.ok)
        .map(([section, e]) => {
          const d = e.data;
          return [
            section,
            {
              ...e,
              data:
                d.ok && "kpis" in d
                  ? {
                      ok: true,
                      section: d.section,
                      range: d.range,
                      generatedAt: d.generatedAt,
                      kpis: d.kpis,
                      tables: [],
                      items: null,
                      filters: {},
                      account: null,
                      notes: [],
                      errors: [],
                    }
                  : d,
            },
          ];
        }),
    );
    localStorage.setItem(key, JSON.stringify(safe));
  } catch {
    /* Private browsing / full storage: keep the in-memory answer. */
  }
}
function read(key: string, sections: string[]): Record<string, HomeEntry> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    return Object.fromEntries(
      Object.entries(parsed).filter(([section, value]) => {
        const e = value as HomeEntry;
        return (
          sections.includes(section) &&
          e &&
          Number.isFinite(e.at) &&
          e.at <= Date.now() &&
          Date.now() - e.at < DAY &&
          typeof e.range === "string" &&
          e.data?.ok &&
          (section === "queue"
            ? "items" in e.data && Array.isArray(e.data.items)
            : "kpis" in e.data && Array.isArray(e.data.kpis))
        );
      }),
    ) as Record<string, HomeEntry>;
  } catch {
    return {};
  }
}

export function useHomeData(
  account: string,
  biz: BusinessKey,
  sections: string[],
  start: string,
  end: string,
  cmp: string,
  refreshTick: number,
) {
  const [entries, setEntries] = useState<Record<string, HomeEntry>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(() => Date.now());
  const lastTick = useRef(refreshTick);
  const range = rangeKey(start, end, cmp);
  useEffect(() => {
    let alive = true;
    const key = storageKey(account, biz);
    const fresh = refreshTick !== lastTick.current;
    lastTick.current = refreshTick;
    // Restore browser data after hydration; the server never reads browser storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries((cur) => (Object.keys(cur).length ? cur : read(key, sections)));
    setErrors({});
    setLoading(true);
    const accept = (section: string, data: AnySection) => {
      if (!alive) return;
      if (!data.ok) {
        setErrors((cur) => ({ ...cur, [section]: data.error }));
        return;
      }
      // Use the source's timestamp rather than making an old server answer look new.
      const sourceTime =
        "generatedAt" in data ? Date.parse(data.generatedAt) : NaN;
      setEntries((cur) => {
        const next = {
          ...cur,
          [section]: {
            data,
            range,
            at: Number.isFinite(sourceTime)
              ? Math.min(Date.now(), sourceTime)
              : Date.now(),
          },
        };
        return next;
      });
    };
    limited(
      sections.map(
        (section) => async () =>
          accept(
            section,
            await loadKey(sectionKey(biz, section, start, end, cmp), fresh),
          ),
      ),
      3,
    ).then(() => {
      if (alive) setLoading(false);
    });
    const reloadQueue = () => {
      void loadKey(sectionKey(biz, "queue", start, end, cmp), true).then((d) =>
        accept("queue", d),
      );
    };
    window.addEventListener("ec-queue-changed", reloadQueue);
    return () => {
      alive = false;
      window.removeEventListener("ec-queue-changed", reloadQueue);
    };
  }, [account, biz, sections, start, end, cmp, range, refreshTick]);
  useEffect(() => {
    if (Object.keys(entries).length) save(storageKey(account, biz), entries);
  }, [entries, account, biz]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const times = Object.values(entries).map((e) => e.at);
  const oldest = times.length ? Math.min(...times) : null;
  const mins =
    oldest === null ? 0 : Math.max(0, Math.floor((clock - oldest) / 60_000));
  const updated =
    oldest === null
      ? "Loading Home…"
      : `Updated ${mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)} hr ago`}`;
  return { entries, errors, loading, range, updated, now: clock };
}
