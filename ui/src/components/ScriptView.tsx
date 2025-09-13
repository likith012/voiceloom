import React from "react";
import type { UILine } from "../lib/tokenize";
import { parseUIScript } from "../lib/tokenize";
import { colorForCharacter } from "../lib/colors";

type Props = {
  uiScript: string;
};

export default function ScriptView({ uiScript }: Props) {
  const lines: UILine[] = React.useMemo(() => parseUIScript(uiScript), [uiScript]);

  return (
    <div className="space-y-3">
      {lines.map((ln, i) => {
        const chip = colorForCharacter(ln.char);
        const showChip = !!ln.char && ln.char.trim().toLowerCase() !== "narrator";
        return (
          <div key={i} className="flex items-start gap-3">
            {showChip ? (
              <span
                className={[
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                  chip.bg,
                  chip.text,
                  chip.ring
                ].join(" ")}
                title={ln.char ?? undefined}
              >
                {ln.char}
              </span>
            ) : (
              <span className="shrink-0 w-0" />
            )}

            <p className="leading-relaxed text-base-content">
              {ln.parts.map((p, j) =>
                p.type === "text" ? (
                  <React.Fragment key={j}>{p.value}</React.Fragment>
                ) : (
                  <span
                    key={j}
                    className="opacity-60 italic"
                    title={p.raw}
                  >
                    {" "}
                    ({p.display})
                  </span>
                )
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}
