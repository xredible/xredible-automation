---
title: Nestoodle AI Text Detector
emoji: 🔎
colorFrom: orange
colorTo: yellow
sdk: docker
app_port: 7860
license: mit
---

Private CPU-only Nestoodle text detector. Set the `DETECT_KEY` Space secret before startup.
POST `/detect` requires `X-Detect-Key`; private HF routing also requires an authorized
Hugging Face bearer token. GET `/health` is available through the authenticated HF route.
No article text, request headers or keys are logged by the application.

Sources and model/licence details: https://github.com/xredible/xredible-automation/tree/main/tools/ai-detector
The score is model confidence, not proof of authorship. Keep manual editorial review.
Free CPU Spaces can sleep; cold starts/timeouts must not block draft creation.
