// lib/autopilot/db.ts
//
// Server-only. Product data tables in n8n, reached through the dashboard gateway:
//   subs         XD Subscriptions   one row per customer per product (trial or paid)
//   li_profiles  XD LI Profiles     LinkedIn Autopilot settings + encrypted LinkedIn access
//   li_posts     XD LI Posts        drafts, approved, posted and failed posts

import { gateway } from "@/lib/dashboard/gateway"

export type Table = "subs" | "li_profiles" | "li_posts"
type Row = Record<string, unknown> & { id: number }

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const r = await gateway({ kind: "db", ...payload }, 25_000)
  const body = r.body as { ok?: boolean; error?: string } & T
  if (r.status !== 200 || !body?.ok) throw new Error(body?.error || "The data store didn't answer. Try again in a minute.")
  return body
}

export async function rows<T = Row>(table: Table, filter?: { col: string; val: string | number }): Promise<T[]> {
  const b = await call<{ rows: T[] }>({ table, op: "list", filter })
  return b.rows || []
}

export async function insert<T = Row>(table: Table, row: Record<string, unknown>): Promise<T> {
  const b = await call<{ row: T }>({ table, op: "insert", row })
  return b.row
}

export async function update(table: Table, id: number, row: Record<string, unknown>): Promise<void> {
  await call({ table, op: "update", id, row })
}

export async function remove(table: Table, id: number): Promise<void> {
  await call({ table, op: "delete", id })
}

/** Asks n8n to write new LinkedIn drafts for this customer now. */
export async function requestDrafts(email: string, count = 3): Promise<void> {
  await gateway({ kind: "li-generate", email, count }, 50_000)
}

/** A Telegram message to the Xredible admin (best effort). */
export async function notify(text: string): Promise<void> {
  await gateway({ kind: "notify", text: text.slice(0, 900) }, 15_000).catch(() => null)
}
