// lib/dashboard/types.ts
//
// Shape of the JSON returned by n8n workflow "10 - Elevating CHRIST - Dashboard API"
// (webhook ec-dash). One section per request; every section uses the same
// generic shape so the dashboard can draw any platform with the same parts.

export type Point = { d: string; v: number | null }

export type Format = "number" | "percent" | "decimal" | "duration" | "date"

export type Kpi = {
  key: string
  label: string
  value: number | null
  prev: number | null
  format: Format
  series?: Point[] | null
  cseries?: Point[] | null
  help?: string
  invert?: boolean
}

export type Column = {
  key: string
  label: string
  format?: Format
  bar?: boolean
  link?: string
  thumb?: string
  badge?: string
  sub?: string
  filter?: string
  filterKey?: string
}

export type Row = Record<string, unknown>

export type DataTable = {
  key: string
  title: string
  columns: Column[]
  rows: Row[]
  kind?: "bars" | "share" | "table"
  group?: string
  wide?: boolean
  note?: string
  emptyNote?: string
  countryCodes?: boolean
  countryCodes3?: boolean
  link?: string
}

export type ItemRow = {
  id: string
  url: string
  thumb: string | null
  title: string
  time: string | null
  type?: string
  privacy?: string | null
  [key: string]: unknown
}

export type Items = { title: string; columns: Column[]; rows: ItemRow[]; typeFilter?: boolean; sortBy?: string }

export type Range = { start: string; end: string; cstart: string | null; cend: string | null; days: number; cmp: string }

export type SectionData = {
  ok: true
  section: string
  range: Range
  filters: Record<string, string>
  generatedAt: string
  account: { name: string; handle?: string; url: string; avatar: string | null; stats: { label: string; value: number | null }[] } | null
  kpis: Kpi[]
  tables: DataTable[]
  items: Items | null
  notes: string[]
  errors: { what: string; error: string }[]
  chartDefault?: string
  heatmap?: { title: string; grid: number[][]; days: string[] }
  realtime?: { users: number | null; pages: { k: string; v: number | null }[] }
}

export type SectionError = { ok: false; section?: string; error: string }

export type QueueItem = {
  row: number
  title: string
  platform: string
  format: string
  postType: string
  mode: string
  status: string
  phase: string
  when: string | null
  whenText: string
  postedAt: string | null
  url: string | null
  error: string | null
  caption: string
  preview: string | null
  slides: number
  isVideo: boolean
  /** Where Open/Edit goes, when it isn't the business's rowUrl (e.g. a blog post in a sheet calendar). */
  editUrl?: string | null
  /** Shown in the calendar but can't be paused or rescheduled from here. */
  readOnly?: boolean
}

export type QueueData = { ok: true; section: "queue"; generatedAt: string; items: QueueItem[]; notes?: string[] }

// ---------- Blog page (Nestoodle) ----------

export type BlogTopic = {
  row: number
  id: string
  type: string
  status: string
  writeOn: string
  publishOn: string
  title: string
  keyword: string
  secondary: string
  category: string
  angle: string
  why: string
  postId: number | null
  notes: string
  pinTitle: string
  pinDescription: string
  socialCaption: string
}

export type BlogPost = {
  id: number
  title: string
  status: string
  /** Site time (India), "YYYY-MM-DDTHH:mm". */
  date: string | null
  modified: string | null
  link: string | null
  slug: string
  excerpt: string
  featuredImage: string | null
  category: string
  words: number
  keyword: string
  automated: boolean
}

export type BlogData = { ok: true; section: "blog"; generatedAt: string; posts: BlogPost[]; topics: BlogTopic[]; notes?: string[] }
export type BlogPostData = { ok: true; section: "blogpost"; generatedAt: string; post: BlogPost & { content: string }; topic: BlogTopic | null }

export type AnySection = SectionData | QueueData | BlogData | BlogPostData | SectionError
