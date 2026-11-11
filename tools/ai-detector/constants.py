MODEL_ID = "desklib/ai-text-detector-v1.01"
MODEL_REVISION = "5fdea974cd4287c61674951ec78803aa274e2fb7"
MIN_CHARS = 200
MAX_CHARS = 100_000
MAX_BODY_BYTES = 1_300_000  # Includes JSON escaping of 100k Unicode characters.
MAX_TOKENS = 768  # Same inference context as the upstream model-card example.
