import re
from dataclasses import dataclass
from typing import List, Tuple, Optional


# ---------- Data types ----------

@dataclass
class ScriptLine:
    role: str                     # Voice-engine role
    character: Optional[str]      # Character label
    text: str                     # full spoken text (may contain inline () cues)
    simple_cues: List[str]        # lower-case () cues
    control_cues: List[str]       # UPPER_SNAKE_CASE () cues

@dataclass
class ParsedDoc:
    styles_raw: str               # after "STYLE DESCRIPTION:"
    vocals_raw: str               # after "VOCAL DICTIONARY:"
    lines: List[ScriptLine]       # ordered speaker turns


# ---------- Section parsing ----------

_STYLE_HDR = re.compile(r"^\s*STYLE DESCRIPTION:\s*$", re.IGNORECASE)
_VOCAL_HDR = re.compile(r"^\s*VOCAL DICTIONARY:\s*$", re.IGNORECASE)
_SCRIPT_HDR = re.compile(r"^\s*SCRIPT:\s*$", re.IGNORECASE)

# script line: [EngineRole] (optional <Character>) utterance...
_ROLE_LINE = re.compile(
    r"""^\s*\[
        (?P<role>[^\]]+)
      \]\s*
      (?:<(?P<char>[^>]+)>\s*[:\-]?\s*)?
      (?P<text>.*)$
    """,
    re.VERBOSE,
)

# inline cues: (...)
_PAREN_GROUP = re.compile(r"\(([^)]*)\)")

def parse_text(text: str) -> ParsedDoc:
    """
        Parse the doc with headings:
            STYLE DESCRIPTION:
            VOCAL DICTIONARY:
            SCRIPT:
    Only SCRIPT is required. Each script line must be "[Role] utterance".
    """
    style_block, vocal_block, script_block = _split_sections(text)

    lines: List[ScriptLine] = []
    for raw in _to_nonempty_lines(script_block):
        m = _ROLE_LINE.match(raw)
        if not m:
            # skip lines that don't conform
            continue

        role = (m.group("role") or "").strip()
        char = (m.group("char") or "").strip() or None
        utter = (m.group("text") or "").strip()

        simple, control = _classify_cues(utter)

        lines.append(
            ScriptLine(
                role=role,
                character=char,
                text=utter,
                simple_cues=simple,
                control_cues=control,
            )
        )

    return ParsedDoc(styles_raw=style_block, vocals_raw=vocal_block, lines=lines)


def _split_sections(text: str) -> Tuple[str, str, str]:
    lines = text.splitlines()
    idx_style = idx_vocal = idx_script = None

    for i, ln in enumerate(lines):
        if idx_style is None and _STYLE_HDR.match(ln):
            idx_style = i
        elif idx_vocal is None and _VOCAL_HDR.match(ln):
            idx_vocal = i
        elif idx_script is None and _SCRIPT_HDR.match(ln):
            idx_script = i

    if idx_script is None:
        raise ValueError("SCRIPT: section is required")

    def block(start: Optional[int], end: Optional[int]) -> str:
        """
        Return text between header (exclusive) and 'end' (exclusive).
        """
        if start is None:
            return ""
        start += 1  # skip the header line itself
        if end is None:
            end = len(lines)
        return "\n".join(lines[start:end]).strip()

    # ensures sections don’t run into each other.
    next_after_style = min(
        [i for i in (idx_vocal, idx_script) if i is not None],
        default=len(lines),
    )
    next_after_vocal = idx_script if idx_script is not None else len(lines)

    # extract blocks
    style_block = block(idx_style, next_after_style) if idx_style is not None else ""
    vocal_block = block(idx_vocal, next_after_vocal) if idx_vocal is not None else ""
    script_block = block(idx_script, None)

    return style_block, vocal_block, script_block


def _to_nonempty_lines(block: str) -> List[str]:
    return [ln for ln in (block.splitlines()) if ln.strip()]


def _classify_cues(utter: str) -> Tuple[List[str], List[str]]:
    """
    Separate lower-case 'simple' cues from UPPER_SNAKE_CASE 'control' cues.
    """
    simple, control = [], []
    for m in _PAREN_GROUP.finditer(utter):
        inner = (m.group(1) or "").strip()
        if not inner:
            continue
        if re.fullmatch(r"[A-Z0-9_]+", inner):
            control.append(inner)
        else:
            simple.append(inner)
    return simple, control


# ---------- Formatters ----------

# remove all (...) cues
_PAREN_STRIP = re.compile(r"\([^)]*\)")

# remove leading [Role]
_ROLE_TAG = re.compile(r"^\s*\[[^\]]+\]\s*")

# Remove leading <Character> 
_CHAR_TAG = re.compile(r"^\s*<[^>]+>\s*[:\-]?\s*")


def build_ui_script(doc: ParsedDoc) -> str:
    """
    Input to the UI layer.
      - Drop STYLE DESCRIPTION and VOCAL DICTIONARY sections entirely.
      - Remove engine roles [Role].
      - Prefer <Character> for display; if missing, fall back to <role>.
      - Preserve inline cues (...) so users can see expressive guidance.
    """
    out_lines: List[str] = []
    for line in doc.lines:
        if not line.text.strip():
            continue
        display_name = line.character or line.role
        out_lines.append(f"<{display_name}> {line.text.strip()}")
    return "\n".join(out_lines).strip()


def build_alignment_text_from_ui(ui_script: str) -> str:
    """
    Build text for alignment:
      - Remove <Character> display tags (if present).
      - Remove all (...) cues.
      - Collapse whitespace.
      - Result is plain spoken text aligned to audio.
    """
    lines: List[str] = []
    for raw in ui_script.splitlines():
        txt = _ROLE_TAG.sub("", raw)
        txt = _CHAR_TAG.sub("", txt)
        txt = _PAREN_STRIP.sub("", txt)
        txt = re.sub(r"\s+", " ", txt).strip()
        if txt:
            lines.append(txt)
    return "\n".join(lines).strip()
