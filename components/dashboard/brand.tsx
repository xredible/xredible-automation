// Platform names, colours and icons used across the dashboard.

import type { ReactNode } from "react"
import { Palette, BadgeIndianRupee, CalendarDays, CircleQuestionMark, CreditCard, HeartPulse, Lightbulb, Megaphone, Receipt, TicketPercent, Users, FileText, Globe, LayoutDashboard, Mail, MailOpen, Newspaper, PenLine, Pin, Search, Settings, TrendingUp } from "lucide-react"

// lucide-react 1.x has no brand icons, so these are simple line glyphs in the same style.
type IconProps = { className?: string; "aria-hidden"?: boolean }
const glyph = (paths: ReactNode) =>
  function Glyph(props: IconProps) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
        {paths}
      </svg>
    )
  }
const Instagram = glyph(<><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" /></>)
const Facebook = glyph(<path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H7v3.5h2V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z" />)
const Youtube = glyph(<><rect x="2.5" y="5.5" width="19" height="13" rx="3.5" /><path d="m10 9.5 4.5 2.5-4.5 2.5z" fill="currentColor" /></>)
export const Linkedin = glyph(<><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10.5V16M8 7.5v.01M11.5 16v-5.5M11.5 13a2.5 2.5 0 0 1 5 0v3" /></>)

export type PlatformMeta = { label: string; short: string; color: string; icon: ReactNode; big: ReactNode }

const i = (C: (p: IconProps) => ReactNode) => ({ icon: <C className="h-3.5 w-3.5" aria-hidden />, big: <C className="h-[18px] w-[18px]" aria-hidden /> })

export const PLATFORM: Record<string, PlatformMeta> = {
  overview: { label: "Overview", short: "Overview", color: "#10203f", ...i(LayoutDashboard) },
  schedule: { label: "Content calendar", short: "Calendar", color: "#10203f", ...i(CalendarDays) },
  blog: { label: "Blog posts", short: "Blog", color: "#c8661b", ...i(PenLine) },
  instagram: { label: "Instagram", short: "Instagram", color: "#c13584", ...i(Instagram) },
  facebook: { label: "Facebook", short: "Facebook", color: "#1877f2", ...i(Facebook) },
  youtube: { label: "YouTube", short: "YouTube", color: "#e62117", ...i(Youtube) },
  pinterest: { label: "Pinterest", short: "Pinterest", color: "#c8102e", ...i(Pin) },
  ga4: { label: "Website analytics", short: "Website", color: "#0f7b5a", ...i(Globe) },
  gsc: { label: "Google Search", short: "Search", color: "#3b5bdb", ...i(Search) },
  linkedin: { label: "LinkedIn", short: "LinkedIn", color: "#0a66c2", ...i(Linkedin) },
  wordpress: { label: "Blog post", short: "Blog", color: "#21759b", ...i(FileText) },
  results: { label: "Results", short: "Results", color: "#0a66c2", ...i(TrendingUp) },
  email: { label: "Email list", short: "Email", color: "#86651a", ...i(Mail) },
  newsletters: { label: "Newsletters", short: "Newsletters", color: "#7c6bc4", ...i(Newspaper) },
  // Xredible Autopilot
  articles: { label: "Blog articles", short: "Blog", color: "#21759b", ...i(FileText) },
  newsletter: { label: "Newsletter", short: "Newsletter", color: "#7c6bc4", ...i(MailOpen) },
  "ap-linkedin": { label: "LinkedIn Autopilot", short: "LinkedIn", color: "#0a66c2", ...i(Linkedin) },
  "ap-meta": { label: "Instagram + Facebook", short: "Instagram + Facebook", color: "#c13584", ...i(Instagram) },
  "ap-blog": { label: "Blog Writer", short: "Blog Writer", color: "#21759b", ...i(PenLine) },
  "ap-newsletter": { label: "Email Marketing", short: "Email", color: "#7c6bc4", ...i(Newspaper) },
  billing: { label: "Billing", short: "Billing", color: "#10203f", ...i(CreditCard) },
  settings: { label: "Settings", short: "Settings", color: "#10203f", ...i(Settings) },
  help: { label: "Help", short: "Help", color: "#10203f", ...i(CircleQuestionMark) },
  "ap-ideas": { label: "Ideas", short: "Ideas", color: "#d4ad4b", ...i(Lightbulb) },
  "ap-brand": { label: "Brand kit", short: "Brand kit", color: "#c13584", ...i(Palette) },
  "admin-revenue": { label: "Revenue", short: "Revenue", color: "#10203f", ...i(BadgeIndianRupee) },
  "admin-customers": { label: "Customers", short: "Customers", color: "#10203f", ...i(Users) },
  "admin-payments": { label: "Payments", short: "Payments", color: "#10203f", ...i(Receipt) },
  "admin-coupons": { label: "Coupons", short: "Coupons", color: "#10203f", ...i(TicketPercent) },
  "admin-announce": { label: "Announcements", short: "Announcements", color: "#10203f", ...i(Megaphone) },
  "admin-health": { label: "System health", short: "Health", color: "#10203f", ...i(HeartPulse) },
}

export const platformKey = (p: string) => (p || "").toLowerCase().replace(/[^a-z]/g, "")
