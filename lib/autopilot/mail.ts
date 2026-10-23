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
export type EmailTemplate = "header" | "classic" | "letter" | "card"
export const EMAIL_TEMPLATES: { key: EmailTemplate; name: string; blurb: string }[] = [
  { key: "header", name: "Branded header", blurb: "Your logo on a band of your colour" },
  { key: "classic", name: "Classic", blurb: "Clean white card with a colour line" },
  { key: "letter", name: "Personal letter", blurb: "Looks like a note from you" },
  { key: "card", name: "Magazine", blurb: "Soft background, bold headings, accent touches" },
]
export const isEmailTemplate = (v: unknown): v is EmailTemplate => typeof v === "string" && EMAIL_TEMPLATES.some((t) => t.key === v)

export type EmailKit = { name?: string; logo?: string; primary?: string; secondary?: string; accent?: string; headFont?: string; bodyFont?: string }

const hex = (v: string | undefined, d: string) => (/^#[0-9a-f]{6}$/i.test(v || "") ? v! : d)
const onColour = (h: string) => {
  const n = parseInt(h.slice(1), 16)
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return l > 0.6 ? "#111827" : "#ffffff"
}

/** One email (newsletter issue, campaign or sequence step) in the customer's brand. */
export function buildIssue(o: { title: string; preheader: string; md: string; newsletter: string; address: string; unsubUrl: string; toName: string; color?: string; kit?: EmailKit; template?: EmailTemplate }) {
  const first = (o.toName || "").trim().split(/\s+/)[0] || "there"
  const md = o.md.replace(/\{\{\s*name\s*\}\}/gi, first)
  const k = o.kit || {}
  const color = hex(k.primary, hex(o.color, "#24438a"))
  const accent = hex(k.accent, color)
  const soft = hex(k.secondary, "#f4f5f7")
  const tpl: EmailTemplate = o.template || "classic"
  const font = (f: string | undefined) => (f ? `'${f}',Arial,Helvetica,sans-serif` : "Arial,Helvetica,sans-serif")
  const head = font(k.headFont)
  const text = font(k.bodyFont)
  const ink = "#1f2937"
  const body = mdToHtml(md, {
    p: `margin:0 0 16px;font-size:16px;line-height:1.65;color:${ink};font-family:${text}`,
    h2: `margin:30px 0 10px;font-size:21px;line-height:1.3;color:${tpl === "card" ? color : "#0e1627"};font-family:${head}`,
    h3: `margin:22px 0 8px;font-size:17px;line-height:1.3;color:#0e1627;font-family:${head}`,
    ul: `margin:0 0 16px;padding-left:22px;font-size:16px;line-height:1.65;color:${ink};font-family:${text}`,
    li: "margin:0 0 6px",
    a: `color:${color};text-decoration:underline`,
  })
    // A paragraph that is only a link becomes a button.
    .replace(/<p([^>]*)><a href="([^"]+)"[^>]*>([^<]{1,60})<\/a><\/p>/g, (_m, _p, href: string, label: string) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px"><tr><td style="border-radius:8px;background:${accent}"><a href="${href}" style="display:inline-block;padding:13px 24px;font-family:${text};font-size:16px;font-weight:bold;color:${onColour(accent)};text-decoration:none;border-radius:8px">${label}</a></td></tr></table>`)
  const fonts = [k.headFont, k.bodyFont].filter(Boolean).map((f) => `family=${String(f).replace(/ /g, "+")}:wght@400;700`)
  const fontLink = fonts.length ? `<link href="https://fonts.googleapis.com/css2?${fonts.join("&")}&display=swap" rel="stylesheet">` : ""
  const name = esc(o.newsletter)
  const logo = k.logo && /^https:\/\//.test(k.logo) ? `<img src="${esc(k.logo)}" alt="${name}" height="40" style="display:block;height:40px;max-width:220px;border:0">` : ""
  const footer = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tr><td style="padding:18px 28px;font-family:${text};font-size:12px;line-height:1.6;color:#6b7280;text-align:center">
You're getting this because you subscribed to ${name}.<br>${esc(o.address)}<br><a href="${esc(o.unsubUrl)}" style="color:#6b7280">Unsubscribe</a>
</td></tr></table>`
  let card: string
  if (tpl === "header") {
    const fg = onColour(color)
    card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${color};padding:22px 28px">${logo || `<span style="font-family:${head};font-size:20px;font-weight:bold;color:${fg}">${name}</span>`}</td></tr>
<tr><td style="height:4px;background:${accent};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 12px">${body}</td></tr></table>`
  } else if (tpl === "letter") {
    card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff">
<tr><td style="padding:12px 8px 4px">${body}</td></tr></table>`
  } else if (tpl === "card") {
    card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px">
<tr><td style="padding:26px 28px 6px">${logo || `<span style="font-family:${head};font-size:18px;font-weight:bold;color:${color}">${name}</span>`}</td></tr>
<tr><td style="padding:6px 28px 0"><div style="height:6px;width:64px;background:${accent};border-radius:3px;font-size:0;line-height:0">&nbsp;</div></td></tr>
<tr><td style="padding:22px 28px 12px">${body}</td></tr></table>`
  } else {
    card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;border-top:4px solid ${color}">
<tr><td style="padding:28px 28px 8px;font-family:${head};font-size:13px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:${color}">${logo || name}</td></tr>
<tr><td style="padding:8px 28px 12px">${body}</td></tr></table>`
  }
  const bg = tpl === "letter" ? "#ffffff" : tpl === "card" ? soft : "#f4f5f7"
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.title)}</title>${fontLink}</head>
<body style="margin:0;padding:0;background:${bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg}"><tr><td align="center" style="padding:24px 12px">
${card}
${footer}
</td></tr></table></body></html>`
  const plain = `${mdToText(md)}\n\n---\nYou're getting this because you subscribed to ${o.newsletter}.\n${o.address}\nUnsubscribe: ${o.unsubUrl}`
  return { html, text: plain }
}
