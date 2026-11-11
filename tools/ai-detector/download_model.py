"""Download only pinned model data, never executable Python or pickle checkpoints."""
import argparse
from pathlib import Path

from huggingface_hub import snapshot_download
from constants import MODEL_ID, MODEL_REVISION

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    snapshot_download(
        repo_id=MODEL_ID, revision=MODEL_REVISION, local_dir=args.directory,
        allow_patterns=["config.json", "model.safetensors", "tokenizer.json", "tokenizer_config.json",
                        "special_tokens_map.json", "added_tokens.json", "spm.model", "README.md"],
    )
    for name in ("config.json", "model.safetensors", "tokenizer_config.json", "spm.model", "README.md"):
        if not (args.directory / name).is_file():
            raise SystemExit("Model download incomplete")
    card = (args.directory / "README.md").read_text()
    if "license: mit" not in card.lower():
        raise SystemExit("Model licence declaration changed; review before using")
    (args.directory / "REVISION").write_text(MODEL_REVISION + "\n")
    print("Pinned model data downloaded; MIT declaration retained in model/README.md")
