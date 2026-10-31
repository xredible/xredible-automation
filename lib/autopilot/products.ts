// lib/autopilot/products.ts
//
// The automations customers can subscribe to at xredible.in/dashboard.
// Safe to import from client code. Prices are in paise (₹1 = 100).

export type ProductKey = "linkedin" | "meta" | "blog" | "newsletter"
export type PlanKey = "starter" | "pro"
/** Monthly, or yearly at the price of 10 months (2 months free) with the year's posts up front. */
export type Cycle = "monthly" | "yearly"

export type Plan = { key: PlanKey; name: string; price: number; posts: number; blurb: string; contacts?: number }

export type Product = {
  key: ProductKey
  name: string
  tagline: string
  unit: string
  trial: number
  /** Newsletter only: how many subscribers the free trial can send to. */
  trialContacts?: number
  live: boolean
  plans: Plan[]
}

export const PRODUCTS: Record<ProductKey, Product> = {
  linkedin: {
    key: "linkedin",
    name: "LinkedIn Autopilot",
    tagline: "Posts written in your voice, approved by you, published to your LinkedIn on schedule.",
    unit: "posts",
    trial: 3,
    live: true,
    plans: [
      { key: "starter", name: "Starter", price: 99900, posts: 12, blurb: "About 3 posts a week" },
      { key: "pro", name: "Pro", price: 199900, posts: 30, blurb: "About 1 post a day" },
    ],
  },
  meta: {
    key: "meta",
    name: "Instagram + Facebook Autopilot",
    tagline: "Captions and post designs made for your brand, approved by you, published to Instagram and your Facebook Page.",
    unit: "posts",
    trial: 3,
    live: true,
    plans: [
      { key: "starter", name: "Starter", price: 189900, posts: 12, blurb: "About 3 posts a week" },
      { key: "pro", name: "Pro", price: 399900, posts: 30, blurb: "About 1 post a day" },
    ],
  },
  blog: {
    key: "blog",
    name: "Blog Writer for WordPress",
    tagline: "SEO articles on your topics, approved by you, published to your WordPress site on schedule.",
    unit: "articles",
    trial: 3,
    live: true,
    plans: [
      { key: "starter", name: "Starter", price: 249900, posts: 10, blurb: "2–3 articles a week" },
      { key: "pro", name: "Pro", price: 499900, posts: 25, blurb: "About 6 articles a week" },
    ],
  },
  newsletter: {
    key: "newsletter",
    name: "Email Marketing",
    tagline: "Newsletters, automated welcome and follow-up emails, campaigns and signup forms, written in your voice and sent from your own email.",
    unit: "issues",
    trial: 3,
    trialContacts: 200,
    live: true,
    plans: [
      { key: "starter", name: "Starter", price: 179900, posts: 4, blurb: "Up to 1,000 subscribers · sequences & signup forms", contacts: 1000 },
      { key: "pro", name: "Pro", price: 299900, posts: 8, blurb: "Up to 5,000 subscribers · sequences & signup forms", contacts: 5000 },
    ],
  },
}

