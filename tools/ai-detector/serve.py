"""Do not expose a bind-host flag: cloudflared is the only remote entry point."""
import uvicorn
from app import create_app

if __name__ == "__main__":
    uvicorn.run(create_app(), host="127.0.0.1", port=8099, workers=1,
                access_log=False, log_level="warning", timeout_keep_alive=5,
                limit_concurrency=8)
