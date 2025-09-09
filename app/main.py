from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.logging import configure_logging  
from app.api.routes_jobs import router as jobs_router


settings = get_settings()
configure_logging(settings.debug)

app = FastAPI(
    title="TTS Reader",
    version="0.1.0",
    debug=settings.debug,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False, 
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- UI static serving ---
ui_dir = Path(__file__).resolve().parent.parent / "ui"
app.mount("/static", StaticFiles(directory=ui_dir), name="static")

@app.get("/", include_in_schema=False)
def serve_index():
    index_path = ui_dir / "index.html"
    return FileResponse(index_path)

# --- Routes ---
app.include_router(jobs_router, prefix="/v1/tts", tags=["tts"])
