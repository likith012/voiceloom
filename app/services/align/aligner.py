import re
import difflib
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple, Dict, Any

from faster_whisper import WhisperModel


def align_audio(
    *,
    audio_path: Path,
    script: str,   
    model_name: str,
    device: str,         
    compute_type: str,   
) -> Dict[str, Any]:
    """
    Return {"words": [{"w": str, "s": float, "e": float, "idx": int}, ...]}.
    """
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio not found: {audio_path}")

    ref_tokens = _normalize_and_tokenize(script)  
    if not ref_tokens:
        return {"words": []}

    asr_words = _transcribe_words( 
        audio_path=audio_path,
        model_name=model_name,
        device=device,
        compute_type=compute_type,
    )  

    # No ASR tokens: return monotonically increasing tiny spans
    if not asr_words:
        out = []
        t = 0.0
        dt = 0.01
        for i, tok in enumerate(ref_tokens):
            out.append({"w": tok, "s": t, "e": t + dt, "idx": i})
            t += dt
        return {"words": out}

    hyp_tokens = [w.word_norm for w in asr_words]

    sm = difflib.SequenceMatcher(a=hyp_tokens, b=ref_tokens, autojunk=False)
    ops = sm.get_opcodes()
    aligned = _assign_timings(ref_tokens, asr_words, ops)

    return {
        "words": [{"w": w.text, "s": w.start, "e": w.end, "idx": i} for i, w in enumerate(aligned)]
    }


# --- internals ---


@dataclass
class ASRWord:
    word_norm: str
    start: float
    end: float

@dataclass
class RefWordTimed:
    text: str
    start: float = 0.0
    end: float = 0.0


def _transcribe_words(
    *, audio_path: Path, model_name: str, device: str, compute_type: str
) -> List[ASRWord]:
    model = WhisperModel(model_name, device=device, compute_type=compute_type)
    segments, _ = model.transcribe(
        str(audio_path),
        vad_filter=True,
        word_timestamps=True,
        beam_size=1,
        language="en",  
    )

    out: List[ASRWord] = []
    for seg in segments:
        if not getattr(seg, "words", None):
            continue
        for w in seg.words:
            if w.start is None or w.end is None:
                continue
            tok = _normalize_word(w.word or "")
            if not tok:
                continue
            out.append(ASRWord(word_norm=tok, start=float(w.start), end=float(w.end)))

    _fix_monotonic(out)
    return out


def _assign_timings(
    ref_tokens: List[str],
    asr_words: List[ASRWord],
    ops: List[Tuple[str, int, int, int, int]],
) -> List[RefWordTimed]:
    out: List[RefWordTimed] = [RefWordTimed(text=t) for t in ref_tokens]
    N = len(asr_words)

    def asr_window(i1: int, i2: int) -> Tuple[float, float]:
        if i2 > i1:
            return asr_words[i1].start, asr_words[i2 - 1].end
        # interpolate between neighbors
        left = asr_words[i1 - 1].end if i1 - 1 >= 0 else None
        right = asr_words[i1].start if i1 < N else None
        if left is not None and right is not None and right > left:
            return left, right
        if left is not None:
            return left, left + 0.02
        if right is not None:
            return max(0.0, right - 0.02), right
        return 0.0, 0.02

    def assign_linear(j1: int, j2: int, t0: float, t1: float):
        count = max(1, j2 - j1)
        span = max(0.0, t1 - t0)
        if span <= 0:
            dt = 0.01
            cur = t0
            for j in range(j1, j2):
                out[j].start = cur
                out[j].end = cur + dt
                cur += dt
            return
        step = span / count
        cur = t0
        for j in range(j1, j2):
            s = cur
            e = t1 if j == j2 - 1 else (s + step)
            out[j].start = s
            out[j].end = max(e, s + 1e-3)
            cur = e

    for tag, i1, i2, j1, j2 in ops:
        if tag == "equal":
            k = i1
            for j in range(j1, j2):
                if k < N:
                    out[j].start = asr_words[k].start
                    out[j].end = asr_words[k].end
                else:
                    # no ASR left, place tiny span after last assigned
                    last = out[j - 1].end if j > j1 else (asr_words[-1].end if N else 0.0)
                    out[j].start = last
                    out[j].end = last + 0.01
                k += 1
        elif tag in ("replace", "insert"):
            t0, t1 = asr_window(i1, i2)
            assign_linear(j1, j2, t0, t1)
        elif tag == "delete":
            # ASR had extra tokens; nothing to do for reference
            continue

    _fix_ref_monotonic(out)
    return out


# --- normalization utils ---

_WS = re.compile(r"\s+")
_PAREN = re.compile(r"\([^)]*\)")
_PUNCT = re.compile(r"[^\w']+")

def _normalize_and_tokenize(text: str) -> List[str]:
    text = _PAREN.sub(" ", text)
    text = text.replace("…", "...").replace("’", "'").replace("‘", "'").lower()
    text = _WS.sub(" ", text).strip()
    toks_raw = text.split()
    toks: List[str] = []
    for t in toks_raw:
        cleaned = _PUNCT.sub(" ", t).strip()
        if cleaned:
            toks.extend([x for x in cleaned.split() if x])
    return toks

def _normalize_word(word: str) -> str:
    w = word.strip().replace("…", "...").replace("’", "'").replace("‘", "'").lower()
    w = _PUNCT.sub("", w)
    return w

def _fix_monotonic(words: List[ASRWord]) -> None:
    eps = 1e-3
    last = 0.0
    for w in words:
        if w.start < last - eps:
            w.start = last
        if w.end < w.start + eps:
            w.end = w.start + eps
        last = w.end

def _fix_ref_monotonic(refs: List[RefWordTimed]) -> None:
    eps = 1e-3
    last = 0.0
    for r in refs:
        if r.start < last - eps:
            r.start = last
        if r.end < r.start + eps:
            r.end = r.start + eps
        last = r.end
