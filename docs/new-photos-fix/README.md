# Blog draft image requests

The Blog posts **Make images** button now sends the same confirmed `make_images` workspace operation as Automations → Image queue, with the WordPress post ID. It queues Codex image-only work, leaves copy and Draft status intact, and says “Queued, Codex starts within about 10 minutes.” Drafts without a Topics row are supported. Pending and published posts do not gain this button. Existing workspace owner/business/confirmation/duplicate gates apply. The obsolete `new_photos` Blog action is rejected before proxying, protecting stale callers too.

Stacked on PR #84 (`feat/dashboard-search-jump`, `67e73da`); main still contains step 2. Owner merge order #82 → #83 → #84 → this PR, retargeting the next PR to main after its parent merges. Website fix is not live until the owner merges and production deploys.

## Verification

- TypeScript and production scratch webpack build pass. Fonts are stubbed only in scratch; source keeps `next/font`.
- Targeted ESLint: zero errors; two pre-existing set-state-in-effect warnings in Blog view.
- [Browser evidence](checks.json): real local browser → workspace API → isolated fixture gateway → one queue row. Confirmation cancel sends nothing; repeat is rejected; member request403; obsolete action400; no legacy Blog POST/page errors.
- [Phone](blog-390.png), [desktop](blog-1366.png), [queued reply](queued-390.png); no horizontal overflow, new button≥44px.
- Reproduce with production scratch build at4336, `XD_N8N_GATEWAY=http://127.0.0.1:4361`, `XD_N8N_SECRET=dashboard-fixture-only`, `node tools/dashboard-step5/gateway.cjs`, then `node tools/new-photos-fix/browser-check.cjs`. Restart the fixture gateway between runs. All screenshots use synthetic data.

Related production workflow fixes and private verification are recorded in the private operations repository. Automatic approval review blocked creating a live test queue item because it would start real image work; no production enqueue is claimed. Existing content publishing/email approvals and scheduled writer hold remain in place.
