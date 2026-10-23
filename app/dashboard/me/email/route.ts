// /dashboard/me/email — Email Marketing: subscribers, tags, sequences, signup form, campaigns.
// GET  → { contacts, tags, seqs, stats, form, formUrl, embed }   (?export=1 → CSV of subscribers)
// POST { op: "import", text, tags, startSeq } | { op: "tag", ids, add, remove } | { op: "delete", ids } | { op: "status", ids, status }
//      { op: "seq-save", seq } | { op: "seq-delete", id } | { op: "seq-write", kind, brief, count }
//      { op: "campaign", brief, link, audience } | { op: "count", audience }

import { NextResponse } from "next/server"
import { errText, json, signedIn } from "@/lib/autopilot/guard"
import { ownerKey } from "@/lib/autopilot/brands"
import { addContacts, audience, channelFor, cleanTags, contactsFor, type Audience } from "@/lib/autopilot/tools"
import { csvOf, deleteContacts, deleteSeq, enroll, formUrl, saveSeq, seqStats, seqsFor, setStatus, tagContacts, writeCampaign, writeSeq } from "@/lib/autopilot/email"
import { insert } from "@/lib/autopilot/db"
import { SITE } from "@/lib/autopilot/linkedin"
import { formId } from "@/lib/autopilot/email"
import { cleanDesign } from "@/lib/autopilot/formats"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

async function state(owner: string) {
  const [contacts, seqs, stats] = await Promise.all([contactsFor(owner), seqsFor(owner), seqStats(owner)])
  const tags: Record<string, number> = {}
  for (const c of contacts) for (const t of c.tags) tags[t] = (tags[t] || 0) + 1
  const url = formUrl(owner)
  const embed = `<form action="${SITE}/api/autopilot/join/${formId(owner)}" method="post" style="display:flex;flex-wrap:wrap;gap:8px;max-width:480px;font-family:sans-serif">
  <input type="text" name="name" placeholder="Your name" style="flex:1 1 140px;padding:10px;border:1px solid #ccc;border-radius:6px">
  <input type="email" name="email" placeholder="Your email" required style="flex:2 1 200px;padding:10px;border:1px solid #ccc;border-radius:6px">
  <input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
  <button type="submit" style="padding:10px 18px;border:0;border-radius:6px;background:#111;color:#fff;font-weight:bold">Subscribe</button>
</form>`
  return {
    ok: true,
    contacts: contacts.map((c) => ({ id: c.id, email: c.email, name: c.name, status: c.status, tags: c.tags, source: c.source, createdAt: c.createdAt, inSeq: Object.values(c.seq).some((p) => p.next) })),
    tags: Object.entries(tags).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count })),
    seqs,
    stats,
    formUrl: url,
    embed,
  }
}

export async function GET(request: Request) {
  const me = await signedIn(request)
  if (me instanceof NextResponse) return me
  const owner = await ownerKey(me.email)
  try {
    if (new URL(request.url).searchParams.get("export")) {
      return new Response(csvOf(await contactsFor(owner)), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="subscribers.csv"' } })
    }
    return json(await state(owner))
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 502)
  }
}

const ids = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [])

export async function POST(request: Request) {
  const me = await signedIn(request)
  if (me instanceof NextResponse) return me
  const owner = await ownerKey(me.email)
  let b: Record<string, unknown> = {}
  try {
    b = (await request.json()) as Record<string, unknown>
  } catch {}
  try {
    const op = String(b.op || "")
    let extra: Record<string, unknown> = {}
    if (op === "import") {
      const tags = cleanTags(b.tags)
      const before = new Set((await contactsFor(owner)).map((c) => c.id))
      extra = { added: await addContacts(owner, String(b.text || ""), { tags, source: "import" }) }
      if (b.startSeq === true) {
        const fresh = (await contactsFor(owner)).filter((c) => !before.has(c.id))
        for (const c of fresh) await enroll(owner, c, ["join", ...tags.map((t) => `tag:${t}`)])
      }
    } else if (op === "tag") extra = { changed: await tagContacts(owner, ids(b.ids), cleanTags(b.add), cleanTags(b.remove)) }
    else if (op === "delete") extra = { deleted: await deleteContacts(owner, ids(b.ids)) }
    else if (op === "status") await setStatus(owner, ids(b.ids), b.status === "unsubscribed" ? "unsubscribed" : "subscribed")
    else if (op === "seq-save") extra = { saved: await saveSeq(owner, (b.seq || {}) as Record<string, unknown>) }
    else if (op === "seq-delete") await deleteSeq(owner, Number(b.id))
    else if (op === "seq-write") return json({ ok: true, steps: await writeSeq(owner, { kind: String(b.kind || "welcome"), brief: String(b.brief || ""), count: Number(b.count) || 4 }) })
    else if (op === "count") return json({ ok: true, count: (await audience(owner, cleanDesign({ audience: b.audience }).audience as Audience)).length })
    else if (op === "campaign") {
      const ch = await channelFor(owner, "newsletter")
      if (!ch?.settings.about) throw new Error("Fill in your newsletter details first (Overview tab).")
      const c = await writeCampaign(owner, { brief: String(b.brief || ""), link: String(b.link || "") })
      const time = /^\d{2}:\d{2}$/.test(String(ch.settings.time || "")) ? String(ch.settings.time) : "10:05"
      const day = new Date(Date.now() + 330 * 60_000 + 864e5).toISOString().slice(0, 10)
      const design = cleanDesign({ audience: b.audience })
      await insert("ap_items", { email: owner, product: "newsletter", status: "draft", title: c.subject, summary: c.preheader, text: c.body, topic: c.topic, image: "", format: "text", design: JSON.stringify(design), scheduledAt: new Date(`${day}T${time}:00+05:30`).toISOString(), postedAt: null, ref: "", progress: 0, error: "" })
      extra = { campaign: true }
    } else return json({ ok: false, error: "Unknown request." }, 400)
    return json({ ...(await state(owner)), ...extra })
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 400)
  }
}
