import { parseDefinition } from "@/lib/definition";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_CLS: Record<Size, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-3xl sm:text-4xl",
};

// Renders an ECDICT-style definition as a clean list of senses, surfacing
// leading "[计]" / "[医]" subject markers as small inline badges instead of
// letting them bleed into the prose.
export function Definition({
  text,
  size = "md",
  muted = false,
  className,
}: {
  text: string | null | undefined;
  size?: Size;
  muted?: boolean;
  className?: string;
}) {
  const senses = parseDefinition(text);
  if (senses.length === 0) return null;

  return (
    <ul
      className={cn(
        "space-y-1.5 leading-relaxed",
        SIZE_CLS[size],
        muted && "text-[var(--color-fg-muted)]",
        className
      )}
    >
      {senses.map((s, i) => (
        <li key={i} className="flex items-start gap-2">
          {s.tag && (
            <span className="shrink-0 mt-1 inline-flex items-center rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wide text-[var(--color-fg-muted)] uppercase">
              {s.tag}
            </span>
          )}
          <span className="flex-1">{s.text}</span>
        </li>
      ))}
    </ul>
  );
}
