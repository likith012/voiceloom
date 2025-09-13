import type { JobState } from "../lib/api";

type Props = {
  state: JobState;
  error?: string | null;
};

const STEPS: JobState[] = ["PENDING", "SYNTHESIZING", "ALIGNING", "READY"];

export default function JobProgress({ state, error }: Props) {
  const activeIdx = state === "FAILED" ? -1 : STEPS.indexOf(state);

  return (
    <div className="w-full">
      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const done = activeIdx > i || state === "READY";
          const active = activeIdx === i;
          const base =
            "h-2 flex-1 rounded-full transition-colors";
          const cls = state === "FAILED"
            ? "bg-rose-200"
            : done
            ? "bg-indigo-500"
            : active
            ? "bg-indigo-300"
            : "bg-zinc-200 dark:bg-zinc-800";
          return <li key={s} className={`${base} ${cls}`} title={s} />;
        })}
      </ol>
      <div className="mt-2 text-sm">
        {state === "FAILED" ? (
          <span className="text-rose-600">Failed{error ? ` — ${error}` : ""}</span>
        ) : (
          <span className="text-base-content/70">{state}</span>
        )}
      </div>
    </div>
  );
}
