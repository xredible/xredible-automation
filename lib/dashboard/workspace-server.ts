import { CronExpressionParser } from "cron-parser";
import { randomUUID } from "node:crypto";
import { rows, insert, update, type Table } from "@/lib/autopilot/db";
import { gateway } from "./gateway";
import { loadSection, runBlogAction } from "./server";
import {
  AUTOMATIONS,
  DEFAULT_KITS,
  type WorkspaceBusiness,
  type Workspace,
  type Idea,
  type Automation,
} from "./business-workspace";
import type { BlogData, QueueData } from "./types";

type Entry = { id: number; key: string; value: string };
const table = (b: WorkspaceBusiness): Table =>
  b === "nestoodle" ? "nst_dashboard" : "ec_dashboard";
function decode<T>(entry: Entry | undefined, fallback: T): T {
  try {
    return entry ? (JSON.parse(entry.value) as T) : fallback;
  } catch {
    return fallback;
  }
}
export async function entries(b: WorkspaceBusiness) {
  return (await rows<Entry>(table(b))).sort((a, b) => b.id - a.id);
}
async function save(b: WorkspaceBusiness, key: string, value: unknown) {
  const matches = await rows<Entry>(table(b), { col: "key", val: key });
  const row = { key, value: JSON.stringify(value) };
  if (matches[0]) await update(table(b), matches[0].id, row);
  else await insert(table(b), row);
}
export async function audit(
  b: WorkspaceBusiness,
  actor: string,
  action: string,
  result: string,
) {
  await insert(table(b), {
    key: "audit:" + randomUUID(),
    value: JSON.stringify({
      at: new Date().toISOString(),
      actor,
      action,
      result,
    }),
  });
}
export async function workspace(
  b: WorkspaceBusiness,
  view = "ap-ideas",
): Promise<Workspace> {
  const list = await entries(b);
  const get = <T>(key: string, fallback: T) =>
    decode(
      list.find((r) => r.key === key),
      fallback,
    );
  const needsIdeas = view === "ap-ideas" || view === "summary";
  const source = needsIdeas
    ? await loadSection(
        b,
        b === "nestoodle" ? "blog" : "queue",
        new URLSearchParams(),
        true,
      )
    : { body: { ok: true, topics: [] } };
  const body = source.body as BlogData | QueueData;
  if (!body?.ok)
    throw new Error("Could not read business ideas. Refresh in a minute.");
  const ideas: Idea[] =
    b === "nestoodle" && "topics" in body
      ? body.topics.map((t) => ({
          id: String(t.row),
          row: t.row,
          title: t.title,
          status: t.status,
          keyword: t.keyword,
          planned: t.writeOn || t.publishOn || "",
          seasonal: /season|christmas|thanksgiving|winter|hanukkah/i.test(
            t.why + t.title + t.notes,
          ),
          source: "Topics",
        }))
      : "items" in body
        ? body.items
            .filter((i) => /draft/i.test(i.status))
            .map((i) => ({
              id: "queue:" + i.row,
              row: i.row,
              title: i.title,
              status: i.status,
              keyword: i.platform,
              planned: i.when || "",
              source: "Content queue",
            }))
        : [];
  if (b === "elevating-christ")
    ideas.push(
      ...list
        .filter((r) => r.key.startsWith("idea:"))
        .map((r) => ({ ...decode(r, {} as Idea), id: r.key })),
    );
  ideas.sort(
    (a, b) =>
      Number(!!b.seasonal) - Number(!!a.seasonal) ||
      a.planned.localeCompare(b.planned),
  );
  const automations = AUTOMATIONS[b].map((a) => {
    const status = get<
      Partial<Automation> & { schedules?: { cron: string; timezone: string }[] }
    >("status:" + a.key, {});
    const held = get("hold:" + a.key, false);
    let nextRun: string | undefined;
    // These two workflows do not declare a timezone. Do not guess the instance timezone.
    if (!held && status.active !== false && !(b === "nestoodle" && ["writer", "social"].includes(a.key))) {
      const next = (status.schedules || [])
        .flatMap((s) => {
          try {
            return [
              CronExpressionParser.parse(s.cron, { tz: s.timezone })
                .next()
                .toISOString(),
            ];
          } catch {
            return [];
          }
        })
        .filter((s): s is string => !!s)
        .sort();
      nextRun = next[0];
    }
    const { schedules: _schedules, ...publicStatus } = status;
    void _schedules;
    return {
      ...a,
      ...publicStatus,
      nextRun,
      held,
      canHold: get("holdVerified:" + a.key, false),
      errors: get<Automation["errors"]>("errors:" + a.key, []),
    };
  });
  if (b === "nestoodle") {
    automations[0].lockedHold = true;
    automations[0].held = true;
  }
  return {
    ok: true,
    ideas,
    automations,
    images:
      b === "nestoodle" && ["automation-images", "summary"].includes(view)
        ? await rows<Workspace["images"][number]>("nst_images")
        : [],
    kit: get("brand", DEFAULT_KITS[b]),
    settings: get("settings", {
      timezone: "Asia/Kolkata",
      postingTimes: "Use each automation's existing schedule",
      notificationChannel: "Existing business Telegram group",
    }),
    audit: list
      .filter((r) => r.key.startsWith("audit:"))
      .map((r) => decode(r, {} as Workspace["audit"][number]))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 30),
    previews: view === "email" ? get("emailPreviews", []) : [],
  };
}
const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
export async function workspaceAction(
  b: WorkspaceBusiness,
  actor: string,
  body: Record<string, unknown>,
) {
  const op = text(body.op, 40);
  if (body.confirmed !== true) throw new Error("Confirm this change first.");
  await audit(b, actor, op, "requested");
  try {
    if (op === "brand") {
      const k = body.kit as Workspace["kit"];
      if (
        !k ||
        !Array.isArray(k.palette) ||
        k.palette.length < 3 ||
        k.palette.length > 8 ||
        k.palette.some((c) => !/^#[a-f0-9]{6}$/i.test(c))
      )
        throw new Error("Use 3–8 full hex colours.");
      const logo = text(k.logo, 1000);
      if (logo && !/^https:\/\//.test(logo) && !/^\/[^/]/.test(logo))
        throw new Error("Use an HTTPS logo or a site asset.");
      await save(b, "brand", {
        logo,
        palette: k.palette,
        fonts: text(k.fonts, 300),
        voice: text(k.voice, 3000),
        imageRules: text(k.imageRules, 3000),
      });
    } else if (op === "settings") {
      const s = body.settings as Workspace["settings"];
      try {
        new Intl.DateTimeFormat("en", { timeZone: s.timezone }).format();
      } catch {
        throw new Error("Choose a valid timezone.");
      }
      await save(b, "settings", {
        timezone: text(s.timezone, 80),
        postingTimes: text(s.postingTimes, 500),
        notificationChannel: text(s.notificationChannel, 300),
      });
    } else if (op === "add_idea") {
      const title = text(body.title, 300);
      if (title.length < 3) throw new Error("Add a title.");
      const planned = text(body.planned, 10);
      if (planned && !/^\d{4}-\d{2}-\d{2}$/.test(planned))
        throw new Error("Choose a valid date.");
      if (b === "nestoodle")
        await proxy(b, {
          action: "add_idea",
          title,
          keyword: text(body.keyword, 200),
          planned,
        });
      else
        await save(b, "idea:" + randomUUID(), {
          title,
          keyword: text(body.keyword, 200),
          planned,
          status: "Draft",
          source: "Ideas",
        });
    } else if (op === "write_now" || op === "skip") {
      const row = Number(body.row);
      if (!Number.isSafeInteger(row) || row < 2)
        throw new Error("Choose a current topic.");
      if (b !== "nestoodle")
        throw new Error("Review church content in the content calendar.");
      const w = await workspace(b);
      const idea = w.ideas.find((i) => i.row === row);
      if (!idea || !/planned|new|pending/i.test(idea.status))
        throw new Error(
          "Only unwritten planned topics can use this action. Refresh first.",
        );
      const r = await runBlogAction(b, {
        action: op === "write_now" ? "write_now" : "skip_topic",
        row,
      });
      if (r.status !== 200 || !(r.body as { ok?: boolean })?.ok)
        throw new Error(
          (r.body as { error?: string })?.error || "The topic action failed.",
        );
    } else if (op === "skip_idea") {
      const key = text(body.id, 100);
      if (b !== "elevating-christ" || !key.startsWith("idea:"))
        throw new Error("Choose an idea from the Ideas list.");
      const list = await entries(b),
        e = list.find((r) => r.key === key);
      if (!e) throw new Error("Idea not found.");
      await save(b, key, { ...decode(e, {}), status: "Skipped" });
    } else if (op === "make_images") {
      if (b !== "nestoodle")
        throw new Error("Image requests are only available for Nestoodle.");
      const postId = Number(body.postId);
      if (!Number.isSafeInteger(postId) || postId < 1)
        throw new Error("Choose a post number.");
      const existing = await rows<{ postId: number; status: string }>(
        "nst_images",
      );
      if (
        existing.some(
          (r) =>
            r.postId === postId && ["queued", "in_progress"].includes(r.status),
        )
      )
        throw new Error(
          "This post already has image work waiting or in progress.",
        );
      await proxy(b, { action: "make_images", postId });
    } else if (op === "hold") {
      const key = text(body.key, 40),
        list = await entries(b);
      if (
        !AUTOMATIONS[b].some((a) => a.key === key) ||
        !decode(
          list.find((r) => r.key === "holdVerified:" + key),
          false,
        )
      )
        throw new Error("This workflow has no verified dashboard hold flag.");
      if (typeof body.held !== "boolean")
        throw new Error("Invalid hold state.");
      if (b === "nestoodle" && key === "writer" && !body.held)
        throw new Error(
          "The existing scheduled writer hold requires separate owner approval.",
        );
      await save(b, "hold:" + key, body.held);
    } else throw new Error("Unknown workspace action.");
    await audit(b, actor, op, "completed");
    return {
      ok: true,
      done: "Saved. Existing publishing approvals still apply.",
    };
  } catch (e) {
    await audit(b, actor, op, "failed");
    throw e;
  }
}
async function proxy(b: WorkspaceBusiness, body: Record<string, unknown>) {
  const r = await gateway({
    kind: "proxy",
    biz: b,
    path: "-ops",
    method: "POST",
    body,
  });
  if (r.status !== 200 || !(r.body as { ok?: boolean })?.ok)
    throw new Error(
      (r.body as { error?: string })?.error ||
        "The workspace action did not complete. Refresh before retrying.",
    );
}
