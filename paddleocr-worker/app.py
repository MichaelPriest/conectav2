"""Private Conecta ID OCR fallback: never logs, stores or returns document images."""
import base64
import binascii
import hmac
import io
import os
from functools import lru_cache
from threading import Lock

import numpy as np
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from PIL import Image, UnidentifiedImageError

app = FastAPI(title="Conecta ID PaddleOCR", docs_url=None, redoc_url=None, openapi_url=None)
_model_lock = Lock()
MAX_IMAGE_BYTES = 4 * 1024 * 1024


class OcrInput(BaseModel):
    # Only the Next.js server can call this endpoint with a private service key.
    images: list[str] = Field(min_length=1, max_length=2)


def _authenticated(token: str | None) -> bool:
    secret = os.environ.get("CONECTA_OCR_SECRET", "")
    return bool(secret and token and hmac.compare_digest(token, secret))


@lru_cache(maxsize=1)
def _ocr():
    # Load once per process; CPU models are shared, not downloaded per request.
    from paddleocr import PaddleOCR
    return PaddleOCR(
        lang="pt",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )


def _decode_image(value: str) -> np.ndarray:
    if len(value) > MAX_IMAGE_BYTES * 4 // 3 + 16:
        raise HTTPException(status_code=413, detail="Imagem excessiva.")
    try:
        raw = base64.b64decode(value, validate=True)
        if not (0 < len(raw) <= MAX_IMAGE_BYTES):
            raise ValueError("size")
        with Image.open(io.BytesIO(raw)) as image:
            if image.width * image.height > 20_000_000:
                raise ValueError("pixels")
            rgb = image.convert("RGB")
            return np.array(rgb, copy=True)
    except (binascii.Error, UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Imagem inválida.") from None


@app.get("/health")
def health():
    return {"ok": True, "service": "paddleocr", "configured": bool(os.getenv("CONECTA_OCR_SECRET"))}


@app.post("/v1/recognize")
def recognize(payload: OcrInput, x_conecta_ocr_key: str | None = Header(default=None)):
    if not _authenticated(x_conecta_ocr_key):
        raise HTTPException(status_code=401, detail="Não autorizado.")
    # Avoid printing raw OCR, metadata, images or their payloads.
    images = [_decode_image(img) for img in payload.images]
    try:
        with _model_lock:
            result = [_ocr().predict(image) for image in images]
        texts: list[str] = []
        for pages in result:
            lines: list[str] = []
            for page in pages:
                content = page.get("rec_texts", []) if hasattr(page, "get") else []
                for value in content:
                    if isinstance(value, str) and value:
                        lines.append(value[:256])
            texts.append("\n".join(lines)[:16000])
        return {"texts": texts}
    except Exception:
        # Do not leak model paths, payloads or personal data into the API.
        raise HTTPException(status_code=503, detail="OCR temporariamente indisponível.") from None
    finally:
        for image in images:
            image.fill(0)
