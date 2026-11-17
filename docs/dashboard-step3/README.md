# Dashboard redesign — step 3: Automations + Content

The Automations hub now opens on six cards for each business, using its existing workspace snapshots: purpose, On/Held/reported state, schedule, last/next run, one existing review destination and an expandable History. Missing run times are explicitly unreported; snapshots are not presented as a live execution feed. History contains the last reported run and errors; the separate action log remains business-wide. Workflow pause controls remain unavailable.

Nestoodle's Image queue panel accepts a current blog title or WordPress post number, shows requests/status/notes, and lists drafts without a featured image or any earlier image request. Active work appears first; request history is shown ten rows at a time. A title resolves to a post number; posts outside the current blog list can still use their number.

“Queue all” lists the chosen drafts in the existing confirmation dialog, then calls the same guarded `make_images` action once per post, sequentially. It reports progress and stops on the first failure; refreshed queue data removes completed requests from the remaining list. Cancel performs no mutation. Completed, blocked or already queued requests and illustrated/published posts are excluded from the bulk list. An individual blocked post can still be requested by number through the existing guarded action.

Content pages appear as horizontal navigation tabs at phone and desktop widths: Calendar / Ideas / Blog posts / Printables for Nestoodle, Calendar / Ideas / Sermon Notes for EC. They retain their existing page URLs, components, actions and permissions. The new `?view=automations` page is an index of already accessible workspace data; individual `?view=automation-*` links still open their existing automation.

No API, gateway, n8n workflow, posting/email/publishing approval or account entitlement is changed. Existing Autopilot controls, styles and confirmation are reused. Nestoodle and EC data stay separate. The owner merges the PR.

## Screenshots

Synthetic fixture data only; production scratch builds with the repository-required font stubs and local copies of the specified fonts. No stubs or font files are committed.

| Hub | Elevating CHRIST | Nestoodle |
|---|---|---|
| Home | [390](elevating-christ-home-390.png) / [1366](elevating-christ-home-1366.png) | [390](nestoodle-home-390.png) / [1366](nestoodle-home-1366.png) |
| Content | [390](elevating-christ-content-390.png) / [1366](elevating-christ-content-1366.png) | [390](nestoodle-content-390.png) / [1366](nestoodle-content-1366.png) |
| Results | [390](elevating-christ-results-390.png) / [1366](elevating-christ-results-1366.png) | [390](nestoodle-results-390.png) / [1366](nestoodle-results-1366.png) |
| Automations | [390](elevating-christ-automations-390.png) / [1366](elevating-christ-automations-1366.png) | [390](nestoodle-automations-390.png) / [1366](nestoodle-automations-1366.png) |
| Brand & settings | [390](elevating-christ-brand-390.png) / [1366](elevating-christ-brand-1366.png) | [390](nestoodle-brand-390.png) / [1366](nestoodle-brand-1366.png) |

[Dark-mode phone example](nestoodle-content-dark-390.png).


| Content tab | Nestoodle | Elevating CHRIST |
|---|---|---|
| Ideas | [390](nestoodle-content-ap-ideas-390.png) / [1366](nestoodle-content-ap-ideas-1366.png) | [390](elevating-christ-content-ap-ideas-390.png) / [1366](elevating-christ-content-ap-ideas-1366.png) |
| Blog posts | [390](nestoodle-content-blog-390.png) / [1366](nestoodle-content-blog-1366.png) | Not assigned |
| Printables / Sermon Notes | [390](nestoodle-content-printables-390.png) / [1366](nestoodle-content-printables-1366.png) | [390](elevating-christ-content-printables-390.png) / [1366](elevating-christ-content-printables-1366.png) |

[Dark phone History example](nestoodle-automations-dark-history-390.png).

[Image queue partial failure and remaining draft](image-queue-partial-failure-390.png).

## Verification

- TypeScript, targeted lint and production webpack scratch build.
- [Feature checks](feature-checks.json): both businesses' cards/history; title lookup; individual/bulk confirmation and cancel; exact existing POST contracts; serial partial failure and retry; exclusion of existing/illustrated/published work; Content tabs at both widths and old URLs; EC separation; member read-only controls and server 403.
- [Shell checks](verification.txt): all five hubs × two businesses × 390/1366 px; keyboard/Escape, focus, 44px targets, theme and title-placeholder contrast ≥4.5:1, dark/reduced motion, legacy links, admin and customer menus.
- [Existing action regression](action-regression.txt) and nav-model checks preserve the account/page allowlists and protected workspace operations.

Reproduce with `node tools/dashboard-step3/gateway.cjs` (independent local fixture gateway, port4341). Build/start a scratch app on4332 with `XD_N8N_GATEWAY=http://127.0.0.1:4341 XD_N8N_SECRET=dashboard-fixture-only`; run `node tools/dashboard-step3/browser-check.cjs` and `node tools/dashboard-step3/shell-check.cjs`. Start baseline main`fd2e73d` on4333 and run `node tools/dashboard-step3/benchmark.cjs` for paired phone performance. Use a fresh fixture gateway for each mutation suite; run `node tools/dashboard-step3/action-check.cjs` for the existing action suite and restart the gateway before capturing initial-state screenshots. `node tools/dashboard-step3/screenshots.cjs` adds every Content tab and keyboard/dark History evidence. `node tools/dashboard-step3/contrast-check.cjs` verifies the active title placeholder in light/dark themes. Tests use local fixtures, never production mutations.

## Performance

Paired fixture measurements and their limits are recorded below; no live n8n speed claim.

Three-run medians at 390×844, 150 ms RTT, 1.6 Mbps down / 750 Kbps up, 4× CPU. Same synthetic reports and self-hosted font files; baseline main`fd2e73d`. [Raw results](performance.json).

| Metric | Nestoodle before → after | EC before → after |
|---|---|---|
| Cold Home usable (first draft row) | 4.789 s → 4.858 s | 4.869 s → 4.821 s |
| Fixture LCP | 0.868 s → 0.808 s | 0.816 s → 0.804 s |
| Cached in-session Home return | 335 ms → 316 ms | 269 ms → 272 ms |
| Cached Calendar switch | 260 ms → 267 ms | 248 ms → 230 ms |
| Encoded first-load JS | 262.6 KB → 264.8 KB | 262.6 KB → 264.8 KB |

The cached measurement is an in-session Calendar → Home return, not a full HTTP reload. Playwright interception suppresses HTTP asset caching; LCP is often an early shell paint rather than complete Home data. Cold usability remains about five seconds, cached hub switches are not consistently below200ms, and first-load JS still exceeds200KB (about +2.2KB). Step6's snapshots/shared cache/bundle splitting remain necessary; this PR does not claim to meet those targets.
