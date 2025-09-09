import yaml 
from pathlib import Path
from typing import List

from app.domain.schemas import VoiceConfig, SpeakerRegistry

def _load_full_registry(path: Path) -> SpeakerRegistry:
    if not path.exists():
        raise FileNotFoundError(f"speaker registry not found: {path}")
    if path.suffix.lower() not in (".yml", ".yaml"):
        raise ValueError(f"unsupported registry format: {path.suffix} (use .yml or .yaml)")

    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ValueError("invalid registry file: expected mapping of role -> config")

    reg: SpeakerRegistry = {}
    for role, cfg in data.items():
        if not isinstance(cfg, dict) or "name" not in cfg:
            raise ValueError(f"invalid config for role '{role}': expected mapping with a 'name' field")
        reg[str(role)] = VoiceConfig(**cfg)
    if not reg:
        raise ValueError(f"empty registry in file: {path}")
    return reg

def resolve_registry(required_roles: List[str], *, search_paths: List[Path]) -> SpeakerRegistry:
    """Read the first available YAML registry, then return only the entries for `required_roles`."""
    if not required_roles:
        raise ValueError("no roles provided; Client must send at least one role")
    
    full: SpeakerRegistry | None = None
    for p in search_paths:
        if p.exists():
            full = _load_full_registry(p)
            break
    if full is None:
        raise FileNotFoundError("No registry file found. Provide voices.yml or voices.yaml at ./app/config.")

    missing = [r for r in required_roles if r not in full]
    if missing:
        raise ValueError(f"missing roles in registry: {', '.join(missing)}")

    return {r: full[r] for r in required_roles}
