import { useEffect, useMemo, useState } from "react";
import ScriptView from "./ScriptView";

type Word = { w: string; s: number; e: number; idx: number };

type Props = {
  uiScript: string;
  timingsUrl?: string; // optional; if missing, we just render the script
  currentTime?: number; // pass from Player onTime for live display
};

export default function SyncText({ uiScript, timingsUrl, currentTime }: Props) {
  const [words, setWords] = useState<Word[] | null>(null);

  useEffect(() => {
    let cancel = false;
    if (!timingsUrl) {
      setWords(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch(timingsUrl);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!cancel) setWords((data?.words as Word[]) ?? null);
      } catch {
        if (!cancel) setWords(null);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [timingsUrl]);

  const position = useMemo(() => {
    if (!words || !currentTime) return null;
    // Find nearest word by time; lightweight linear probe around previous would be better,
    // but this is simple and robust for now.
    let lo = 0,
      hi = words.length - 1,
      mid = 0;
    while (lo <= hi) {
      mid = (lo + hi) >> 1;
      if (words[mid].e < currentTime) lo = mid + 1;
      else if (words[mid].s > currentTime) hi = mid - 1;
      else break;
    }
    const w = words[mid];
    return w ? { idx: w.idx, w } : null;
  }, [words, currentTime]);

  return (
    <div className="space-y-3">
      {/* keep position computed for future highlight; reference to satisfy TS */}
      {position && <span className="hidden">{position.idx}</span>}
      {words && (
  <div className="text-xs text-base-content/60">
          {currentTime !== undefined ? `t=${currentTime.toFixed(2)}s` : null} ·
          {" "}aligned words: {words.length.toLocaleString()}
        </div>
      )}
      <ScriptView uiScript={uiScript} />
      {/* We’re not doing per-word highlighting against UI text here,
          because alignment text strips tags/cues; mapping is non-trivial.
          The time readout above still helps when scrubbing the audio. */}
    </div>
  );
}
