# Dashboard redesign — step 1: themes and shell

This PR implements the themes/navigation shell from the 16 November audit and the uploaded **Dashboard brand redesign Elevating CHRIST, Nestoodle, Autopilot.html** artboards. The attachment is a visual reference only and is not copied into the public repository. Home content layout, automation cards, search and data caching remain in the later steps.

## Navigation and themes

- Five hubs: Home, Content, Results, Automations, Brand & settings. The desktop sidebar opens only the active hub's pages. Phone tabs are Home / Content / Results / Automate / More, with a scrollable active-page row.
- Existing `?view=…` links remain valid. The old page allowlists and all API/action/permission code are unchanged. No action is added, no workflow is edited, and Pause remains unavailable.
- Avatar disclosure contains account actions and role-gated admin links. Billing continues to refer only to an entitled user's Autopilot account. Member/customer admin controls remain hidden.
- EC uses paper/white, navy and accessible gold text; Nestoodle uses warm paper, ink brown and accessible coral. Autopilot and LinkedIn Agency retain the current navy style. LinkedIn Agency keeps its existing page entitlement: its two empty hubs are disabled rather than granting new pages.
- `next/font` loads Inter, Playfair Display 600, Baloo 2 700, Karla and Noto Sans Devanagari with subsets and swap. Extra brand fonts are not preloaded globally. Nestoodle's existing brand logo replaces the generic letter icon.
- Shell controls have 44px targets, visible focus, text contrast checks ≥4.5:1, reduced-motion support and dark variants. These checks cover the new shell, not a redesign of every existing report/editor control.

## Phone / desktop screenshots

All screenshots contain synthetic, labelled fixture content, not actual results or subscribers. They use production builds and self-hosted copies of the specified fonts in the scratch harness; the source uses `next/font/google` as required. No font stubs or fixture font files are committed.

| Hub | Elevating CHRIST | Nestoodle |
|---|---|---|
| Home | [390](elevating-christ-home-390.png) / [1366](elevating-christ-home-1366.png) | [390](nestoodle-home-390.png) / [1366](nestoodle-home-1366.png) |
| Content | [390](elevating-christ-content-390.png) / [1366](elevating-christ-content-1366.png) | [390](nestoodle-content-390.png) / [1366](nestoodle-content-1366.png) |
| Results | [390](elevating-christ-results-390.png) / [1366](elevating-christ-results-1366.png) | [390](nestoodle-results-390.png) / [1366](nestoodle-results-1366.png) |
| Automations | [390](elevating-christ-automations-390.png) / [1366](elevating-christ-automations-1366.png) | [390](nestoodle-automations-390.png) / [1366](nestoodle-automations-1366.png) |
| Brand & settings | [390](elevating-christ-brand-390.png) / [1366](elevating-christ-brand-1366.png) | [390](nestoodle-brand-390.png) / [1366](nestoodle-brand-1366.png) |

[Dark-mode phone example](nestoodle-content-dark-390.png).

## Checks

- TypeScript and new navigation/model lint pass. Existing app hook warnings are unchanged.
- Production webpack scratch build passes, using the repository-required font stubs plus local font files for visual accuracy.
- [Shell browser results](verification.txt): 20 hub/viewport screenshots, legacy deep links, phone sub-navigation, keyboard focus/Escape, contrast/targets, dark/reduced-motion, admin Accounts, member denial and Autopilot customer Help/Billing.
- `node tools/dashboard-shell/model-check.cjs` verifies that every existing non-admin page maps exactly once for all four businesses. Page allowlists are preserved; admin destinations remain in the avatar menu.
- [Action regression](action-regression.txt) reruns the existing parity suite against the new shell: idea, brand/settings persistence, business isolation, image duplicate rejection, drafted-topic protection and permission/origin rejection.
- The browser suite uses a local fixture gateway and read-only report interception. No real workflow, post or email action is executed.

## Reproduce

Use a scratch checkout with the font-stub setup required by AGENTS.md. Start `node tools/dashboard-parity/fixture-gateway.cjs` on 127.0.0.1:4311. Build/start the scratch app on 127.0.0.1:4320 with `XD_N8N_GATEWAY=http://127.0.0.1:4311 XD_N8N_SECRET=dashboard-fixture-only`. Run `node tools/dashboard-shell/browser-check.cjs`. Playwright/Chromium must be installed; `CHROMIUM_PATH` can override `/usr/bin/chromium`.

For the paired benchmark, start the unmodified `main` build on 4321 and the new shell build on 4320, sharing the same fixture gateway. Run `node tools/dashboard-shell/benchmark.cjs`. The benchmark's synthetic API content is identical across versions; it does not measure live n8n latency or claim production cache/LCP targets have been achieved.

## Paired performance results

Medians of three runs per business/version: Chromium at 390×844, 150 ms RTT, 1.6 Mbps download / 750 Kbps upload and 4× CPU slowdown. Baseline is `main` at `13b82a0`. Both builds use the same local fixture reports and self-hosted font files. [Raw measurements](performance.json).

| Metric | Nestoodle before → after | EC before → after |
|---|---|---|
| Cold Home usable (first draft row) | 4.314 s → 4.336 s | 4.325 s → 4.404 s |
| Fixture LCP | 0.804 s → 0.820 s | 0.824 s → 0.808 s |
| In-session cached Home return | 0.326 s → 0.193 s | 0.304 s → 0.216 s |
| Calendar navigation from visible control | 0.428 s → 0.234 s | 0.445 s → 0.194 s |
| First-load JavaScript, encoded | 259.7 KB → 260.8 KB | 259.7 KB → 260.8 KB |

The cached return measures the existing **in-memory** section cache, not persistent storage or an app reopen. Browser reload-cache timing is deliberately omitted: report interception suppresses HTTP caching in this harness. The LCP number is synthetic and can describe the early shell paint; cold **usable** time remains around 4.3–4.4 seconds. It does not establish a live n8n <2.5 s result.

The <200 KB JavaScript target is **not met** (260.8 KB after, +1.1 KB). Nestoodle's median calendar switch remains above the <200 ms goal; EC is just below it in this fixture. Persistent Home caching is step 2; bundle splitting, snapshots and production speed work remain step 6. This shell PR makes no claim that those later targets are complete.
