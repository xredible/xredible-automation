// lib/autopilot/queue-actions.ts
//
// Server-only. The dashboard's calendar buttons (Schedule / Pause / Resume / Draft / Retry /
// Reschedule, Pause all / Resume paused) for a customer's own Autopilot posts.
// Answers in the same shape as the n8n Dashboard Actions workflows, so the calendar code is shared.

import type { QueueAction } from "@/lib/dashboard/server"
import { postAction, postsFor } from "./service"
import { itemAction, itemById, TOOL_KEYS, type ToolKey } from "./tools"
import { rows } from "./db"
import { fromRow, rowOf } from "./report"

type Done = { row: number; to: string }
type Skipped = { row: number; why: string }

const SHOW: Record<string, string> = { approve: "Scheduled", pause: "Paused", unapprove: "Draft" }

async function one(email: string, row: number, op: "approve" | "pause" | "unapprove" | "reschedule", when?: string): Promise<Done | Skipped> {
  const { kind, id } = fromRow(row)
  try {
    if (kind === "li") await postAction(email, { op, id, when })
    else {
      const it = await itemById(id)
      if (!it || it.email !== email || !(TOOL_KEYS as string[]).includes(it.product)) throw new Error("That post isn't yours.")
      await itemAction(email, it.product as ToolKey, { op, id, when })
    }
    return { row, to: SHOW[op] || "" }
  } catch (e) {
    return { row, why: e instanceof Error ? e.message : "Not changed." }
  }
}

export async function runAutopilotAction(email: string, a: QueueAction): Promise<{ status: number; body: unknown }> {
  const results: (Done | Skipped)[] = []
  if (a.action === "status") {
    const op = a.to === "ready" ? "approve" : a.to === "paused" ? "pause" : "unapprove"
    for (const r of a.rows) results.push(await one(email, r.row, op))
  } else if (a.action === "reschedule") {
    for (const r of a.rows) results.push(await one(email, r.row, "reschedule", a.when))
  } else {
    // Pause everything scheduled, or put paused posts back on schedule.
    const from = a.action === "pause_all" ? "approved" : "paused"
    const op = a.action === "pause_all" ? "pause" : "approve"
    const [posts, items] = await Promise.all([postsFor(email), rows<Record<string, unknown>>("ap_items", { col: "email", val: email })])
    const targets = [
      ...posts.filter((p) => p.status === from).map((p) => rowOf("li", p.id)),
      ...items.filter((i) => i.status === from && !(Number(i.progress) > 0)).map((i) => rowOf("item", Number(i.id))),
    ]
    for (const row of targets) results.push(await one(email, row, op))
  }
  const done = results.filter((r): r is Done => "to" in r)
  const skipped = results.filter((r): r is Skipped => "why" in r)
  if (!done.length && !skipped.length) return { status: 200, body: { ok: true, changed: 0, done: [], skipped: [{ row: 0, why: a.action === "pause_all" ? "Nothing is scheduled right now." : "Nothing is paused." }] } }
  return { status: 200, body: { ok: true, changed: done.length, done, skipped } }
}
