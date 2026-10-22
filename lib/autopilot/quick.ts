// lib/autopilot/quick.ts
//
// Server-only. One-tap Approve / Skip links in the daily drafts email. Each link is signed for one
// draft and one action and works for 7 days, without signing in.

import { makeToken, readToken } from "./account"
import { SITE } from "./linkedin"

export type QuickKind = "li" | "item"
export type QuickAction = "approve" | "reject"

export const quickUrl = (owner: string, kind: QuickKind, id: number, action: QuickAction) =>
  `${SITE}/dashboard/quick?k=${kind}&i=${id}&a=${action}&t=${encodeURIComponent(makeToken("quick", owner, 24 * 7, `${kind}:${id}:${action}`))}`

/** The owner the link was made for, if the link is genuine and fresh. */
export function readQuick(kind: string, id: number, action: string, token: string) {
  return readToken("quick", token, () => `${kind}:${id}:${action}`)
}
