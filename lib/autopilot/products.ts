// lib/autopilot/products.ts
//
// The automations customers can subscribe to at xredible.in/dashboard.
// Safe to import from client code. Prices are in paise (₹1 = 100).

export type ProductKey = "linkedin" | "meta" | "blog" | "newsletter"
export type PlanKey = "starter" | "pro"

export type Plan = { key: PlanKey; name: string; price: number; posts: number; blurb: string }

export type Product = {
  key: ProductKey
  name: string
  tagline: string
  unit: string
  trial: number
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
    name: "Instagram + Facebook Publisher",
    tagline: "A content calendar that posts reels, carousels and posts to your Instagram and Facebook.",
    unit: "posts",
    trial: 3,
    live: false,
    plans: [],
  },
  blog: {
    key: "blog",
    name: "Blog Writer for WordPress",
    tagline: "Researches keywords, writes SEO articles and schedules them on your WordPress site.",
    unit: "articles",
    trial: 1,
    live: false,
    plans: [],
  },
  newsletter: {
    key: "newsletter",
    name: "Email Newsletter",
    tagline: "Welcome emails and a weekly digest to your subscribers, sent from your own domain.",
    unit: "emails",
    trial: 1,
    live: false,
    plans: [],
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

/** A UPI payment waiting for the admin to check: note "upi:<plan>:<utr>:<when>". */
export function pendingUpi(s: Subscription | null): { plan: PlanKey; utr: string; at: string } | null {
  const m = /^upi:(starter|pro):([A-Za-z0-9]+):(.+)$/.exec(s?.note || "")
  return m ? { plan: m[1] as PlanKey, utr: m[2], at: m[3] } : null
}
export const remaining = (s: Subscription | null) => (s ? Math.max(0, s.postLimit - s.used) : 0)
