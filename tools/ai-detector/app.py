"""Loopback-only HTTP API. No request text or authentication headers are logged."""
import asyncio
import hmac
import json
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from starlette.requests import ClientDisconnect

from constants import MAX_BODY_BYTES, MAX_CHARS, MIN_CHARS, MODEL_ID, MODEL_REVISION
from engine import CpuScorer, DeadlineExceeded
from text import paragraphs


def create_app(factory=CpuScorer, key=None, budget=None):
    secret = key if key is not None else os.getenv("DETECT_KEY", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]{32,256}", secret):
        raise RuntimeError("Configure a 32–256 character detector key in /etc/ai-detector/env")
    timeout = min(165.0, max(0.01, float(budget if budget is not None else os.getenv("DETECT_TIMEOUT", "90"))))
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="detector")
    busy = threading.Lock()

    @asynccontextmanager
    async def lifespan(api):
        api.state.scorer = await asyncio.get_running_loop().run_in_executor(executor, factory)
        try:
            yield
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

    api = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    @api.get("/health")
    async def health():
        return {"status": "ok", "model": MODEL_ID, "revision": MODEL_REVISION,
                "busy": busy.locked()}

    @api.post("/detect")
    async def detect(request: Request):
        supplied = request.headers.get("X-Detect-Key", "")
        if not hmac.compare_digest(supplied.encode("utf-8"), secret.encode("ascii")):
            raise HTTPException(401, "Unauthorized")
        if request.headers.get("content-type", "").split(";", 1)[0].lower() != "application/json":
            raise HTTPException(415, "Use application/json")
        started = time.monotonic()
        payload = bytearray()
        try:
            async for block in request.stream():
                if len(payload) + len(block) > MAX_BODY_BYTES:
                    raise HTTPException(413, "Request is too large")
                payload.extend(block)
            obj = json.loads(payload)
        except (ValueError, UnicodeError):
            raise HTTPException(422, "Invalid JSON") from None
        except ClientDisconnect:
            raise HTTPException(499, "Client disconnected") from None
        if not isinstance(obj, dict) or set(obj) != {"text"} or not isinstance(obj["text"], str):
            raise HTTPException(422, "Send a JSON object containing only text")
        raw = obj["text"]
        if not MIN_CHARS <= len(raw) <= MAX_CHARS:
            raise HTTPException(422, "Text must contain 200–100000 characters")
        parts = paragraphs(raw)
        if len("\n\n".join(parts)) < MIN_CHARS:
            raise HTTPException(422, "At least 200 visible text characters are required")
        if not busy.acquire(blocking=False):
            raise HTTPException(429, "Detector busy; skip this check or retry later", headers={"Retry-After": "60"})
        cancelled = threading.Event()

        def score():
            try:
                result = api.state.scorer.detect(parts, started + timeout, cancelled)
                result["seconds"] = round(time.monotonic() - started, 3)
                return result
            finally:
                busy.release()

        future = asyncio.get_running_loop().run_in_executor(executor, score)
        # Consume errors even if the HTTP caller disconnects before the CPU task ends.
        future.add_done_callback(lambda f: f.exception() if not f.cancelled() else None)
        try:
            while not future.done():
                if await request.is_disconnected():
                    cancelled.set()
                    raise HTTPException(499, "Client disconnected")
                if time.monotonic() - started >= timeout:
                    cancelled.set()
                    raise HTTPException(504, "Detector time budget exceeded; skip this check")
                await asyncio.sleep(0.05)
            return future.result()
        except DeadlineExceeded:
            raise HTTPException(504, "Detector time budget exceeded; skip this check") from None
        except HTTPException:
            raise
        except asyncio.CancelledError:
            cancelled.set()
            raise
        except Exception:
            raise HTTPException(503, "Detector unavailable; skip this check") from None

    return api
