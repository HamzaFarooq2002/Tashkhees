import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ContributionBar } from "./contribution-bar";
import { Decimal, formatDisplay } from "@/lib/scoring/decimal-config";
import type { EvaluationResultsPayload } from "@/server/actions/results";
import type { RowResult } from "@/lib/scoring/engine";

const CATEGORY_MAX: Record<string, string> = {
  technical: "40",
  operational: "35",
  financial_inclusion: "25",
};

function statusLabel(key: string) {
  return (
    { fully_implemented: "Fully Implemented", partially_implemented: "Partially Implemented", fragmented_uneven: "Fragmented/Uneven", absent: "Absent" }[
      key
    ] ?? key
  );
}

function RowDetail({ row }: { row: RowResult }) {
  return (
    <div className="space-y-2 rounded-md bg-secondary/40 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-foreground">{row.label}</span>
        {/* Finalized results only ever contain complete rows (submit refuses otherwise), so this is never null. */}
        <ContributionBar contribution={row.rowContribution!} max={row.maxRowContribution} size="sm" />
      </div>

      <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        {row.selectedStandardLabel && (
          <div>
            Selected standard: <span className="text-foreground">{row.selectedStandardLabel}</span>
          </div>
        )}
        {row.resolvedBandLabel && (
          <div>
            Raw value: <span className="text-foreground">{row.rawPercentage}%</span> → band{" "}
            <span className="text-foreground">{row.resolvedBandLabel}</span>
          </div>
        )}
        {row.booleanCapability !== undefined && (
          <div>
            Capability: <span className="text-foreground">{row.booleanCapability ? "Yes" : "No"}</span>
          </div>
        )}
        <div>
          Status: <span className="text-foreground">{statusLabel(row.statusKey)}</span> (score {row.statusScore})
        </div>
        <div>
          Capability multiplier: <span className="text-foreground">{row.capabilityMultiplier}</span>
        </div>
      </div>

      {row.coverageBreakdown && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {row.coverageBreakdown.map((c) => (
            <Badge key={c.key} variant={c.present ? "default" : "outline"} className="text-[11px] font-normal">
              {c.label} ({(Number(c.contributorWeight) * 100).toFixed(0)}%)
            </Badge>
          ))}
        </div>
      )}

      <details className="pt-1">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
          How this was calculated
        </summary>
        <p className="mt-1 text-xs text-muted-foreground">
          {row.categoryWeight} (category weight) × {row.parameterWeight} (parameter weight) × {row.splitWeight}{" "}
          (split weight) × {row.capabilityMultiplier} (capability multiplier) × {row.statusScore} (status score) ×
          10 = {row.rowScore}. Contribution to the 100-point scale = {row.rowScore} × 2 = {row.rowContribution}.
        </p>
      </details>
    </div>
  );
}

export function ResultsView({ data }: { data: EvaluationResultsPayload }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Overall readiness score
          </span>
          <span className="text-6xl font-semibold tracking-tight text-foreground">
            {formatDisplay(new Decimal(data.totalScore))}
            <span className="text-2xl text-muted-foreground"> / 100</span>
          </span>
          <p className="max-w-md text-xs text-muted-foreground">
            Totals are computed from unrounded values; the sum of the rounded figures shown below may differ
            very slightly.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {data.categories.map((category) => (
          <Card key={category.categoryKey}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{category.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">
                {formatDisplay(new Decimal(category.contribution))}
                <span className="text-base text-muted-foreground">
                  {" "}
                  / {CATEGORY_MAX[category.categoryKey] ?? category.maxContribution}
                </span>
              </div>
              <div className="mt-3">
                <ContributionBar contribution={category.contribution} max={category.maxContribution} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.categories.map((category) => (
        <Card key={category.categoryKey}>
          <CardHeader>
            <CardTitle>{category.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="space-y-2">
              {category.parameters.map((parameter) => (
                <AccordionItem key={parameter.parameterKey} value={parameter.parameterKey} className="rounded-md border border-border px-3">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-1 items-center justify-between pr-4">
                      <span className="text-sm font-medium">{parameter.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDisplay(new Decimal(parameter.contribution))} / {formatDisplay(new Decimal(parameter.maxContribution))}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {parameter.rows.map((row) => (
                      <RowDetail key={row.rowKey} row={row} />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
