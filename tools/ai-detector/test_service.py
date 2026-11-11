"""Real HTTP/timeout tests with a deterministic scorer; no model/network download."""
import concurrent.futures
import json
import threading
import time
import unittest

from fastapi.testclient import TestClient
from app import create_app
from engine import Scorer
from text import paragraphs

KEY = "unit_test_key_not_a_real_secret_1234567890"
HEADERS = {"X-Detect-Key": KEY, "Content-Type": "application/json"}


class WordScorer(Scorer):
    def windows(self, paragraph):
        words = paragraph.split()
        for i in range(0, len(words), 5):
            yield words[i:i+5], len(words[i:i+5])

    def probability(self, window):
        return sum(w == "ai" for w in window) / len(window)


class ServiceTests(unittest.TestCase):
    def test_full_article_weighting_and_sorted_paragraph_indices(self):
        content = " ".join(["human"] * 40) + "\n\n" + " ".join(["ai"] * 30) + "\n\n" + " ".join(["human"] * 10)
        with TestClient(create_app(WordScorer, key=KEY)) as client:
            response = client.post("/detect?wait=true", headers=HEADERS, json={"text": content})
            self.assertEqual(response.status_code, 200)
            result = response.json()
            self.assertEqual(result["ai_percent"], 37.5)
            self.assertEqual([p["index"] for p in result["paragraphs"]], [2, 1, 3])
            self.assertEqual([p["ai_score"] for p in result["paragraphs"]], [100, 0, 0])
            self.assertIn("seconds", result)

    def test_limits_auth_and_validation_never_echo_input_or_key(self):
        with TestClient(create_app(WordScorer, key=KEY)) as client:
            self.assertEqual(client.get("/health").status_code, 200)
            response = client.post("/detect?wait=true", json={"text": "human " * 50})
            self.assertEqual(response.status_code, 401)
            self.assertNotIn(KEY, response.text)
            for value in ["x" * 199, "x" * 100001, "<script>" + "x" * 300 + "</script>", None, 22]:
                response = client.post("/detect?wait=true", headers=HEADERS, json={"text": value})
                self.assertEqual(response.status_code, 422)
                self.assertNotIn("x" * 50, response.text)
            for length in [200, 100000]:
                self.assertEqual(client.post("/detect?wait=true", headers=HEADERS, json={"text": "x" * length}).status_code, 200)
            self.assertEqual(client.post("/detect?wait=true", headers=HEADERS, content="not json").status_code, 422)
            self.assertEqual(client.post("/detect?wait=true", headers=HEADERS, content=b"x" * 1300001).status_code, 413)
            self.assertEqual(client.get("/docs").status_code, 404)

    def test_visible_paragraphs_and_shortcodes(self):
        self.assertEqual(paragraphs("<h2>Title</h2><p>One &amp; two.</p><p>Next<br>line.</p><script>hidden</script>"),
                         ["Title", "One & two.", "Next line."])
        self.assertEqual(paragraphs("[nestoodle_faq]Answer[/nestoodle_faq]\n\nKeep 5 < 10."), ["Answer", "Keep 5 < 10."])

    def test_busy_request_is_not_queued_and_health_stays_responsive(self):
        entered, release = threading.Event(), threading.Event()

        class Blocking(WordScorer):
            def probability(self, window):
                entered.set()
                release.wait(3)
                return 0.2

        with TestClient(create_app(Blocking, key=KEY)) as client, concurrent.futures.ThreadPoolExecutor() as pool:
            first = pool.submit(client.post, "/detect?wait=true", headers=HEADERS, json={"text": "x" * 200})
            self.assertTrue(entered.wait(2))
            try:
                self.assertTrue(client.get("/health").json()["busy"])
                self.assertEqual(client.post("/detect?wait=true", headers=HEADERS, json={"text": "x" * 200}).status_code, 429)
            finally:
                release.set()
            self.assertEqual(first.result(timeout=3).status_code, 200)

    def test_timeout_returns_no_partial_score_and_releases_worker(self):
        class Slow(WordScorer):
            def probability(self, window):
                time.sleep(0.15)
                return 0.9

        with TestClient(create_app(Slow, key=KEY, budget=0.02)) as client:
            response = client.post("/detect?wait=true", headers=HEADERS, json={"text": "x" * 200})
            self.assertEqual(response.status_code, 504)
            self.assertNotIn("ai_percent", response.text)
            time.sleep(0.2)
            self.assertFalse(client.get("/health").json()["busy"])

    def test_model_error_does_not_leak_text_or_secret(self):
        class Broken(WordScorer):
            def probability(self, window):
                raise RuntimeError(KEY + " private article")

        with TestClient(create_app(Broken, key=KEY)) as client:
            response = client.post("/detect?wait=true", headers=HEADERS, json={"text": "x" * 200})
            self.assertEqual(response.status_code, 503)
            self.assertNotIn(KEY, response.text)
            self.assertNotIn("private article", response.text)


if __name__ == "__main__":
    unittest.main()
