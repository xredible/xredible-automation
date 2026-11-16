"use client";
import { useEffect, useState } from "react";
import { Lightbulb, ImageIcon } from "lucide-react";
import { Card, Notice } from "./ui";
import type {
  Workspace,
  WorkspaceBusiness,
} from "@/lib/dashboard/business-workspace";
import type { View } from "./state";
export function BusinessOverview({
  biz,
  go,
}: {
  biz: WorkspaceBusiness;
  go: (v: View) => void;
}) {
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    fetch(`/dashboard/workspace?biz=${biz}&view=summary`, {
      signal: c.signal,
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(true);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(true);
      });
    return () => c.abort();
  }, [biz]);
  if (error)
    return (
      <Notice>
        Workspace counts could not load. Open Ideas or Image queue to retry.
      </Notice>
    );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card
        title={
          <span className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Ideas waiting
          </span>
        }
      >
        <button
          onClick={() => go("ap-ideas")}
          className="text-2xl font-semibold text-[var(--brand)]"
          aria-label="Open ideas"
        >
          {data
            ? data.ideas.filter(
                (i) => !/skipped|drafted|posted/i.test(i.status),
              ).length
            : "…"}
        </button>
      </Card>
      {biz === "nestoodle" ? (
        <Card
          title={
            <span className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Images queued
            </span>
          }
        >
          <button
            onClick={() => go("automation-images")}
            className="text-2xl font-semibold text-[var(--brand)]"
            aria-label="Open image queue"
          >
            {data
              ? data.images.filter(
                  (i) => i.status === "queued" || i.status === "in_progress",
                ).length
              : "…"}
          </button>
        </Card>
      ) : null}
    </div>
  );
}
