FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 HF_HOME=/models \
    TOKENIZERS_PARALLELISM=false
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /service
COPY requirements.txt /service/requirements.txt
RUN pip install --no-cache-dir -r /service/requirements.txt
COPY server.py /service/server.py
RUN useradd --create-home --uid 10001 app && mkdir -p /models && chown -R app:app /models /service
USER app
EXPOSE 8080
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--no-access-log"]
