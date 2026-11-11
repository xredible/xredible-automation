"""Bounded, ephemeral job results. Never retain article input in the result store."""
import threading
import time
import uuid


class Jobs:
    def __init__(self, ttl=900, limit=32):
        self.ttl, self.limit = ttl, limit
        self.lock = threading.Lock()
        self.rows = {}

    def _prune(self, reserve=False):
        now = time.monotonic()
        for key in list(self.rows):
            row = self.rows[key]
            if row["status"] in ("done", "error") and now - row["finished"] > self.ttl:
                del self.rows[key]
        terminal = sorted((r["finished"], k) for k, r in self.rows.items() if r["status"] in ("done", "error"))
        while len(self.rows) + int(reserve) > self.limit and terminal:
            _, key = terminal.pop(0)
            del self.rows[key]

    def create(self):
        with self.lock:
            self._prune(reserve=True)
            key = uuid.uuid4().hex
            self.rows[key] = {"job_id": key, "status": "running"}
            return key

    def finish(self, key, result=None, error=None):
        with self.lock:
            self.rows[key] = {"job_id": key, "status": "error" if error else "done",
                              "finished": time.monotonic(), **({"error": error} if error else {"result": result})}

    def get(self, key):
        with self.lock:
            self._prune()
            row = self.rows.get(key)
            return {k: v for k, v in row.items() if k != "finished"} if row else None
