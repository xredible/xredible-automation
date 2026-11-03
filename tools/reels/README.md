# Nestoodle reel renderer

Turns a validated job from the private n8n workflow into a 1080×1920 MP4 with per-scene narration, animated photos, captions, and a JPEG cover. The scheduler claims one job per run, commits only the finished public video/cover to `media`, and reports completion to n8n. No job specs, audio credentials, or authentication headers are committed to the public repository.

## Run

```
cd tools/reels
npm ci
npx playwright install --with-deps chromium
# ffmpeg and ffprobe must be installed
node render.mjs /absolute/work/spec.json /absolute/work/reel.mp4
```

The work folder contains `reel.html`, `assets/`, local scene images, and local WAV voice clips. Scene types are `hook`, `item`, and `cta`. Each has `text`, `headline`/`title`, `image`, and `vo`. Timing comes from the actual voice duration. No third-party music is added.

## Automatic worker

Configure repository Actions secret `N8N_REELS_SECRET`. The same value must be stored in an n8n Header Auth credential, header name `X-Reel-Secret`, on both `nst-reel-jobs` and `nst-reel-done`. Do not put it in workflow source or a public variable.

Keep Actions variable `NESTOODLE_REELS_ENABLED` unset/false until the authenticated endpoints and first complete video are verified. Set it to `true` only after that review. The Actions concurrency group serializes renderer runs. n8n returns one claimed job. Completion callbacks use per-job/per-platform markers to avoid duplicates on sequential retries; this is not a database transaction or a general concurrent multi-worker queue.

The private completion workflow initially creates **Draft** rows. Existing social publishers only process Ready rows. Draft-to-Ready review and the real comment-to-DM test are required before promoting the first reel. Existing YouTube audit/private-upload behavior is preserved.

Downloads permit only HTTPS files under `nestoodle.com/wp-content/uploads/`; redirects are rejected. LLM text uses DOM textContent, not HTML. The browser renders only local assets. Failures report a generic status; credentials and job content are not logged. WAV files remain in WordPress for retries; automatic permanent deletion is deliberately absent.
