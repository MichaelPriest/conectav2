FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY app.py /app/app.py
RUN useradd --system --create-home ocr
USER ocr
EXPOSE 8080
CMD ["uvicorn","app:app","--host","0.0.0.0","--port","8080","--no-access-log","--workers","1"]