export const PRODUCT_KEYS = Object.keys(PRODUCTS) as ProductKey[]
export const isProduct = (v: unknown): v is ProductKey => typeof v === "string" && v in PRODUCTS
export const planOf = (p: ProductKey, plan: string) => PRODUCTS[p].plans.find((x) => x.key === plan) || null
export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`

export type Subscription = {
  id: number
  email: string
  product: ProductKey
  plan: "trial" | PlanKey
  cycle: Cycle
  status: "trial" | "pending" | "active" | "halted" | "cancelled"
  postLimit: number
  used: number
  periodStart: string | null
  periodEnd: string | null
  rzpSubId: string
  note: string
  /** Extra profiles paid for on top of the plan (each one: half the plan price, the plan's full post count). */
  extra: number
}

/** "Free access" given by an admin (Accounts → Edit): the Pro plan without payment, renewed every 30 days. */
export const FREE_NOTE = "Free access from Xredible: no payment needed."
export const isFree = (s: Subscription | null) => !!s && s.note === FREE_NOTE

/** A paid month ended (manual UPI plans aren't renewed automatically). 2 days' grace. Free access never lapses. */
export const lapsed = (s: Subscription | null) => !!s && !isFree(s) && s.status === "active" && !!s.periodEnd && Date.parse(s.periodEnd) + 2 * 864e5 < Date.now()

/** Can this subscription publish one more? */
export const canPublish = (s: Subscription | null) => !!s && (s.status === "trial" || s.status === "active") && !lapsed(s) && s.used < s.postLimit

export const YEARLY_MONTHS = 10

// ---------- extra profiles (add-on) ----------
// More than one LinkedIn profile, Facebook Page (+ Instagram) or WordPress site in one brand.
// Each extra profile costs half the plan price and adds the plan's full post count.

/** Tools that can have extra profiles (the newsletter sends from one address). */
export const EXTRA_PRODUCTS: ProductKey[] = ["linkedin", "meta", "blog"]
export const canHaveExtra = (p: ProductKey) => EXTRA_PRODUCTS.includes(p)
export const MAX_EXTRA = 5
export const cleanExtra = (p: ProductKey, v: unknown) => (canHaveExtra(p) ? Math.min(MAX_EXTRA, Math.max(0, Math.floor(Number(v) || 0))) : 0)
export const EXTRA_LABEL: Record<ProductKey, { one: string; many: string }> = {
  linkedin: { one: "LinkedIn profile", many: "LinkedIn profiles" },
  meta: { one: "Facebook Page + Instagram", many: "Facebook Pages + Instagram" },
  blog: { one: "WordPress site", many: "WordPress sites" },
  newsletter: { one: "sending address", many: "sending addresses" },
}
/** "+ 2 extra LinkedIn profiles" (empty for none). */
export const extraText = (p: ProductKey, n: number) => (n > 0 ? `+ ${n} extra ${n === 1 ? EXTRA_LABEL[p].one : EXTRA_LABEL[p].many}` : "")

/** The plan price, with extra profiles at half the plan price each (rounded to the rupee). */
export const priceOf = (product: ProductKey, plan: PlanKey, cycle: Cycle, extra = 0) => {
  const base = (planOf(product, plan)?.price || 0) * (cycle === "yearly" ? YEARLY_MONTHS : 1)
  return Math.round((base * (2 + cleanExtra(product, extra))) / 2 / 100) * 100
}
/** Posts in the period: the plan's count for the main profile and again for each extra one. */
export const limitOf = (product: ProductKey, plan: PlanKey, cycle: Cycle, extra = 0) => (planOf(product, plan)?.posts || 0) * (cycle === "yearly" ? 12 : 1) * (1 + cleanExtra(product, extra))
/** How many profiles a subscription may connect: 1, plus paid extras while the plan is active. */
export const profilesAllowed = (s: Subscription | null) => 1 + (s && (s.status === "active" || isFree(s)) && !lapsed(s) ? cleanExtra(s.product, s.extra) : 0)
export const daysOf = (cycle: Cycle) => (cycle === "yearly" ? 365 : 30)
export const isCycle = (v: unknown): v is Cycle => v === "monthly" || v === "yearly"

/** A UPI payment waiting for the admin to check: note "upi:<plan>:<utr>:<when>|<cycle>|<coupon>|<amount paise>|<extra profiles>". */
export function pendingUpi(s: Subscription | null): { plan: PlanKey; utr: string; at: string; cycle: Cycle; coupon: string; amount: number | null; extra: number } | null {
  const m = /^upi:(starter|pro):([A-Za-z0-9]+):([^|]+)(?:\|(monthly|yearly)\|([A-Z0-9]*)\|(\d+)(?:\|(\d+))?)?$/.exec(s?.note || "")
  return m ? { plan: m[1] as PlanKey, utr: m[2], at: m[3], cycle: (m[4] as Cycle) || "monthly", coupon: m[5] || "", amount: m[6] ? Number(m[6]) : null, extra: m[7] ? Number(m[7]) : 0 } : null
}
export const remaining = (s: Subscription | null) => (s ? Math.max(0, s.postLimit - s.used) : 0)

/** Newsletter: how many subscribers this subscription may send to. */
export function contactCap(s: Subscription | null): number {
  const p = PRODUCTS.newsletter
  if (!s || s.product !== "newsletter") return 0
  if (s.status === "trial") return p.trialContacts || 200
  return planOf("newsletter", s.plan)?.contacts || p.trialContacts || 200
}
