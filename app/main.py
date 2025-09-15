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
    title="Voice Loom",
    version="0.1.0",
    debug=settings.debug,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routes ---
app.include_router(jobs_router, prefix="/v1/tts", tags=["tts"])

# --- UI static serving ---
ui_dist = Path(__file__).resolve().parents[1] / "ui" / "dist"
if ui_dist.exists():
    app.mount("/", StaticFiles(directory=ui_dist, html=True), name="ui")
    