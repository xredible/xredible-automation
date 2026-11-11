# Nestoodle AI-text check on a Raspberry Pi

## Alternative: private Hugging Face Space

The owner-authorized GitHub Actions workflow **Deploy private AI detector Space**
uses the repository secret `HF_TOKEN` to create/deploy
https://huggingface.co/spaces/Xrediblee/nestoodle-ai-detector.
It enforces private visibility and refuses paid hardware. Only allowlisted source
files are uploaded; the deployment token is never added to the image or Space.
The Docker variant uses HF's required port 7860; the Pi service remains loopback-only.

After creation, open the Space → **Settings → Variables and secrets → New secret**:
name **DETECT_KEY**, value a new random 32–256-character string containing only
letters, digits, `_`, `-` (a password manager can generate 64 hex characters).
Save, restart if needed, and wait for Running. Do not put the value in a Variable,
repository file, URL or chat. Keep the same value for n8n's `X-Detect-Key` header.

Private HF routing also needs `Authorization: Bearer …`. Create a separate
fine-grained **read** HF token permitted to read this Space; keep the Write token
only in GitHub Actions. In n8n use **Custom Auth** named `[NST] AI Detector (HF)`
with JSON containing a `headers` object whose keys are `Authorization` (value
`Bearer ` followed by that read token) and `X-Detect-Key` (the Space secret).
Enter actual values only in n8n's credential editor. A single Header Auth credential
cannot supply both headers. The direct app host is shown by **Embed this Space →
Direct URL** (normally `https://xrediblee-nestoodle-ai-detector.hf.space`);
use `/health` and `/detect` on that host, not the huggingface.co editor URL.

The model stays CPU-only with a 165-second internal budget. Free Spaces can sleep
and cold-start slowly; writer calls must retain their 180-second timeout and skip
without blocking a Draft on any failure. No paid upgrade or always-on guarantee.

A native FastAPI service for **64-bit Debian bookworm / Python 3.11+ / arm64**,
using `desklib/ai-text-detector-v1.01` on CPU. No paid inference or detection API.
The requested model is DeBERTa-v3-large (about 435M parameters, **1.74 GB weights**),
not a tiny detector. An **8 or 16 GB Pi 5** is recommended, especially alongside
Immich. Installation requires **4 GiB currently available RAM and 8 GiB free disk**;
it stops before changing services if those checks fail. Model download takes time.

The model and base model cards declare **MIT**, which allows this self-hosted
commercial-blog use. Model revision, sources and notices are in
[THIRD_PARTY.md](THIRD_PARTY.md). The installer saves the upstream card with the
weights and pins a full model revision. Weights use safetensors only; no remote
model Python is executed.

## 1. Install on the Pi (owner runs this)

From the Pi’s terminal or SSH session, run this single line:

```bash
curl -fsSL https://raw.githubusercontent.com/xredible/xredible-automation/main/tools/ai-detector/install.sh -o /tmp/nestoodle-ai-detector-install.sh && sudo bash /tmp/nestoodle-ai-detector-install.sh
```

For a reproducible release, replace `main` in the download URL with the supplied
Git commit SHA and add `--ref THE_SAME_SHA` to `sudo bash`. Never pass the key in
the command or paste it into chat. The installer uses `read -rsp` on `/dev/tty`;
choose **32–256 letters, digits, underscores or hyphens** and save that same value
in your password manager for the n8n credential. Input is hidden and not printed.

The key lives only in `/etc/ai-detector/env`, root-owned mode 600, in a mode-700
directory. systemd reads that EnvironmentFile and passes it to the unprivileged
service; the service user does not need to read the root-only file itself. Updates
keep the key and old release directory. Do not `cat`/share the env file. The script
does not alter ufw, Docker, existing tunnels, cron jobs, n8n or other services.

Installed components:

- `/opt/ai-detector/current` → release directory with a dedicated venv.
- `/var/lib/ai-detector/model` → pinned model data, downloaded once.
- `ai-detector.service` → unprivileged `ai-detector` user, restart on failure,
  **127.0.0.1:8099 only**, two CPU threads / 200% CPU quota, low priority,
  3 GB memory-high / 4 GB memory-max and no service swap.
- Health readiness wait, then an authenticated sample call. Only its score/model/
  elapsed time is printed; the sample is a connectivity test, not a labelled
  accuracy benchmark. No secret appears in an argument, URL, output or access log.

Useful commands:

```bash
curl -fsS http://127.0.0.1:8099/health
sudo systemctl status ai-detector --no-pager
sudo journalctl -u ai-detector -n 50 --no-pager
sudo /opt/ai-detector/current/venv/bin/python /opt/ai-detector/current/client_test.py
```

Do not open port 8099 in ufw or bind it to `0.0.0.0`. If 8099 belongs to another
service, installation stops rather than replacing it. To stop just this service:
`sudo systemctl disable --now ai-detector`. The env/model/release data is retained.

## 2. Add the Cloudflare Tunnel hostname

1. Open Cloudflare **Zero Trust → Networks → Connectors → Cloudflare Tunnels**
   (some layouts call this **Networks → Tunnels**).
2. Select the Pi’s existing tunnel → **Edit/Configure → Published application
   routes / Public Hostnames → Add a public hostname**.
3. Subdomain **aidetect**, domain **xredible.in**; no path restriction.
4. Service type **HTTP**, URL **localhost:8099**. Save; Cloudflare creates the
   hostname’s DNS route. Do not change nameservers, firewall or router ports.
