from pathlib import Path
from typing import Optional

from app.config.config import get_settings


def _read(path: Path) -> Optional[str]:
    if path.exists():
        txt = path.read_text(encoding="utf-8").strip()
        return txt or None
    return None


def load_tts_instructions() -> Optional[str]:
    """Respects Settings.use_instructions. Returns None if disabled or file not found."""
    s = get_settings()
    if not s.use_instructions:
        return None

    return _read(s.instructions_path)

def prepend_tts_instructions(script: str) -> str:
    instr = load_tts_instructions()
    if not instr:
        return script
    return f"{instr}\n{script}"
