# Nestoodle weekly Pinterest CSV

Manual upload only. There is no Pinterest write/publish operation in this tool.
A Sunday n8n schedule dispatches `nestoodle-pinterest-weekly.yml`; the owner receives
CSV and JPEG thumbnail contact sheet as Telegram documents and imports the CSV.

The renderer reuses the approved 1000×1500 brand pin HTML, fonts, logo, fit checks
and face protection. Each variant has a different keyword-led title and distinct
photo bytes. Existing article photos must pass strict visual review; no unchecked
images, text banners, human faces or distorted/off-topic photos are accepted.
Posts with fewer than three usable photos are skipped and reported. The Free printable
badge appears only for an article-linked PDF verified by signature; free promises
without a verified PDF cause a skip. Article text is never changed.

Coverage policy: fewer than three confirmed owned article-link pins plus prior
export reservations qualifies a post. Export reservations are explicitly separate
from live Pinterest publication. Draft/Scheduled Queue rows are never counted.
Exports are reserved once, even if the owner has not imported them yet: reuse the
existing CSV rather than produce duplicates. Newest published posts come first;
maximum 18 articles get three variants before optional fourth/fifth variants.
Capacity is 56 pins/week (8/day), below Pinterest's 200-row import maximum.
One article never appears twice on the same IST planning day. All dates are future:
next day through next seven days, 09:00–23:00 IST slots, encoded as UTC in the CSV.
Sunday exports therefore cover Monday–Sunday. Test scope selects current IST-week
published posts only; drafts never enter the published-post endpoint.

Columns follow Pinterest's bulk-upload guide:
https://help.pinterest.com/en/business/article/bulk-upload-video-pins
`Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords`
Image Thumbnail cells are blank. Board names must match observed public boards.
Descriptions contain two sentences and the keyword. Links use utm_source=pinterest.
CSV is quoted UTF-8 with BOM and CRLF, titles ≤100 and descriptions ≤500 characters.

Full pin JPGs and a reservation ledger go to `media/nestoodle/pinterest/weekly-YYYY-MM-DD/`
and `media/nestoodle/pinterest/ledger.json`. CSV/preview/manifest are saved as Actions
artifacts before media push and Telegram delivery. The `deliver_only` input accepts
an earlier run ID to retry delivery from its artifact without generating more pins.
Do not rerender a week with an existing reservation. GitHub concurrency serializes
exports; media pushes retry after unrelated branch updates.

Credentials remain in n8n/GitHub secrets. Only the existing renderer header authenticates
the three n8n endpoints. Execution data for these endpoints is not retained in n8n.
The four-trigger graph is kept intact: Sunday schedule, inputs GET, photo check POST,
and document delivery POST. The shared image checker uses the existing Nestoodle
credential; this tool never exports its key. No Drive connection is required.

Undecodable source or preview images are listed by article ID, source URL and pin filename in the preview/manifest and logs. Failed preview pins are removed before CSV/ledger writes; articles falling below three usable variants are skipped. Remaining articles still export.

Run `node --test tools/pinterest-weekly/*.test.mjs` after installing `tools/brand-images` dependencies and Playwright Chromium (or set CHROMIUM_PATH). Brand renderer tests use
`npm test --prefix tools/brand-images` with Playwright Chromium installed.

Approved photos: the protected inputs endpoint includes NST Approved Photos rows.
The exporter reuses score10/faceFree/zero-problem approvals only when the current
article still contains that exact media ID and source URL; it verifies bytes/MIME
and the renderer still checks decoding. Unregistered candidates retain live review.
Failed articles no longer consume the input quota: later usable posts fill the
remaining weekly slots. The existing 56/week, eight/day and minimum-three gates stay.

For owner-approved catch-up, `supplement: true` creates a separate
`weekly-YYYY-MM-DD-supplement-RUNID` asset namespace. Existing ledger entries and
future slot reservations remain; already-covered articles and source hashes are
not regenerated. Import this additional CSV alongside the earlier CSV only after
review. Default runs still reject an already-exported planning week.

`report_run` reads an earlier Actions artifact and prints every skipped/deferred
article with its original reason and current published title; it performs no render,
media push, reservation write or delivery. New exports print COVERAGE_REPORT and
include titles/reasons in the manifest to make failures independently auditable.
