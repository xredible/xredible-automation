// Search indexes assigned navigation and a small allowlist of existing entry points.
// It never sends content actions or grants new page permissions.
import {
  ADMIN_VIEWS,
  hubOf,
  viewsOf,
  type BusinessKey,
  type ViewName,
} from "./businesses";
export type JumpTarget = "idea-composer" | "write-topics" | "image-post";
export type JumpEntry = {
  id: string;
  label: string;
  description: string;
  keywords: string;
  kind: "Page" | "Action" | "Account";
  biz?: BusinessKey;
  view?: ViewName;
  panel?: "accounts" | "customers" | "password";
  target?: JumpTarget;
};
// Labels come from the existing page registry at the call site, avoiding a second
// list of page names or a dependency on React/icon modules in this model.
export function jumpEntries(
  biz: BusinessKey,
  admin: boolean,
  hasAutopilot: boolean,
  label: (biz: BusinessKey, view: ViewName) => string,
): JumpEntry[] {
  const page = (b: BusinessKey, v: ViewName): JumpEntry => ({
    id: `page:${b}:${v}`,
    label: label(b, v),
    description: ADMIN_VIEWS.includes(v)
      ? "Account · Admin"
      : `${hubOf(b, v).label}${b !== biz ? " · Xredible Autopilot" : ""}`,
    keywords: `${v} ${hubOf(b, v).label}`,
    kind: ADMIN_VIEWS.includes(v) ? "Account" : "Page",
    biz: b,
    view: v,
  });
  const entries = viewsOf(biz)
    .filter((v) => !ADMIN_VIEWS.includes(v) || admin)
    .map((v) => page(biz, v));
  if (admin && hasAutopilot && biz !== "autopilot")
    entries.push(...ADMIN_VIEWS.map((v) => page("autopilot", v)));
  if (hasAutopilot && biz !== "autopilot")
    entries.push({ ...page("autopilot", "billing"), kind: "Account" });
  if (admin) {
    entries.push({
      id: "account:accounts",
      label: "Accounts",
      description: "Account access",
      keywords: "users members permissions",
      kind: "Account",
      panel: "accounts",
    });
    if (!hasAutopilot)
      entries.push({
        id: "account:customers",
        label: "Customers",
        description: "Customer accounts",
        keywords: "clients",
        kind: "Account",
        panel: "customers",
      });
  }
  entries.push({
    id: "account:password",
    label: "My password",
    description: "Open the existing password form",
    keywords: "account password security",
    kind: "Account",
    panel: "password",
  });
  if (admin && (biz === "nestoodle" || biz === "elevating-christ")) {
    entries.push({
      id: "action:add-idea",
      label: "Add an idea",
      description: "Open the idea form; review before saving",
      keywords: "new topic draft create idea",
      kind: "Action",
      biz,
      view: "ap-ideas",
      target: "idea-composer",
    });
    if (biz === "nestoodle")
      entries.push(
        {
          id: "action:write",
          label: "Write a blog post now",
          description: "Choose a topic, then use the existing confirmation",
          keywords: "article wordpress draft writer write now",
          kind: "Action",
          biz,
          view: "ap-ideas",
          target: "write-topics",
        },
        {
          id: "action:images",
          label: "Make images for a draft",
          description: "Choose a post, then confirm the image request",
          keywords: "photos image queue ready generate",
          kind: "Action",
          biz,
          view: "automation-images",
          target: "image-post",
        },
      );
  }
  if (biz === "autopilot")
    entries.push({
      id: "action:repurpose",
      label: "Create drafts from an idea",
      description: "Open Ideas to choose channels and review the request",
      keywords: "repurpose draft content create",
      kind: "Action",
      biz,
      view: "ap-ideas",
    });
  return entries;
}
export function filterJumps(entries: JumpEntry[], query: string): JumpEntry[] {
  const q = query.trim().toLocaleLowerCase(),
    terms = q.split(/\s+/).filter(Boolean);
  return entries
    .filter((e) =>
      terms.every((t) =>
        `${e.label} ${e.description} ${e.keywords}`
          .toLocaleLowerCase()
          .includes(t),
      ),
    )
    .map((entry, index) => ({
      entry,
      index,
      rank: q && entry.label.toLocaleLowerCase().startsWith(q) ? 0 : 1,
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((x) => x.entry);
}
