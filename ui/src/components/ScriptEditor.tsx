import { useId } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

export default function ScriptEditor({ value, onChange, disabled }: Props) {
  const id = useId();
  const count = value.trim().length;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        Script
      </label>
      <textarea
        id={id}
        className="textarea textarea-bordered w-full h-48 leading-relaxed resize-vertical"
        placeholder="Paste your text here. Optional sections: STYLE DESCRIPTION, ACTION DICTIONARY. SCRIPT is required."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <div className="text-xs text-base-content/60">{count.toLocaleString()} chars</div>
    </div>
  );
}
