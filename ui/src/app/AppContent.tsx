import { useMemo, useState, useCallback, useRef } from "react";
import { Header } from "../components/Header.tsx";
import { Footer } from "../components/Footer.tsx";
import { TTSInput } from "../components/TTSInput.tsx";
import { FormattedTextDisplay } from "../components/FormattedTextDisplay.tsx";
import { AudioPlayer } from "../components/AudioPlayer.tsx";
import { motion, AnimatePresence } from "motion/react";
import { parseUIScript, type UILine } from "../lib/tokenize.ts";

interface Word {
  text: string;
  startTime: number;
  endTime: number;
  character?: string;
}

interface TTSResult {
  audioUrl: string;
  words: Word[];
  duration: number;
  displayLines: DisplayLine[];
}

type JobState =
  | "PENDING"
  | "SYNTHESIZING"
  | "ALIGNING"
  | "READY"
  | "FAILED";

// API types
interface JobCreateResponse { jobId: string }
interface JobStatusResponse { id: string; state: JobState; error?: string | null; createdAt: number; updatedAt: number }
interface ManifestResponse { audioUrl: string; timingsUrl: string; script: string }
interface WordTiming { w: string; s: number; e: number; idx: number }
interface TimingsResponse { words: WordTiming[] }

// Utility
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Extract role names from SCRIPT section
function extractRoles(structuredText: string): string[] {
  const script = structuredText.split("SCRIPT:")[1] ?? structuredText;
  const roles = new Set<string>();
  for (const line of script.split("\n")) {
    const m = line.match(/^\s*\[([^\]]+)]/);
    if (m) roles.add(m[1].trim());
  }
  return Array.from(roles);
}

