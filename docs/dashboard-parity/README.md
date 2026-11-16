# Business dashboard parity — review evidence

The screenshots use labelled fixture data with the production Next.js build. They contain no real subscribers, results, private content, or workflow identifiers.

| Page | Nestoodle phone / desktop | Elevating CHRIST phone / desktop |
|---|---|---|
| Ideas | [390](nestoodle-ap-ideas-390.png) / [1366](nestoodle-ap-ideas-1366.png) | [390](elevating-christ-ap-ideas-390.png) / [1366](elevating-christ-ap-ideas-1366.png) |
| Automations | [390](nestoodle-automation-publisher-390.png) / [1366](nestoodle-automation-publisher-1366.png) | [390](elevating-christ-automation-publisher-390.png) / [1366](elevating-christ-automation-publisher-1366.png) |
| Image queue | [390](nestoodle-automation-images-390.png) / [1366](nestoodle-automation-images-1366.png) | — |
| Newsletter / Email | [390](nestoodle-email-390.png) / [1366](nestoodle-email-1366.png) | [390](elevating-christ-email-390.png) / [1366](elevating-christ-email-1366.png) |
| Brand kit | [390](nestoodle-ap-brand-390.png) / [1366](nestoodle-ap-brand-1366.png) | [390](elevating-christ-ap-brand-390.png) / [1366](elevating-christ-ap-brand-1366.png) |
| Settings | [390](nestoodle-settings-390.png) / [1366](nestoodle-settings-1366.png) | [390](elevating-christ-settings-390.png) / [1366](elevating-christ-settings-1366.png) |
| Help | [390](nestoodle-help-390.png) / [1366](nestoodle-help-1366.png) | [390](elevating-christ-help-390.png) / [1366](elevating-christ-help-1366.png) |

## Validation

- TypeScript passes. Targeted ESLint passes for the new workspace code; older dashboard files retain their existing hook warnings.
- Production webpack build passes in a scratch copy with Google font imports stubbed, per repository instructions. No stubs are committed.
- [Browser results](verification.txt): 26 layouts at 390×844 and 1366×900; no page errors or horizontal overflow. Confirmed owner actions, business isolation, persistence, signed-out / member / cross-origin rejection, and refusal of unsupported holds.
- Separate authenticated, read-only n8n checks verified both real business sources, email reports, and workspace/image tables. Email API draft tests retained all original tables plus the new campaign report; post-publish webhook readbacks returned `ok:true` and the campaign table. No sender or publisher was executed by these checks.

## Current boundaries

- Workflow state and last-run details are timestamped snapshots. Next-run estimates use the published cron expressions where the workflow explicitly declares a timezone. A continuous monitoring feed remains to be connected.
- Pause/Resume stays disabled unless a verified, consumed hold flag is present. No website path deactivates workflows. The requested scheduled hold integration was blocked by automatic approval review and awaits separate owner approval.
- Settings save business preferences; existing workflow schedules and notification destinations are not changed by those fields. Brand edits save the business reference, without automatically changing established renderer templates.
- Existing unsubscribe links cannot attribute an unsubscribe to an individual email. The report shows unavailable rather than a fabricated zero.
- Email previews are labelled snapshots of current templates with sample content; unsubscribe/tracking links are disabled. They never send mail.

## Reproduce the fixture checks

Use a scratch checkout and local-only fixture configuration. Never point these checks at production. Install Playwright separately if it is not already available, and set `CHROMIUM_PATH` if Chromium is elsewhere.

1. Start `node tools/dashboard-parity/fixture-gateway.cjs` (127.0.0.1:4311).
2. In the scratch checkout, build with `XD_N8N_GATEWAY=http://127.0.0.1:4311 XD_N8N_SECRET=dashboard-fixture-only npm run build -- --webpack`, then start with the same fixture variables on 127.0.0.1:4310.
3. Run `node tools/dashboard-parity/browser-check.cjs` from this checkout. The test uses locally signed fixture sessions, real API handlers, and the fixture gateway. It never connects to n8n or any publishing service.
