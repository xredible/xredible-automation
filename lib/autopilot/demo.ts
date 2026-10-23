// lib/autopilot/demo.ts
//
// Server-only. "Book a live demo" requests from xredible.in/demo: saved as notices (kind "demo") on one key,
// sent to the admin on Telegram and by email, confirmed to the visitor, and (only if they tick the box)
// added to Xredible's own Email Marketing list (XD_LIST_OWNER = the owner key of that list).

import { addNotice, noticesFor, sendXd } from "./account"
import { notify, update } from "./db"
import { join } from "./email"

export const DEMO_KEY = "xd:demo-requests"
export const WHATSAPP = "918085949384"
export const INTERESTS = ["LinkedIn", "Instagram + Facebook", "Blog writing", "Email marketing", "Custom automation"] as const
export const STATUSES = ["new", "contacted", "demo done", "customer", "not a fit"] as const
export type DemoStatus = (typeof STATUSES)[number]

export type DemoRequest = { id: number; name: string; email: string; phone: string; business: string; website: string; interests: string[]; when: string; note: string; consent: boolean; at: string; status: DemoStatus }

const clip = (v: unknown, n: number) => String(v ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, n)

// A few requests per visitor per hour (per server instance), so the form can't be used to spam inboxes.
const recent = new Map<string, number[]>()
function allowed(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const list = (recent.get(key) || []).filter((t) => now - t < windowMs)
  if (list.length >= max) return false
  list.push(now)
  recent.set(key, list)
  if (recent.size > 5000) recent.clear()
  return true
}

export async function requestDemo(input: Record<string, unknown>, ip: string): Promise<void> {
  const name = clip(input.name, 80)
  const email = clip(input.email, 160).toLowerCase()
  const phone = clip(input.phone, 20).replace(/[^\d+ ]/g, "")
  if (!name) throw new Error("Please tell us your name.")
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(email)) throw new Error("Please enter a valid email address.")
  if (phone.replace(/\D/g, "").length < 10) throw new Error("Please enter your WhatsApp number so we can fix a time.")
  if (!allowed(`ip:${ip}`, 4, 3_600_000) || !allowed(`em:${email}`, 2, 86_400_000)) throw new Error("We've got your request already. We'll be in touch soon.")
  const interests = (Array.isArray(input.interests) ? input.interests : []).map(String).filter((x) => (INTERESTS as readonly string[]).includes(x))
  const r = {
    name,
    email,
    phone,
    business: clip(input.business, 120),
    website: clip(input.website, 200),
    interests,
    when: clip(input.when, 60),
    note: clip(input.note, 600),
    consent: input.consent === true,
    at: new Date().toISOString(),
  }
  await addNotice(DEMO_KEY, "demo", "new", JSON.stringify(r))
  const lines = [`New demo request: ${r.name}${r.business ? ` (${r.business})` : ""}`, `Email: ${r.email}`, `WhatsApp: ${r.phone}`, r.interests.length ? `Wants: ${r.interests.join(", ")}` : "", r.when ? `Best time: ${r.when}` : "", r.website ? `Site: ${r.website}` : "", r.note ? `Note: ${r.note}` : ""].filter(Boolean)
  const wa = `https://wa.me/${r.phone.replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}`
  await Promise.all([
    notify(lines.join("\n")).catch(() => {}),
    sendXd(process.env.XD_ADMIN_EMAIL || "accounts@xredible.in", `Demo request: ${r.name}${r.business ? `, ${r.business}` : ""}`, `${lines.map((l) => `- ${l}`).join("\n")}\n\n[Message them on WhatsApp](${wa})`, { label: "Open Demo requests", url: "https://www.xredible.in/dashboard?biz=autopilot&view=admin-leads" }),
    sendXd(
      r.email,
      "Your Xredible demo: we'll fix a time with you",
      `Hi ${r.name.split(" ")[0]},\n\nThanks for asking for a demo of Xredible Autopilot. We'll message you on WhatsApp within one working day to fix a 15-minute slot${r.when ? ` (you said ${r.when} suits you)` : ""}.\n\nIn the demo we'll set up your brand, write your first posts together and show you how approving and posting works.\n\nCan't wait? You can start free now: every automation includes 3 free posts.`,
      { label: "Start free", url: "https://www.xredible.in/dashboard" },
    ),
  ])
  // Only people who ticked the box join the email list (with the list's own confirmation email, if it has one).
  const owner = process.env.XD_LIST_OWNER
  if (r.consent && owner) await join(owner, r.email, r.name).catch(() => {})
}

export async function demoRequests(): Promise<DemoRequest[]> {
  return (await noticesFor(DEMO_KEY))
    .filter((n) => n.kind === "demo")
    .map((n) => {
      let v: Partial<DemoRequest> = {}
      try {
        v = JSON.parse(n.value)
      } catch {}
      const status = (STATUSES as readonly string[]).includes(n.key) ? (n.key as DemoStatus) : "new"
      return { name: "", email: "", phone: "", business: "", website: "", interests: [], when: "", note: "", consent: false, at: n.at || "", ...v, id: n.id, status }
    })
    .sort((a, b) => b.id - a.id)
}

export async function setDemoStatus(id: number, status: unknown): Promise<void> {
  if (!(STATUSES as readonly string[]).includes(String(status))) throw new Error("Pick a status.")
  if (!(await demoRequests()).some((d) => d.id === id)) throw new Error("Not found.")
  await update("notices", id, { key: String(status) })
}
