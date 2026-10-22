// lib/autopilot/account.ts
//
// Server-only. Things about a customer's account that aren't a product:
// small notes ("notices": email verified, emails already sent, preferences, referral codes,
// credits, brands), signed one-time links (verify email, reset password), and emails
// from accounts@xredible.in.
//   XD_SMTP_PASS   password of accounts@xredible.in (required to send)
//   XD_SMTP_HOST   optional, default magnus.herosite.pro (the mail server's own name, so TLS matches)
//   XD_SMTP_USER   optional, default accounts@xredible.in

import { createHmac, timingSafeEqual } from "node:crypto"
import nodemailer from "nodemailer"
import { insert, remove, rows } from "./db"
import { gatewaySecret } from "@/lib/dashboard/gateway"
import { mdToHtml, mdToText } from "./markdown"
import { SITE } from "./linkedin"

// ---------- notices ----------

export type Notice = { id: number; email: string; kind: string; key: string; value: string; at: string | null }

const asNotice = (r: Record<string, unknown>): Notice => ({ id: Number(r.id), email: String(r.email || ""), kind: String(r.kind || ""), key: String(r.key || ""), value: String(r.value || ""), at: (r.at as string) || null })

export async function noticesFor(email: string): Promise<Notice[]> {
  return (await rows<Record<string, unknown>>("notices", { col: "email", val: email })).map(asNotice)
}

export async function allNotices(): Promise<Notice[]> {
  return (await rows<Record<string, unknown>>("notices")).map(asNotice)
}

export async function addNotice(email: string, kind: string, key = "", value = ""): Promise<Notice> {
  return asNotice(await insert<Record<string, unknown>>("notices", { email, kind, key: key.slice(0, 200), value: value.slice(0, 2000), at: new Date().toISOString() }))
}

export const removeNotice = (id: number) => remove("notices", id)

export const isVerified = (n: Notice[]) => n.some((x) => x.kind === "verified")

/** Brand accounts share a person's sign-in: "me@x.com::2" belongs to me@x.com. */
export const realEmail = (key: string) => key.split("::")[0]

// ---------- signed links ----------

const key = () => createHmac("sha256", gatewaySecret() || "unset").update("xd-links").digest()
const b64 = (s: string) => Buffer.from(s).toString("base64url")
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8")
const mac = (data: string) => createHmac("sha256", key()).update(data).digest("base64url").slice(0, 32)

/** A link token for one purpose that expires; `bind` ties it to state (e.g. the password hash) so it works once. */
export function makeToken(purpose: string, email: string, hours: number, bind = ""): string {
  const exp = Math.floor(Date.now() / 1000) + hours * 3600
  return `${b64(email)}.${exp}.${mac(`${purpose}|${email}|${exp}|${bind}`)}`
}

export function readToken(purpose: string, token: string, bind: (email: string) => string | Promise<string> = () => ""): Promise<string | null> {
  return (async () => {
    const [e, exp, sig] = String(token || "").split(".")
    if (!e || !exp || !sig) return null
    let email = ""
    try {
      email = unb64(e)
    } catch {
      return null
    }
    if (Number(exp) * 1000 < Date.now()) return null
    const want = Buffer.from(mac(`${purpose}|${email}|${exp}|${await bind(email)}`))
    const got = Buffer.from(sig)
    return want.length === got.length && timingSafeEqual(want, got) ? email : null
  })()
}

// ---------- email from accounts@xredible.in ----------

export const mailConfigured = () => Boolean(process.env.XD_SMTP_PASS)

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

