# Dashboard step 5 — Search / jump

Ctrl K (also Cmd K) on desktop and the header search button on phones open a business-scoped page and safe-action picker. Arrow keys and Enter select; Escape/backdrop restore focus and scroll. The modal traps Tab, fits the visual viewport, and leaves unsaved form text intact. Search text stays in memory and clears on close; opening/filtering does not fetch or persist queries.

The index follows existing business and owner/member/customer permissions. Account pages retain their existing gates. Existing dialogs block the shortcut. Nestoodle and Elevating CHRIST remain separate; global Autopilot admin links require the existing admin permission.

Safe commands open existing destinations: Add idea focuses the existing form; Nestoodle's writer opens the waiting ideas list and image command focuses the existing title/post-number input. Autopilot draft creation opens Ideas. They never submit or prefill an approval. Download CSV appears only for an existing, enabled export on the current page and calls that same export with its current report data. No invented weekly export, bulk action, new publishing/email action, API, or workflow change. Pause remains unavailable.

## Review and validation

Stacked on step 4, PR #83 (`f68a8b1`), because main still contains step 2. Owner merge order: #82 → retarget #83 to main and merge → retarget this PR to main and merge. This PR contains step 5 only relative to its base.

- TypeScript, targeted ESLint, production scratch webpack build, and diff whitespace checks pass.
- [Model checks](model-checks.txt): navigation scope, role gates, safe allowlist and matching.
- [Browser checks](feature-checks.json): keyboard/phone entry, arrows, Enter, Tab/Escape, focus/scroll restoration, no query storage or fetch, confirmation preservation, existing CSV content, owner/member/customer/admin gates; zero browser POSTs and page errors.
- [Shell checks](verification.txt): all five hubs for both businesses at 390/1366, legacy links, account views, reduced motion, 44px targets, contrast and overflow.
- Search screenshots also cover empty results, dark mode, a short 390×430 viewport, backdrop dismissal and active-option visibility. Placeholder/active text contrast ≥4.5:1.

All screenshots and requests use synthetic fixtures, not live customer/n8n data. Local production builds use scratch-only local font shims because of build network restrictions; source retains next/font. No font shim is committed.

## Screenshots

| Business | Search phone / desktop | Actions phone / desktop | Empty phone / desktop | CSV phone / desktop |
|---|---|---|---|---|
| nestoodle | [390](nestoodle-search-pages-390.png) / [1366](nestoodle-search-pages-1366.png) | [390](nestoodle-search-actions-390.png) / [1366](nestoodle-search-actions-1366.png) | [390](nestoodle-search-empty-390.png) / [1366](nestoodle-search-empty-1366.png) | [390](nestoodle-search-csv-390.png) / [1366](nestoodle-search-csv-1366.png) |
| elevating-christ | [390](elevating-christ-search-pages-390.png) / [1366](elevating-christ-search-pages-1366.png) | [390](elevating-christ-search-actions-390.png) / [1366](elevating-christ-search-actions-1366.png) | [390](elevating-christ-search-empty-390.png) / [1366](elevating-christ-search-empty-1366.png) | [390](elevating-christ-search-csv-390.png) / [1366](elevating-christ-search-csv-1366.png) |

| Business | Hub | Phone | Desktop |
|---|---|---|---|
| nestoodle | home | [390](nestoodle-home-390.png) | [1366](nestoodle-home-1366.png) |
| nestoodle | content | [390](nestoodle-content-390.png) | [1366](nestoodle-content-1366.png) |
| nestoodle | results | [390](nestoodle-results-390.png) | [1366](nestoodle-results-1366.png) |
| nestoodle | automations | [390](nestoodle-automations-390.png) | [1366](nestoodle-automations-1366.png) |
| nestoodle | brand | [390](nestoodle-brand-390.png) | [1366](nestoodle-brand-1366.png) |
| elevating-christ | home | [390](elevating-christ-home-390.png) | [1366](elevating-christ-home-1366.png) |
| elevating-christ | content | [390](elevating-christ-content-390.png) | [1366](elevating-christ-content-1366.png) |
| elevating-christ | results | [390](elevating-christ-results-390.png) | [1366](elevating-christ-results-1366.png) |
| elevating-christ | automations | [390](elevating-christ-automations-390.png) | [1366](elevating-christ-automations-1366.png) |
| elevating-christ | brand | [390](elevating-christ-brand-390.png) | [1366](elevating-christ-brand-1366.png) |

[Dark search](nestoodle-search-dark-390.png) · [Short viewport](search-small-viewport-390x430.png)

## Reproduce

Use isolated production builds of the base and head, local fixture gateway `node tools/dashboard-step5/gateway.cjs` on 4361, preview on 4336 and baseline on 4337; set `XD_N8N_GATEWAY=http://127.0.0.1:4361` and `XD_N8N_SECRET=dashboard-fixture-only` for those scratch builds. Never point these fixtures at production. With Playwright and Chromium installed:

```sh
node tools/dashboard-step5/model-check.cjs
node tools/dashboard-step5/browser-check.cjs
node tools/dashboard-step5/shell-check.cjs
node tools/dashboard-step5/screenshots.cjs
node tools/dashboard-step5/benchmark.cjs
```

## Performance

See [raw measurements](performance.json). Same Chromium, production builds, 390px, simulated 4G (150ms latency, 200KB/s download), 4× CPU, three runs/business/version. Playwright routing disables HTTP cache. Fixtures isolate frontend overhead; these are not live n8n latency or proof that every audit speed target passes. Speed/backend work remains step 6.

Three-run medians (ms unless stated):

| Business | Metric | Before | After |
|---|---|---:|---:|
| nestoodle | Cold Home usable | 5107 | 4756 |
| nestoodle | LCP | 996 | 824 |
| nestoodle | Cached Home return | 260 | 282 |
| nestoodle | Calendar navigation | 285 | 254 |
| nestoodle | Cached Results navigation | 151 | 114 |
| nestoodle | Encoded JS bytes | 265975 | 269227 |
| nestoodle | Search open | — | 175 |
| nestoodle | Search filter | — | 76 |
| elevating-christ | Cold Home usable | 4970 | 5085 |
| elevating-christ | LCP | 812 | 932 |
| elevating-christ | Cached Home return | 297 | 404 |
| elevating-christ | Calendar navigation | 259 | 252 |
| elevating-christ | Cached Results navigation | 152 | 154 |
| elevating-christ | Encoded JS bytes | 265975 | 269227 |
| elevating-christ | Search open | — | 155 |
| elevating-christ | Search filter | — | 63 |

Search adds 3,252 encoded JS bytes. Cold Home remains around five seconds and exceeds the audit target; the EC third after run also had a 5.576s LCP outlier. No speed-target completion is claimed. Step 6 is still required.
