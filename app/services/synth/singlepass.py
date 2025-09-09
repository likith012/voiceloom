import base64
import wave
from pathlib import Path
from functools import lru_cache
from typing import Dict, Any, List, Optional, Tuple, Union

from google import genai
from google.genai import types

@lru_cache(maxsize=1)
def _get_client(api_key: str) -> genai.Client:
    return genai.Client(api_key=api_key) # Reuse HTTP pool/TLS; useful for multiple jobs.

def synthesize_single_pass(
    *,
    script: str,
    registry: Dict[str, Any],   
    output_dir: Path,
    output_basename: str,
    google_api_key: str,
    tts_model: str,             
    request_timeout_sec: int,
) -> Path:
    """
    Generate audio in a single pass (single- or multi-speaker).
    """
    if not google_api_key:
        raise RuntimeError("Missing GOOGLE_API_KEY")

    roles: List[str] = list(registry.keys())
    if len(roles) < 1:
        raise ValueError("registry must contain at least one role.")

    client = _get_client(google_api_key)

    # Build MultiSpeakerVoiceConfig for 1..N roles
    speaker_cfgs: List[types.SpeakerVoiceConfig] = []
    for role in roles:
        vc = registry[role]
        voice_name = vc["name"] if isinstance(vc, dict) else getattr(vc, "name", None)
        if not voice_name:
            raise ValueError(f"voice name missing for role '{role}'")
        speaker_cfgs.append(
            types.SpeakerVoiceConfig(
                speaker=role,
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
                ),
            )
        )

    speech_config = types.SpeechConfig(
        multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
            speaker_voice_configs=speaker_cfgs
        )
    )

    resp = client.models.generate_content(
        model=tts_model,
        contents=[script],
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=speech_config,
        ),
    )

    audio_bytes, mime = _extract_inline_audio(resp)
    if not audio_bytes:
        raise RuntimeError("TTS model returned no inline audio payload.")

    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / f"{output_basename}.wav"

    m = (mime or "").lower()
    if "wav" in m:
        out_path.write_bytes(audio_bytes)
    else:
        _write_wav_24k_mono16(out_path, audio_bytes)

    return out_path


def _extract_inline_audio(resp) -> Tuple[Optional[bytes], Optional[str]]:
    """
    - Some SDK builds return bytes; some return base64 string.
    - We check `inline_data.mime_type` to decide WAV vs PCM handling.
    """
    for cand in getattr(resp, "candidates", []) or []:
        content = getattr(cand, "content", None)
        parts = getattr(content, "parts", []) if content else []
        
        for p in parts:
            inline = getattr(p, "inline_data", None) or getattr(p, "inlineData", None)
            if not inline:
                continue
            mime: Optional[str] = getattr(inline, "mime_type", None) or getattr(inline, "mimeType", None)
            data: Union[bytes, bytearray, str, None] = getattr(inline, "data", None)
            if data is None:
                continue
            if isinstance(data, (bytes, bytearray)):
                return bytes(data), mime
            if isinstance(data, str):
                try:
                    return base64.b64decode(data), mime
                except Exception:
                    return None, mime
    return None, None


def _write_wav_24k_mono16(path: Path, pcm: bytes) -> None:
    """Wrap raw PCM s16le @ 24 kHz mono into a WAV container."""
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)        # mono
        wf.setsampwidth(2)        # 16-bit PCM => 2 bytes
        wf.setframerate(24000)    # 24 kHz
        wf.writeframes(pcm)