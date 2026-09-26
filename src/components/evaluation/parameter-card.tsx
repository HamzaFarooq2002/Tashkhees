"use client";

import { memo } from "react";
import type { FormParameter, FormStatusOption } from "@/lib/rubric/formView";
import type { RowError, RowResult } from "@/lib/scoring/engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { StatusSelect } from "./status-select";
import { EvidenceFields } from "./evidence-fields";
import { SaveIndicator } from "./save-indicator";
import { formatDisplay, Decimal } from "@/lib/scoring/decimal-config";
import type { RowState } from "./types";

export interface RowFieldChange {
  standardKey?: string | null;
  availability?: Record<string, boolean>;
  availabilityConfirmed?: boolean;
  rawPercentage?: string;
  booleanCapability?: boolean | null;
  statusKey?: string | null;
  evidenceUrl?: string;
  sourceTitle?: string;
  sourceDate?: string;
  notes?: string;
}

interface ParameterCardProps {
  parameter: FormParameter;
  statusOptions: FormStatusOption[];
  rows: RowState[];
  resolvedByRowKey: Record<string, RowResult>;
  errorByRowKey: Record<string, RowError>;
  onChange: (parameterKey: string, rowKey: string, patch: RowFieldChange) => void;
  onRetry: (parameterKey: string, rowKey: string) => void;
}

