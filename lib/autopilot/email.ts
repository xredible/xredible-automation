// lib/autopilot/email.ts
//
// Server-only. Email Marketing on top of the newsletter tool: subscriber lists and tags, automated
// sequences (welcome series and follow-ups), signup forms with double opt-in, and one-off campaigns.
// Everything sends from the customer's own email account, like their newsletter.

import { insert, remove, rows, update } from "./db"
import { sign, signed } from "./crypto"
import { askJson, HONEST, LANG, voiceBlock, voiceOf } from "./ai"
import { SITE } from "./linkedin"
import { buildIssue, transport } from "./mail"
import { asContact, channelFor, cleanTags, contactsFor, emailLook, MAX_CONTACTS, SEQ_ITEM, smtpOf, track, unsubUrl, type Contact } from "./tools"
import { contactCap } from "./products"
import { subFor } from "./service"

type Obj = Record<string, unknown>

// ---------- subscribers ----------

export async function tagContacts(owner: string, ids: number[], add: string[], drop: string[]) {
  const mine = new Map((await contactsFor(owner)).map((c) => [c.id, c]))
  const plus = cleanTags(add)
  const minus = cleanTags(drop)
  let n = 0
  for (const id of ids.slice(0, 2000)) {
    const c = mine.get(id)
    if (!c) continue
    const tags = cleanTags([...c.tags.filter((t) => !minus.includes(t)), ...plus])
    if (tags.join(",") === c.tags.join(",")) continue
    await update("ap_contacts", id, { tags: tags.join(",") })
    n++
    // New tags can start sequences that are triggered by them.
    const fresh = plus.filter((t) => !c.tags.includes(t))
    if (fresh.length) await enroll(owner, { ...c, tags }, fresh.map((t) => `tag:${t}`))
  }
  return n
}

export async function deleteContacts(owner: string, ids: number[]) {
  const mine = new Set((await contactsFor(owner)).map((c) => c.id))
  let n = 0
  for (const id of ids.slice(0, 2000)) if (mine.has(id)) (await remove("ap_contacts", id), n++)
  return n
}

export async function setStatus(owner: string, ids: number[], status: "subscribed" | "unsubscribed") {
  const mine = new Map((await contactsFor(owner)).map((c) => [c.id, c]))
  for (const id of ids.slice(0, 2000)) {
    const c = mine.get(id)
    if (c && c.status !== status) await update("ap_contacts", id, { status, unsubAt: status === "unsubscribed" ? new Date().toISOString() : null })
  }
}

export const csvOf = (list: Contact[]) =>
  ["email,name,status,tags,source,joined"].concat(list.map((c) => [c.email, c.name, c.status, c.tags.join(" "), c.source, c.createdAt || ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))).join("\n")

// ---------- sequences ----------

export type Step = { delay: number; subject: string; preheader: string; body: string; approved: boolean }
export type Sequence = { id: number; owner: string; name: string; trigger: string; steps: Step[]; active: boolean; createdAt?: string }

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n)

function asSeq(r: Obj): Sequence {
  let steps: Step[] = []
  try {
    steps = JSON.parse(String(r.steps || "[]")) || []
  } catch {}
  return { id: Number(r.id), owner: String(r.owner || "").toLowerCase(), name: String(r.name || ""), trigger: String(r.trigger || "join"), steps: steps.map(cleanStep), active: r.active === true, createdAt: (r.createdAt as string) || undefined }
}

function cleanStep(s: unknown): Step {
  const o = (s && typeof s === "object" ? s : {}) as Obj
  return { delay: Math.max(0, Math.min(365, Math.round(Number(o.delay) || 0))), subject: clip(o.subject, 120), preheader: clip(o.preheader, 200), body: clip(o.body, 20000), approved: o.approved === true }
}

export const seqsFor = async (owner: string) => (await rows<Obj>("ap_seqs", { col: "owner", val: owner })).map(asSeq).sort((a, b) => a.id - b.id)

async function ownSeq(owner: string, id: number) {
  const s = (await rows<Obj>("ap_seqs", { col: "id", val: id })).map(asSeq)[0]
  if (!s || s.owner !== owner) throw new Error("That sequence isn't yours.")
  return s
}

