# Dashboard redesign — step 2: Home

Home now opens with **Needs you** (failed posts first, overdue automatic posts, then drafts due within three days), using the existing queue row actions. Next up includes the next three posts, the seven-day count and the most recent posted item. Four business-specific headline tiles lead into the all-channels comparison table and links to the existing automation pages. Ideas/image counts are compact links; existing Autopilot onboarding and tool cards remain available.

The desktop business name wraps so **Elevating CHRIST** is visible in full. This branch includes PR #80's phone header commit because #80 was still open after pulling main. The header continues to scroll away; page chips remain sticky. A browser-discovered stacking regression is fixed so those chips cannot cover account-menu actions.

## Kept Home data

- Versioned localStorage is scoped to the authenticated account and business, retaining the last successful queue and aggregate section results for up to 24 hours. Each section carries its requested range/comparison and original source timestamp. Browser storage is optional.
- Saved results render after hydration while reports refresh. Changing dates never clears successful data; each result still using older dates is labelled. Partial failures retain successful results and show the failed sources. “Updated … ago” uses the oldest displayed source timestamp, not the time a cached response was read.
- Subscriber/contact tables, report content items and account records are excluded from persistent report storage. Queue data is retained to restore the existing queue controls. Workspace counts still load separately from the existing endpoint.
- No API, gateway, permission, action contract or workflow is changed. Automation shortcuts only navigate. Workflow Pause stays off, and publishing/email approvals remain unchanged. Existing per-post calendar controls are reused.

## Phone / desktop screenshots

Synthetic fixture content only. Production scratch builds use the repository-required font stubs and self-hosted copies of the specified fonts; no stubs or font files are committed.

| Hub | Elevating CHRIST | Nestoodle |
|---|---|---|
| Home | [390](elevating-christ-home-390.png) / [1366](elevating-christ-home-1366.png) | [390](nestoodle-home-390.png) / [1366](nestoodle-home-1366.png) |
| Content | [390](elevating-christ-content-390.png) / [1366](elevating-christ-content-1366.png) | [390](nestoodle-content-390.png) / [1366](nestoodle-content-1366.png) |
| Results | [390](elevating-christ-results-390.png) / [1366](elevating-christ-results-1366.png) | [390](nestoodle-results-390.png) / [1366](nestoodle-results-1366.png) |
| Automations | [390](elevating-christ-automations-390.png) / [1366](elevating-christ-automations-1366.png) | [390](nestoodle-automations-390.png) / [1366](nestoodle-automations-1366.png) |
| Brand & settings | [390](elevating-christ-brand-390.png) / [1366](elevating-christ-brand-1366.png) | [390](nestoodle-brand-390.png) / [1366](nestoodle-brand-1366.png) |

[Dark-mode phone example](nestoodle-content-dark-390.png).

[Refresh failure with kept data](kept-data-refresh-failed-390.png).

## Validation

TypeScript, targeted lint and production webpack scratch build pass. [Home checks](home-checks.json) cover failed/overdue/due-draft membership and controls, four tiles, full document reload with reporting requests held, range changes, failed refresh, subscriber-table exclusion and account/business isolation, corrupt/expired storage and unavailable browser storage. [Shell checks](verification.txt) cover all 20 hub/viewport combinations, full desktop names, 44px Home/shell targets, contrast, keyboard/Escape, legacy URLs, role restrictions, Autopilot customer Help/Billing, dark mode and reduced motion.

[Existing action regression](action-regression.txt) also passes against the local gateway: confirmation, persistence, duplicate image rejection, drafted-topic protection, 401/403 and unsupported workflow holds. No production actions are executed.

Reproduce with a fresh local fixture gateway (`node tools/dashboard-parity/fixture-gateway.cjs`, port 4311), a production scratch app on 4330, and `XD_N8N_GATEWAY=http://127.0.0.1:4311 XD_N8N_SECRET=dashboard-fixture-only`. Run `node tools/dashboard-home/browser-check.cjs` and `node tools/dashboard-home/shell-check.cjs`. For the benchmark, start baseline `c35a757` (main + PR80) on 4331, then run `node tools/dashboard-home/benchmark.cjs`. Chromium is `/usr/bin/chromium` or `CHROMIUM_PATH`.

## Performance

Paired phone measurements and limits are recorded below. These are local synthetic fixtures, not live n8n measurements.

Three-run medians, Chromium 390×844, 150 ms RTT, 1.6 Mbps down / 750 Kbps up, 4× CPU. Identical synthetic reports and local font files; baseline is main plus PR80 (`c35a757`). [Raw measurements](performance.json).

| Metric | Nestoodle before → after | EC before → after |
|---|---|---|
| Cold Home usable (first draft row) | 4.498 s → 4.983 s | 4.558 s → 4.848 s |
| Fixture LCP | 0.816 s → 0.772 s | 0.820 s → 0.828 s |
| Cached in-session Home return | 255 ms → 273 ms | 276 ms → 276 ms |
| Cached Calendar switch | 270 ms → 235 ms | 235 ms → 205 ms |
| Encoded first-load JS | 260.8 KB → 262.7 KB | 260.8 KB → 262.7 KB |

These measurements do **not** establish live n8n targets. Cached Home here means an in-session Calendar → Home return; full document reload persistence is tested with network reports held, but its latency is not claimed to be under one second. Playwright routing suppresses HTTP asset caching, so warm HTTP reload timings are omitted. LCP is often an early shell paint, not complete Home data. Cold usability remains around five seconds, the 200 ms hub target is not consistently met and first-load JS still exceeds 200 KB (about +1.9 KB). The snapshot, shared server cache and bundle splitting in step 6 remain necessary. The benefit in this step is retained useful data during reload/range change/failure, not a claim of reduced cold-load latency.

## Vercel build follow-up

The separate deploy-test project initially failed in Turbopack's existing Google-font resolver (`next/font/google queries have exactly one entry` / missing internal font module); the primary project preview passed. `npm run build` now explicitly selects webpack, matching the successful local production verification, so Git builds use the same tested compiler. Runtime application code and the measured webpack bundle are unchanged by this build-command fix.
