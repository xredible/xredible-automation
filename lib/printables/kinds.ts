// lib/printables/kinds.ts
//
// Safe to import from client code. Which printables each workspace makes, and what they are
// called there. Nestoodle has its own flow (WordPress articles, n8n NST-PR); the others are
// kept in the n8n data table "XD Printables" (lib/printables/generic.ts).

export type PLang = "en" | "hi"

export type Kind = { key: string; label: string; labelHi?: string; hint: string; auto?: boolean }

export type Workspace = {
  /** The page's name in the sidebar. */
  label: string
  /** What the printables are made from. */
  sources: string
  source: string
  kinds: Kind[]
  langs: PLang[]
  /** Where Publish puts the PDF. */
  publishTo: string
  /** New printables can also be made from a topic someone types (no source item). */
  topics?: boolean
}

export const WORKSPACES: Record<string, Workspace> = {
  "elevating-christ": {
    label: "Sermon Notes",
    sources: "Sermons",
    source: "sermon",
    kinds: [
      { key: "notes", label: "Sermon Notes", labelHi: "संदेश नोट्स", hint: "Fill-in outline, key verse, reflection questions and a weekly step. For every sermon.", auto: true },
      { key: "study", label: "Bible Study Guide", labelHi: "बाइबल अध्ययन गाइड", hint: "Deeper questions for personal or small-group study (about 45 minutes)." },
    ],
    langs: ["en", "hi"],
    publishTo: "the sermon page on elevatingchrist.com",
  },
  "linkedin-agency": {
    label: "Lead Magnets",
    sources: "Newsletters",
    source: "newsletter",
    kinds: [{ key: "magnet", label: "Lead Magnet", hint: "A one or two page checklist or guide people download from a LinkedIn post, newsletter or DM. Publish gives you a link to share." }],
    langs: ["en"],
    publishTo: "a download link you can share on LinkedIn",
    topics: true,
  },
  autopilot: {
    label: "Printables",
    sources: "Articles",
    source: "article",
    kinds: [{ key: "guide", label: "Free download", labelHi: "मुफ़्त डाउनलोड", hint: "A checklist or short guide made from the article, added to the end of the article as a PDF download (your brand colors and logo).", auto: true }],
    langs: ["en", "hi"],
    publishTo: "the article on your website",
  },
}

export const LANG_LABEL: Record<PLang, string> = { en: "English", hi: "Hindi" }

/** One printable that can be made: a sermon × kind × language. */
export type GSource = {
  key: string
  ref: string
  kind: string
  lang: PLang
  title: string
  /** The source's title in this language. */
  shownTitle: string
  link: string
  date: string
  available: boolean
  note?: string
}

export type GRow = {
  id: number
  ref: string
  kind: string
  lang: PLang
  status: "draft" | "published" | "failed"
  title: string
  spec: import("./spec").Spec | null
  fileName: string
  linkText: string
  url: string
  pages: number
  error: string
  changedAt: string
  publishedAt: string
}

export const sourceKey = (ref: string, kind: string, lang: string) => `${ref}~${kind}~${lang}`
