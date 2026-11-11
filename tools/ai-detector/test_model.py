"""Tiny real transformer tests; no Desklib weights or external network required."""
import tempfile
import unittest

try:
    import torch
    from transformers import DebertaV2Config
    from model import DesklibAIDetectionModel
except ImportError:
    torch = None


@unittest.skipIf(torch is None, "torch/transformers not installed; CI runs this with pinned dependencies")
class ModelTests(unittest.TestCase):
    def make_model(self):
        torch.manual_seed(7)
        config = DebertaV2Config(vocab_size=40, hidden_size=8, intermediate_size=16,
                                num_hidden_layers=1, num_attention_heads=2,
                                hidden_dropout_prob=0, attention_probs_dropout_prob=0,
                                relative_attention=True, position_biased_input=False)
        return DesklibAIDetectionModel(config).eval()

    def test_masked_mean_matches_model_card_and_safetensors_round_trip(self):
        model = self.make_model()
        ids = torch.tensor([[1, 2, 3, 0]])
        mask = torch.tensor([[1, 1, 1, 0]])
        with torch.inference_mode():
            hidden = model.model(input_ids=ids, attention_mask=mask)[0]
            expected = model.classifier(hidden[:, :3].mean(dim=1))
            actual = model(ids, mask)["logits"]
        torch.testing.assert_close(actual, expected)
        with tempfile.TemporaryDirectory() as tmp:
            model.save_pretrained(tmp, safe_serialization=True)
            restored, info = DesklibAIDetectionModel.from_pretrained(tmp, local_files_only=True,
                                                                  use_safetensors=True, output_loading_info=True)
            self.assertFalse(info["missing_keys"])
            with torch.inference_mode():
                torch.testing.assert_close(restored(ids, mask)["logits"], actual)

    def test_relative_positions_allow_model_card_768_context_and_cpu_int8(self):
        model = self.make_model()
        ids = torch.ones((1, 768), dtype=torch.long)
        mask = torch.ones_like(ids)
        with torch.inference_mode():
            baseline = torch.sigmoid(model(ids, mask)["logits"])
        engine = next((e for e in ("qnnpack", "x86", "fbgemm") if e in torch.backends.quantized.supported_engines), None)
        self.assertIsNotNone(engine)
        torch.backends.quantized.engine = engine
        torch.ao.quantization.quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8, inplace=True)
        with torch.inference_mode():
            quantized = torch.sigmoid(model(ids, mask)["logits"])
        torch.testing.assert_close(quantized, baseline, atol=0.02, rtol=0.02)


if __name__ == "__main__":
    unittest.main()
