# Dashboard redesign — step 4: Results

Results now has channel chips at phone and desktop widths, with one shared date picker and one compare selector in the DOM. Both stay bound to the existing dashboard date state and query parameters. Switching channels keeps the dates/comparison and each report's own filters; old report links still open their assigned channel. The active chip scrolls into view on phones without moving the page vertically.

Nestoodle and Elevating CHRIST gain an All channels index. It reuses Home's aggregate table and the same existing report endpoints, with three requests at a time. Last successful aggregate results are kept per account/business in a separate `xd-results-v1` cache, so Results cannot overwrite Home's saved queue. Source timestamps, older-date labels, shorter reported coverage and failed refreshes stay explicit. Subscriber/contact tables and content items are excluded from saved aggregates.

Individual section views remain in place, including the existing Email report and read-only previews. Email comparison labels now follow the report response. Date choices and limits are unchanged; the popover fits phone screens and Escape restores focus. Native date/compare/filter controls have clear accessible names. Autopilot customer and legacy LinkedIn Agency reports keep their existing page entitlements; the new aggregate index is limited to Nestoodle/EC.

No API, gateway, workflow, publishing/email approval or account permission contract changes. No browser POSTs occur in the Results interaction suite. Pause remains unavailable.

This PR is stacked on step3 PR82 while it remains open: merge PR82 first, then retarget this PR to main if GitHub has not already done so. The owner merges.

## Screenshots

Synthetic fixture data only, with actual report components and comparison charts. Production scratch builds use the repository-required font stubs and self-hosted copies of the specified fonts; no stubs or font files are committed.

| Hub | Elevating CHRIST | Nestoodle |
|---|---|---|
| Home | [390](elevating-christ-home-390.png) / [1366](elevating-christ-home-1366.png) | [390](nestoodle-home-390.png) / [1366](nestoodle-home-1366.png) |
| Content | [390](elevating-christ-content-390.png) / [1366](elevating-christ-content-1366.png) | [390](nestoodle-content-390.png) / [1366](nestoodle-content-1366.png) |
| Results | [390](elevating-christ-results-390.png) / [1366](elevating-christ-results-1366.png) | [390](nestoodle-results-390.png) / [1366](nestoodle-results-1366.png) |
| Automations | [390](elevating-christ-automations-390.png) / [1366](elevating-christ-automations-1366.png) | [390](nestoodle-automations-390.png) / [1366](nestoodle-automations-1366.png) |
| Brand & settings | [390](elevating-christ-brand-390.png) / [1366](elevating-christ-brand-1366.png) | [390](nestoodle-brand-390.png) / [1366](nestoodle-brand-1366.png) |

[Dark-mode phone example](nestoodle-content-dark-390.png).


| Results channel | Nestoodle | Elevating CHRIST |
|---|---|---|
| All channels | [390](nestoodle-results-all-results-390.png) / [1366](nestoodle-results-all-results-1366.png) | [390](elevating-christ-results-all-results-390.png) / [1366](elevating-christ-results-all-results-1366.png) |
| Instagram | [390](nestoodle-results-instagram-390.png) / [1366](nestoodle-results-instagram-1366.png) | [390](elevating-christ-results-instagram-390.png) / [1366](elevating-christ-results-instagram-1366.png) |
| Facebook | [390](nestoodle-results-facebook-390.png) / [1366](nestoodle-results-facebook-1366.png) | [390](elevating-christ-results-facebook-390.png) / [1366](elevating-christ-results-facebook-1366.png) |
| YouTube | Not assigned | [390](elevating-christ-results-youtube-390.png) / [1366](elevating-christ-results-youtube-1366.png) |
| Pinterest | [390](nestoodle-results-pinterest-390.png) / [1366](nestoodle-results-pinterest-1366.png) | [390](elevating-christ-results-pinterest-390.png) / [1366](elevating-christ-results-pinterest-1366.png) |
| Website | [390](nestoodle-results-ga4-390.png) / [1366](nestoodle-results-ga4-1366.png) | [390](elevating-christ-results-ga4-390.png) / [1366](elevating-christ-results-ga4-1366.png) |
| Traffic | [390](nestoodle-results-sessions-390.png) / [1366](nestoodle-results-sessions-1366.png) | [390](elevating-christ-results-sessions-390.png) / [1366](elevating-christ-results-sessions-1366.png) |
| Search | [390](nestoodle-results-gsc-390.png) / [1366](nestoodle-results-gsc-1366.png) | [390](elevating-christ-results-gsc-390.png) / [1366](elevating-christ-results-gsc-1366.png) |
| Email | [390](nestoodle-results-email-390.png) / [1366](nestoodle-results-email-1366.png) | [390](elevating-christ-results-email-390.png) / [1366](elevating-christ-results-email-1366.png) |
| Ads | [390](nestoodle-results-ads-390.png) / [1366](nestoodle-results-ads-1366.png) | [390](elevating-christ-results-ads-390.png) / [1366](elevating-christ-results-ads-1366.png) |
| Ad earnings | [390](nestoodle-results-adsense-390.png) / [1366](nestoodle-results-adsense-1366.png) | Not assigned |

