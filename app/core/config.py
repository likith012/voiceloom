import os
from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel
from dotenv import load_dotenv


load_dotenv(override=False)


class Settings(BaseModel):
    # --- Server ---
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"

    # --- Google ---
    google_api_key: str = os.getenv("GOOGLE_API_KEY", "")
    tts_model: str = os.getenv("TTS_MODEL", "gemini-2.5-flash-preview-tts")
    
    # --- TTS Instructions ---
    use_instructions: bool = os.getenv("USE_INSTRUCTIONS", "false").lower() == "true"
    instructions_filename: str = os.getenv("INSTRUCTIONS_FILENAME", "instructions.txt")

    # --- Dev Storage ---
    data_dir: Path = Path(os.getenv("DATA_DIR", "./data")).resolve()
    jobs_dirname: str = os.getenv("JOBS_DIRNAME", "jobs")
    cache_dirname: str = os.getenv("CACHE_DIRNAME", "cache")

    # --- Alignment ---
    whisper_model: str = os.getenv("WHISPER_MODEL", "tiny.en")
    whisper_device: str = os.getenv("WHISPER_DEVICE", "auto")  # "cpu", "cuda", or "auto"
    whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")  # "int8" or "float16"

    # --- Limits & Timeouts ---
    max_text_chars: int = int(os.getenv("MAX_TEXT_CHARS", "120000"))  # ~20k words
    request_timeout_sec: int = int(os.getenv("REQUEST_TIMEOUT_SEC", "900"))  

    # --- Tunneling ---
    tunnel_provider: Literal["ngrok", "none"] = os.getenv("TUNNEL_PROVIDER", "ngrok")
    share_token: Optional[str] = os.getenv("SHARE_TOKEN") or None

    @property
    def jobs_path(self) -> Path:
        return self.data_dir / self.jobs_dirname

    @property
    def cache_path(self) -> Path:
        return self.data_dir / self.cache_dirname
    
    @property
    def instructions_path(self) -> Path:
        return Path(__file__).resolve().parents[1] / "config" / self.instructions_filename

    def ensure_dirs(self) -> None:
        """Create directories if they don't exist."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.jobs_path.mkdir(parents=True, exist_ok=True)
        self.cache_path.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Global accessor for application settings."""
    settings = Settings()
    settings.ensure_dirs()
    return settings
