"""Root-only installer smoke test; key is read from a file, never argv/stdout."""
import json
import os
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
    with urlopen(request, timeout=180) as response:
        result = json.load(response)
    assert 0 <= result["ai_percent"] <= 100 and result["paragraphs"]
    print(json.dumps({k: result[k] for k in ("ai_percent", "label", "model", "seconds")}))
