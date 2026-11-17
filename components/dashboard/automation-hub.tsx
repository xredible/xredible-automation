"use client";

import { useEffect, useId, useState } from "react";
import {
  ArrowRight,
  Clock,
  History,
  ImageIcon,
  PenLine,
  Share2,
  Send,
  Mail,
  Pin,
  Play,
  FileText,
  MessageCircle,
  Radio,
  Settings2,
} from "lucide-react";
import { ghost, primary, field } from "@/components/autopilot/ui";
import type {
  Automation,
  Workspace,
  WorkspaceBusiness,
} from "@/lib/dashboard/business-workspace";
import type { BlogData } from "@/lib/dashboard/types";
import { loadKey, type View } from "./state";
import { Card, Notice, Skeleton } from "./ui";

export const workspaceTime = (s?: string) =>
  s && Number.isFinite(Date.parse(s))
    ? new Date(s).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not reported";
export type WorkspaceAsk = (
  title: string,
  body: Record<string, unknown>,
  detail?: string,
) => void;
const destination = (key: string): { view: View; label: string } =>
  key === "writer"
    ? { view: "ap-ideas", label: "Choose a topic" }
    : key === "emails"
      ? { view: "email", label: "View email results" }
      : {
          view: "schedule",
          label:
            key === "social"
              ? "Review social drafts"
              : key === "pinterest"
                ? "Review Pinterest posts"
                : "Review calendar",
        };

