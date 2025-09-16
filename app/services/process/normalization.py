import re
from typing import Dict, List


DE_DIALECT_MAP: Dict[str, str] = {
    # h-dropping pronouns 
    "'e": "he",
    "'im": "him",
    "'is": "his",
    "'er": "her",
    "'ers": "hers",
    "'em": "them",
    "'ave": "have",
    "'ad": "had",
    "'as": "has",
    "'adn't": "hadn't",
    "'aven't": "haven't",
    "'asn't": "hasn't",

    # h-dropping words
    "'ouse": "house",
    "'all": "hall",
    "'and": "hand",
    "'ands": "hands",
    "'andful": "handful",
    "'air": "hair",
    "'ead": "head",
    "'eart": "heart",
    "'ard": "hard",
    "'ardly": "hardly",
    "'ungry": "hungry",
    "'onest": "honest",
    "'ours": "hours",
    "'istory": "history",
    "'oliday": "holiday",
    "'ospital": "hospital",
    "'orrible": "horrible",
    "'urry": "hurry",
    "'urts": "hurts",

    # colloquial conjunction
    "an'": "and",

    # g-dropping
    "nothin'": "nothing",
    "somethin'": "something",
    "everythin'": "everything",
    "anythin'": "anything",
    "goin'": "going",
    "comin'": "coming",
    "doin'": "doing",
    "makin'": "making",
    "sayin'": "saying",
    "thinkin'": "thinking",
    "talkin'": "talking",
    "lookin'": "looking",
    "watchin'": "watching",
    "breathin'": "breathing",
    "livin'": "living",
    "burnin'": "burning",
    "workin'": "working",
    "waitin'": "waiting",
    "walkin'": "walking",
    "runnin'": "running",
    "turnin'": "turning",
    "openin'": "opening",
    "closin'": "closing",
}


_PAREN_GROUP = re.compile(r"\([^)]*\)")
_SMART_APOS_RE = re.compile(r"[’‘]")
_LEADING_ALPHA_RE = re.compile(r"^([^A-Za-z]*)([a-z])")
_LINE_RE = re.compile(r"^\s*<([^>]+)>\s*(.*)$")
_SENTENCE_START_RE = re.compile(
    r"((?:(?<!\.)[.!?]|\.{3}|…)\s*(?:[\"'”’\)\]]*)\s+)([\"'“‘\(\[]*)([a-z])"
)

def _ascii_apostrophes(s: str) -> str:
    return _SMART_APOS_RE.sub("'", s)


def _stage_a_pattern(keys: List[str]) -> re.Pattern[str]:
    ordered = sorted(keys, key=len, reverse=True)
    inner = "|".join(map(re.escape, ordered))
    pattern = r"(^|(?<![A-Za-z]))(?:" + inner + r")(?![A-Za-z])"
    return re.compile(pattern, flags=re.IGNORECASE)


_STAGE_A_RE = _stage_a_pattern(list(DE_DIALECT_MAP.keys()))
_H_INSERT_RE = re.compile(r"(^|(?<![A-Za-z]))'(?=[aeiou])", flags=re.IGNORECASE)
_G_DROP_FIX_RE = re.compile(r"(\b\w+?)in'(?![A-Za-z])")  


def _stage_a(seg: str) -> str:
    def repl(m: re.Match[str]) -> str:
        left = m.group(1) or ""
        token = seg[m.start(0) + len(left):m.end(0)]
        val = DE_DIALECT_MAP.get(token.lower())
        return left + (val if val is not None else token)

    return _STAGE_A_RE.sub(repl, seg)


def _stage_b(seg: str) -> str:
    seg = _H_INSERT_RE.sub(r"\1h", seg)
    seg = _G_DROP_FIX_RE.sub(r"\1ing", seg)
    return seg


def _normalize(text: str) -> str:
    text = _ascii_apostrophes(text)
    out_parts: List[str] = []
    pos = 0
    for m in _PAREN_GROUP.finditer(text):
        pre = text[pos:m.start()]
        if pre:
            pre = _stage_b(_stage_a(pre))
        out_parts.append(pre)
        out_parts.append(m.group(0))  
        pos = m.end()
    tail = text[pos:]
    if tail:
        tail = _stage_b(_stage_a(tail))
    out_parts.append(tail)
    return "".join(out_parts)


def _capitalize(text: str) -> str:
    def cap_leading(seg: str) -> str:
        m = _LEADING_ALPHA_RE.match(seg)
        if m:
            prefix, ch = m.group(1), m.group(2)
            seg = prefix + ch.upper() + seg[m.end():]
        return _SENTENCE_START_RE.sub(lambda mm: mm.group(1) + mm.group(2) + mm.group(3).upper(), seg)

    out_parts: List[str] = []
    pos = 0
    for pm in _PAREN_GROUP.finditer(text):
        pre = text[pos:pm.start()]
        if pre:
            pre = cap_leading(pre)
        out_parts.append(pre)
        out_parts.append(pm.group(0))
        pos = pm.end()
    tail = text[pos:]
    if tail:
        tail = cap_leading(tail)
    out_parts.append(tail)
    return "".join(out_parts)


def apply_de_dialect(ui_script: str) -> str:
    """
    Transform only lines with <Narrator>.
    """
    out_lines: List[str] = []
    for raw in ui_script.splitlines():
        m = _LINE_RE.match(raw)
        if not m:
            out_lines.append(raw)
            continue
        label, text = m.group(1), m.group(2)
        if (label or "").strip() == "Narrator":
            norm = _normalize(text)
            norm = _capitalize(norm)
            out_lines.append(f"<{label}> {norm}".rstrip())
        else:
            out_lines.append(raw)
    return "\n".join(out_lines)
