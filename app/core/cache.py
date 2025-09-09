import json
import hashlib
import re
from pathlib import Path
from typing import Any, Dict, Optional


_INDEX_FILE = "index.json"


def _normalize_script(s: str) -> str:
    # remove ALL whitespace
    return re.sub(r"\s+", "", s, flags=re.UNICODE)


def _normalize_registry(registry: Dict[str, Any]) -> Dict[str, str]:
    """
    Works whether values are VoiceConfig objects or dicts.
    """
    slim = {
        str(role): str(cfg["name"] if isinstance(cfg, dict) else getattr(cfg, "name", ""))
        for role, cfg in registry.items()
    }
    
    if any(not v for v in slim.values()):
        missing = [r for r, v in slim.items() if not v]
        raise ValueError(f"registry missing for roles: {missing}")
    return dict(sorted(slim.items()))


def make_cache_key(script: str, registry: Dict[str, Any], model: str) -> str:
    payload = {
        "script": _normalize_script(script),
        "registry": _normalize_registry(registry),
        "model": model,
    }
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _index_path(cache_root: Path) -> Path:
    return cache_root / _INDEX_FILE


def load_index(cache_root: Path) -> Dict[str, Any]:
    p = _index_path(cache_root)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_index(cache_root: Path, idx: Dict[str, Any]) -> None:
    p = _index_path(cache_root)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(p)


def lookup_origin_job(cache_root: Path, key: str) -> Optional[str]:
    """
    Returns job_id if present in index; None otherwise.
    """
    idx = load_index(cache_root)
    entry = idx.get(key)
    if entry and isinstance(entry, dict):
        return entry.get("job_id")
    return None


def record_origin_job(cache_root: Path, key: str, job_id: str) -> None:
    """
    Writes/updates index: key -> job_id
    """
    idx = load_index(cache_root)
    idx[key] = {"job_id": job_id}
    save_index(cache_root, idx)