export async function saveSeq(owner: string, input: Obj): Promise<Sequence> {
  const steps = (Array.isArray(input.steps) ? input.steps : []).map(cleanStep).slice(0, 12)
  const trigger = /^tag:[\p{L}\p{N} _-]{1,30}$/u.test(String(input.trigger)) ? String(input.trigger).toLowerCase() : "join"
  const row = { name: clip(input.name, 80) || "Welcome series", trigger, steps: JSON.stringify(steps), active: input.active === true }
  if (row.active && (!steps.length || steps.some((s) => !s.approved || !s.subject || s.body.length < 20))) throw new Error("Approve every email in the sequence (each needs a subject and text) before switching it on.")
  if (Number(input.id) > 0) {
    await ownSeq(owner, Number(input.id))
    await update("ap_seqs", Number(input.id), row)
    return { ...(await ownSeq(owner, Number(input.id))) }
  }
  return asSeq(await insert<Obj>("ap_seqs", { owner, ...row }))
}

export async function deleteSeq(owner: string, id: number) {
  await ownSeq(owner, id)
  await remove("ap_seqs", id)
}

/** AI writes a whole sequence in the customer's voice. */
export async function writeSeq(owner: string, o: { kind: string; brief: string; count: number }): Promise<Step[]> {
  const ch = await channelFor(owner, "newsletter")
  const s = (ch?.settings || {}) as Obj
  const count = Math.max(2, Math.min(7, o.count || 4))
  const plan =
    o.kind === "nurture"
      ? "a nurture series that builds trust: useful tips, a short story or lesson, common mistakes, and a soft invitation to work together"
      : o.kind === "sales"
        ? "a short sales series for the offer described below: the problem, the solution, proof from general experience (no invented numbers or testimonials), answers to doubts, and a clear last call"
        : "a welcome series for new subscribers: a warm welcome and what to expect, their best tips, who they are and why they do this, and an invitation to reply or take the next step"
  const out = await askJson<{ emails?: { delay?: number; subject?: string; preheader?: string; body?: string }[] }>(
    `You write automated emails for one person or business, in their voice, sent from their own email address. They review every email before it goes out.

ABOUT THEM: ${s.about || ""}
AUDIENCE: ${s.audience || "their subscribers"}
TONE: ${s.tone || "warm, clear, personal, plain words"}
LANGUAGE: ${LANG[String(s.language)] || LANG.English}
SIGN OFF AS: ${s.fromName || ""}
${o.brief ? `WHAT THEY WANT: ${o.brief.slice(0, 800)}\n` : ""}${voiceBlock(await voiceOf(owner, "newsletter"))}
Write ${count} emails for ${plan}.
- delay: days after the previous email (the first is 0, then usually 2 to 4).
- subject: max 55 characters, specific, no clickbait, at most 1 emoji. preheader: 50 to 90 characters.
- body: Markdown with only '## ' headings, '- ' bullets and **bold**. Start with 'Hi {{name}},'. 120 to 260 words, short paragraphs, one idea per email, end with one clear action (reply, read, book, buy) and a sign-off line. A link on its own line like [Book a call](https://...) shows as a button; only use links they gave you.
- ${HONEST}

Return JSON only: {"emails": [{"delay": 0, "subject": "...", "preheader": "...", "body": "..."}]}`,
    12000,
  )
  const steps = (out.emails || []).map((e, i) => cleanStep({ ...e, delay: i === 0 ? 0 : e.delay ?? 2, approved: false })).filter((e) => e.subject && e.body.length > 40)
  if (steps.length < 2) throw new Error("The AI answer came back too short. Try again.")
  return steps
}

/** Puts a contact into every active sequence started by one of these triggers ("join", "tag:x"). */
export async function enroll(owner: string, c: Contact, triggers: string[]) {
  if (c.status !== "subscribed") return
  const seqs = (await seqsFor(owner)).filter((s) => s.active && triggers.includes(s.trigger) && s.steps.length)
  if (!seqs.length) return
  const seq = { ...c.seq }
  for (const s of seqs) if (!seq[s.id]) seq[s.id] = { step: 0, next: new Date(Date.now() + s.steps[0].delay * 864e5).toISOString() }
  await update("ap_contacts", c.id, { seq: JSON.stringify(seq) })
}