5. Open **https://aidetect.xredible.in/health**: it should return `status: ok` and
   the Desklib model ID. A POST to `/detect` without the key must return 401.

The connector must reach the Pi’s host loopback. A native/systemd cloudflared
process can. If cloudflared is in a **bridged Docker container**, `localhost`
means that container, so this route cannot reach host-only 8099. Do not expose
the detector on the LAN as a workaround; use a host-level connector for this
hostname (or ask for the correct separate tunnel setup before changing an
existing connector’s networking). Leave other working tunnel routes intact.

An interactive Cloudflare Access login would block n8n. This API authenticates
with its header; do not add an interactive-login policy unless service-token
authentication is separately configured. Cloudflare may impose its own HTTP
timeout before n8n’s 180-second ceiling; the service defaults to a **90-second**
work budget to return a clean timeout before the usual proxy limit.

## 3. Save the n8n credential, then confirm to the assistant

In **n8n → Credentials → Add credential → Header Auth**:

- Credential display name: **[NST] AI Detector**
- Inner **Name** field: **X-Detect-Key**, exactly, with no surrounding spaces.
- **Value**: the same value entered at the Pi’s hidden prompt. Enter it only in
  n8n, never in chat or a workflow’s inline header parameter.
- Save in the project accessible to the Nestoodle writer.

Confirm installation/sample succeeded, `/health` works through the hostname, and
the credential is saved. The writer is **not changed before that confirmation**.
The next step is one real test on the existing draft, with no publication or
additional article generation. No genuine article score can be reported before
the owner has installed and exposed the service.

## HTTP contract and scoring

`GET /health` returns readiness/model/revision and whether one check is busy.

`POST /detect`, JSON `{"text":"..."}`, requires `X-Detect-Key`. Text limits are
**200–100,000 characters**, with at least 200 visible characters after cleaning.
Blank lines and `<p>`/block elements split paragraphs; scripts/styles/HTML and
WordPress shortcode tags are stripped. Indexes are **one-based original paragraph
order**. `ai_score` and `ai_percent` are both **0–100**, not 0–1. Paragraphs are
sorted descending by score, with stable original-order ties. A response has:

```json
{
  "ai_percent": 62.5,
  "label": "AI Generated",
  "paragraphs": [{"index": 2, "first_words": "Illustrative paragraph opening", "ai_score": 81.2}],
  "model": "desklib/ai-text-detector-v1.01",
  "revision": "5fdea974cd4287c61674951ec78803aa274e2fb7",
  "precision": "dynamic-int8",
  "seconds": 12.3
}
```

Those numbers are an **illustrative response**, not a measured draft score.
Every paragraph is tokenised without truncation and split into non-overlapping
windows of at most 768 tokens including special tokens. Each window uses the
model card’s masked-mean-pooling classifier and sigmoid. Paragraph and article
scores are token-weighted means of their windows. Overall is an aggregation of
the paragraph windows, not a claim that the checkpoint accepts a 100,000-character
sequence at once. Dynamic padding avoids padding short paragraphs to 768 tokens.
Nothing beyond the first window is silently ignored.

The default is CPU dynamic INT8 for Linear layers using QNNPACK on arm64, with
the same checkpoint and architecture. Its output can differ slightly from
float32; `precision` makes that explicit. For model-card float32 comparison, the
owner can use a systemd override `Environment=DETECT_QUANTIZE=0` and restart this
service, accepting higher memory/CPU use. Actual Pi latency and accuracy have
not been measured by the assistant; the owner’s sample and one-draft test supply
that evidence. A large/paragraph-heavy article may time out rather than return a
complete score. Short paragraphs and lists are especially weak authorship signals.

The percentage is **model confidence**, not a proven percentage of AI-written
words and not a Copyleaks-equivalent verdict. False positives are possible.
Use the ranked openings for Sakshi’s review, keep Draft status, and retain
**“Run Copyleaks before publishing”**. Never manufacture personal stories to
change a detector score.

Only one request runs at a time; another gets 429 (Retry-After 60). Inference runs
off the HTTP event loop so health remains responsive. Time budget 90 seconds;
CPU work checks cancellation/deadline between windows. A single active forward
pass can finish after a disconnected/timed-out caller, then releases the worker;
there is no growing job queue. No partial article score is returned on timeout.
401 means wrong/missing key, 422 invalid/short text, 413 oversized JSON, 429 busy,
503 unavailable, 504 timeout. Neither input text nor key is echoed in errors.

After confirmation, n8n will use a 180-second HTTP timeout, continue on detector
failure, save the result as private draft review data, and append the top 3–5
paragraph openings to the owner alert. Unavailable/slow checks are marked skipped;
they never block a draft or remove the manual Copyleaks reminder.

## Verification

```bash
python -m unittest discover -s tools/ai-detector -p 'test_*.py' -v
bash -n tools/ai-detector/install.sh
```

HTTP tests use deterministic fixtures for auth, boundaries, HTML/shortcodes,
token-weighted ranking, concurrency, errors and cooperative timeout. CI installs
the pinned native dependencies on x64 and arm64, checks a tiny real DeBERTa’s
pooling/768-token context/INT8/safetensors round-trip, and validates the installer.
No full checkpoint is downloaded by these unit tests. The real 1.74 GB checkpoint,
Pi systemd start, tunnel and draft score require the owner’s install/test.
