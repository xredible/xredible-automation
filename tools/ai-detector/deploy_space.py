"""Deploy only the detector allowlist; HF_TOKEN is read from Actions environment."""
import os
import sys
from pathlib import Path

from huggingface_hub import HfApi

SPACE = "Xrediblee/nestoodle-ai-detector"
ROOT = Path(__file__).resolve().parent
FILES = ["requirements.txt", "constants.py", "model.py", "engine.py", "text.py",
         "app.py", "download_model.py", "THIRD_PARTY.md"]
STAGE = "initialization"


def main():
    global STAGE
    api = HfApi(token=os.environ["HF_TOKEN"])
    STAGE = "verify HF account"
    if api.whoami()["name"].lower() != "xrediblee":
        raise RuntimeError("HF_TOKEN must belong to the requested Xrediblee account")
    STAGE = "create private Space"
    api.create_repo(SPACE, repo_type="space", private=True, space_sdk="docker", exist_ok=True)
    STAGE = "verify Space privacy"
    info = api.repo_info(SPACE, repo_type="space")
    if not info.private:
        raise RuntimeError("Refusing to deploy: existing Space is not private")
    # Never select paid hardware or copy the deployment token into the Space.
    STAGE = "verify free hardware"
    runtime = api.get_space_runtime(SPACE)
    if runtime.hardware not in (None, "cpu-basic") or runtime.requested_hardware not in (None, "cpu-basic"):
        raise RuntimeError("Refusing to deploy onto non-free hardware")
    from huggingface_hub import CommitOperationAdd
    operations = [CommitOperationAdd(path_in_repo=name, path_or_fileobj=str(ROOT / name)) for name in FILES]
    operations += [CommitOperationAdd(path_in_repo=name, path_or_fileobj=str(ROOT / "space" / name))
                   for name in ("Dockerfile", "README.md")]
    STAGE = "upload detector source"
    api.create_commit(SPACE, repo_type="space", operations=operations,
                      commit_message="Deploy reviewed Nestoodle CPU detector")
    STAGE = "verify deployed Space"
    info = api.repo_info(SPACE, repo_type="space")
    if not info.private:
        raise RuntimeError("Space privacy verification failed")
    print("Private free-CPU Space deployed: https://huggingface.co/spaces/" + SPACE)
    print("Set DETECT_KEY under Space Settings > Variables and secrets > New secret.")
    print("Runtime stage:", api.get_space_runtime(SPACE).stage)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # HF exceptions may include request details. Never emit their body/headers.
        status = getattr(getattr(exc, "response", None), "status_code", None)
        print("Space deployment failed at " + STAGE + " (" + type(exc).__name__ +
              ", HTTP " + str(status) + "). Check token/account permissions and Space settings.", file=sys.stderr)
        sys.exit(1)
