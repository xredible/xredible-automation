"""Model-card architecture: DeBERTa → masked mean pooling → linear logit.

Local class, pinned safetensors weights, no remote Python/model code execution.
See THIRD_PARTY.md for the upstream model card and MIT declarations.
"""
import torch
from torch import nn
from transformers import AutoConfig, AutoModel, PreTrainedModel


class DesklibAIDetectionModel(PreTrainedModel):
    config_class = AutoConfig

    def __init__(self, config):
        super().__init__(config)
        self.model = AutoModel.from_config(config)
        self.classifier = nn.Linear(config.hidden_size, 1)
        self.init_weights()

    def forward(self, input_ids, attention_mask=None, labels=None):
        if attention_mask is None:
            attention_mask = torch.ones_like(input_ids)
        hidden = self.model(input_ids=input_ids, attention_mask=attention_mask)[0]
        mask = attention_mask.unsqueeze(-1).expand(hidden.size()).float()
        pooled = (hidden * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)
        logits = self.classifier(pooled)
        result = {"logits": logits}
        if labels is not None:
            result["loss"] = nn.functional.binary_cross_entropy_with_logits(logits.view(-1), labels.float())
        return result
