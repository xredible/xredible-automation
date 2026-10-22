// lib/dashboard/businesses.ts
//
// The businesses the Xredible client dashboard (xredible.in/dashboard) can show.
// Safe to import from client code: no secrets here.
//
// Each business has its own n8n "Dashboard API" webhook. The website reaches them all
// through one n8n gateway (XD-G), and each account only sees the businesses it was given.

export type BusinessKey = "elevating-christ" | "nestoodle" | "linkedin-agency" | "autopilot"

export type ViewName =
  | "overview"
  | "schedule"
  | "blog"
  | "instagram"
  | "facebook"
  | "youtube"
  | "pinterest"
  | "ga4"
  | "gsc"
  | "results"
  | "newsletters"
  | "email"
  // Xredible Autopilot (a customer's own automations; data computed on the website, not in n8n)
  | "linkedin"
  | "articles"
  | "newsletter"
  | "ap-linkedin"
  | "ap-meta"
  | "ap-blog"
  | "ap-newsletter"
  | "settings"
  | "billing"
  | "help"

export type Business = {
  key: BusinessKey
  name: string
  subtitle: string
  icon: string
  /** Sidebar groups; the first group has no heading. */
  nav: { group: string; items: ViewName[] }[]
  /** Sections the n8n Dashboard API answers ("queue" backs the calendar view). */
  sections: string[]
  /** Overview tiles: one headline number from a section. */
  picks: { section: ViewName; key: string; label: string }[]
  /** Where the content queue lives; row links open {row} there ("" when each item brings its own editUrl). */
  sheet: string
  sheetName: string
  rowUrl: string
  rowLabel: string
  /** Whether the calendar can pause / resume / reschedule (needs a Dashboard Actions workflow). */
  actions: boolean
  /** Whether the Blog page can edit and publish posts (needs a Blog Actions workflow). */
  blog?: boolean
  /** The public website, for links to its pages. */
  site: string
  /** Platforms shown in the calendar legend. */
  platforms: string[]
}

