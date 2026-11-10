# Nestoodle brand images

Clean photos are inputs. HTML adds brand typography and logos only for social formats. The featured collage and article images have **no text or logo**. Nothing here publishes a WordPress post, changes a queue, calls n8n, or switches an existing automation.

## Render

```sh
npm ci --prefix tools/brand-images
npx --prefix tools/brand-images playwright install chromium
node tools/brand-images/job.mjs tools/brand-images/samples/indoor-winter-activities-for-kids/job.json
npm test --prefix tools/brand-images
```

JPGs and `render-info.json` go to `tools/brand-images/output/` (ignored). For n8n, the manual Action also accepts `job_json`: a reviewed manifest with `jobId`. The worker writes media, then acknowledges its exact output manifest to the authenticated n8n callback using the existing renderer secret. Incoming manifests are excluded from artifacts. The callback only updates job state; it never publishes posts.

Set `CHROMIUM_PATH` only to use an existing Chromium installation. Browser assets are embedded; page network requests are blocked.

GitHub Actions → **Nestoodle brand images** → Run workflow. Select a committed manifest and leave **publish_media** false for artifact-only review. True writes the validated artifact to the `media` branch under `nestoodle/brand/<slug>/`; this is permitted only on main. There is **no schedule**. PR runs test/render without write permission. The separate media job serializes publication and rebases concurrent media changes; it never overwrites other media folders. GitHub-hosted rendering needs no service secrets.

## Templates / outputs

| Template | Pixels | Output |
|---|---|---|
| pin.html | 1000 × 1500 | pin.jpg |
| ig-cover.html | 1080 × 1350 | ig-cover.jpg, facebook.jpg |
| ig-step.html | 1080 × 1350 | ig-step-01.jpg … |
| ig-cta.html | 1080 × 1350 | ig-cta.jpg |
| og.html | 1200 × 630 | og.jpg |
| story.html | 1080 × 1920 | story.jpg |
| featured-collage.html | 1200 × 800 | featured-collage.jpg |
| article-photo.html | 1200 × 800 | article-photo-01.jpg … |

Facebook shares the cover layout but uses “Read the guide” rather than a carousel swipe prompt. Featured photos are 594px each, separated by a 12px cream gutter. Story overlays stay within y=240…1680. Fonts/logo come from `../reels/assets/`; Karla Regular is copied from the existing licensed printables font kit. Font license: `../reels/assets/OFL-fonts.txt`.

## Job contract

Copy the sample `job.json` to `jobs/<slug>/job.json`. Fields:

- `slug`, `articleUrl`, editorial short `title` (at most 8 words), `highlight` (exact substring), `eyebrow`, one-line `benefit`, uppercase `keyword`.
- `photos`: at least three `{src, alt, review}` objects. Local JPEG/PNG/WebP paths must resolve within the job directory. HTTPS sources must be public Nestoodle WP uploads or this repo’s Nestoodle media branch, without query strings, credentials or redirects. Downloads are capped at 12 MB.
- `steps`: 1–8 objects `{title, body, photo}`; photo is a zero-based index. Cover defaults to photo 0; step photos must be unique and must never reuse the cover (indices 1 and 2 in the sample). Step bodies fit in two lines.
- Optional `printableUrl` (Nestoodle PDF) **and** `printableVerified: true`: producer must verify the actual PDF and article relationship first. Only this combination permits “+ free printable.” The winter sample deliberately promises only the full guide.

Every photo needs `review: {approved: true, reviewer: "who/when", faceFree: true}` **after actual visual inspection** for activity, anatomy, safety, logos and text. If faces are present, omit faceFree and supply `faces: [[x,y,width,height], ...]` normalized to the original image. Annotate **every** face. The renderer maps boxes through the center cover crop and rejects cropped faces or overlays within 24px of them (45px crop/rounded-corner clearance). It does not detect faces or certify photo quality itself. The future producer must provide a trustworthy visual review/detection step; never assume faceFree just because generation requested it.

Headlines auto-shrink to fit at most three lines; body/eyebrow/benefit limits are stricter. The floor is 36px at 1080px wide, scaled with canvas width (40px at 1200px). Impossible copy fails the job; it is never silently truncated. Text/logo collisions and story safe-area violations also fail. Tests include a long eight-word headline across all layouts, JPEG dimensions, invalid reviews/printables, unreadable benefit text, and a face behind cover text. A job failure prevents artifact publication, although a local output directory may contain earlier images from that attempt: only use a successful run’s report.

## Sample review

One published article: https://nestoodle.com/indoor-winter-activities-for-kids/. “10” comes from the article’s actual activity count. The two sample steps are from the article; photos are newly generated realistic illustrations, not documentary photographs. Both were visually checked: hands/materials, no faces, no text. The sample is a four-slide carousel (cover, two example steps, CTA), not a claim to reproduce all ten activities in the carousel.

**Template design approved by the owner on 10 Nov 2026.** n8n integration sources are maintained in the private operations repository. New article/social content still requires owner review. Preserve/recheck all existing triggers and connections before publishing any n8n draft; save those sources in the private operations repository. Writer: clean photo prompt suffix, 2-photo featured collage, OG social image. NST-SOC: dedicated pin/carousel/Facebook outputs, replacing article-image/wsrv reuse. Photos must retain their alt text on upload.

## Owner refinements, 10 Nov 2026

Pin headline starts at 110px (+25%), benefit at 42px; three-line maximum and minimum legibility stay enforced. Step titles start at 96px and body at 50px; the photo starts 30px below actual fitted copy, avoiding unused gaps. Every step must use a separate photo; matching paths and identical image bytes are rejected. The cover has its own photo.

Eyebrows must not repeat headline words (numbers are compared as quantities, not words). The producer derives age intersection and time range from the chosen activities’ explicit article metadata; if unavailable it leaves the eyebrow absent rather than invent ages/times. Pin and IG cover display a coral Free printable badge only for an article-linked Nestoodle PDF whose response starts with the actual PDF signature. A failed PDF check fails the render. No PDF exists for the winter sample, so it has no badge.
