// Shared business workspace contract. No workflow IDs or private operational notes.
export type WorkspaceBusiness = "nestoodle" | "elevating-christ";
export const isWorkspace = (b: string): b is WorkspaceBusiness =>
  b === "nestoodle" || b === "elevating-christ";
export type Idea = {
  id: string;
  row?: number;
  title: string;
  status: string;
  keyword: string;
  planned: string;
  seasonal?: boolean;
  source: string;
};
export type Automation = {
  key: string;
  name: string;
  description: string;
  schedule: string;
  held: boolean;
  active?: boolean;
  lockedHold?: boolean;
  canHold: boolean;
  observedAt?: string;
  lastRun?: { at: string; status: string };
  nextRun?: string;
  errors: { at: string; message: string }[];
};
export type ImageTask = {
  id: number;
  postId: number;
  title: string;
  status: string;
  notes: string;
  requestedAt: string;
};
export type BusinessKit = {
  logo: string;
  palette: string[];
  fonts: string;
  voice: string;
  imageRules: string;
};
export type BusinessSettings = {
  timezone: string;
  postingTimes: string;
  notificationChannel: string;
};
export type Workspace = {
  ok: true;
  ideas: Idea[];
  automations: Automation[];
  images: ImageTask[];
  kit: BusinessKit;
  settings: BusinessSettings;
  audit: { at: string; actor: string; action: string; result: string }[];
  previews: { title: string; html: string }[];
};
export const BUSINESS_RULES: Record<WorkspaceBusiness, string[]> = {
  nestoodle: [
    "American English for parents of children ages 1–10 in the US and Canada.",
    "Sakshi reviews every WordPress draft before publication.",
    "People-free photos; Hanukkah menorahs have nine branches. No Cloudflare image generation.",
    "Pinterest uses a reviewed bulk CSV; upload and publishing stay manual.",
  ],
  "elevating-christ": [
    "Hindi and English only. Hindi Bible verses must match the O.V. word for word.",
    "No city names in public content.",
    "Credit Br Chandra Mohan only for his own work. Covers must show the named speaker.",
    "Owner reviews Draft → Ready. Pinterest publishing requires human approval.",
  ],
};
export const AUTOMATIONS: Record<
  WorkspaceBusiness,
  Pick<Automation, "key" | "name" | "description" | "schedule">[]
> = {
  nestoodle: [
    {
      key: "writer",
      name: "Blog Writer",
      description:
        "Writes WordPress drafts for Sakshi to review. Write Now uses the existing draft writer.",
      schedule: "07:00 / 15:00 IST; Monday refresh 11:00 IST",
    },
    {
      key: "social",
      name: "Social from articles",
      description:
        "Prepares social drafts from published articles using checked photos.",
      schedule: "Daily; existing workflow schedule",
    },
    {
      key: "publisher",
      name: "Auto Publisher",
      description:
        "Publishes only queue items already approved through the existing process.",
      schedule: "Existing publisher schedule",
    },
    {
      key: "emails",
      name: "Subscriber emails",
      description:
        "Welcome messages and the weekly email for opted-in subscribers.",
      schedule: "Welcome every 15 minutes; weekly Saturday 08:00 US Eastern",
    },
    {
      key: "pinterest",
      name: "Pinterest CSV",
      description:
        "Builds a preview and bulk CSV for manual review and upload.",
      schedule: "Sunday 09:13 IST",
    },
    {
      key: "images",
      name: "Image queue",
      description:
        "Queues the same guarded image request as ready <title> in the Nestoodle bot.",
      schedule: "Worker checks approximately every 10 minutes",
    },
  ],
  "elevating-christ": [
    {
      key: "publisher",
      name: "Auto Publisher",
      description:
        "Processes only approved Ready rows through the existing publishers.",
      schedule: "Hourly",
    },
    {
      key: "shorts",
      name: "YouTube Shorts",
      description: "Uploads approved Shorts from the church content queue.",
      schedule: "Existing Shorts schedule",
    },
    {
      key: "emails",
      name: "Member Emails",
      description:
        "Welcome series, weekly newsletter and Sunday reminder for opted-in members.",
      schedule: "Welcome daily 09:00; Saturday 09:00; Sunday 07:30 IST",
    },
    {
      key: "youtube-pack",
      name: "YouTube Posts Pack",
      description:
        "Sends a pack to the owner to schedule manually in YouTube Studio.",
      schedule: "Saturday 10:13 IST",
    },
    {
      key: "whatsapp",
      name: "WhatsApp Channel Pack",
      description:
        "Prepares approved content for the owner to forward manually to the channel.",
      schedule: "Daily 07:13 IST",
    },
    {
      key: "live",
      name: "LIVE NOW",
      description:
        "Runs the existing live-stream announcement process with its existing checks.",
      schedule: "Existing live trigger",
    },
  ],
};
export const DEFAULT_KITS: Record<WorkspaceBusiness, BusinessKit> = {
  nestoodle: {
    logo: "https://raw.githubusercontent.com/xredible/xredible-automation/main/tools/reels/assets/nestoodle-logo.png",
    palette: ["#FAF3E7", "#332B22", "#E0653C", "#3E8FA6", "#6F8E4E"],
    fonts: "Baloo 2 / Karla / Caveat",
    voice:
      "Warm, practical American English. Helpful parent-to-parent guidance; never invent experiences or results.",
    imageRules:
      "People-free, warm home style. Nine-branch menorah. Checked sources only; no Cloudflare images.",
  },
  "elevating-christ": {
    logo: "/dashboard/elevating-christ.png",
    palette: ["#FFFFFF", "#0F172A", "#D9A521"],
    fonts: "Site typography / Hindi and English",
    voice:
      "Respectful, welcoming Hindi and English. Scripture grounded; no invented testimony or claims.",
    imageRules:
      "Named speaker must match the cover photo. Exact O.V. Hindi verses; no city names. Human review before publishing.",
  },
};
