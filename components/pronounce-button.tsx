"use client";

import { useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PronounceButton({
  word,
  variant = "us",
  className,
  size = "md",
}: {
  word: string;
  variant?: "us" | "uk";
  className?: string;
  size?: "sm" | "md";
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(
    word
  )}&type=${variant === "uk" ? 1 : 0}`;

  async function play() {
    if (!audioRef.current) audioRef.current = new Audio(url);
    else audioRef.current.src = url;
    try {
      setPlaying(true);
      await audioRef.current.play();
      audioRef.current.onended = () => setPlaying(false);
    } catch {
      setPlaying(false);
    }
  }

  return (
    <button
      type="button"
      onClick={play}
      aria-label={`朗读 ${word}（${variant === "uk" ? "英音" : "美音"}）`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-border)] transition",
        size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-sm",
        playing && "text-[var(--color-brand)]",
        className
      )}
    >
      <Volume2 className={size === "sm" ? "size-3" : "size-4"} />
      <span className="uppercase tracking-wider text-[0.65rem]">
        {variant}
      </span>
    </button>
  );
}
