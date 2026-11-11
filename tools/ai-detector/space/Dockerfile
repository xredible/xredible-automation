FROM python:3.11-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir torch==2.10.0 --index-url https://download.pytorch.org/whl/cpu && pip install --no-cache-dir -r requirements.txt
COPY constants.py model.py engine.py text.py app.py download_model.py ./
RUN python download_model.py /app/model && chmod -R a+rX /app
ENV DETECT_MODEL_DIR=/app/model DETECT_THREADS=2 DETECT_TIMEOUT=165 DETECT_QUANTIZE=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1 USE_TF=0 USE_TORCH=1 TOKENIZERS_PARALLELISM=false HOME=/home/user
RUN useradd -m -u 1000 user
USER user
EXPOSE 7860
CMD ["uvicorn", "app:create_app", "--factory", "--host", "0.0.0.0", "--port", "7860", "--workers", "1", "--no-access-log", "--log-level", "warning"]
