"""CPU scoring of every paragraph/token; never silently truncate a long article."""
import math
import os
import threading
import time
from pathlib import Path

from constants import MAX_TOKENS, MODEL_ID, MODEL_REVISION
from text import first_words


class DeadlineExceeded(Exception):
    pass


def check_budget(deadline, cancelled):
    if cancelled.is_set() or time.monotonic() >= deadline:
        raise DeadlineExceeded()


class Scorer:
    """A scorer's token windows and scores can be replaced by deterministic fixtures."""

    def windows(self, paragraph):
        raise NotImplementedError

    def probability(self, window):
        raise NotImplementedError

    def detect(self, parts: list[str], deadline: float, cancelled: threading.Event):
        rows = []
        total = total_tokens = 0
        for index, paragraph in enumerate(parts, 1):
            check_budget(deadline, cancelled)
            score = tokens = 0
            for window, weight in self.windows(paragraph):
                check_budget(deadline, cancelled)
                p = float(self.probability(window))
                check_budget(deadline, cancelled)
                if not math.isfinite(p) or not 0 <= p <= 1 or weight < 1:
                    raise RuntimeError("Invalid model score")
                score += p * weight
                tokens += weight
            if not tokens:
                raise RuntimeError("Paragraph has no model tokens")
            total += score
            total_tokens += tokens
            rows.append({"index": index, "first_words": first_words(paragraph), "ai_score": round(100 * score / tokens, 2)})
        probability = total / total_tokens
        return {"ai_percent": round(probability * 100, 2),
                "label": "AI Generated" if probability >= 0.5 else "Not AI Generated",
                "paragraphs": sorted(rows, key=lambda r: (-r["ai_score"], r["index"])),
                "model": MODEL_ID, "revision": MODEL_REVISION,
                "precision": getattr(self, "precision", "float32")}


class CpuScorer(Scorer):
    def __init__(self):
        import torch
        from transformers import AutoTokenizer
        from model import DesklibAIDetectionModel

        self.torch = torch
        torch.set_num_threads(max(1, min(2, int(os.getenv("DETECT_THREADS", "2")))))
        torch.set_num_interop_threads(1)
        directory = Path(os.getenv("DETECT_MODEL_DIR", "/var/lib/ai-detector/model"))
        if (directory / "REVISION").read_text().strip() != MODEL_REVISION:
            raise RuntimeError("Unexpected model revision")
        self.tokenizer = AutoTokenizer.from_pretrained(directory, local_files_only=True, trust_remote_code=False)
        self.model, info = DesklibAIDetectionModel.from_pretrained(
            directory, local_files_only=True, use_safetensors=True,
            low_cpu_mem_usage=True, output_loading_info=True,
        )
        trainable = dict(self.model.named_parameters())
        if any(k in trainable for k in info.get("missing_keys", [])):
            raise RuntimeError("Checkpoint is missing trained parameters")
        self.model.to(torch.device("cpu"))
        self.model.eval()
        self.precision = "float32"
        if os.getenv("DETECT_QUANTIZE", "1") == "1":
            engines = torch.backends.quantized.supported_engines
            engine = next((e for e in ("qnnpack", "x86", "fbgemm") if e in engines), None)
            if engine is None:
                raise RuntimeError("No CPU INT8 engine; set DETECT_QUANTIZE=0 to use float32")
            torch.backends.quantized.engine = engine
            torch.ao.quantization.quantize_dynamic(self.model, {torch.nn.Linear}, dtype=torch.qint8, inplace=True)
            self.precision = "dynamic-int8"
        self.content_tokens = MAX_TOKENS - self.tokenizer.num_special_tokens_to_add(pair=False)

    def windows(self, paragraph):
        ids = self.tokenizer.encode(paragraph, add_special_tokens=False, truncation=False)
        for start in range(0, len(ids), self.content_tokens):
            window = ids[start:start + self.content_tokens]
            yield window, len(window)

    def probability(self, window):
        ids = self.torch.tensor([self.tokenizer.build_inputs_with_special_tokens(window)], dtype=self.torch.long)
        encoded = {"input_ids": ids, "attention_mask": self.torch.ones_like(ids)}
        with self.torch.inference_mode():
            logits = self.model(input_ids=encoded["input_ids"], attention_mask=encoded["attention_mask"])["logits"]
            return self.torch.sigmoid(logits).item()
