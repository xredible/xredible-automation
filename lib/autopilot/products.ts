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
    name: "Email Newsletter Autopilot",
    tagline: "A newsletter written for your audience, approved by you, sent from your own email to your subscribers.",
    unit: "issues",
    trial: 3,
    trialContacts: 200,
    live: true,
    plans: [
      { key: "starter", name: "Starter", price: 179900, posts: 4, blurb: "Weekly, up to 1,000 subscribers", contacts: 1000 },
      { key: "pro", name: "Pro", price: 299900, posts: 8, blurb: "Twice a week, up to 5,000 subscribers", contacts: 5000 },
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
}

/** A paid month ended (manual UPI plans aren't renewed automatically). 2 days' grace. */
export const lapsed = (s: Subscription | null) => !!s && s.status === "active" && !!s.periodEnd && Date.parse(s.periodEnd) + 2 * 864e5 < Date.now()

/** Can this subscription publish one more? */
export const canPublish = (s: Subscription | null) => !!s && (s.status === "trial" || s.status === "active") && !lapsed(s) && s.used < s.postLimit

export const YEARLY_MONTHS = 10
export const priceOf = (product: ProductKey, plan: PlanKey, cycle: Cycle) => (planOf(product, plan)?.price || 0) * (cycle === "yearly" ? YEARLY_MONTHS : 1)
export const limitOf = (product: ProductKey, plan: PlanKey, cycle: Cycle) => (planOf(product, plan)?.posts || 0) * (cycle === "yearly" ? 12 : 1)
export const daysOf = (cycle: Cycle) => (cycle === "yearly" ? 365 : 30)
export const isCycle = (v: unknown): v is Cycle => v === "monthly" || v === "yearly"

/** A UPI payment waiting for the admin to check: note "upi:<plan>:<utr>:<when>|<cycle>|<coupon>|<amount paise>". */
export function pendingUpi(s: Subscription | null): { plan: PlanKey; utr: string; at: string; cycle: Cycle; coupon: string; amount: number | null } | null {
  const m = /^upi:(starter|pro):([A-Za-z0-9]+):([^|]+)(?:\|(monthly|yearly)\|([A-Z0-9]*)\|(\d+))?$/.exec(s?.note || "")
  return m ? { plan: m[1] as PlanKey, utr: m[2], at: m[3], cycle: (m[4] as Cycle) || "monthly", coupon: m[5] || "", amount: m[6] ? Number(m[6]) : null } : null
}
export const remaining = (s: Subscription | null) => (s ? Math.max(0, s.postLimit - s.used) : 0)

/** Newsletter: how many subscribers this subscription may send to. */
export function contactCap(s: Subscription | null): number {
  const p = PRODUCTS.newsletter
  if (!s || s.product !== "newsletter") return 0
  if (s.status === "trial") return p.trialContacts || 200
  return planOf("newsletter", s.plan)?.contacts || p.trialContacts || 200
}
