# Nestoodle weekly Pinterest CSV

Manual import only: these tools never create or schedule Pins through Pinterest.
The owner reviews the images, then uploads the CSV in Pinterest's bulk importer.

## Copy and images

- Use the published article's real title, shortened at a word boundary to100 characters and put in Title Case. No generic suffixes or invented craft claims.
- The image subtitle is a sourced excerpt from the article's own opening benefit line. Missing or unsupported source copy fails closed.
- Each photo has its own two-sentence description: the actual activity plus an instruction or sentence from that article section. The focus keyword appears once. The tracked destination link follows those sentences.
- Keywords are3–5 concrete article/activity terms. No generic creative-play filler.
- Photos must match current post/media IDs and URLs in NST Approved Photos, with approved/score10/faceFree/no problems/reviewer. No generation or new approvals. Owner-rejected mug/frame photos1979/1982 are excluded; obstacle photos2110/2111/2112 are replaced with approved2113/2114/2115.
- Re-render every replacement JPEG with the corrected on-image title and subtitle, using the shared brand renderer's opt-in editorial pin layout. Other brand layouts stay unchanged. Full images are1000×1500 JPEGs; contact sheets use isolated300×450 thumbnails.
- Genuine free-printable claims require an article-linked PDF verified by signature. Screen-free does not mean free-download.

## Links and import preflight

Pinterest's import email confirmed37 Duplicate Pin link rejections in the original54-row file. It contained17 different Link values, one per article. All54 image URLs decoded correctly and all board names matched observed public boards; CSV quoting/headers were valid.

Give every new pin `utm_content=<postId>-<pin number>`, preserving existing utm_source/medium/campaign. Numbering checks all earlier/superseded export links and known Pinterest links. No Link repeats within a batch or against that history. Preflight rejects duplicates, malformed headers/field counts/dates, wrong board names, and excessive title/description lengths. Delivery also re-parses the CSV and rejects duplicate-link artifacts.

Exact headers:
`Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords`
Use UTF-8BOM, quoted cells and CRLF. Thumbnail is blank for images. Boards must exactly match current public board names. Public media URLs point directly to JPEG files. Publish date is an explicit future UTC timestamp; never leave it blank.

## US evening schedule and reservations

Use01:00,02:00,03:00UTC only, within the owner's00:30–03:30UTC window. These are8–10PM Eastern in winter and9–11PM in summer. Max3 pins per UTC/US-evening day, max1/article/day, and at least3 calendar days between an article's pins, including prior reservations. Priority: Advent, Christmas, Hanukkah, winter break, other winter, then other articles.

A weekly run generates at most21 new pins for7 articles; the scheduler can use later open dates when earlier ones are occupied. It considers all active ledger dates, not just the current week. Pending-review rows reserve slots and suppress repeat coverage; superseded/cancelled rows remain historical but do not double-book capacity. Export status is never called Pinterest publication. Source hashes and all historical links remain available for dedupe.

## Fresh replacement after sample review

`replacementPlan` rebuilds all rows from current articles/approved photos. It supersedes only exact old media reservations and creates a separate `weekly-YYYY-MM-DD-replacement-ID` namespace. The owner removes old scheduled pins on Pinterest; the tool never does that.

Reserve the plan as pending-review before the next weekly run. Show five real rendered sample images with their titles/times before exporting the replacement CSV. No CSV or full-batch Telegram delivery at the sample checkpoint.

After explicit review approval, dispatch the Action with `replacement_batch` set to that exact pending batch. `replacement-run.mjs` checks frozen dates, links, source media IDs and copy digests; re-renders every full-size image; verifies all free offers; then writes the CSV/preview/manifest/ledger. Artifacts are saved before GitHub media publication and Telegram file delivery. The ledger changes to exported-not-confirmed-published. A completed replacement cannot be rerun accidentally.

`report_run` is read-only artifact diagnosis. `deliver_only` can re-deliver a saved valid artifact; it cannot bypass CSV preflight. Default duplicate-week protection and serialized export concurrency remain. Four protected n8n routes/triggers and existing credentials stay intact; no secrets in files or logs.

## Tests

Install tools/brand-images dependencies and Playwright Chromium (or set CHROMIUM_PATH).

    node --test tools/pinterest-weekly/*.test.mjs tools/brand-images/render.test.mjs

Coverage includes full54-row scheduling, three-day spacing, history-aware unique links, pending/superseded reservations, sourced copy, banned photo choices, CSV round trips and a full56-pin thumbnail contact sheet.
