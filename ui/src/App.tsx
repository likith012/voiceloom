// ui/src/App.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import ThemeToggle from "./components/ThemeToggle";
import "./App.css";
import ScriptView from "./components/ScriptView";
import { createJob, getManifest, getStatus, type JobStatus } from "./lib/api";

export default function App() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [manifest, setManifest] = useState<Awaited<ReturnType<typeof getManifest>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  const canSubmit = useMemo(() => text.trim().length > 0, [text]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, []);

  const startPolling = (id: string) => {
    if (pollingRef.current) window.clearInterval(pollingRef.current);
    pollingRef.current = window.setInterval(async () => {
      try {
        const s = await getStatus(id);
        setStatus(s);
        if (s.state === "READY") {
          const m = await getManifest(id);
          setManifest(m);
          if (pollingRef.current) window.clearInterval(pollingRef.current);
        }
        if (s.state === "FAILED") {
          if (pollingRef.current) window.clearInterval(pollingRef.current);
          setError(s.error ?? "Job failed");
        }
      } catch (e: any) {
        if (pollingRef.current) window.clearInterval(pollingRef.current);
        setError(e?.message ?? String(e));
      }
    }, 1000);
  };

  const onSubmit = async () => {
    setError(null);
    setManifest(null);
    setStatus(null);
    try {
      const res = await createJob(text);
      startPolling(res.jobId);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create job");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-base-100">
      <header className="navbar bg-base-200/70 backdrop-blur sticky top-0 z-20 border-b border-base-300">
        <div className="mx-auto w-full max-w-7xl px-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="avatar placeholder">
                <div className="bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-neutral-content rounded-lg w-10 h-10 font-bold">
                  <span>VL</span>
                </div>
              </div>
              <h1 className="font-semibold tracking-tight text-lg">VoiceLoom</h1>
            </div>
            <div className="flex items-center gap-5">
              <div className="min-w-[140px] text-xs font-medium">
                {status ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="loading loading-xs loading-ring text-primary" />
                    <code className="font-mono">{status.id.slice(0,6)}</code>
                    <span>· {status.state}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 opacity-60"><span className="w-2 h-2 rounded-full bg-base-content/40"/> idle</span>
                )}
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-10 lg:py-14 grid gap-8 lg:gap-12 lg:grid-cols-1">
        {/* Left column */}
        <section className="space-y-6">
          <div className="card bg-base-200/50 border border-base-300 backdrop-blur shadow-md">
            <div className="card-body gap-4">
              <div className="flex items-center justify-between">
                <h2 className="card-title text-sm font-semibold tracking-wider uppercase">Script Input</h2>
                <span className="badge badge-sm badge-ghost">{text.trim().length.toLocaleString()} chars</span>
              </div>
              <textarea
                className="textarea textarea-bordered h-64 leading-relaxed resize-vertical"
                placeholder="Paste your text here"
                value={text}
                onChange={(e)=>setText(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <button
                  disabled={!canSubmit}
                  onClick={onSubmit}
                  className="btn btn-primary btn-sm sm:btn-md disabled:opacity-50"
                >
                  Synthesize
                </button>
                {error && <p className="text-sm text-error animate-fade-in">{error}</p>}
              </div>
            </div>
          </div>
        </section>

        {/* Right column */}
        <section className="space-y-6">
          <div className="card bg-base-200/50 border border-base-300 backdrop-blur shadow-sm">
            <div className="card-body gap-4">
              <h2 className="card-title text-sm font-semibold tracking-wider uppercase">Audio Preview</h2>
              {manifest ? (
                <audio controls className="w-full">
                  <source src={manifest.audioUrl} type="audio/wav" />
                </audio>
              ) : (
                <div className="text-sm opacity-70 flex items-center gap-2">
                  <span className="loading loading-spinner loading-xs" />
                  Waiting for job…
                </div>
              )}
            </div>
          </div>
          <div className="card bg-base-200/50 border border-base-300 backdrop-blur shadow-sm">
            <div className="card-body gap-4">
              <h2 className="card-title text-sm font-semibold tracking-wider uppercase mb-2">Script View</h2>
              {manifest ? (
                <ScriptView uiScript={manifest.script} />
              ) : (
                <p className="text-sm opacity-70">No script yet.</p>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-base-300 bg-base-200/60 mt-10">
        <div className="mx-auto max-w-7xl px-4 py-6 text-[11px] flex justify-between items-center opacity-70">
          <span>© {new Date().getFullYear()} VoiceLoom</span>
          <span className="inline-flex items-center gap-1">Built with <span className="text-primary font-medium">FastAPI</span> + <span className="text-secondary font-medium">React</span></span>
        </div>
      </footer>
    </div>
  );
}