function layout(title: string, md: string, cta?: { label: string; url: string }) {
  const body = mdToHtml(md, {
    p: "margin:0 0 14px;font-size:15px;line-height:1.6;color:#1f2937",
    h2: "margin:22px 0 8px;font-size:17px;color:#0e1627",
    ul: "margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.6;color:#1f2937",
    li: "margin:0 0 4px",
    a: "color:#24438a",
  })
  const button = cta
    ? `<p style="margin:22px 0 6px"><a href="${esc(cta.url)}" style="display:inline-block;background:#10203f;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 20px;border-radius:8px">${esc(cta.label)}</a></p>`
    : ""
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px">
<tr><td style="background:#10203f;border-radius:12px 12px 0 0;padding:16px 24px;color:#ffffff;font-size:17px;font-weight:bold"><span style="color:#d4ad4b">X</span>&nbsp; Xredible</td></tr>
<tr><td style="padding:24px">${body}${button}</td></tr>
</table>
<p style="max-width:560px;margin:14px auto 0;font-size:12px;line-height:1.5;color:#6b7280;text-align:center">Xredible · AI automations for your business · <a href="${SITE}/dashboard" style="color:#6b7280">xredible.in/dashboard</a><br>Questions? Just reply to this email.</p>
</td></tr></table></body></html>`
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

/** Sends one email from accounts@xredible.in. Never throws: returns false when it couldn't send. */
export async function sendXd(to: string, subject: string, md: string, cta?: { label: string; url: string }): Promise<boolean> {
  if (!mailConfigured()) return false
  try {
    transporter ||= nodemailer.createTransport({
      host: process.env.XD_SMTP_HOST || "magnus.herosite.pro",
      port: Number(process.env.XD_SMTP_PORT) || 465,
      secure: (Number(process.env.XD_SMTP_PORT) || 465) === 465,
      auth: { user: process.env.XD_SMTP_USER || "accounts@xredible.in", pass: process.env.XD_SMTP_PASS },
      connectionTimeout: 15_000,
      socketTimeout: 30_000,
    })
    const from = process.env.XD_SMTP_USER || "accounts@xredible.in"
    await transporter.sendMail({
      from: { name: "Xredible", address: from },
      to: realEmail(to),
      replyTo: from,
      subject,
      html: layout(subject, md, cta),
      text: `${mdToText(md)}${cta ? `\n\n${cta.label}: ${cta.url}` : ""}\n\n— Xredible · ${SITE}/dashboard`,
    })
    return true
  } catch {
    transporter = null
    return false
  }
}

// ---------- the emails ----------

const first = (name: string) => (name || "").trim().split(/\s+/)[0] || "there"

export const EMAILS = {
  welcome: (name: string, verifyUrl: string) => ({
    subject: "Welcome to Xredible: confirm your email",
    md: `Hi ${first(name)},\n\nThanks for signing up. Every automation starts with **3 free posts**, so you can see the results before paying anything.\n\nFirst, confirm this is your email so we can send you drafts, receipts and important notices:`,
    cta: { label: "Confirm my email", url: verifyUrl },
  }),
  verify: (name: string, verifyUrl: string) => ({
    subject: "Confirm your email for Xredible",
    md: `Hi ${first(name)},\n\nClick below to confirm your email address. The link works for 3 days.`,
    cta: { label: "Confirm my email", url: verifyUrl },
  }),
  reset: (name: string, url: string) => ({
    subject: "Reset your Xredible password",
    md: `Hi ${first(name)},\n\nSomeone (hopefully you) asked to reset the password for this account. The link works for 1 hour and only once.\n\nIf it wasn't you, ignore this email; your password stays the same.`,
    cta: { label: "Choose a new password", url },
  }),
  drafts: (name: string, lines: string[]) => ({
    subject: `${lines.length} new ${lines.length === 1 ? "draft is" : "drafts are"} waiting for your approval`,
    md: `Hi ${first(name)},\n\nFresh drafts are ready. Nothing goes out until you approve it. Tap **Approve** or **Skip** right here, no sign-in needed:\n\n${lines.map((l) => `- ${l}`).join("\n")}\n\nTo edit or rewrite one first, open your dashboard.`,
    cta: { label: "Review drafts", url: `${SITE}/dashboard?biz=autopilot&view=schedule` },
  }),
  trialUsed: (name: string, tool: string, view: string) => ({
    subject: `Your free ${tool} posts are used up`,
    md: `Hi ${first(name)},\n\nYour 3 free posts with **${tool}** have gone out. To keep posting on schedule, choose a plan. Your drafts and settings stay as they are.`,
    cta: { label: "Choose a plan", url: `${SITE}/dashboard?biz=autopilot&view=${view}` },
  }),
  renew: (name: string, tool: string, date: string, view: string) => ({
    subject: `${tool}: your plan ends on ${date}`,
    md: `Hi ${first(name)},\n\nYour **${tool}** plan was paid by UPI, so it doesn't renew by itself. It ends on **${date}**.\n\nPay for the next month before then and your posts keep going out without a break.`,
    cta: { label: "Renew now", url: `${SITE}/dashboard?biz=autopilot&view=${view}` },
  }),
  expired: (name: string, tool: string, view: string) => ({
    subject: `${tool} is paused: your plan has ended`,
    md: `Hi ${first(name)},\n\nYour **${tool}** plan has ended, so approved posts are on hold. Renew to start posting again; everything you set up is still there.`,
    cta: { label: "Renew", url: `${SITE}/dashboard?biz=autopilot&view=${view}` },
  }),
  failed: (name: string, lines: string[]) => ({
    subject: `${lines.length === 1 ? "A post" : `${lines.length} posts`} couldn't go out`,
    md: `Hi ${first(name)},\n\nThese didn't publish:\n\n${lines.map((l) => `- ${l}`).join("\n")}\n\nOpen the Content calendar to see why and retry.`,
    cta: { label: "Open Content calendar", url: `${SITE}/dashboard?biz=autopilot&view=schedule` },
  }),
  receipt: (name: string, what: string, amount: string, until: string, url: string) => ({
    subject: `Payment received: ${what}`,
    md: `Hi ${first(name)},\n\nThanks! We've received **${amount}** for **${what}**. Your plan is active until **${until}**.\n\nYour receipt is ready to view or print.`,
    cta: { label: "View receipt", url },
  }),
  referral: (name: string, friend: string) => ({
    subject: "You've earned a free month",
    md: `Hi ${first(name)},\n\n${friend} joined Xredible with your invite and subscribed, so you get **one month free**. It's added to your plan automatically (or to your next one if you're not subscribed right now).`,
    cta: { label: "Open dashboard", url: `${SITE}/dashboard?biz=autopilot` },
  }),
}

export async function send(to: string, e: { subject: string; md: string; cta?: { label: string; url: string } }) {
  return sendXd(to, e.subject, e.md, e.cta)
}

export const verifyUrl = (email: string) => `${SITE}/dashboard/verify?t=${makeToken("verify", realEmail(email), 72)}`