function AutomationCard({
  automation: a,
  go,
  images,
}: {
  automation: Automation;
  go: (v: View) => void;
  images: () => void;
}) {
  const action = destination(a.key);
  const Icon =
    (
      {
        writer: PenLine,
        social: Share2,
        publisher: Send,
        emails: Mail,
        pinterest: Pin,
        images: ImageIcon,
        shorts: Play,
        "youtube-pack": FileText,
        whatsapp: MessageCircle,
        live: Radio,
      } as Record<string, typeof Settings2>
    )[a.key] || Settings2;
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Icon aria-hidden className="h-5 w-5 text-[var(--brand)]" />
          {a.name}
        </span>
      }
    >
      <p className="min-h-10 text-sm text-[var(--muted)]">{a.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${a.held ? "bg-[var(--chip)]" : a.observedAt && a.active ? "bg-[var(--good-bg)] text-[var(--good)]" : "bg-[var(--chip)]"}`}
        >
          {a.held
            ? "Held"
            : !a.observedAt
              ? "State not reported"
              : a.active === true
                ? "On at last check"
                : a.active === false
                  ? "Inactive at last check"
                  : "State not reported"}
        </span>
        {a.observedAt ? (
          <span className="text-xs text-[var(--muted)]">
            Snapshot {workspaceTime(a.observedAt)}
          </span>
        ) : null}
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-[var(--muted)]">Schedule</dt>
          <dd className="mt-1 flex gap-2">
            <Clock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            {a.schedule}
          </dd>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-[var(--muted)]">Last run</dt>
            <dd className="mt-1">
              {a.lastRun
                ? `${a.lastRun.status} · ${workspaceTime(a.lastRun.at)}`
                : "Not reported"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Next run</dt>
            <dd className="mt-1">
              {a.held
                ? "Held"
                : a.nextRun
                  ? workspaceTime(a.nextRun)
                  : "Not reported · see schedule"}
            </dd>
          </div>
        </div>
      </dl>
      {a.lockedHold ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Scheduled writing stays held. Choose a topic to request an individual
          draft.
        </p>
      ) : null}
      <button
        type="button"
        className={`${primary} mt-4`}
        onClick={() => (a.key === "images" ? images() : go(action.view))}
      >
        {a.key === "images" ? "Open image queue" : action.label}
        <ArrowRight aria-hidden className="h-4 w-4" />
      </button>
      <details className="mt-3 border-t border-[var(--line-soft)] pt-2">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <History aria-hidden className="h-4 w-4" />
          History
          <span className="text-xs text-[var(--muted)]">
            {a.errors.length ? `${a.errors.length} reported ${a.errors.length === 1 ? "error" : "errors"}` : ""}
          </span>
        </summary>
        <div className="mt-2 space-y-2 text-xs text-[var(--muted)]">
          <p>
            {a.lastRun
              ? `Last reported run: ${a.lastRun.status} · ${workspaceTime(a.lastRun.at)}`
              : "No run history has been reported."}
          </p>
          {a.errors.length ? (
            <ul className="space-y-2">
              {a.errors.map((e, i) => (
                <li key={`${e.at}-${i}`}>
                  <span className="font-medium text-[var(--bad)]">
                    Reported error
                  </span>{" "}
                  · {workspaceTime(e.at)}
                  <p className="mt-1 break-words">{e.message}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No errors in the available snapshot.</p>
          )}
          <p>Monitoring snapshots may be older than the latest execution.</p>
        </div>
      </details>
    </Card>
  );
}

export function AutomationHub({
  biz,
  view,
  data,
  owner,
  busy,
  go,
  ask,
}: {
  biz: WorkspaceBusiness;
  view: View;
  data: Workspace;
  owner: boolean;
  busy: boolean;
  go: (v: View) => void;
  ask: WorkspaceAsk;
}) {
  const all = view === "automations";
  const selected = data.automations.filter(
    (a) => all || view === `automation-${a.key}`,
  );
  const showImages =
    biz === "nestoodle" && (all || view === "automation-images");
  const openImages = () =>
    document.getElementById("nestoodle-image-queue")?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  return (
    <div className="dash-automation-hub space-y-5">
      <p className="text-sm text-[var(--muted)]">
        Review each automation and its reported history. Workflow pausing
        remains unavailable. Existing content and publishing approvals still
        apply.
      </p>
      {!all ? (
        <button
          type="button"
          className={ghost}
          onClick={() => go("automations")}
        >
          All automations
        </button>
      ) : null}
      <div
        className={`grid items-start gap-4 ${all ? "md:grid-cols-2 xl:grid-cols-3" : ""}`}
      >
        {selected.map((a) => (
          <AutomationCard
            key={a.key}
            automation={a}
            go={go}
            images={openImages}
          />
        ))}
      </div>
      {showImages ? (
        <ImageQueuePanel data={data} owner={owner} busy={busy} ask={ask} />
      ) : null}
      <Card
        title="Recent dashboard actions"
        sub="Business-wide actions, separate from the run snapshots above."
      >
        <ul className="space-y-2 text-xs text-[var(--muted)]">
          {data.audit.map((a, i) => (
            <li key={i}>
              {workspaceTime(a.at)} · {a.actor} · {a.action} · {a.result}
            </li>
          ))}
        </ul>
        {!data.audit.length ? (
          <p className="text-sm text-[var(--muted)]">
            No dashboard actions recorded.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

function ImageQueuePanel({
  data,
  owner,
  busy,
  ask,
}: {
  data: Workspace;
  owner: boolean;
  busy: boolean;
  ask: WorkspaceAsk;
}) {
  const [blog, setBlog] = useState<BlogData | null>(null),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  const listId = useId();
  useEffect(() => {
    let alive = true;
    void loadKey("biz=nestoodle&section=blog", true).then((d) => {
      if (!alive) return;
      if (d.ok && "posts" in d) setBlog(d as BlogData);
      else setError(d.ok ? "Could not read drafts." : d.error);
    });
    return () => {
      alive = false;
    };
  }, []);
  const [shown, setShown] = useState(10);
  const rank = (status: string) =>
    status === "in_progress"
      ? 0
      : status === "queued"
        ? 1
        : status === "blocked"
          ? 2
          : 3;
  const requests = [...data.images].sort(
    (a, b) =>
      rank(a.status) - rank(b.status) ||
      (b.requestedAt || "").localeCompare(a.requestedAt || ""),
  );
  const posts = blog?.posts || [];
  const matched = posts.filter(
    (p) =>
      p.title.toLocaleLowerCase() === query.trim().toLocaleLowerCase() ||
      `${p.title} (#${p.id})` === query.trim(),
  );
  const candidate = /^\d+$/.test(query.trim())
    ? Number(query)
    : matched.length === 1
      ? matched[0].id
      : null;
  const postId =
    candidate && Number.isSafeInteger(candidate) && candidate > 0
      ? candidate
      : null;
  const pending =
    !!postId &&
    data.images.some(
      (i) =>
        i.postId === postId && ["queued", "in_progress"].includes(i.status),
    );
  const drafts = posts.filter(
    (p) =>
      ["draft", "pending"].includes(p.status) &&
      !p.featuredImage &&
      !data.images.some((i) => i.postId === p.id),
  );
  const queue = (ids: number[]) =>
    ask(
      ids.length === 1
        ? "Queue images for this post?"
        : `Queue images for ${ids.length} drafts?`,
      { op: "make_images", postIds: ids },
      `Request image-only work for ${ids.map((id) => `${posts.find((p) => p.id === id)?.title || "Post"} (#${id})`).join(", ")}. Each post is checked fresh by the existing guarded action. Requests run one at a time and stop on the first error. Article text and publishing approvals stay unchanged.`,
    );
  return (
    <div id="nestoodle-image-queue" className="scroll-mt-20 space-y-4">
      <Card
        title={
          <span className="flex items-center gap-2">
            <ImageIcon aria-hidden className="h-5 w-5" />
            Nestoodle Image queue
          </span>
        }
        sub="Request image-only work. The worker checks approximately every 10 minutes."
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (postId && !pending && owner && !busy) queue([postId]);
          }}
        >
          <label className="min-w-0 flex-1 text-sm font-medium">
            Post title or number
            <input data-dashboard-jump="image-post"
              className={field}
              list={listId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={!owner || busy}
              placeholder="Choose a title, or enter a post number"
              autoComplete="off"
            />
            <datalist id={listId}>
              {posts.map((p) => (
                <option key={p.id} value={`${p.title} (#${p.id})`}>
                  {p.status}
                </option>
              ))}
            </datalist>
          </label>
          <button
            className={primary}
            disabled={!owner || busy || !postId || pending}
          >
            Make images
          </button>
        </form>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {pending
            ? "This post already has image work waiting or in progress."
            : query && !postId
              ? "Choose a listed title or enter a WordPress post number."
              : "Titles come from the current blog list. Post numbers also work for posts outside that list."}
        </p>
      </Card>
      <Card title="Image requests">
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {["queued", "in_progress", "done", "blocked"].map((s) => (
            <div key={s} className="rounded-lg bg-[var(--chip)] p-3">
              <div className="text-xl font-semibold">
                {data.images.filter((i) => i.status === s).length}
              </div>
              <div className="text-xs text-[var(--muted)]">
                {s.replaceAll("_", " ")}
              </div>
            </div>
          ))}
        </div>
        <ul className="divide-y divide-[var(--line-soft)]">
          {requests.slice(0, shown).map((i) => (
            <li key={i.id} className="py-3">
              <div className="flex flex-wrap justify-between gap-2 text-sm font-medium">
                <span>
                  {i.title} · #{i.postId}
                </span>
                <span className="rounded-full bg-[var(--chip)] px-2 py-1 text-xs">
                  {i.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-1 break-words text-xs text-[var(--muted)]">
                {i.notes || "No notes yet"} · {workspaceTime(i.requestedAt)}
              </p>
            </li>
          ))}
        </ul>
        {requests.length > shown ? (
          <button
            type="button"
            className={ghost}
            onClick={() => setShown((n) => n + 10)}
          >
            Show more requests ({requests.length - shown})
          </button>
        ) : null}
        {!data.images.length ? (
          <p className="text-sm text-[var(--muted)]">No image requests yet.</p>
        ) : null}
      </Card>
      <Card
        title="Drafts not queued"
        sub="Drafts in the current blog list without a featured image or any previous image request."
        action={
          <button
            type="button"
            className={primary}
            disabled={!owner || busy || !drafts.length || !!error}
            onClick={() => queue(drafts.map((p) => p.id))}
          >
            Queue all{drafts.length ? ` (${drafts.length})` : ""}
          </button>
        }
      >
        {error ? (
          <Notice tone="error">
            {error} Refresh before queuing drafts. You can still request a known
            post number above.
          </Notice>
        ) : !blog ? (
          <Skeleton className="h-24" />
        ) : drafts.length ? (
          <ul className="divide-y divide-[var(--line-soft)]">
            {drafts.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{p.title}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    #{p.id} · {p.status}
                  </p>
                </div>
                <button
                  type="button"
                  className={ghost}
                  disabled={!owner || busy}
                  onClick={() => queue([p.id])}
                >
                  Queue images
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            No unqueued drafts without featured images in the current list.
          </p>
        )}
      </Card>
    </div>
  );
}
