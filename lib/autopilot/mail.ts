// lib/autopilot/mail.ts
//
// Server-only. Newsletters go out through the customer's own email account (SMTP),
// so they come from their address and their sending reputation, not Xredible's.
// Gmail / Google Workspace: smtp.gmail.com, port 465, an App Password (needs 2-step verification).

import nodemailer, { type Transporter } from "nodemailer"
import { mdToHtml, mdToText } from "./markdown"

export type Smtp = { host: string; port: number; secure: boolean; user: string; pass: string; from: string; fromName: string }

export function transport(s: Smtp): Transporter {
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: { user: s.user, pass: s.pass },
    pool: true,
    maxConnections: 2,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  })
}

export async function smtpVerify(s: Smtp): Promise<void> {
  const t = transport(s)
  try {
    await t.verify()
  } catch (e) {
    const m = e instanceof Error ? e.message : ""
    if (/auth|535|534|credentials|username and password/i.test(m)) throw new Error("Your email provider didn't accept the username and password. For Gmail, use an App Password, not your normal password.")
    if (/ENOTFOUND|EAI_AGAIN/i.test(m)) throw new Error("That SMTP server name wasn't found. Check the host.")
    if (/ETIMEDOUT|ECONNREFUSED|timeout/i.test(m)) throw new Error("Couldn't connect to the SMTP server. Check the host and port (465 with SSL, or 587).")
    throw new Error("Couldn't sign in to your email: " + m.slice(0, 160))
  } finally {
    t.close()
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** One newsletter for one subscriber. `{{name}}` in the text becomes their first name (or "there"). */
export function buildIssue(o: { title: string; preheader: string; md: string; newsletter: string; address: string; unsubUrl: string; toName: string; color?: string }) {
  const first = (o.toName || "").trim().split(/\s+/)[0] || "there"
  const md = o.md.replace(/\{\{\s*name\s*\}\}/gi, first)
  const color = /^#[0-9a-f]{6}$/i.test(o.color || "") ? o.color! : "#24438a"
  const body = mdToHtml(md, {
    p: "margin:0 0 16px;font-size:16px;line-height:1.6;color:#1f2937",
    h2: "margin:28px 0 10px;font-size:20px;line-height:1.3;color:#0e1627",
    h3: "margin:22px 0 8px;font-size:17px;line-height:1.3;color:#0e1627",
    ul: "margin:0 0 16px;padding-left:22px;font-size:16px;line-height:1.6;color:#1f2937",
    li: "margin:0 0 6px",
    a: `color:${color};text-decoration:underline`,
  })
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;border-top:4px solid ${color}">
<tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:${color}">${esc(o.newsletter)}</td></tr>
<tr><td style="padding:8px 28px 12px;font-family:Arial,Helvetica,sans-serif">${body}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tr><td style="padding:18px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6b7280;text-align:center">
You're getting this because you subscribed to ${esc(o.newsletter)}.<br>${esc(o.address)}<br><a href="${esc(o.unsubUrl)}" style="color:#6b7280">Unsubscribe</a>
</td></tr></table>
</td></tr></table></body></html>`
  const text = `${mdToText(md)}\n\n---\nYou're getting this because you subscribed to ${o.newsletter}.\n${o.address}\nUnsubscribe: ${o.unsubUrl}`
  return { html, text }
}
