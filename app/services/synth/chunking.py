import base64
import concurrent.futures
import io
import logging
import re
import time
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from google import genai
from google.genai import types

from app.services.process.mastering import (
	parse_text,
	ScriptLine,
)

logger = logging.getLogger(__name__)

LINES_PER_CHUNK = 30


@dataclass
class ChunkResult:
	index: int
	wav_bytes: bytes


def _read_wav_params(wav_bytes: bytes) -> Tuple[int, int, int]:
	with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
		return wf.getnchannels(), wf.getsampwidth(), wf.getframerate()


def _concat_wavs(wavs: List[bytes], silence_ms: int = 150) -> bytes:
	if not wavs:
		return b""
	ch, sw, fr = _read_wav_params(wavs[0])
	silence_frames = int(fr * silence_ms / 1000)
	silence_bytes = (b"\x00" * sw * ch) * silence_frames
	out = io.BytesIO()
	with wave.open(out, "wb") as wf_out:
		wf_out.setnchannels(ch)
		wf_out.setsampwidth(sw)
		wf_out.setframerate(fr)
		for i, b in enumerate(wavs):
			with wave.open(io.BytesIO(b), "rb") as wf_in:
				if (wf_in.getnchannels(), wf_in.getsampwidth(), wf_in.getframerate()) != (ch, sw, fr):
					raise ValueError("Inconsistent WAV formats across chunks")
				frames = wf_in.readframes(wf_in.getnframes())
				wf_out.writeframes(frames)
			if i < len(wavs) - 1:
				wf_out.writeframes(silence_bytes)
	return out.getvalue()


def _find_first_header_index(text: str) -> Optional[int]:
	"""Return the byte index of the first known header or None if not found."""
	pat = re.compile(r"(?m)^(?:\s*STYLE DESCRIPTION:|\s*VOCAL DICTIONARY:|\s*SCRIPT:)\s*$")
	m = pat.search(text)
	return m.start() if m else None


def _split_sections_and_parse(script: str):
	"""Split into sections and parse.

	Returns (instructions, styles, vocals, lines[])
	"""
	idx = _find_first_header_index(script)
	instructions = script[:idx].strip() if idx is not None and idx > 0 else ""
	sectioned = script[idx:] if idx is not None else script

	doc = parse_text(sectioned)
	return instructions, doc.styles_raw, doc.vocals_raw, doc.lines


def _format_line_for_tts(line: ScriptLine) -> str:
	"""Reconstruct a script line in the canonical input format for TTS."""
	role = line.role.strip()
	prefix = f"[{role}] "
	char = (line.character or "").strip()
	if char:
		prefix += f"<{char}> "
	return f"{prefix}{line.text.strip()}".strip()


def _group_lines_into_chunks(lines: List[ScriptLine], lines_per_chunk: int) -> List[List[str]]:
	"""Group formatted lines into fixed-size chunks by line count."""
	formatted: List[str] = []
	for line in lines:
		s = _format_line_for_tts(line)
		if s:
			formatted.append(s)

	if not formatted:
		return []

	# Chunk by count
	chunks: List[List[str]] = [
		formatted[i:i + lines_per_chunk] for i in range(0, len(formatted), lines_per_chunk)
	]

	# Merge small tail into previous
	if len(chunks) >= 2 and len(chunks[-1]) < (lines_per_chunk // 2):
		chunks[-2].extend(chunks[-1])
		chunks.pop()

	return chunks


def _build_chunk_payload(
		instructions: str,
		styles: str,
		vocals: str,
		script_lines: List[str],
) -> str:
	parts: List[str] = []
	if instructions:
		parts.append(instructions.strip())
	if styles.strip():
		parts.append("STYLE DESCRIPTION:")
		parts.append(styles.strip())
	if vocals.strip():
		parts.append("VOCAL DICTIONARY:")
		parts.append(vocals.strip())
  
	parts.append("SCRIPT:")
	parts.append("\n".join(script_lines).strip())
	return "\n\n".join(parts).strip()


def _extract_inline_audio(resp) -> Tuple[Optional[bytes], Optional[str]]:
	for cand in getattr(resp, "candidates", []) or []:
		content = getattr(cand, "content", None)
		parts = getattr(content, "parts", []) if content else []
		for p in parts:
			inline = getattr(p, "inline_data", None) or getattr(p, "inlineData", None)
			if not inline:
				continue
			mime: Optional[str] = getattr(inline, "mime_type", None) or getattr(inline, "mimeType", None)
			data = getattr(inline, "data", None)
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


def synthesize_chunked(
	script: str,
	registry: Dict[str, Any],
	output_dir: Path,
	output_basename: str,
	google_api_key: str,
	tts_model: str,
	request_timeout_sec: int = 900,
	max_workers: int = 5,
	silence_ms: int = 150,
) -> Path:
	"""Chunk the script, synthesize in parallel and then merge.

	- Replicates STYLE DESCRIPTION and VOCAL DICTIONARY per chunk.
	- Concatenates WAVs losslessly; wraps PCM as needed.
	- Inserts a short silence between chunks (default 150 ms) to improve naturalness.
	"""

	if not google_api_key:
		raise RuntimeError("Missing GOOGLE_API_KEY")

	# 1) Extract sections
	instructions, styles, vocals, lines = _split_sections_and_parse(script)
	line_chunks = _group_lines_into_chunks(lines, lines_per_chunk=LINES_PER_CHUNK)
	if not line_chunks:
		raise ValueError("Empty script after parsing")

	# 3) Prepare client, multi-speaker config, and payloads
	client = genai.Client(api_key=google_api_key)

	roles: List[str] = list(registry.keys())
	if len(roles) < 1:
		raise ValueError("registry must contain at least one role.")

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

	payloads: List[str] = []
	for chunk_lines in line_chunks:
		payloads.append(
			_build_chunk_payload(
				instructions=instructions,
				styles=styles or "",
				vocals=vocals or "",
				script_lines=chunk_lines,
			)
		)

	# 4) Parallel synth
	results: List[ChunkResult] = []

	def _one_pass(i: int, payload: str) -> ChunkResult:
		t0 = time.time()
		resp = client.models.generate_content(
			model=tts_model,
			contents=[payload],
			config=types.GenerateContentConfig(
				response_modalities=["AUDIO"],
				speech_config=speech_config,
			),
		)
		audio_bytes, mime = _extract_inline_audio(resp)
		if not audio_bytes:
			raise RuntimeError(f"No audio returned for chunk {i}")

		m = (mime or "").lower()
		if "wav" in m:
			wav_bytes = audio_bytes
		else:
			tmp = io.BytesIO()
			with wave.open(tmp, "wb") as wf:
				wf.setnchannels(1)
				wf.setsampwidth(2)
				wf.setframerate(24000)
				wf.writeframes(audio_bytes)
			wav_bytes = tmp.getvalue()
		dt = time.time() - t0
		if logger.isEnabledFor(logging.INFO):
			logger.info(f"Chunk {i} synthesized in {dt:.2f}s, bytes={len(wav_bytes)}")
		return ChunkResult(index=i, wav_bytes=wav_bytes)

	with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
		futs = [ex.submit(_one_pass, i, p) for i, p in enumerate(payloads)]
		for fut in concurrent.futures.as_completed(futs):
			results.append(fut.result())

	# 5) Merge 
	results.sort(key=lambda r: r.index)
	merged = _concat_wavs([r.wav_bytes for r in results], silence_ms=silence_ms)

	output_dir.mkdir(parents=True, exist_ok=True)
	out_path = output_dir / f"{output_basename}.wav"
	out_path.write_bytes(merged)
	return out_path
