"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { AutomationHub } from "./automation-hub";
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
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const r = await fetch(
          `/dashboard/workspace?biz=${biz}&view=${view === "automations" ? "automation-images" : view}`,
          {
            cache: "no-store",
            signal,
          },
        );
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
    setMsg("");
    let completed = 0;
    const ids = Array.isArray(change.body.postIds)
      ? (change.body.postIds as number[])
      : null;
    try {
      const requests = ids
        ? ids.map((postId) => ({ op: "make_images", postId }))
        : [change.body];
      for (const body of requests) {
        const r = await fetch("/dashboard/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ biz, ...body, confirmed: true }),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "Change failed.");
        completed++;
        setMsg(
          ids ? `${completed} of ${ids.length} image requests queued.` : j.done,
        );
      }
      setChange(null);
      await load();
    } catch (e) {
      if (ids) {
        setChange(null);
        await load();
      }
      setError(
        `${ids ? `${completed} of ${ids.length} requests completed. ` : ""}${e instanceof Error ? e.message : "Change failed."}`,
      );
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
  return (
    <div className="dash-workspace space-y-5">
      {change ? (
        <ConfirmChange
          title={change.title}
          busy={busy}
          onClose={() => setChange(null)}
          onConfirm={run}
        >
          {change.detail}
          {busy && Array.isArray(change.body.postIds) ? (
            <p role="status" className="mt-3 font-medium">
              {msg || "Checking the first draft…"}
            </p>
          ) : null}
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
      {view === "automations" || view.startsWith("automation-") ? (
        <AutomationHub
          biz={biz}
          view={view}
          data={data}
          owner={owner}
          busy={busy}
          go={go}
          ask={ask}
        />
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
