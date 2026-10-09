"""Self-hosted, open-source Conecta moderator. Runs only on a trusted private server.

Two real Apache-2.0 Hugging Face models, never a mocked classification.
Text: unitary/multilingual-toxic-xlm-roberta
Image: Falconsai/nsfw_image_detection
Video: ffmpeg frame sampling; even a clean sample requires human review.
"""
import io
import os
import hmac
import subprocess
import tempfile
import threading
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
lock = threading.Lock()
_text_classifier = None
_image_classifier = None

TEXT_MODEL = "unitary/multilingual-toxic-xlm-roberta"
IMAGE_MODEL = "Falconsai/nsfw_image_detection"
MAX_IMAGE = 20 * 1024 * 1024
MAX_VIDEO = 50 * 1024 * 1024
MAX_VIDEO_SECONDS = 90


@app.get("/health")
def health():
    return {"ready": bool(os.getenv("MODERATION_WORKER_TOKEN"))}


def verify_token(authorization: str | None):
    secret = os.getenv("MODERATION_WORKER_TOKEN")
    if not secret:
        raise HTTPException(status_code=503, detail="service not configured")
    supplied = (authorization or "").removeprefix("Bearer ")
    if not hmac.compare_digest(supplied, secret):
        raise HTTPException(status_code=401, detail="not authorized")


def text_classifier():
    global _text_classifier
    with lock:
        if _text_classifier is None:
            from transformers import pipeline
            _text_classifier = pipeline(
                "text-classification", model=TEXT_MODEL, device=-1,
                trust_remote_code=False
            )
    return _text_classifier


def image_classifier():
    global _image_classifier
    with lock:
        if _image_classifier is None:
            from transformers import pipeline
            _image_classifier = pipeline(
                "image-classification", model=IMAGE_MODEL, device=-1,
                trust_remote_code=False
            )
    return _image_classifier


def evaluate_image(blob: bytes) -> float:
    if len(blob) > MAX_IMAGE:
        raise ValueError("image exceeds limit")
    try:
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(blob))).convert("RGB")
        image.thumbnail((768, 768))
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("invalid image") from exc
    result = image_classifier()(image)
    scores = [float(item.get("score", 0)) for item in result
              if str(item.get("label", "")).strip().lower() == "nsfw"]
    if not scores:
        raise ValueError("image model response missing nsfw label")
    return max(scores)


def video_frames(blob: bytes) -> list[bytes]:
    if len(blob) > MAX_VIDEO:
        raise ValueError("video exceeds limit")
    with tempfile.TemporaryDirectory(prefix="conecta-moderation-") as directory:
        source = Path(directory) / "clip.input"
        source.write_bytes(blob)
        duration_result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(source)],
            capture_output=True, text=True, timeout=20, check=True
        )
        duration = float(duration_result.stdout.strip())
        if not 0 < duration <= MAX_VIDEO_SECONDS:
            raise ValueError("video duration requires manual review")
        positions = sorted(set(min(duration - 0.05, max(0.0, duration * fraction))
                               for fraction in (0.05, 0.33, 0.67, 0.95)))
        frames = []
        for position in positions:
            frame = subprocess.run(
                ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
                 "-ss", str(position), "-i", str(source), "-frames:v", "1",
                 "-vf", "scale=640:-2", "-f", "image2pipe", "-vcodec", "mjpeg", "-"],
                capture_output=True, timeout=20, check=True
            )
            if not frame.stdout:
                raise ValueError("unable to extract video frame")
            frames.append(frame.stdout)
        return frames


@app.post("/classify")
async def classify(
    authorization: str | None = Header(default=None),
    content: str = Form(default=""),
    images: list[UploadFile] = File(default=[]),
    video: UploadFile | None = File(default=None),
):
    verify_token(authorization)
    if len(content) > 4000 or len(images) > 5 or (images and video):
        raise HTTPException(status_code=413, detail="unsupported size or input count")

    # Never send content to a third-party model from this worker.
    # Intentionally no request body logging and no persistence of uploads.
    text_score = 0.0
    image_score = 0.0
    try:
        if content.strip():
            prediction = text_classifier()(content[:4000], truncation=True, max_length=256)[0]
            if str(prediction.get("label", "")).lower() != "toxic":
                raise ValueError("unexpected toxicity model output")
            text_score = float(prediction["score"])
        for image in images:
            blob = await image.read(MAX_IMAGE + 1)
            image_score = max(image_score, evaluate_image(blob))
        if video:
            blob = await video.read(MAX_VIDEO + 1)
            for frame in video_frames(blob):
                image_score = max(image_score, evaluate_image(frame))
    except (ValueError, OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="model unavailable") from exc

    flagged = text_score >= 0.80 or image_score >= 0.65
    # Frame sampling alone is never strong enough to automatically clear a video.
    return {
        "flagged": flagged, "human_review": bool(video),
        "engine": "transformers-open-source-v1",
        "text_toxic_score": round(text_score, 4),
        "image_nsfw_score": round(image_score, 4),
    }
