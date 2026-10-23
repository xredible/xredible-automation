// lib/autopilot/demo-samples.ts
//
// Safe for client code. Fixed sample brands and posts for the public demo page (/demo). The designs are
// drawn by the real template engine at /api/autopilot/demo, so visitors see exactly what customers get.
// All brands here are made up.

import type { Goal, Slide } from "./formats"
import type { TemplateKey } from "./brand-presets"

export type DemoPost = { day: string; goal: Goal; format: "text" | "image" | "carousel"; channel: "LinkedIn" | "Instagram" | "Facebook" | "Email"; hook: string }
export type DemoBrand = {
  key: string
  label: string
  name: string
  handle: string
  tagline: string
  niche: string
  template: TemplateKey
  offerTemplate: TemplateKey
  week: DemoPost[]
  carousel: Slide[]
  offer: string
}

export const DEMO_BRANDS: DemoBrand[] = [
  {
    key: "coach",
    label: "Coach / consultant",
    name: "Priya Mehta",
    handle: "Career coach",
    tagline: "Career coaching | Interviews | Salary talks",
    niche: "creator",
    template: "playbook",
    offerTemplate: "playbook",
    week: [
      { day: "Mon", goal: "teach", format: "carousel", channel: "LinkedIn", hook: "5 interview answers that quietly cost you the offer" },
      { day: "Tue", goal: "story", format: "text", channel: "LinkedIn", hook: "I froze in my first salary talk. Here's what I say now." },
      { day: "Wed", goal: "proof", format: "image", channel: "Instagram", hook: "How I prepare a client for a final round, step by step" },
      { day: "Thu", goal: "talk", format: "text", channel: "LinkedIn", hook: "Cover letters in 2026: still needed or a waste of time?" },
      { day: "Fri", goal: "offer", format: "image", channel: "LinkedIn", hook: "3 free mock-interview slots this month. Comment PREP." },
    ],
    carousel: [
      { title: "5 interview answers that cost you the offer", body: "Small habits that make strong candidates sound unsure." },
      { title: "Starting with your full life story", body: "Answer 'tell me about yourself' in 60 seconds: now, before, next." },
      { title: "Saying you have no weaknesses", body: "Name a real one and the step you took to fix it." },
      { title: "Save this for your next interview", body: "Follow for one practical career tip every week." },
    ],
    offer: "3 free mock-interview slots this month",
  },
  {
    key: "cafe",
    label: "Restaurant / café",
    name: "Chai & Crumbs Café",
    handle: "@chaiandcrumbs",
    tagline: "Fresh bakes daily | Open 8 am to 11 pm",
    niche: "food",
    template: "editorial",
    offerTemplate: "bold",
    week: [
      { day: "Mon", goal: "teach", format: "carousel", channel: "Instagram", hook: "How to pick the right chai for your mood" },
      { day: "Tue", goal: "story", format: "image", channel: "Instagram", hook: "4 am at our bakery: the first batch of the day" },
      { day: "Wed", goal: "talk", format: "image", channel: "Facebook", hook: "Masala chai or cutting chai? Settle it in the comments." },
      { day: "Thu", goal: "proof", format: "image", channel: "Instagram", hook: "From dough to your plate in 3 hours" },
      { day: "Fri", goal: "offer", format: "image", channel: "Instagram", hook: "Weekend combo: any chai + a fresh bake. DM us to book a table." },
    ],
    carousel: [
      { title: "How to pick the right chai for your mood", body: "A quick guide from our counter to your cup." },
      { title: "Tired after work?", body: "Go for adrak chai. Ginger wakes you up better than a second coffee." },
      { title: "Catching up with friends?", body: "Share a pot of masala chai and a plate of rusks." },
      { title: "Save this for your next visit", body: "Show this slide at the counter and pick your chai." },
    ],
    offer: "Weekend combo: any chai and a fresh bake",
  },
  {
    key: "d2c",
    label: "D2C / e-commerce",
    name: "Lumi Botanicals",
    handle: "lumibotanicals.in",
    tagline: "Clean skincare | Made in small batches",
    niche: "ecommerce",
    template: "spark",
    offerTemplate: "split",
    week: [
      { day: "Mon", goal: "teach", format: "carousel", channel: "Instagram", hook: "Your 3-step night routine for humid weather" },
      { day: "Tue", goal: "proof", format: "image", channel: "Instagram", hook: "What goes into one bottle: our ingredient list, explained" },
      { day: "Wed", goal: "story", format: "text", channel: "LinkedIn", hook: "Why we chose small batches over a big factory run" },
      { day: "Thu", goal: "talk", format: "image", channel: "Instagram", hook: "Oily, dry or both? Tell us your skin type." },
      { day: "Fri", goal: "offer", format: "image", channel: "Facebook", hook: "Festive gift box is back. DM GIFT for the link." },
    ],
    carousel: [
      { title: "Your night routine for humid weather", body: "Three steps, under five minutes, no sticky feel." },
      { title: "Cleanse gently", body: "A mild gel cleanser removes sweat and sunscreen without drying." },
      { title: "Hydrate, don't layer", body: "One light serum is enough when the air is already humid." },
      { title: "Save this routine", body: "Follow for weekly skin tips that suit Indian weather." },
    ],
    offer: "Festive gift box is back",
  },
  {
    key: "clinic",
    label: "Clinic / wellness",
    name: "BrightSmile Dental",
    handle: "brightsmiledental.in",
    tagline: "Family dentistry | Mon to Sat",
    niche: "health",
    template: "minimal",
    offerTemplate: "minimal",
    week: [
      { day: "Mon", goal: "teach", format: "carousel", channel: "Instagram", hook: "4 brushing mistakes almost everyone makes" },
      { day: "Tue", goal: "story", format: "text", channel: "Facebook", hook: "Why our first visit is always just a conversation" },
      { day: "Wed", goal: "proof", format: "image", channel: "Instagram", hook: "What happens in a 30-minute check-up" },
      { day: "Thu", goal: "teach", format: "image", channel: "Facebook", hook: "When to bring your child for their first check-up" },
      { day: "Fri", goal: "offer", format: "image", channel: "Instagram", hook: "Family check-up week. Call or DM to book a slot." },
    ],
    carousel: [
      { title: "4 brushing mistakes almost everyone makes", body: "Small fixes that protect your teeth for years." },
      { title: "Brushing too hard", body: "Use a soft brush and gentle circles. Pressure wears enamel away." },
      { title: "Rinsing right after", body: "Spit, don't rinse. Let the toothpaste keep working." },
      { title: "Save this and share it", body: "Follow for simple tips from our dentists." },
    ],
    offer: "Family check-up week",
  },
]

export const demoBrand = (key: unknown) => DEMO_BRANDS.find((b) => b.key === key) || DEMO_BRANDS[0]
