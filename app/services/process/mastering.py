import re
from dataclasses import dataclass
from typing import List, Tuple


# ---------- Data types ----------

@dataclass
class ScriptLine:
    role: str
    text: str                     # full spoken text (may contain inline () cues)
    simple_cues: List[str]        # lower-case () cues
    control_cues: List[str]       # UPPER_SNAKE_CASE () cues

@dataclass
class ParsedDoc:
    styles_raw: str               # after "STYLE DESCRIPTION:"
    actions_raw: str              # after "ACTION DICTIONARY:"
    lines: List[ScriptLine]       # ordered speaker turns


# ---------- Section parsing ----------

_STYLE_HDR = re.compile(r"^\s*STYLE DESCRIPTION:\s*$", re.IGNORECASE)
_ACTION_HDR = re.compile(r"^\s*ACTION DICTIONARY:\s*$", re.IGNORECASE)
_SCRIPT_HDR = re.compile(r"^\s*SCRIPT:\s*$", re.IGNORECASE)

# script line: [Role] utterance
_ROLE_LINE = re.compile(r"^\s*\[(?P<role>[^\]]+)\]\s*(?P<text>.*)$")

# inline cues: (...)
_PAREN_GROUP = re.compile(r"\(([^)]*)\)")

def parse_text(text: str) -> ParsedDoc:
    """
    Parse the doc with headings:
      STYLE DESCRIPTION:
      ACTION DICTIONARY:
      SCRIPT:
    Only SCRIPT is required. Each script line must be "[Role] utterance".
    """
    style_block, action_block, script_block = _split_sections(text)

    lines: List[ScriptLine] = []
    for raw in _to_nonempty_lines(script_block):
        m = _ROLE_LINE.match(raw)
        if not m:
            # strictly enforce your spec; if a line doesn't match, skip it
            # (or raise ValueError if you prefer hard failure)
            continue
        role = m.group("role").strip()
        utter = m.group("text").strip()

        # Extract inline cues
        simple, control = _classify_cues(utter)

        # We keep the original utterance for TTS, but when we build UI/alignment
        # we will remove parentheses content as needed.
        lines.append(ScriptLine(role=role, text=utter, simple_cues=simple, control_cues=control))

    return ParsedDoc(styles_raw=style_block, actions_raw=action_block, lines=lines)


def _split_sections(text: str) -> Tuple[str, str, str]:
    lines = text.splitlines()
    idx_style = idx_action = idx_script = None
    for i, ln in enumerate(lines):
        if idx_style is None and _STYLE_HDR.match(ln):
            idx_style = i
        elif idx_action is None and _ACTION_HDR.match(ln):
            idx_action = i
        elif idx_script is None and _SCRIPT_HDR.match(ln):
            idx_script = i

    if idx_script is None:
        raise ValueError("SCRIPT: section is required")

    # slice blocks
    def block(start: int | None, end: int | None) -> str:
        if start is None:
            return ""
        # skip the header line (STYLE DESCRIPTION) itself
        start += 1
        if end is None:
            end = len(lines)
        return "\n".join(lines[start:end]).strip()

    # ensures sections don’t run into each other.
    next_after_style = min([i for i in [idx_action, idx_script] if i is not None], default=len(lines))
    next_after_action = idx_script if idx_script is not None else len(lines)

    # extract blocks
    style_block = block(idx_style, next_after_style) if idx_style is not None else ""
    action_block = block(idx_action, next_after_action) if idx_action is not None else ""
    script_block = block(idx_script, None)

    return style_block, action_block, script_block


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
        if inner.upper() == inner and re.fullmatch(r"[A-Z0-9_]+", inner):
            control.append(inner)
        else:
            simple.append(inner)
    return simple, control


# ---------- Formatters ----------

# remove all (...) cues
_PAREN_STRIP = re.compile(r"\([^)]*\)")

# remove leading [Role]
_ROLE_TAG = re.compile(r"^\s*\[[^\]]+\]\s*")


def build_ui_script(doc: ParsedDoc) -> str:
    """
    Input to the UI layer.
      - Drop STYLE DESCRIPTION and ACTION DICTIONARY sections entirely.
      - Keep speaker tag lines: [Role] utterance
    """
    out_lines: List[str] = []
    for line in doc.lines:
        if line.text.strip():
            out_lines.append(f"[{line.role}] {line.text.strip()}")
    return "\n".join(out_lines).strip()


def build_alignment_text_from_ui(ui_script: str) -> str:
    """
    Input for alignment model. 
      - Remove [Role] tags
      - Remove () cues
      - Collapse whitespace
    """
    lines: List[str] = []
    for raw in ui_script.splitlines():
        txt = _ROLE_TAG.sub("", raw)          # remove [Role]
        txt = _PAREN_STRIP.sub("", txt)       # remove cues
        txt = re.sub(r"\s+", " ", txt).strip()
        if txt:
            lines.append(txt)
    return "\n".join(lines).strip()