[Dark date picker](nestoodle-results-dark-date-picker-390.png) · [Kept Results during failed refresh](results-kept-on-failure-390.png).

## Verification

- TypeScript, targeted lint and production webpack scratch build pass.
- [Results checks](feature-checks.json): one date/compare in DOM at both widths, popover bounds/Escape, presets/custom dates and compare query parameters, channel-filter isolation/restoration, Email labels, shorter source coverage, kept data on blocked reload/failure, account/cache separation and subscriber exclusion, member403/unknown-section400, customer and agency links, zero browser POSTs/page errors.
- [Same-browser account check](cache-account-check.txt) changes accounts with the owner cache still present and the network failed; no prior-account figures appear.
- [Home cache regression](home-checks.json) preserves cached reload, date changes, error retention, account isolation and corrupt/expired/unavailable storage after sharing the aggregate table/cache helper.
- [Shell checks](verification.txt) cover all20hub/viewport combinations, legacy navigation, roles/admin/customer, keyboard/focus, 44px targets, contrast ≥4.5, dark/reduced motion. [Nav model](model-checks.txt) retains every existing page and adds only the two aggregate indexes.
- Every assigned Results channel is captured at390/1366, including existing charts; one visible date/compare, 44px new controls, active-chip visibility, no overflow or page errors.

Reproduce: start `node tools/dashboard-step4/gateway.cjs` on4351, build/start the repository-required font-stub scratch app on4334 with `XD_N8N_GATEWAY=http://127.0.0.1:4351 XD_N8N_SECRET=dashboard-fixture-only`. Run `browser-check.cjs`, `home-check.cjs`, `shell-check.cjs` and `screenshots.cjs` from `tools/dashboard-step4/`. For paired performance, start baseline step3`24bebf2` on4335 and run `node tools/dashboard-step4/benchmark.cjs`. Everything uses local fixtures, not production mutations.

## Performance

Paired phone fixture measurements follow; no live n8n speed claim.

Three-run medians at390×844,150ms RTT,1.6Mbps down/750Kbps up,4×CPU, identical local reports/fonts. Baseline step3`24bebf2`. [Raw measurements](performance.json).

| Metric | Nestoodle before → after | EC before → after |
|---|---|---|
| Cold Home usable (first draft row) | 4.969 s → 4.942 s | 4.856 s → 4.966 s |
| Fixture LCP | 0.876 s → 0.832 s | 0.796 s → 0.824 s |
| Cached in-session Home return | 382 ms → 343 ms | 350 ms → 356 ms |
| Cached Calendar switch | 256 ms → 264 ms | 291 ms → 270 ms |
| Cached Facebook → Instagram content | 155 ms → 149 ms | 154 ms → 134 ms |
| Encoded first-load JS | 264.8 KB → 266.0 KB | 264.8 KB → 266.0 KB |

Cached Results measures Facebook → previously loaded Instagram until its reach KPI label is visible, rather than just the page heading. It is an in-session cache measurement. Persistent HTTP reload latency is not claimed: Playwright interception suppresses asset caching. LCP often measures the early shell, not full report data. Cold Home remains about five seconds and first-load JS remains above200KB (about +1.2KB). Step6's snapshot/shared cache/bundle work remains necessary. These fixtures do not establish production n8n latency or all speed targets.
