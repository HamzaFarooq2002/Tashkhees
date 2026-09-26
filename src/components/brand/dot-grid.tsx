import { cn } from "cn";

/** Decorative dot-grid texture for hero/CTA corners only — never a full-bleed wash. */
export function DotGrid({ className }: { className?: string }) {
  return <div aria-hidden className={cn("dot-grid pointer-events-none absolute opacity-[0.14]", className)} />;
}