/** Memoized: the editor re-renders on every keystroke, but only the card whose rows changed needs to. */
export const ParameterCard = memo(function ParameterCard({
  parameter,
  statusOptions,
  rows,
  resolvedByRowKey,
  errorByRowKey,
  onChange,
  onRetry,
}: ParameterCardProps) {
  const allComplete = rows.every((r) => Boolean(resolvedByRowKey[r.rowKey]));

  return (
    <Card data-testid={`param-${parameter.key}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">{parameter.name}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Category weight × parameter weight = {(Number(parameter.weight) * 100).toFixed(0)}% of category
          </p>
        </div>
        {allComplete ? (
          <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" /> Complete
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" /> Incomplete
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {parameter.inputType === "STANDARD" && (
          <StandardRow
            parameter={parameter}
            row={rows[0]}
            statusOptions={statusOptions}
            resolved={resolvedByRowKey["main"]}
            error={errorByRowKey["main"]}
            onChange={(patch) => onChange(parameter.key, "main", patch)}
            onRetry={() => onRetry(parameter.key, "main")}
          />
        )}

        {parameter.inputType === "SUBPARAM" && (
          <SubParamRow
            parameter={parameter}
            row={rows[0]}
            statusOptions={statusOptions}
            resolved={resolvedByRowKey["main"]}
            error={errorByRowKey["main"]}
            onChange={(patch) => onChange(parameter.key, "main", patch)}
            onRetry={() => onRetry(parameter.key, "main")}
          />
        )}

        {parameter.inputType === "BANDED" && (
          <BandedRow
            label={null}
            row={rows[0]}
            statusOptions={statusOptions}
            resolved={resolvedByRowKey["main"]}
            error={errorByRowKey["main"]}
            onChange={(patch) => onChange(parameter.key, "main", patch)}
            onRetry={() => onRetry(parameter.key, "main")}
            idPrefix={`${parameter.key}-main`}
          />
        )}

        {parameter.inputType === "SPLIT_BANDED" &&
          parameter.subMetrics.map((sm) => {
            const row = rows.find((r) => r.rowKey === sm.key);
            if (!row) return null;
            return (
              <div key={sm.key} className="rounded-md border border-border p-4">
                <BandedRow
                  label={`${sm.label} (${(Number(sm.splitWeight) * 100).toFixed(0)}% of this parameter)`}
                  row={row}
                  statusOptions={statusOptions}
                  resolved={resolvedByRowKey[sm.key]}
                  error={errorByRowKey[sm.key]}
                  onChange={(patch) => onChange(parameter.key, sm.key, patch)}
                  onRetry={() => onRetry(parameter.key, sm.key)}
                  idPrefix={`${parameter.key}-${sm.key}`}
                />
              </div>
            );
          })}

        {parameter.inputType === "BOOLEAN" && (
          <BooleanRow
            row={rows[0]}
            statusOptions={statusOptions}
            resolved={resolvedByRowKey["main"]}
            error={errorByRowKey["main"]}
            onChange={(patch) => onChange(parameter.key, "main", patch)}
            onRetry={() => onRetry(parameter.key, "main")}
          />
        )}
      </CardContent>
    </Card>
  );
}, parameterCardPropsEqual);

/** `rows` is rebuilt as a new array on every editor render, but each RowState is only replaced when that row
 * changes — so compare the rows element-wise by identity and everything else by reference. */
function parameterCardPropsEqual(prev: ParameterCardProps, next: ParameterCardProps): boolean {
  if (prev.rows.length !== next.rows.length) return false;
  for (let i = 0; i < prev.rows.length; i++) {
    if (prev.rows[i] !== next.rows[i]) return false;
  }
  return (
    prev.parameter === next.parameter &&
    prev.statusOptions === next.statusOptions &&
    prev.resolvedByRowKey === next.resolvedByRowKey &&
    prev.errorByRowKey === next.errorByRowKey &&
    prev.onChange === next.onChange &&
    prev.onRetry === next.onRetry
  );
}

function RowFooter({
  row,
  resolved,
  error,
  onRetry,
}: {
  row: RowState;
  resolved?: RowResult;
  error?: RowError;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <SaveIndicator state={row.saveState} onRetry={row.saveState === "error" ? onRetry : undefined} />
      {row.saveState === "error" && row.saveError ? (
        <span className="text-destructive">{row.saveError}</span>
      ) : resolved && resolved.state === "unresolved" ? (
        <span className="text-destructive">
          This methodology leaves {resolved.unresolvedBand?.sourceLabel ?? "this range"} unresolved
          {resolved.unresolvedBand?.note ? ` — ${resolved.unresolvedBand.note}` : ""}
        </span>
      ) : resolved ? (
        <span className="text-muted-foreground">
          Row contribution:{" "}
          <span className="font-medium text-foreground">
            {formatDisplay(new Decimal(resolved.rowContribution!))} / {formatDisplay(new Decimal(resolved.maxRowContribution))}
          </span>
        </span>
      ) : error && error.code !== "MISSING_ENTRY" ? (
        <span className="text-destructive">{error.message}</span>
      ) : null}
    </div>
  );
}

function StandardRow({
  parameter,
  row,
  statusOptions,
  resolved,
  error,
  onChange,
  onRetry,
}: {
  parameter: FormParameter;
  row: RowState;
  statusOptions: FormStatusOption[];
  resolved?: RowResult;
  error?: RowError;
  onChange: (patch: RowFieldChange) => void;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Standard / capability</Label>
          <Select
            value={row.standardKey ?? ""}
            onValueChange={(v) => {
              if (v) onChange({ standardKey: v });
            }}
          >
            <SelectTrigger data-testid={`standard-select-${parameter.key}`}>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {parameter.standardOptions.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Implementation status</Label>
          <StatusSelect
            statusOptions={statusOptions}
            value={row.statusKey}
            onChange={(v) => onChange({ statusKey: v })}
            testId={`status-select-${parameter.key}`}
          />
        </div>
      </div>
      <EvidenceFields
        idPrefix={`${parameter.key}-main`}
        evidenceUrl={row.evidenceUrl}
        sourceTitle={row.sourceTitle}
        sourceDate={row.sourceDate}
        notes={row.notes}
        onChange={onChange}
      />
      <RowFooter row={row} resolved={resolved} error={error} onRetry={onRetry} />
    </div>
  );
}

function SubParamRow({
  parameter,
  row,
  statusOptions,
  resolved,
  error,
  onChange,
  onRetry,
}: {
  parameter: FormParameter;
  row: RowState;
  statusOptions: FormStatusOption[];
  resolved?: RowResult;
  error?: RowError;
  onChange: (patch: RowFieldChange) => void;
  onRetry: () => void;
}) {
  const coverage = parameter.subParameters.reduce(
    (sum, sp) => sum + (row.availability[sp.key] ? Number(sp.contributorWeight) : 0),
    0
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {parameter.subParameters.map((sp) => (
          <label
            key={sp.key}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <Checkbox
              data-testid={`checkbox-${parameter.key}-${sp.key}`}
              checked={Boolean(row.availability[sp.key])}
              onCheckedChange={(checked) =>
                onChange({
                  availability: { ...row.availability, [sp.key]: checked === true },
                  availabilityConfirmed: false,
                })
              }
            />
            <span className="flex-1">{sp.label}</span>
            <span className="text-xs text-muted-foreground">{(Number(sp.contributorWeight) * 100).toFixed(0)}%</span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant={row.availabilityConfirmed ? "secondary" : "default"}
          onClick={() => {
            // The engine requires an explicit answer for every contributor (unanswered ≠ absent), so
            // confirming records each unticked contributor as explicitly not present.
            const answered: Record<string, boolean> = {};
            for (const sp of parameter.subParameters) answered[sp.key] = row.availability[sp.key] === true;
            onChange({ availability: answered, availabilityConfirmed: true });
          }}
          data-testid={`confirm-availability-${parameter.key}`}
        >
          Confirm availability selections
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            const cleared: Record<string, boolean> = {};
            for (const sp of parameter.subParameters) cleared[sp.key] = false;
            onChange({ availability: cleared, availabilityConfirmed: true });
          }}
          data-testid={`none-present-${parameter.key}`}
        >
          None present
        </Button>
        <span className="text-xs text-muted-foreground" data-testid={`coverage-${parameter.key}`}>
          Coverage so far: {(coverage * 100).toFixed(0)}%
          {row.availabilityConfirmed ? " · confirmed" : " · not yet confirmed — click Confirm when done"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Tick what is present, then confirm. Unticked items will be recorded as not present.
      </p>

      <div className="max-w-xs space-y-1.5">
        <Label>Implementation status</Label>
        <StatusSelect
          statusOptions={statusOptions}
          value={row.statusKey}
          onChange={(v) => onChange({ statusKey: v })}
          testId={`status-select-${parameter.key}`}
        />
      </div>

      <EvidenceFields
        idPrefix={`${parameter.key}-main`}
        evidenceUrl={row.evidenceUrl}
        sourceTitle={row.sourceTitle}
        sourceDate={row.sourceDate}
        notes={row.notes}
        onChange={onChange}
      />
      <RowFooter row={row} resolved={resolved} error={error} onRetry={onRetry} />
    </div>
  );
}

function BandedRow({
  label,
  row,
  statusOptions,
  resolved,
  error,
  onChange,
  onRetry,
  idPrefix,
}: {
  label: string | null;
  row: RowState;
  statusOptions: FormStatusOption[];
  resolved?: RowResult;
  error?: RowError;
  onChange: (patch: RowFieldChange) => void;
  onRetry: () => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-3">
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-pct`}>Raw percentage (0–100)</Label>
          <Input
            id={`${idPrefix}-pct`}
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={row.rawPercentage}
            onChange={(e) => onChange({ rawPercentage: e.target.value })}
          />
          {resolved?.resolvedBandLabel && (
            <p className="text-xs text-muted-foreground">
              Band: {resolved.resolvedBandLabel} → multiplier {resolved.capabilityMultiplier}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Implementation status</Label>
          <StatusSelect
            statusOptions={statusOptions}
            value={row.statusKey}
            onChange={(v) => onChange({ statusKey: v })}
            testId={`status-select-${idPrefix}`}
          />
        </div>
      </div>
      <EvidenceFields
        idPrefix={idPrefix}
        evidenceUrl={row.evidenceUrl}
        sourceTitle={row.sourceTitle}
        sourceDate={row.sourceDate}
        notes={row.notes}
        onChange={onChange}
      />
      <RowFooter row={row} resolved={resolved} error={error} onRetry={onRetry} />
    </div>
  );
}

function BooleanRow({
  row,
  statusOptions,
  resolved,
  error,
  onChange,
  onRetry,
}: {
  row: RowState;
  statusOptions: FormStatusOption[];
  resolved?: RowResult;
  error?: RowError;
  onChange: (patch: RowFieldChange) => void;
  onRetry: () => void;
}) {
  const value = row.booleanCapability === null ? "" : row.booleanCapability ? "yes" : "no";
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Does the country have a unique citizen ID?</Label>
          <RadioGroup
            value={value}
            onValueChange={(v) => onChange({ booleanCapability: v === "yes" })}
            className="flex gap-4"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="yes" data-testid="boolean-yes" /> Yes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="no" data-testid="boolean-no" /> No
            </label>
          </RadioGroup>
        </div>
        <div className="space-y-1.5">
          <Label>Implementation status</Label>
          <StatusSelect
            statusOptions={statusOptions}
            value={row.statusKey}
            onChange={(v) => onChange({ statusKey: v })}
            testId="status-select-unique_citizen_id"
          />
        </div>
      </div>
      <EvidenceFields
        idPrefix="unique_citizen_id-main"
        evidenceUrl={row.evidenceUrl}
        sourceTitle={row.sourceTitle}
        sourceDate={row.sourceDate}
        notes={row.notes}
        onChange={onChange}
      />
      <RowFooter row={row} resolved={resolved} error={error} onRetry={onRetry} />
    </div>
  );
}
