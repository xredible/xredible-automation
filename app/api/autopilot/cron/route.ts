// POST /api/autopilot/cron — called every hour by n8n (XD-AP-C) with the X-XD-Secret header.
// Sends customers the emails that depend on time passing, each at most once:
//   drafts waiting for approval (daily, from 9 AM India time; can be turned off in Settings)
//   free posts used up · UPI plan ends in 3 days · plan ended · posts that failed

import { NextResponse } from "next/server"
import { fromN8n } from "@/lib/autopilot/guard"
import { rows } from "@/lib/autopilot/db"
import { addNotice, allNotices, EMAILS, mailConfigured, realEmail, send, type Notice } from "@/lib/autopilot/account"
import { asSub } from "@/lib/autopilot/service"
import { isFree, PRODUCTS, type ProductKey } from "@/lib/autopilot/products"
import { makeFree } from "@/lib/autopilot/free"
import { listUsers } from "@/lib/dashboard/auth"
import { noteCronRun } from "@/lib/autopilot/admin"
import { quickUrl } from "@/lib/autopilot/quick"
import { runSequences } from "@/lib/autopilot/email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const VIEW: Record<ProductKey, string> = { linkedin: "ap-linkedin", meta: "ap-meta", blog: "ap-blog", newsletter: "ap-newsletter" }
const istDay = (t: number) => new Date(t + 330 * 60_000).toISOString().slice(0, 10)
const istHour = () => new Date(Date.now() + 330 * 60_000).getUTCHours()
const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" })

