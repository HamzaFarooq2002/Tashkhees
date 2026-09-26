import { Decimal, formatDisplay } from "@/lib/scoring/decimal-config";

export function ContributionBar({
  contribution,
  max,
  size = "md",
}: {
  contribution: string;
  max: string;
  size?: "sm" | "md";
}) {
  const pct = Math.min(100, Math.max(0, new Decimal(contribution).div(new Decimal(max || "1")).mul(100).toNumber()));
  return (
    <div className="flex items-center gap-3">
      <div className={`flex-1 overflow-hidden rounded-full bg-muted ${size === "sm" ? "h-1.5" : "h-2.5"}`}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="whitespace-nowrap text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{formatDisplay(new Decimal(contribution))}</span> /{" "}
        {formatDisplay(new Decimal(max))}
      </span>
    </div>
  );
}