// Normalize role names to Title_Case_With_Underscores
function normalizeRoleName(raw: string): string {
  let s = (raw ?? "").trim();
  if ((s.startsWith("\"") && s.endsWith("\"")) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  } else {
    s = s.replace(/^['\"]+/, "").replace(/['\"]+$/, "");
  }
  s = s.replace(/[\s\-]+/g, "_");
  s = s.replace(/[^A-Za-z0-9_]/g, "");
  s = s.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (!s) return s;
  const parts = s.split("_").map((p) => p ? (p[0].toUpperCase() + p.slice(1).toLowerCase()) : p);
  return parts.join("_");
}

function normalizeRoles(roles: string[]): string[] {
  const out = new Set<string>();
  for (const r of roles) {
    const n = normalizeRoleName(r);
    if (n) out.add(n);
  }
  return Array.from(out);
}

// Display model for script + cues
interface DisplayTextPartCue { type: "cue"; display: string }
interface DisplayTextPartText { type: "text"; startIndex: number; length: number; tokens: string[] }
type DisplayTextPart = DisplayTextPartCue | DisplayTextPartText;
export interface DisplayLine {
  character: string;
  isNarrator: boolean;
  parts: DisplayTextPart[];
  startIndex: number;
  length: number;
}

// Build words and display lines
function buildDisplayFrom(manifestScript: string, timings: WordTiming[]): { words: Word[]; displayLines: DisplayLine[] } {
  const uiLines: UILine[] = parseUIScript(manifestScript);

  // Flatten UI tokens, preserve segmentation
  type FlatToken = { token: string; character: string };
  const flatTokens: FlatToken[] = [];
  const displayLines: DisplayLine[] = [];

  for (const ln of uiLines) {
    const character = ln.char ?? "Narrator";
    const isNarrator = ln.isNarrator || character.trim().toLowerCase() === "narrator";

    const parts: DisplayTextPart[] = [];
    const lineStart = flatTokens.length;
    let lineWordCount = 0;

    for (const p of ln.parts) {
      if (p.type === "cue") {
        parts.push({ type: "cue", display: p.display });
        continue;
      }
      const tokens = p.value
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (tokens.length > 0) {
        parts.push({ type: "text", startIndex: flatTokens.length, length: tokens.length, tokens });
        for (const tok of tokens) {
          flatTokens.push({ token: tok, character });
        }
        lineWordCount += tokens.length;
      }
    }

    displayLines.push({
      character,
      isNarrator,
      parts,
      startIndex: lineStart,
      length: lineWordCount,
    });
  }


  // Map UI tokens to backend timings
  const tokenCount = flatTokens.length;
  const timingCount = timings.length;
  const count = Math.min(tokenCount, timingCount);

  // Clamp if counts differ
  if (tokenCount !== timingCount) {
    if (import.meta.env.DEV) {
      console.warn(
        `Token/timing length mismatch: uiTokens=${tokenCount} timings=${timingCount}. Clamping to ${count}.`,
      );
    }
  }

  const words: Word[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const ft = flatTokens[i];
    const t = timings[i];
    words[i] = {
      text: ft.token,
      startTime: t.s,
      endTime: t.e,
      character: ft.character,
    };
  }

  // Shrink display parts if clamped
  if (count < tokenCount) {
    for (const line of displayLines) {
      const newParts: DisplayTextPart[] = [];
      let newLen = 0;
      for (const part of line.parts) {
        if (part.type === "cue") { newParts.push(part); continue; }
        if (part.startIndex >= count) continue; // entirely beyond range
        const maxLen = Math.max(0, Math.min(part.length, count - part.startIndex));
        if (maxLen <= 0) continue;
        if (maxLen === part.length) {
          newParts.push(part);
          newLen += part.length;
        } else {
          newParts.push({ type: "text", startIndex: part.startIndex, length: maxLen, tokens: part.tokens.slice(0, maxLen) });
          newLen += maxLen;
        }
      }
      (line as any).parts = newParts;
      (line as any).length = newLen;
    }
  }

  return { words, displayLines };
}

export default function AppContent() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInputCollapsed, setIsInputCollapsed] =
    useState(false);
  const [ttsResult, setTtsResult] = useState<TTSResult | null>(
    null,
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [seekRequest, setSeekRequest] = useState<{ time: number; token: number } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobState, setJobState] = useState<JobState | null>(
    null,
  );
  // Character color mapping
  const [characterColors, setCharacterColors] = useState<Record<string, string>>({
    Narrator: "from-slate-500 to-slate-600",
  });

  const gradients = useMemo(
    () => [
      "from-blue-500 to-blue-600",
      "from-rose-500 to-pink-600",
      "from-emerald-500 to-green-600",
      "from-purple-500 to-violet-600",
      "from-amber-500 to-orange-600",
      "from-pink-500 to-rose-600",
      "from-cyan-500 to-sky-600",
      "from-lime-500 to-emerald-600",
      "from-fuchsia-500 to-pink-600",
      "from-indigo-500 to-blue-600",
    ],
    [],
  );

  function assignCharacterColors(words: Word[]) {
    const names = Array.from(
      new Set(words.map((w) => w.character).filter(Boolean)),
    ) as string[];
    const result: Record<string, string> = { Narrator: "from-slate-500 to-slate-600" };
    let gi = 0;
    for (const name of names) {
      if (name === "Narrator") continue;
      if (!result[name]) {
        result[name] = gradients[gi % gradients.length];
        gi++;
      }
    }
    setCharacterColors(result);
  }

  // API flow: create job -> poll -> fetch manifest/timings -> map
  const processTTS = async (
    structuredText: string,
  ): Promise<TTSResult> => {
  // Create job
    const roles = normalizeRoles(extractRoles(structuredText));
    const createRes = await fetch("/v1/tts/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: structuredText, roles }),
    });
    if (!createRes.ok) {
      const msg = await createRes.text();
      throw new Error(`Create job failed: ${msg}`);
    }
    const { jobId } = (await createRes.json()) as JobCreateResponse;
    setJobId(jobId);
    setJobState("PENDING");

  // Poll
    let state: JobState = "PENDING";
    let attempts = 0;
    while (true) {
      const stRes = await fetch(`/v1/tts/jobs/${jobId}`);
      if (!stRes.ok) {
        const msg = await stRes.text();
        throw new Error(`Status error: ${msg}`);
      }
      const st = (await stRes.json()) as JobStatusResponse;
      state = st.state;
      setJobState(state);
      if (state === "READY") break;
      if (state === "FAILED") throw new Error(st.error || "Job failed");
      attempts += 1;
      await sleep(Math.min(1500 + attempts * 250, 4000));
    }

  // Fetch manifest
    const mfRes = await fetch(`/v1/tts/jobs/${jobId}/manifest`);
    if (!mfRes.ok) {
      const msg = await mfRes.text();
      throw new Error(`Manifest error: ${msg}`);
    }
    const manifest = (await mfRes.json()) as ManifestResponse;

  // Fetch timings
    const tmRes = await fetch(manifest.timingsUrl);
    if (!tmRes.ok) {
      const msg = await tmRes.text();
      throw new Error(`Timings error: ${msg}`);
    }
    const timings = (await tmRes.json()) as TimingsResponse;

  // Map to UI shape
    const { words, displayLines } = buildDisplayFrom(manifest.script, timings.words);
    const duration = words.length
      ? Math.max(...words.map((w) => w.endTime))
      : 0;

    return { audioUrl: manifest.audioUrl, words, duration, displayLines };
  };

  // Throttled time updates
  const lastUpdateRef = useRef(0);
  const handleTimeUpdate = useCallback((time: number) => {
    const now = performance.now();
  if (now - lastUpdateRef.current < 50) return;
    lastUpdateRef.current = now;
    setCurrentTime(time);
  }, []);

  const handleWordClick = useCallback((time: number) => {
  // ensure repeated same-time clicks trigger a new effect
    setSeekRequest({ time, token: Date.now() });
  }, []);

  const handleTTSSubmit = async (structuredText: string) => {
    setIsProcessing(true);

  // Reset
    setTtsResult(null);
    setCurrentTime(0);
    setJobId(null);
    setJobState(null);

    try {
      const result = await processTTS(structuredText);
      setTtsResult(result);
      assignCharacterColors(result.words);
      setIsInputCollapsed(true);
    } catch (error) {
      console.error("TTS processing failed:", error);
      setJobState("FAILED");
  // TODO: user-visible error message
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Animated background pattern */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%236366f1%22%20fill-opacity%3D%220.02%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-60" />

      <div className="relative flex flex-col min-h-screen">
        {/* Header */}
        <Header
          jobId={jobId || undefined}
          jobState={jobState || undefined}
        />

        {/* Main Content */}
        <main className="flex-1">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-6xl">
            {/* Hero Section - Only show when no result */}
            {!ttsResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center mb-12 lg:mb-16"
              >
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-slate-100 mb-6">
                  Transform Stories into{" "}
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Professional Audio
                  </span>
                </h2>
              </motion.div>
            )}

            {/* Input Section */}
            <div className="space-y-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key="tts-input"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                >
                  <TTSInput
                    onSubmit={handleTTSSubmit}
                    isProcessing={isProcessing}
                    isCollapsed={isInputCollapsed}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Results Section */}
              <AnimatePresence>
                {ttsResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="space-y-4"
                  >
                    {/* Script Display */}
                    <FormattedTextDisplay
                      words={ttsResult.words}
                      displayLines={ttsResult.displayLines}
                      currentTime={currentTime}
                      characterColors={characterColors}
                      onWordClick={handleWordClick}
                    />

                    {/* Character Legend */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4, delay: 0.4 }}
                      className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-xl border border-white/20 dark:border-slate-700/50 p-4 shadow-lg"
                    >
                      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        Characters
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(characterColors).map(
                          ([character, gradient]) => {
                            // Only show characters that appear in the current script
                            const hasCharacter =
                              ttsResult.words.some(
                                (word) =>
                                  word.character === character,
                              );
                            if (
                              !hasCharacter ||
                              character === "Narrator"
                            )
                              return null;

                            return (
                              <motion.div
                                key={character}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3 }}
                                className="flex items-center gap-2 bg-white/90 dark:bg-slate-700/90 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-600/50 shadow-sm hover:shadow-md transition-all"
                              >
                                <div
                                  className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${gradient} shadow-sm`}
                                />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                  {character}
                                </span>
                              </motion.div>
                            );
                          },
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom padding for fixed audio player - always present to prevent layout shift */}
              <div className="h-32 lg:h-40" />
            </div>
          </div>
        </main>

        {/* Footer */}
        <Footer />

        {/* Audio Player - Fixed at bottom */}
        <AnimatePresence>
          {ttsResult && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ duration: 0.5 }}
            >
              <AudioPlayer
                audioUrl={ttsResult.audioUrl}
                onTimeUpdate={handleTimeUpdate}
                duration={ttsResult.duration}
                externalSeek={seekRequest}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