export async function POST(request: Request) {
  if (!fromN8n(request)) return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 })
  // Customers' email sequences go out from their own accounts, so they run whatever Xredible's email is.
  const sequences = await runSequences().catch((e) => ({ error: e instanceof Error ? e.message : "failed" }))
  // Free access: start the next free month (fresh Pro post limit) once the current one is over.
  const renewedFree = await rows<Record<string, unknown>>("subs")
    .then(async (all) => {
      let n = 0
      for (const s of all.map(asSub)) if (isFree(s) && (!s.periodEnd || Date.parse(s.periodEnd) <= Date.now())) await makeFree(s).then(() => n++)
      return n
    })
    .catch(() => -1)
  if (!mailConfigured()) return NextResponse.json({ ok: true, sequences, renewedFree, skipped: "XD_SMTP_PASS is not set" })
  const [subsRaw, liPosts, items, notices, { users }] = await Promise.all([rows<Record<string, unknown>>("subs"), rows<Record<string, unknown>>("li_posts"), rows<Record<string, unknown>>("ap_items"), allNotices(), listUsers(true)])
  const subs = subsRaw.map(asSub)
  const people = new Map((users || []).filter((u) => u.active).map((u) => [u.email, u]))
  const sent: string[] = []
  const now = Date.now()
  const today = istDay(now)
  const notes = (email: string) => notices.filter((n) => n.email === realEmail(email))
  const had = (list: Notice[], kind: string, key: string) => list.some((n) => n.kind === kind && n.key === key)
  const mark = async (email: string, kind: string, key: string) => {
    const n = await addNotice(realEmail(email), kind, key)
    notices.push(n)
  }

  // Everyone with Autopilot data, grouped by person (all their brands together).
  const keys = new Set<string>([...subs.map((s) => s.email), ...liPosts.map((p) => String(p.email)), ...items.map((i) => String(i.email))])
  const byPerson = new Map<string, string[]>()
  for (const k of keys) {
    const p = realEmail(k)
    if (!people.has(p)) continue
    byPerson.set(p, [...(byPerson.get(p) || []), k])
  }

  for (const [person, brandKeys] of byPerson) {
    const user = people.get(person)!
    const mine = notes(person)
    try {
      // 1. Drafts waiting (one email a day, from 9 AM).
      if (istHour() >= 9 && !had(mine, "digest", today) && !had(mine, "optout", "digest")) {
        const lastDigest = mine.filter((n) => n.kind === "digest").map((n) => n.at || "").sort().pop() || ""
        const fresh = (createdAt: unknown) => String(createdAt || "") > lastDigest
        const lines: string[] = []
        const links = (kind: "li" | "item", id: number, owner: string) => ` — [Approve](${quickUrl(owner, kind, id, "approve")}) · [Skip](${quickUrl(owner, kind, id, "reject")})`
        for (const p of liPosts)
          if (brandKeys.includes(String(p.email)) && p.status === "draft" && fresh(p.createdAt)) lines.push(`**LinkedIn:** ${String(p.topic || p.text || "").split("\n")[0].slice(0, 80)}${links("li", Number(p.id), String(p.email))}`)
        for (const i of items)
          if (brandKeys.includes(String(i.email)) && i.status === "draft" && fresh(i.createdAt))
            lines.push(`**${PRODUCTS[i.product as ProductKey]?.name.split(" ")[0] || "Post"}:** ${String(i.title || "").slice(0, 80)}${links("item", Number(i.id), String(i.email))}`)
        if (lines.length) {
          if (await send(person, EMAILS.drafts(user.name, lines.slice(0, 12)))) sent.push(`drafts ${person}`)
          await mark(person, "digest", today)
        }
      }

      for (const s of subs.filter((x) => brandKeys.includes(x.email))) {
        const tool = PRODUCTS[s.product].name
        // 2. Free posts used up.
        if (s.status === "trial" && s.postLimit > 0 && s.used >= s.postLimit && !had(mine, "trial-used", s.email + "|" + s.product)) {
          await send(person, EMAILS.trialUsed(user.name, tool, VIEW[s.product]))
          await mark(person, "trial-used", s.email + "|" + s.product)
          sent.push(`trial ${person} ${s.product}`)
        }
        if (s.status !== "active" || !s.periodEnd || isFree(s)) continue
        const end = Date.parse(s.periodEnd)
        // 3. UPI plans don't renew: remind 3 days before the end.
        if (!s.rzpSubId && end > now && end - now < 3 * 864e5 && !had(mine, "renew", `${s.email}|${s.product}|${s.periodEnd}`)) {
          await send(person, EMAILS.renew(user.name, tool, date(s.periodEnd), VIEW[s.product]))
          await mark(person, "renew", `${s.email}|${s.product}|${s.periodEnd}`)
          sent.push(`renew ${person} ${s.product}`)
        }
        // 4. Ended (after the 2-day grace).
        if (end + 2 * 864e5 < now && !had(mine, "expired", `${s.email}|${s.product}|${s.periodEnd}`)) {
          await send(person, EMAILS.expired(user.name, tool, VIEW[s.product]))
          await mark(person, "expired", `${s.email}|${s.product}|${s.periodEnd}`)
          sent.push(`expired ${person} ${s.product}`)
        }
      }

      // 5. Posts that failed or were held back by the plan.
      const failed: { key: string; line: string }[] = []
      for (const p of liPosts)
        if (brandKeys.includes(String(p.email)) && (p.status === "failed" || p.status === "blocked") && !had(mine, "failed", `li:${p.id}`))
          failed.push({ key: `li:${p.id}`, line: `LinkedIn: ${String(p.error || "failed").slice(0, 140)}` })
      for (const i of items)
        if (brandKeys.includes(String(i.email)) && (i.status === "failed" || i.status === "blocked") && !had(mine, "failed", `item:${i.id}`))
          failed.push({ key: `item:${i.id}`, line: `${PRODUCTS[i.product as ProductKey]?.name || "Post"} “${String(i.title || "").slice(0, 60)}”: ${String(i.error || "failed").slice(0, 140)}` })
      if (failed.length) {
        await send(person, EMAILS.failed(user.name, failed.map((f) => f.line).slice(0, 10)))
        for (const f of failed) await mark(person, "failed", f.key)
        sent.push(`failed ${person} ${failed.length}`)
      }
    } catch {
      // One person's problem shouldn't stop everyone else's emails.
    }
  }
  await noteCronRun().catch(() => {})
  return NextResponse.json({ ok: true, people: byPerson.size, sent, sequences, renewedFree })
}
