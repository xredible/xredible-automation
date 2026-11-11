"""Root-only installer smoke test; key is read from a file, never argv/stdout."""
import json
import os
import re
import time
from pathlib import Path
from urllib.request import Request, urlopen

def key_from_file(path=Path("/etc/ai-detector/env")):
    lines = path.read_text().splitlines()
    values = [line.split("=", 1)[1] for line in lines if line.startswith("DETECT_KEY=")]
    if len(values) != 1:
        raise SystemExit("Detector key file is invalid")
    return values[0]

if __name__ == "__main__":
    if os.geteuid() != 0:
        raise SystemExit("Run the local test with sudo; the key stays in /etc/ai-detector/env")
    sample = (
        "Paper tearing can be a simple indoor activity. Set out a sheet of paper and a bowl, "
        "then show your child how to tear a strip and place it in the bowl. Stay nearby and "
        "keep scraps out of mouths. Stop when your child loses interest; the aim is to explore "
        "the materials together rather than produce a perfect picture."
    )
    request = Request("http://127.0.0.1:8099/detect", data=json.dumps({"text": sample}).encode(),
                      headers={"Content-Type": "application/json", "X-Detect-Key": key_from_file()})
    with urlopen(request, timeout=20) as response:
        result = json.load(response)
    deadline = time.monotonic() + 300
    job_id = result.get("job_id")
    if not isinstance(job_id, str) or not re.fullmatch(r"[a-f0-9]{32}", job_id):
        raise SystemExit("Async job response invalid")
    while time.monotonic() < deadline:
        time.sleep(10)
        poll = Request("http://127.0.0.1:8099/result/" + job_id,
                       headers={"X-Detect-Key": key_from_file()})
        with urlopen(poll, timeout=15) as response:
            status = json.load(response)
        if status.get("status") == "done":
            result = status["result"]
            break
        if status.get("status") == "error":
            raise SystemExit("Detector sample failed; inspect service health (no key needed)")
    else:
        raise SystemExit("Detector sample exceeded five minutes")
    assert 0 <= result["ai_percent"] <= 100 and result["paragraphs"]
    print(json.dumps({k: result[k] for k in ("ai_percent", "label", "model", "seconds")}))
