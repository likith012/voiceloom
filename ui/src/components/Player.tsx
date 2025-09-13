import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  onTime?: (t: number, dur: number) => void;
  className?: string;
};

export default function Player({ src, onTime, className }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [dur, setDur] = useState<number>(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onLoaded = () => setDur(el.duration || 0);
    const onUpdate = () => onTime?.(el.currentTime || 0, el.duration || 0);

    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onUpdate);
    el.addEventListener("seeked", onUpdate);
    el.addEventListener("play", onUpdate);
    el.addEventListener("pause", onUpdate);

    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onUpdate);
      el.removeEventListener("seeked", onUpdate);
      el.removeEventListener("play", onUpdate);
      el.removeEventListener("pause", onUpdate);
    };
  }, [onTime]);

  return (
    <div className={className}>
      <audio ref={audioRef} controls className="w-full">
        <source src={src} type="audio/wav" />
      </audio>
      {dur > 0 && (
  <div className="mt-1 text-xs text-base-content/60">
          Duration: {dur.toFixed(1)}s
        </div>
      )}
    </div>
  );
}
