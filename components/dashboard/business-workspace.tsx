"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Clock, ImageIcon, ShieldCheck } from "lucide-react";
import { Card, Notice, Skeleton } from "./ui";
import { SectionView } from "./section-view";
import {
  BUSINESS_RULES,
  type Workspace,
  type WorkspaceBusiness,
  type BusinessKit,
  type BusinessSettings,
} from "@/lib/dashboard/business-workspace";
import type { SectionData } from "@/lib/dashboard/types";
import type { View } from "./state";
import { ghost, primary } from "@/components/autopilot/ui";
import {
  Colour,
  ConfirmChange,
  HelpTopics,
  IdeaComposer,
  WorkspaceField,
} from "@/components/autopilot/workspace-parts";
const at = (s?: string) =>
  s
    ? new Date(s).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not reported";
type Change = { title: string; detail: string; body: Record<string, unknown> };
export function BusinessWorkspace({
  biz,
  view,
  owner,
  go,
  emailData,
  emailError,
}: {
  biz: WorkspaceBusiness;
  view: View;
  owner: boolean;
  go: (v: View) => void;
  emailData?: SectionData | null;
  emailError?: string;
}) {
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false),
    [change, setChange] = useState<Change | null>(null);
  const [postId, setPostId] = useState("");
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const r = await fetch(`/dashboard/workspace?biz=${biz}&view=${view}`, {
          cache: "no-store",
          signal,
        });
        const j = await r.json();
        if (j.ok) {
          setData(j);
          setError("");
        } else setError(j.error || "Could not load workspace.");
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError"))
          setError("No connection. Try Refresh.");
      }
    },
    [biz, view],
  );
  useEffect(() => {
    const c = new AbortController();
    void Promise.resolve().then(() => {
      if (!c.signal.aborted) return load(c.signal);
    });
    return () => c.abort();
  }, [load]);
  const run = async () => {
    if (!change) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/dashboard/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ biz, ...change.body, confirmed: true }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Change failed.");
      setMsg(j.done);
      setChange(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Change failed.");
    } finally {
      setBusy(false);
    }
  };
  const ask = (
    title: string,
    body: Record<string, unknown>,
    detail = "This change is logged. Existing content review and publishing approvals still apply.",
  ) => setChange({ title, body, detail });
  if (!data)
    return error ? (
      <Notice tone="error">{error}</Notice>
    ) : (
      <Skeleton className="h-80" />
    );
  const automation = data.automations.find(
    (a) => view === `automation-${a.key}`,
  );
  return (
    <div className="space-y-5">
      {change ? (
        <ConfirmChange
          title={change.title}
          busy={busy}
          onClose={() => setChange(null)}
          onConfirm={run}
        >
          {change.detail}
        </ConfirmChange>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {msg ? (
        <div role="status">
          <Notice>{msg}</Notice>
        </div>
      ) : null}
      {!owner ? (
        <Notice>
          Only the owner can change this business workspace. You can review its
          data here.
        </Notice>
      ) : null}
      {view === "ap-ideas" ? (
        <>
          <Card
            title="Ideas for the next draft"
            sub="Seasonal topics first. Each business keeps its own ideas and content queue."
          >
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <ShieldCheck className="h-4 w-4 shrink-0" /> Drafts need review
              before Ready or publishing.
            </div>
          </Card>
          <IdeaComposer
            key={biz + data.ideas.length}
            disabled={!owner || busy}
            onAdd={(v) => ask("Add this idea?", { op: "add_idea", ...v })}
          />
          <Card
            title={`${data.ideas.filter((i) => !/skipped|drafted|posted/i.test(i.status)).length} ideas waiting`}
          >
            <ul className="divide-y divide-[var(--line-soft)]">
              {data.ideas.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-start gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{i.title}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {i.seasonal ? "Seasonal · " : ""}
                      {i.status} · {i.source}
                      {i.keyword ? ` · ${i.keyword}` : ""}
                      {i.planned ? ` · ${i.planned.slice(0, 10)}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {biz === "nestoodle" &&
                    /planned|new|pending/i.test(i.status) ? (
                      <>
                        <button
                          className={ghost}
                          disabled={!owner || busy}
                          onClick={() =>
                            ask(
                              "Write this topic now?",
                              { op: "write_now", row: i.row },
                              "The existing writer creates a WordPress draft for Sakshi. This does not release scheduled runs or publish the article.",
                            )
                          }
                        >
                          Write now
                        </button>
                        <button
                          className={ghost}
                          disabled={!owner || busy}
                          onClick={() =>
                            ask("Skip this topic?", { op: "skip", row: i.row })
                          }
                        >
                          Skip
                        </button>
                      </>
                    ) : i.source === "Ideas" && i.status !== "Skipped" ? (
                      <button
                        className={ghost}
                        disabled={!owner || busy}
                        onClick={() =>
                          ask("Skip this idea?", { op: "skip_idea", id: i.id })
                        }
                      >
                        Skip
                      </button>
                    ) : i.source === "Content queue" ? (
                      <button className={ghost} onClick={() => go("schedule")}>
                        Review <ArrowRight className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            {!data.ideas.length ? (
              <p className="text-sm text-[var(--muted)]">
                No ideas yet. Add one above.
              </p>
            ) : null}
          </Card>
          <Rules biz={biz} />
        </>
      ) : null}
      {automation ? (
        <>
          <Card title={automation.name} sub={automation.description}>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${automation.held ? "bg-[var(--chip)]" : "bg-[var(--good-bg)] text-[var(--good)]"}`}
              >
                {automation.held
                  ? "Held"
                  : automation.observedAt
                    ? automation.active
                      ? "On at last check"
                      : "Inactive at last check"
                    : "State not reported"}
              </span>
              {automation.observedAt ? (
                <span className="text-xs text-[var(--faint)]">
                  Snapshot {at(automation.observedAt)}
                </span>
              ) : null}
            </div>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-[var(--muted)]">Schedule</dt>
                <dd className="mt-1 flex gap-2">
                  <Clock className="h-4 w-4 shrink-0" />
                  {automation.schedule}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">Last run</dt>
                <dd className="mt-1">
                  {automation.lastRun
                    ? `${automation.lastRun.status} · ${at(automation.lastRun.at)}`
                    : "Not reported"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">Next run</dt>
                <dd className="mt-1">
                  {automation.held
                    ? "Held"
                    : automation.nextRun
                      ? at(automation.nextRun)
                      : "See schedule"}
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {automation.key === "writer" ? (
                <button className={primary} onClick={() => go("ap-ideas")}>
                  Choose a topic to write
                </button>
              ) : null}
              <button
                className={ghost}
                disabled={
                  !owner ||
                  busy ||
                  !automation.canHold ||
                  !!automation.lockedHold
                }
                onClick={() =>
                  ask(
                    automation.held
                      ? "Resume this automation?"
                      : "Hold this automation?",
                    { op: "hold", key: automation.key, held: !automation.held },
                    "Change the workflow's verified hold flag. The workflow stays active; existing approval rules remain in effect.",
                  )
                }
              >
                {automation.held ? "Resume" : "Pause"}
              </button>
              <button className={ghost} onClick={() => go("schedule")}>
                Content calendar
              </button>
            </div>
            {automation.lockedHold ? (
              <p className="mt-3 text-xs text-[var(--muted)]">
                Scheduled writing is held for owner review. Write Now can still
                request an individual draft.
              </p>
            ) : !automation.canHold ? (
              <p className="mt-3 text-xs text-[var(--muted)]">
                Dashboard pause is unavailable until this workflow has a
                verified hold flag.
              </p>
            ) : null}
          </Card>
          <Card title="Recent errors">
            {automation.errors.length ? (
              <ul className="space-y-2">
                {automation.errors.map((e, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-[var(--muted)]">{at(e.at)} · </span>
                    {e.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                No errors reported by monitoring.
              </p>
            )}
          </Card>
          {automation.key === "images" ? (
            <>
              <Card
                title="Make images"
                sub="Same guarded image task as the Nestoodle ready command. A post is read fresh before it is queued."
              >
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    ask(
                      "Queue images for this post?",
                      { op: "make_images", postId: Number(postId) },
                      "The worker will process an image-only request using the existing quality checks. Article text and publishing approval stay with the owner.",
                    );
                  }}
                >
                  <WorkspaceField
                    label="WordPress post number"
                    value={postId}
                    onChange={setPostId}
                    type="number"
                    disabled={!owner}
                  />
                  <button
                    className={primary}
                    disabled={!owner || busy || !/^\d+$/.test(postId)}
                  >
                    <ImageIcon className="h-4 w-4" />
                    Make images
                  </button>
                </form>
              </Card>
              <Card title="Image queue">
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {["queued", "in_progress", "done", "blocked"].map((s) => (
                    <div key={s} className="rounded-lg bg-[var(--chip)] p-3">
                      <div className="text-xl font-semibold">
                        {data.images.filter((i) => i.status === s).length}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {s.replace("_", " ")}
                      </div>
                    </div>
                  ))}
                </div>
                <ul className="divide-y divide-[var(--line-soft)]">
                  {data.images.map((i) => (
                    <li key={i.id} className="py-3">
                      <div className="flex flex-wrap justify-between gap-2 text-sm font-medium">
                        <span>
                          {i.title} · #{i.postId}
                        </span>
                        <span>{i.status.replace("_", " ")}</span>
                      </div>
                      <p className="mt-1 break-words text-xs text-[var(--muted)]">
                        {i.notes || "No notes yet"} · {at(i.requestedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
                {!data.images.length ? (
                  <p className="text-sm text-[var(--muted)]">
                    No image requests yet.
                  </p>
                ) : null}
              </Card>
            </>
          ) : null}
          <Card title="Recent dashboard actions">
            <ul className="space-y-2 text-xs text-[var(--muted)]">
              {data.audit.map((a, i) => (
                <li key={i}>
                  {at(a.at)} · {a.actor} · {a.action} · {a.result}
                </li>
              ))}
            </ul>
            {!data.audit.length ? (
              <p className="text-sm text-[var(--muted)]">
                No dashboard actions recorded.
              </p>
            ) : null}
          </Card>
        </>
      ) : null}
      {view === "email" ? (
        <>
          {emailError ? (
            <Notice tone="error">{emailError}</Notice>
          ) : emailData ? (
            <SectionView data={emailData} color="#7c6bc4" compareLabel={null} />
          ) : (
            <Skeleton className="h-64" />
          )}
          <Card
            title="Current email previews"
            sub="Read-only copies from the current email workflow. No email is sent from this page."
          >
            {data.previews.length ? (
              data.previews.map((p) => (
                <details key={p.title} className="py-2">
                  <summary className="cursor-pointer text-sm font-medium">
                    {p.title}
                  </summary>
                  <iframe
                    title={p.title}
                    sandbox=""
                    srcDoc={p.html}
                    className="mt-3 h-[600px] w-full rounded-lg border border-[var(--line)] bg-white"
                  />
                </details>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">
                The email workflow has not supplied a preview yet.
              </p>
            )}
          </Card>
        </>
      ) : null}
      {view === "ap-brand" ? (
        <>
          <BrandForm
            key={biz}
            kit={data.kit}
            disabled={!owner || busy}
            onSave={(kit) =>
              ask(
                "Save this brand kit?",
                { op: "brand", kit },
                "Save this business's brand reference. Existing rendering templates and content checks are not changed automatically.",
              )
            }
          />
          <Rules biz={biz} />
        </>
      ) : null}
      {view === "settings" ? (
        <SettingsForm
          key={biz}
          settings={data.settings}
          disabled={!owner || busy}
          onSave={(settings) =>
            ask(
              "Save business preferences?",
              { op: "settings", settings },
              "Save business preferences. Existing workflow schedules and notification destinations require a separate verified workflow change.",
            )
          }
        />
      ) : null}
      {view === "help" ? (
        <>
          <Rules biz={biz} />
          <HelpTopics
            topics={
              biz === "nestoodle"
                ? [
                    [
                      "How do I request images?",
                      "In Nestoodle Alert, send ready <title> or ready <post number>. You can also use Image queue → Make images. The worker checks approximately every 10 minutes; blocked tasks show notes.",
                    ],
                    [
                      "How does Draft → Ready work?",
                      "Review text and media first. Sakshi reviews WordPress drafts. Only the owner decides when content is approved; creating an idea or requesting images does not publish anything.",
                    ],
                    [
                      "How do I upload Pinterest pins?",
                      "Open the weekly Pinterest CSV and preview from Telegram. Review each pin, then upload the CSV manually in Pinterest's bulk creation tool. No automatic Pinterest publishing.",
                    ],
                    [
                      "What does Pause do?",
                      "A supported Pause changes a hold flag read by that workflow. It never deactivates the workflow. An unavailable button means no verified hold flag is connected.",
                    ],
                  ]
                : [
                    [
                      "How does Draft → Ready work?",
                      "Review text, exact O.V. verses and speaker photos in the content calendar. The owner decides Draft → Ready. Existing publishers process approved rows only.",
                    ],
                    [
                      "How do I use the YouTube and WhatsApp packs?",
                      "Review the pack delivered to Telegram. Schedule YouTube Posts in Studio and forward WhatsApp messages manually after review.",
                    ],
                    [
                      "What are the content rules?",
                      "Hindi and English only. No city names. Check Hindi Bible verses word for word in the O.V. Credit Br Chandra Mohan only for his work and match speaker photos.",
                    ],
                    [
                      "Does this dashboard publish content?",
                      "Ideas, brand references and preferences do not publish. Existing content actions and approvals remain in control.",
                    ],
                  ]
            }
          />
        </>
      ) : null}
    </div>
  );
}
function Rules({ biz }: { biz: WorkspaceBusiness }) {
  return (
    <Card title="Content and approval rules">
      <ul className="list-disc space-y-2 pl-4 text-sm text-[var(--muted)]">
        {BUSINESS_RULES[biz].map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </Card>
  );
}
function BrandForm({
  kit,
  disabled,
  onSave,
}: {
  kit: BusinessKit;
  disabled: boolean;
  onSave: (k: BusinessKit) => void;
}) {
  const [value, setValue] = useState(kit);
  return (
    <Card
      title="Brand kit"
      sub="This business's logo, colours, typography and voice reference."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(value);
        }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <img
            src={value.logo}
            alt="Business logo"
            className="h-16 w-16 rounded-lg object-contain"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {value.palette.map((c, i) => (
              <Colour
                key={i}
                name={`Colour ${i + 1}`}
                value={c}
                disabled={disabled}
                onChange={(v) =>
                  setValue({
                    ...value,
                    palette: value.palette.map((old, n) => (n === i ? v : old)),
                  })
                }
              />
            ))}
          </div>
        </div>
        {(["logo", "fonts", "voice", "imageRules"] as const).map((k) => (
          <WorkspaceField
            key={k}
            label={
              {
                logo: "Logo URL",
                fonts: "Fonts",
                voice: "Voice",
                imageRules: "Image rules",
              }[k]
            }
            value={value[k]}
            onChange={(v) => setValue({ ...value, [k]: v })}
            multiline={k === "voice" || k === "imageRules"}
            disabled={disabled}
          />
        ))}
        <button className={primary} disabled={disabled}>
          Save brand kit
        </button>
      </form>
    </Card>
  );
}
function SettingsForm({
  settings,
  disabled,
  onSave,
}: {
  settings: BusinessSettings;
  disabled: boolean;
  onSave: (s: BusinessSettings) => void;
}) {
  const [value, setValue] = useState(settings);
  return (
    <Card
      title="Business settings"
      sub="Saved preferences for this business. Workflow schedules and notification destinations are managed separately."
    >
      <form
        className="max-w-xl space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(value);
        }}
      >
        {(["timezone", "postingTimes", "notificationChannel"] as const).map(
          (k) => (
            <WorkspaceField
              key={k}
              label={
                {
                  timezone: "Timezone",
                  postingTimes: "Preferred posting times",
                  notificationChannel: "Preferred notification channel",
                }[k]
              }
              value={value[k]}
              onChange={(v) => setValue({ ...value, [k]: v })}
              disabled={disabled}
            />
          ),
        )}
        <button className={primary} disabled={disabled}>
          Save preferences
        </button>
      </form>
    </Card>
  );
}
