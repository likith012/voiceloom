// Parse UI script into lines with cues.
export type TextPart =
  | { type: "text"; value: string }
  | { type: "cue"; raw: string; display: string };

export interface UILine {
  /** Character name from the leading <Name> tag. */
  char: string | null;
  /** True when the line is a narrator line (char === "Narrator", case-insensitive). */
  isNarrator: boolean;
  /** Interleaved spoken text and action cues. */
  parts: TextPart[];
}

/**
 * Parse UI script into UILines.
 */
export function parseUIScript(uiScript: string): UILine[] {
  const lines: UILine[] = [];
  for (const raw of uiScript.split(/\r?\n/)) {
    const ln = raw.trim();
    if (!ln) continue;

  // Ignore optional engine tags; capture optional <Name> and body.
    const m = ln.match(/^(?:\[[^\]]+\]\s*)?(?:<([^>]+)>\s*)?(.*)$/);
    if (!m) continue;

    const char = (m[1]?.trim() ?? null) || null;
    const body = m[2] ?? "";

    const parts = splitTextAndCues(body);
    const isNarrator = char !== null && char.trim().toLowerCase() === "narrator";

    lines.push({ char, isNarrator, parts });
  }
  return lines;
}

/** Extract unique characters in order of first appearance (excluding null). */
export function collectCharacters(lines: UILine[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    if (!l.char) continue;
    const key = l.char.trim();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

/** Split a line body into spoken text and cue parts. */
function splitTextAndCues(body: string): TextPart[] {
  const parts: TextPart[] = [];
  const re = /\(([^)]*)\)/g;
  let idx = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(body))) {
    const start = m.index;
    const end = re.lastIndex;

    if (start > idx) {
      parts.push({ type: "text", value: body.slice(idx, start) });
    }

    const rawInner = (m[1] ?? "").trim();
    const display = humanizeCue(rawInner);
    parts.push({ type: "cue", raw: rawInner, display });

    idx = end;
  }

  if (idx < body.length) {
    parts.push({ type: "text", value: body.slice(idx) });
  }

  // Merge adjacent text
  return mergeAdjacentText(parts);
}

function humanizeCue(s: string): string {
  const trimmed = s.trim();
  // Convert UPPER_SNAKE_CASE cues to lowercase with spaces
  const isUpperSnake = /_/.test(trimmed) && /^[A-Z0-9_]+$/.test(trimmed);
  if (isUpperSnake) {
    return trimmed.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
  }
  // Otherwise preserve
  return trimmed;
}

function mergeAdjacentText(parts: TextPart[]): TextPart[] {
  const out: TextPart[] = [];
  for (const p of parts) {
    if (p.type === "text") {
      const prev = out[out.length - 1];
      if (prev && prev.type === "text") {
        prev.value += p.value;
      } else {
        out.push({ type: "text", value: p.value });
      }
    } else {
      out.push(p);
    }
  }
  return out;
}