export const BUSINESSES: Record<BusinessKey, Business> = {
  "elevating-christ": {
    key: "elevating-christ",
    name: "Elevating CHRIST",
    subtitle: "Ministry dashboard",
    icon: "/dashboard/elevating-christ.png",
    nav: [
      { group: "", items: ["overview", "schedule"] },
      { group: "Social", items: ["instagram", "facebook", "youtube", "pinterest"] },
      { group: "Website", items: ["ga4", "gsc"] },
      { group: "Members", items: ["email"] },
    ],
    sections: ["queue", "instagram", "facebook", "youtube", "pinterest", "ga4", "gsc", "email"],
    picks: [
      { section: "ga4", key: "activeUsers", label: "Website visitors" },
      { section: "youtube", key: "views", label: "YouTube views" },
      { section: "youtube", key: "watch", label: "YouTube watch hours" },
      { section: "instagram", key: "reach", label: "Instagram accounts reached" },
      { section: "instagram", key: "views", label: "Instagram views" },
      { section: "facebook", key: "views", label: "Facebook views" },
      { section: "gsc", key: "clicks", label: "Google search clicks" },
      { section: "pinterest", key: "impression", label: "Pinterest impressions" },
      { section: "email", key: "members", label: "Website members" },
    ],
    sheet: "https://docs.google.com/spreadsheets/d/14YuPAcgpIwktyHLLtJgZqM65t2SNeXmle181F6QP-q0/edit#gid=1492332432",
    sheetName: "Church Content Queue",
    rowUrl: "https://docs.google.com/spreadsheets/d/14YuPAcgpIwktyHLLtJgZqM65t2SNeXmle181F6QP-q0/edit#gid=1492332432&range=A{row}",
    rowLabel: "Sheet",
    actions: true,
    site: "https://www.elevatingchrist.com",
    platforms: ["instagram", "facebook", "youtube", "pinterest"],
  },
  nestoodle: {
    key: "nestoodle",
    name: "Nestoodle",
    subtitle: "Parenting website",
    icon: "/dashboard/nestoodle.svg",
    nav: [
      { group: "", items: ["overview", "schedule", "blog"] },
      { group: "Social", items: ["instagram", "facebook", "pinterest"] },
      { group: "Website", items: ["ga4", "gsc"] },
      { group: "Email", items: ["email"] },
    ],
    sections: ["queue", "blog", "blogpost", "ga4", "gsc", "instagram", "facebook", "pinterest", "email"],
    picks: [
      { section: "ga4", key: "activeUsers", label: "Website visitors" },
      { section: "ga4", key: "views", label: "Page views" },
      { section: "gsc", key: "clicks", label: "Google search clicks" },
      { section: "gsc", key: "impressions", label: "Google search impressions" },
      { section: "instagram", key: "views", label: "Instagram views" },
      { section: "facebook", key: "views", label: "Facebook views" },
      { section: "pinterest", key: "impression", label: "Pinterest impressions" },
      { section: "email", key: "subscribers", label: "Email subscribers" },
    ],
    // The Content Queue sheet's id lives in n8n (NST_SHEET_ID), so every item brings its own editUrl.
    sheet: "",
    sheetName: "Nestoodle Content Queue",
    rowUrl: "",
    rowLabel: "Sheet",
    actions: true,
    blog: true,
    site: "https://nestoodle.com",
    platforms: ["instagram", "facebook", "pinterest", "wordpress"],
  },
  "linkedin-agency": {
    key: "linkedin-agency",
    name: "LinkedIn Agency",
    subtitle: "Growth dashboard",
    icon: "/dashboard/linkedin-agency.svg",
    nav: [
      { group: "", items: ["overview", "schedule"] },
      { group: "LinkedIn", items: ["results", "newsletters"] },
    ],
    sections: ["queue", "results", "newsletters"],
    picks: [
      { section: "results", key: "posted", label: "Posts published" },
      { section: "results", key: "clicks", label: "Lead-link clicks" },
      { section: "results", key: "clicksPerPost", label: "Clicks per post" },
      { section: "newsletters", key: "drafted", label: "Newsletter drafts" },
    ],
    sheet: "https://docs.google.com/spreadsheets/d/1OlnBLxFm5R3JdYbjtuX32qm-JzZzOehlVEBOG3l285M/edit#gid=266430623",
    sheetName: "LinkedIn Lead Engine sheet",
    rowUrl: "https://docs.google.com/spreadsheets/d/1OlnBLxFm5R3JdYbjtuX32qm-JzZzOehlVEBOG3l285M/edit#gid=266430623&range=A{row}",
    rowLabel: "Sheet",
    actions: true,
    site: "https://www.linkedin.com",
    platforms: ["linkedin"],
  },
  autopilot: {
    key: "autopilot",
    name: "My automations",
    subtitle: "Xredible Autopilot",
    icon: "/dashboard/xredible.svg",
    nav: [
      { group: "", items: ["overview", "schedule"] },
      { group: "Results", items: ["instagram", "facebook", "linkedin", "articles", "newsletter"] },
      { group: "Automations", items: ["ap-linkedin", "ap-meta", "ap-blog", "ap-newsletter"] },
      { group: "Account", items: ["billing", "settings", "help"] },
    ],
    sections: ["queue", "instagram", "facebook", "linkedin", "articles", "newsletter"],
    picks: [
      { section: "instagram", key: "reach", label: "Instagram accounts reached" },
      { section: "instagram", key: "views", label: "Instagram views" },
      { section: "facebook", key: "views", label: "Facebook views" },
      { section: "facebook", key: "engagement", label: "Facebook engagements" },
      { section: "linkedin", key: "posted", label: "LinkedIn posts published" },
      { section: "articles", key: "published", label: "Blog articles published" },
      { section: "newsletter", key: "sent", label: "Newsletter emails sent" },
      { section: "newsletter", key: "openRate", label: "Newsletter open rate" },
    ],
    sheet: "",
    sheetName: "content calendar",
    rowUrl: "",
    rowLabel: "Open",
    actions: true,
    site: "https://www.xredible.in",
    platforms: ["instagram", "facebook", "linkedin", "wordpress", "email"],
  },
}

/** The client businesses run through n8n (assignable to member accounts). Autopilot is per customer. */
export const BUSINESS_KEYS = (Object.keys(BUSINESSES) as BusinessKey[]).filter((k) => k !== "autopilot")

/** Autopilot views that open a tool's own page (settings, connection, review queue) instead of a report. */
/** Autopilot account pages (not reports). */
export const ACCOUNT_VIEWS: ViewName[] = ["settings", "billing", "help"]

export const TOOL_VIEW: Partial<Record<ViewName, "linkedin" | "meta" | "blog" | "newsletter">> = { "ap-linkedin": "linkedin", "ap-meta": "meta", "ap-blog": "blog", "ap-newsletter": "newsletter" }

export const isBusiness = (v: unknown): v is BusinessKey => typeof v === "string" && v in BUSINESSES

export const DEFAULT_BUSINESS: BusinessKey = "elevating-christ"

/** Every view a business shows in its sidebar. */
export const viewsOf = (b: BusinessKey): ViewName[] => BUSINESSES[b].nav.flatMap((g) => g.items)

/** The API section behind a view ("schedule" is the "queue" section). */
export const sectionOf = (v: ViewName) => (v === "schedule" ? "queue" : v)
