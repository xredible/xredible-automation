"use client"

// Extra profiles (paid add-on): more LinkedIn profiles, Facebook Pages (+ Instagram) or WordPress
// sites in the same brand, and the "Post to" choice on each post. Used by the LinkedIn page and
// the Instagram + Facebook / Blog Writer pages.

import { createContext, useContext, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { EXTRA_LABEL, limitOf, planOf, priceOf, rupees, type ProductKey, type Subscription } from "@/lib/autopilot/products"
import { card, field, ghost, primary, small } from "./ui"

export type Extras = {
  allowed: number
  room: number
  list: { id: number; name: string; connected: boolean; over: boolean; soon: boolean }[]
  choose?: { id: string; name: string; igUser: string }[]
}

type Act = (b: Record<string, unknown>) => Promise<unknown>

/** Opens the plan picker with one more extra profile (PlanCard listens for this). */
export const askForProfile = (product: ProductKey) => window.dispatchEvent(new CustomEvent("xd-add-profile", { detail: { product } }))

const CONNECT: Partial<Record<ProductKey, string>> = { linkedin: "/dashboard/linkedin/connect?extra=1", meta: "/dashboard/meta/connect?extra=1" }

export function ExtraProfiles({ product, extras, sub, mainName, mainConnected, busy, act }: { product: ProductKey; extras: Extras | null; sub: Subscription; mainName: string; mainConnected: boolean; busy: boolean; act: Act }) {
  const [wp, setWp] = useState({ site: "", user: "", pass: "" })
  const [adding, setAdding] = useState(false)
  if (!extras) return null
  const L = EXTRA_LABEL[product]
  const plan = sub.plan === "pro" || sub.plan === "starter" ? sub.plan : "starter"
  const each = priceOf(product, plan, "monthly", 1) - priceOf(product, plan, "monthly")
  const posts = limitOf(product, plan, "monthly")
  const unit = product === "blog" ? "articles" : "posts"
  const paid = extras.allowed - 1
  const choose = extras.choose || []
  return (
    <div className={card}>
      <h2 className="text-base font-semibold">More {L.many}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Post to more than one {L.one} from this brand. Each extra one is half your plan price ({rupees(each)}/month on {planOf(product, plan)?.name || "Starter"}) and adds {posts} {unit} a month.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        <li className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2">
          <span className="min-w-0 flex-1 truncate">
            <b>{mainName || `Your main ${L.one}`}</b> <span className="text-[var(--muted)]">· main{mainConnected ? "" : " · not connected"}</span>
          </span>
        </li>
        {extras.list.map((x) => (
          <li key={x.id} className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2">
            <span className="min-w-0 flex-1 truncate">
              <b>{x.name}</b>
              {x.over ? <span className="text-[var(--bad)]"> · not in your plan now (renew the extra profile)</span> : !x.connected ? <span className="text-[var(--bad)]"> · connect again</span> : x.soon ? <span className="text-[var(--muted)]"> · reconnect soon</span> : null}
            </span>
            {CONNECT[product] && (!x.connected || x.soon) ? (
              <a href={CONNECT[product]} className={ghost}>
                Reconnect
              </a>
            ) : null}
            <button
              type="button"
              className={ghost + " text-[var(--bad)]"}
              disabled={busy}
              aria-label={`Remove ${x.name}`}
              onClick={() => window.confirm(`Remove ${x.name}? Posts set to go there will wait until you pick another ${L.one}.`) && act({ op: "extra-remove", id: x.id })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {choose.length ? (
        <div className="mt-3">
          <p className="text-sm">
            <b>Pick the Page to add:</b>
          </p>
          <div className="mt-2 space-y-2">
            {choose.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2">
                <div className="min-w-0 flex-1 text-sm">
                  <b>{p.name}</b> <span className="text-[var(--muted)]">{p.igUser ? `· Facebook + Instagram @${p.igUser}` : "· Facebook only"}</span>
                </div>
                <button type="button" className={primary} disabled={busy || extras.room < 1} onClick={() => act({ op: "extra-page", pageId: p.id })}>
                  Add this Page
                </button>
              </div>
            ))}
            <button type="button" className="text-[13px] text-[var(--muted)] underline" onClick={() => act({ op: "extra-cancel" })}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        {extras.room > 0 ? (
          product === "blog" ? (
            adding ? (
              <form
                className="space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (await act({ op: "extra-connect", ...wp })) {
                    setWp({ site: "", user: "", pass: "" })
                    setAdding(false)
                  }
                }}
              >
                <label className="block">
                  <span className={small}>Website address</span>
                  <input value={wp.site} onChange={(e) => setWp({ ...wp, site: e.target.value })} placeholder="https://yoursite.com" className={field} required />
                </label>
                <label className="block">
                  <span className={small}>WordPress username</span>
                  <input value={wp.user} onChange={(e) => setWp({ ...wp, user: e.target.value })} className={field} required autoComplete="off" />
                </label>
                <label className="block">
                  <span className={small}>Application Password (Users → Profile → Application Passwords)</span>
                  <input value={wp.pass} onChange={(e) => setWp({ ...wp, pass: e.target.value })} className={field + " font-mono"} required autoComplete="off" />
                </label>
                <div className="flex gap-2">
                  <button type="submit" className={primary} disabled={busy}>
                    {busy ? "Checking…" : "Add this site"}
                  </button>
                  <button type="button" className={ghost} onClick={() => setAdding(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className={primary} onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Add another WordPress site
              </button>
            )
          ) : (
            <a href={CONNECT[product]} className={primary}>
              <Plus className="h-4 w-4" /> {product === "linkedin" ? "Connect another LinkedIn profile" : "Connect another Facebook Page"}
            </a>
          )
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-[var(--muted)]">
              {sub.status === "trial" ? `The free trial covers one ${L.one}. Extra ones come with a paid plan.` : paid > 0 ? `Your plan covers ${paid} extra ${paid === 1 ? L.one : L.many}, all in use.` : `Your plan covers one ${L.one}.`}
            </span>
            <button type="button" className={ghost} onClick={() => askForProfile(product)}>
              <Plus className="h-3.5 w-3.5" /> Add an extra {L.one} to my plan
            </button>
          </div>
        )}
        {product === "linkedin" && extras.room > 0 ? (
          <p className="mt-2 text-[12.5px] text-[var(--faint)]">Each person signs in with their own LinkedIn. Posting to LinkedIn company pages needs LinkedIn&rsquo;s approval for Xredible; it&rsquo;s switched on once LinkedIn approves it.</p>
        ) : null}
        {product === "meta" && extras.room > 0 ? (
          <p className="mt-2 text-[12.5px] text-[var(--faint)]">When Facebook asks, tick the Page (and its Instagram account) you want to add.</p>
        ) : null}
      </div>
    </div>
  )
}

/** The tool's profiles, for the "Post to" picker on each post. */
export const ProfilesCtx = createContext<{ product: ProductKey; mainName: string; extras: Extras | null } | null>(null)

/** "Post to" on a post card, reading the profiles from ProfilesCtx. */
export function PostTo({ value, busy, onPick }: { value: number | undefined; busy: boolean; onPick: (id: number) => void }) {
  const c = useContext(ProfilesCtx)
  if (!c) return null
  return <SendTo product={c.product} mainName={c.mainName} extras={c.extras} value={value} busy={busy} onPick={onPick} />
}

/** "Post to": the main profile or one of the extra ones (shown only when there are extra ones). */
export function SendTo({ product, mainName, extras, value, busy, onPick }: { product: ProductKey; mainName: string; extras: Extras | null; value: number | undefined; busy: boolean; onPick: (id: number) => void }) {
  if (!extras?.list.length) return null
  const gone = value && !extras.list.some((x) => x.id === value)
  return (
    <label className="inline-flex items-center gap-2 text-[12.5px] text-[var(--muted)]">
      Post to
      <select value={gone ? "" : value || 0} disabled={busy} onChange={(e) => onPick(Number(e.target.value))} className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-[12.5px] text-[var(--ink)]">
        {gone ? <option value="">Pick a {EXTRA_LABEL[product].one}…</option> : null}
        <option value={0}>{mainName || `Main ${EXTRA_LABEL[product].one}`}</option>
        {extras.list.map((x) => (
          <option key={x.id} value={x.id} disabled={x.over}>
            {x.name}
            {x.over ? " (not in plan)" : ""}
          </option>
        ))}
      </select>
    </label>
  )
}