/** Sends every sequence email that's due (run hourly). At most `perOwner` emails per customer per run. */
export async function runSequences(perOwner = 250): Promise<{ sent: number; owners: number }> {
  const all = (await rows<Obj>("ap_seqs")).map(asSeq).filter((s) => s.active)
  const owners = [...new Set(all.map((s) => s.owner))]
  let sent = 0
  for (const owner of owners) {
    try {
      const ch = await channelFor(owner, "newsletter")
      if (!ch?.connected || !ch.secretEnc) continue
      const sub = await subFor(owner, "newsletter")
      if (!sub || !["trial", "active"].includes(sub.status)) continue
      const cap = contactCap(sub)
      const seqs = new Map(all.filter((s) => s.owner === owner).map((s) => [String(s.id), s]))
      const contacts = (await contactsFor(owner)).filter((c) => c.status === "subscribed").slice(0, cap)
      const due: { c: Contact; s: Sequence; step: number }[] = []
      for (const c of contacts)
        for (const [sid, p] of Object.entries(c.seq)) {
          const s = seqs.get(sid)
          if (s && p.next && Date.parse(p.next) <= Date.now() && p.step < s.steps.length) due.push({ c, s, step: p.step })
        }
      if (!due.length) continue
      const smtp = smtpOf(ch)
      const t = transport(smtp)
      const look = await emailLook(owner, ch)
      const name = String(ch.settings.name || smtp.fromName || "Newsletter")
      try {
        for (const d of due.slice(0, perOwner)) {
          const st = d.s.steps[d.step]
          const u = unsubUrl(d.c.id)
          const item = SEQ_ITEM + d.s.id * 100 + d.step
          const built = buildIssue({ title: st.subject, preheader: st.preheader, md: st.body, newsletter: name, address: String(ch.settings.address || ""), unsubUrl: u, toName: d.c.name, ...look })
          const fresh = (await rows<Obj>("ap_contacts", { col: "id", val: d.c.id })).map(asContact)[0]
          if (!fresh || fresh.status !== "subscribed") continue
          try {
            await t.sendMail({
              from: { name: smtp.fromName || name, address: smtp.from },
              to: d.c.name ? { name: d.c.name, address: d.c.email } : d.c.email,
              subject: st.subject,
              html: track(built.html, item, d.c.id),
              text: built.text,
              headers: { "List-Unsubscribe": `<${u}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
            })
            sent++
            await insert("ap_events", { owner, item, contact: d.c.id, type: "sent", url: "", at: new Date().toISOString() })
          } catch (e) {
            if (/auth|535|534|limit|quota|rate|421|454/i.test(e instanceof Error ? e.message : "")) break
          }
          const nextStep = d.step + 1
          const seq = { ...fresh.seq, [d.s.id]: { step: nextStep, next: nextStep < d.s.steps.length ? new Date(Date.now() + d.s.steps[nextStep].delay * 864e5).toISOString() : null } }
          await update("ap_contacts", d.c.id, { seq: JSON.stringify(seq) })
        }
      } finally {
        t.close()
      }
    } catch {
      // One customer's broken email account shouldn't stop the others.
    }
  }
  return { sent, owners: owners.length }
}

/** Sends, opens and clicks per sequence step. */
export async function seqStats(owner: string) {
  const ev = await rows<Obj>("ap_events", { col: "owner", val: owner })
  const out: Record<string, { sent: number; opens: number; clicks: number }> = {}
  for (const e of ev) {
    const item = Number(e.item)
    if (item < SEQ_ITEM) continue
    const k = String(item - SEQ_ITEM)
    out[k] = out[k] || { sent: 0, opens: 0, clicks: 0 }
    if (e.type === "sent") out[k].sent++
    else if (e.type === "open") out[k].opens++
    else if (e.type === "click") out[k].clicks++
  }
  return out
}

// ---------- signup forms ----------

/** A form's public id: the owner key, signed so nobody can sign people up to someone else's list. */
export const formId = (owner: string) => `${Buffer.from(owner).toString("base64url")}.${sign(`form:${owner}`).slice(0, 16)}`
export function formOwner(fid: string): string | null {
  const [b, s] = String(fid || "").split(".")
  if (!b || !s) return null
  let owner = ""
  try {
    owner = Buffer.from(b, "base64url").toString("utf8")
  } catch {
    return null
  }
  return sign(`form:${owner}`).slice(0, 16) === s ? owner : null
}
export const formUrl = (owner: string) => `${SITE}/join/${formId(owner)}`
export const confirmUrl = (id: number) => `${SITE}/join/confirm?c=${id}&s=${sign(`join:${id}`)}`
export const confirmOk = (id: number, s: string) => signed(`join:${id}`, s)

export type FormSettings = { title: string; text: string; button: string; askName: boolean; tags: string; doubleOptIn: boolean; thanks: string }

export async function formFor(owner: string) {
  const ch = await channelFor(owner, "newsletter")
  if (!ch) return null
  const f = (ch.settings.form || {}) as Partial<FormSettings>
  return {
    channel: ch,
    form: {
      title: f.title || "Join my newsletter",
      text: f.text || "Useful tips in your inbox. No spam, unsubscribe any time.",
      button: f.button || "Subscribe",
      askName: f.askName !== false,
      tags: String(f.tags || ""),
      doubleOptIn: f.doubleOptIn !== false,
      thanks: f.thanks || "Thanks for subscribing!",
    } as FormSettings,
  }
}

/** Someone filled in the form. Returns what to tell them. */
// One confirmation email per address per 30 minutes, and at most 120 an hour from one form
// (per server instance; the daily cap on new pending signups backs this up across instances).
const confirmSent = new Map<string, number>()
const confirmHour = new Map<string, { start: number; n: number }>()

function confirmAllowed(owner: string, addr: string): boolean {
  const now = Date.now()
  const key = `${owner}|${addr}`
  if (now - (confirmSent.get(key) || 0) < 30 * 60_000) return false
  const h = confirmHour.get(owner)
  const hour = !h || now - h.start > 3_600_000 ? { start: now, n: 0 } : h
  if (hour.n >= 120) return false
  hour.n += 1
  confirmHour.set(owner, hour)
  confirmSent.set(key, now)
  if (confirmSent.size > 20_000) for (const [k, t] of confirmSent) if (now - t > 30 * 60_000) confirmSent.delete(k)
  return true
}

export async function join(owner: string, email: string, name: string): Promise<"confirm" | "done"> {
  const ff = await formFor(owner)
  if (!ff || !ff.channel.connected) throw new Error("This list isn't accepting signups yet.")
  const addr = email.trim().toLowerCase()
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(addr) || addr.length > 200) throw new Error("Please enter a valid email address.")
  const list = await contactsFor(owner)
  const have = list.find((c) => c.email === addr)
  const tags = cleanTags(ff.form.tags)
  const recent = list.filter((c) => c.status === "pending" && c.createdAt && Date.parse(c.createdAt) > Date.now() - 864e5).length
  if (recent > 300) throw new Error("Too many signups right now. Please try again later.")
  if (!have && list.length >= MAX_CONTACTS) throw new Error("This list is full.")
  const status = ff.form.doubleOptIn ? "pending" : "subscribed"
  let c: Contact
  if (have) {
    if (have.status === "subscribed") return "done"
    await update("ap_contacts", have.id, { status, unsubAt: null, name: name.slice(0, 80) || have.name, tags: cleanTags([...have.tags, ...tags]).join(","), source: "form" })
    c = { ...have, status, tags: cleanTags([...have.tags, ...tags]) }
  } else {
    c = asContact(await insert<Obj>("ap_contacts", { owner, email: addr, name: name.slice(0, 80), status, unsubAt: null, tags: tags.join(","), source: "form", seq: "{}" }))
  }
  if (status === "subscribed") {
    await enroll(owner, c, ["join", ...tags.map((t) => `tag:${t}`)])
    return "done"
  }
  // Someone re-submitting the same address (or a script doing it for them) mustn't turn the
  // customer's form into a way to flood a stranger's inbox.
  if (!confirmAllowed(owner, addr)) return "confirm"
  const smtp = smtpOf(ff.channel)
  const t = transport(smtp)
  const nl = String(ff.channel.settings.name || smtp.fromName || "our newsletter")
  try {
    const built = buildIssue({
      title: `Please confirm: ${nl}`,
      preheader: "One click to confirm your subscription.",
      md: `Hi {{name}},\n\nPlease confirm you'd like to get emails from **${nl}**.\n\n[Yes, subscribe me](${confirmUrl(c.id)})\n\nIf you didn't sign up, ignore this email and you won't hear from us.`,
      newsletter: nl,
      address: String(ff.channel.settings.address || ""),
      unsubUrl: unsubUrl(c.id),
      toName: name,
      ...(await emailLook(owner, ff.channel)),
    })
    await t.sendMail({ from: { name: smtp.fromName || nl, address: smtp.from }, to: addr, subject: `Please confirm your subscription to ${nl}`, html: built.html, text: built.text })
  } finally {
    t.close()
  }
  return "confirm"
}

export async function confirm(id: number): Promise<{ owner: string; name: string } | null> {
  const c = (await rows<Obj>("ap_contacts", { col: "id", val: id })).map(asContact)[0]
  if (!c) return null
  if (c.status === "pending") {
    await update("ap_contacts", id, { status: "subscribed", unsubAt: null })
    await enroll(c.owner, { ...c, status: "subscribed" }, ["join", ...c.tags.map((t) => `tag:${t}`)])
  }
  const ch = await channelFor(c.owner, "newsletter")
  return { owner: c.owner, name: String(ch?.settings.name || "the newsletter") }
}

// ---------- one-off campaigns ----------

export async function writeCampaign(owner: string, o: { brief: string; link: string }) {
  const ch = await channelFor(owner, "newsletter")
  const s = (ch?.settings || {}) as Obj
  if (o.brief.trim().length < 10) throw new Error("Say what the email is about (an offer, launch, event or news).")
  const link = /^https?:\/\/\S+$/i.test(o.link.trim()) ? o.link.trim() : ""
  const r = await askJson<{ subject?: string; preheader?: string; body?: string; topic?: string }>(
    `You write one promotional email (a campaign) for one person or business, in their voice, sent from their own email to their subscribers. They approve it before it is sent.

ABOUT THEM: ${s.about || ""}
AUDIENCE: ${s.audience || "their subscribers"}
TONE: ${s.tone || "warm, clear, personal"}
LANGUAGE: ${LANG[String(s.language)] || LANG.English}
SIGN OFF AS: ${s.fromName || ""}
WHAT THE EMAIL IS ABOUT: ${o.brief.slice(0, 1000)}
${link ? `LINK FOR THE BUTTON: ${link}\n` : ""}${voiceBlock(await voiceOf(owner, "newsletter"))}
- subject: max 55 characters, specific and honest, at most 1 emoji. preheader: 50 to 90 characters.
- body: Markdown with only '## ' headings, '- ' bullets and **bold**. Start with 'Hi {{name}},'. 120 to 250 words: the hook, what it is and who it's for, 2 to 4 benefits as bullets, any deadline they gave, ${link ? `then the button on its own line as [<short action>](${link})` : "then a clear call to reply"}, then a sign-off line.
- ${HONEST} Only use prices, dates and offers they gave.

Return JSON only: {"topic": "<3-6 words>", "subject": "...", "preheader": "...", "body": "..."}`,
    8000,
  )
  const body = String(r.body || "").trim()
  if (body.length < 120 || !r.subject) throw new Error("The AI answer came back too short. Try again.")
  return { subject: String(r.subject).slice(0, 120), preheader: String(r.preheader || "").slice(0, 300), body: body.slice(0, 30000), topic: String(r.topic || "Campaign").slice(0, 60) }
}
