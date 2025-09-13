// ui/src/lib/colors.ts

type ChipClasses = { bg: string; text: string; ring: string };

const PALETTE: ChipClasses[] = [
  { bg: "bg-rose-100 dark:bg-rose-300/30",     text: "text-rose-800 dark:text-rose-200",       ring: "ring-rose-300/60 dark:ring-rose-400/40" },
  { bg: "bg-fuchsia-100 dark:bg-fuchsia-300/30", text: "text-fuchsia-800 dark:text-fuchsia-200", ring: "ring-fuchsia-300/60 dark:ring-fuchsia-400/40" },
  { bg: "bg-violet-100 dark:bg-violet-300/30", text: "text-violet-800 dark:text-violet-200",   ring: "ring-violet-300/60 dark:ring-violet-400/40" },
  { bg: "bg-indigo-100 dark:bg-indigo-300/30", text: "text-indigo-800 dark:text-indigo-200",   ring: "ring-indigo-300/60 dark:ring-indigo-400/40" },
  { bg: "bg-blue-100 dark:bg-blue-300/30",     text: "text-blue-800 dark:text-blue-200",       ring: "ring-blue-300/60 dark:ring-blue-400/40" },
  { bg: "bg-cyan-100 dark:bg-cyan-300/30",     text: "text-cyan-800 dark:text-cyan-200",       ring: "ring-cyan-300/60 dark:ring-cyan-400/40" },
  { bg: "bg-teal-100 dark:bg-teal-300/30",     text: "text-teal-800 dark:text-teal-200",       ring: "ring-teal-300/60 dark:ring-teal-400/40" },
  { bg: "bg-emerald-100 dark:bg-emerald-300/30", text: "text-emerald-800 dark:text-emerald-200", ring: "ring-emerald-300/60 dark:ring-emerald-400/40" },
  { bg: "bg-amber-100 dark:bg-amber-300/30",   text: "text-amber-800 dark:text-amber-200",     ring: "ring-amber-300/60 dark:ring-amber-400/40" },
  { bg: "bg-pink-100 dark:bg-pink-300/30",     text: "text-pink-800 dark:text-pink-200",       ring: "ring-pink-300/60 dark:ring-pink-400/40" }
];

const NEUTRAL: ChipClasses = {
  bg: "bg-base-200 dark:bg-base-300/40",
  text: "text-base-content/70",
  ring: "ring-base-300/60"
};

export function colorForCharacter(name: string | null): ChipClasses {
  if (!name) return NEUTRAL;
  if (name.trim().toLowerCase() === "narrator") return NEUTRAL;

  // Simple stable hash
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  const idx = h % PALETTE.length;
  return PALETTE[idx];
}
