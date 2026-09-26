"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { EvaluationEditPayload } from "@/server/actions/evaluations";
import { saveEntry, saveEvaluationMeta } from "@/server/actions/entries";
import { normalizeEvidenceUrl } from "@/lib/validation/evaluation";
import type { ScoringResult, RowResult, RowError } from "@/lib/scoring/engine";
import { buildInitialRows, parameterRowKeys, rowKeyOf, TOTAL_SCORED_ROWS } from "./types";
import type { RowState } from "./types";
import { ParameterCard, type RowFieldChange } from "./parameter-card";
import { EvaluationHeader, type MetaState } from "./evaluation-header";
import { SubmitReviewDialog } from "./submit-review-dialog";

const DEBOUNCE_MS = 700;

// Stable fallbacks so memoized ParameterCards don't see a "new" empty object on every render.
const EMPTY_RESOLVED: Record<string, RowResult> = {};
const EMPTY_ERRORS: Record<string, RowError> = {};

function isoDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function EvaluationEditor({ initial }: { initial: EvaluationEditPayload }) {
  const router = useRouter();

  // `rowsRef`/`metaRef` are the single source of truth, updated synchronously
  // and outside of any React state-updater callback. Reading/writing state
  // updates and triggering saves from *inside* a setState functional updater
  // is unsafe here: React (Strict Mode, in particular) may invoke that
  // function more than once, which would double- or triple-fire network
  // saves against the same optimistic-concurrency revision. Plain-value
  // setState calls (as used everywhere below) don't have that hazard.
  const [rows, setRowsState] = useState<Record<string, RowState>>(() =>
    buildInitialRows(initial.rubric, initial.entries)
  );
  const rowsRef = useRef(rows);
  function setRows(next: Record<string, RowState>) {
    rowsRef.current = next;
    setRowsState(next);
  }

  const initialMeta: MetaState = {
    countryCode: initial.evaluation.countryCode,
    countryName: initial.evaluation.countryName,
    assessmentDate: isoDateOnly(initial.evaluation.assessmentDate),
    title: initial.evaluation.title ?? "",
    analystNotes: initial.evaluation.analystNotes ?? "",
  };
  const [meta, setMetaState] = useState<MetaState>(initialMeta);
  const metaRef = useRef(meta);
  function setMeta(next: MetaState) {
    metaRef.current = next;
    setMetaState(next);
  }

  const [metaSaveState, setMetaSaveState] = useState<RowState["saveState"]>("idle");
  const [progress, setProgress] = useState<ScoringResult>(initial.progress);
  const [reviewOpen, setReviewOpen] = useState(false);

  const revisionRef = useRef(initial.evaluation.revision);
  const [revision, setRevision] = useState(initial.evaluation.revision);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const debounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const evaluationId = initial.evaluation.id;

  const { resolvedByParameter, errorByParameter } = useMemo(() => {
    const resolved: Record<string, Record<string, RowResult>> = {};
    const errors: Record<string, Record<string, RowError>> = {};
    for (const category of progress.categories) {
      for (const parameter of category.parameters) {
        resolved[parameter.parameterKey] = {};
        for (const row of parameter.rows) {
          resolved[parameter.parameterKey][row.rowKey] = row;
        }
      }
    }
    for (const error of progress.errors) {
      errors[error.parameterKey] = errors[error.parameterKey] ?? {};
      errors[error.parameterKey][error.rowKey] = error;
    }
    return { resolvedByParameter: resolved, errorByParameter: errors };
  }, [progress]);

  function enqueue(fn: () => Promise<void>) {
    saveQueueRef.current = saveQueueRef.current.then(fn, fn);
  }

  function handleStaleRevision(message: string) {
    toast.error(message, { duration: 8000 });
    router.refresh();
  }

  function persistRow(key: string, updatedRow: RowState) {
    setRows({ ...rowsRef.current, [key]: { ...updatedRow, saveState: "saving", saveError: undefined } });
    enqueue(async () => {
      const payload = {
        parameterKey: updatedRow.parameterKey,
        rowKey: updatedRow.rowKey,
        standardKey: updatedRow.standardKey,
        availability: Object.keys(updatedRow.availability).length > 0 ? updatedRow.availability : null,
        availabilityConfirmed: updatedRow.availabilityConfirmed,
        rawPercentage: updatedRow.rawPercentage === "" ? null : updatedRow.rawPercentage,
        booleanCapability: updatedRow.booleanCapability,
        statusKey: updatedRow.statusKey,
        evidenceUrl: normalizeEvidenceUrl(updatedRow.evidenceUrl) || null,
        sourceTitle: updatedRow.sourceTitle || null,
        sourceDate: updatedRow.sourceDate || null,
        notes: updatedRow.notes || null,
      };
      const result = await saveEntry(evaluationId, revisionRef.current, payload);
      if (result.ok) {
        revisionRef.current = result.revision;
        setRevision(result.revision);
        setProgress(result.progress);
        setRows({ ...rowsRef.current, [key]: { ...rowsRef.current[key], saveState: "saved", saveError: undefined } });
      } else {
        setRows({
          ...rowsRef.current,
          [key]: { ...rowsRef.current[key], saveState: "error", saveError: result.message },
        });
        if (result.code === "STALE_REVISION") handleStaleRevision(result.message);
        else if (result.code === "ALREADY_SUBMITTED") {
          toast.error("This evaluation was already submitted and is now read-only.");
          router.push(`/evaluations/${evaluationId}/results`);
        }
        // Other failures (e.g. VALIDATION) are shown inline on the row itself — no toast spam.
      }
    });
  }

  function onRowChange(parameterKey: string, rowKey: string, patch: RowFieldChange, immediate = false) {
    const key = rowKeyOf(parameterKey, rowKey);
    const updated: RowState = { ...rowsRef.current[key], ...patch };
    setRows({ ...rowsRef.current, [key]: updated });

    // A half-typed evidence link can't be saved; hold the row's autosave until it becomes valid
    // (EvidenceFields shows the hint). Any other pending change for this row is saved with it then.
    if (normalizeEvidenceUrl(updated.evidenceUrl) === null) {
      if (debounceTimersRef.current[key]) clearTimeout(debounceTimersRef.current[key]);
      return;
    }

    const debounced =
      "rawPercentage" in patch || "evidenceUrl" in patch || "sourceTitle" in patch || "sourceDate" in patch || "notes" in patch;

    if (debounceTimersRef.current[key]) clearTimeout(debounceTimersRef.current[key]);
    if (debounced && !immediate) {
      debounceTimersRef.current[key] = setTimeout(() => persistRow(key, updated), DEBOUNCE_MS);
    } else {
      persistRow(key, updated);
    }
  }

  function onMetaChange(patch: Partial<MetaState>) {
    const updated = { ...metaRef.current, ...patch };
    setMeta(updated);
    setMetaSaveState("saving");

    if (debounceTimersRef.current["__meta"]) clearTimeout(debounceTimersRef.current["__meta"]);
    debounceTimersRef.current["__meta"] = setTimeout(() => {
      enqueue(async () => {
        const result = await saveEvaluationMeta(evaluationId, revisionRef.current, {
          countryCode: updated.countryCode,
          countryName: updated.countryName,
          assessmentDate: updated.assessmentDate,
          title: updated.title,
          analystNotes: updated.analystNotes,
        });
        if (result.ok) {
          revisionRef.current = result.revision;
          setRevision(result.revision);
          setMetaSaveState("saved");
        } else {
          setMetaSaveState("error");
          if (result.code === "STALE_REVISION") handleStaleRevision(result.message);
          else toast.error(result.message);
        }
      });
    }, DEBOUNCE_MS);
  }

  function retryRow(parameterKey: string, rowKey: string) {
    const key = rowKeyOf(parameterKey, rowKey);
    persistRow(key, rowsRef.current[key]);
  }

  // Stable identities for the memoized ParameterCards. The underlying functions only read refs and
  // state setters, so it is safe to always call the latest version through a ref.
  const handlersRef = useRef({ onRowChange, retryRow });
  useLayoutEffect(() => {
    handlersRef.current = { onRowChange, retryRow };
  });
  const handleCardChange = useCallback(
    (parameterKey: string, rowKey: string, patch: RowFieldChange) =>
      handlersRef.current.onRowChange(parameterKey, rowKey, patch),
    []
  );
  const handleCardRetry = useCallback(
    (parameterKey: string, rowKey: string) => handlersRef.current.retryRow(parameterKey, rowKey),
    []
  );

  const answeredCount = TOTAL_SCORED_ROWS - progress.errors.length;

  return (
    <div className="space-y-6 pb-24">
      <EvaluationHeader meta={meta} onChange={onMetaChange} saveState={metaSaveState} />

      <div className="sticky top-0 z-10 -mx-6 flex items-center justify-between gap-4 border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Progress value={(answeredCount / TOTAL_SCORED_ROWS) * 100} className="h-2 w-40" />
          <span className="text-sm text-muted-foreground">
            {answeredCount} / {TOTAL_SCORED_ROWS} rows complete
          </span>
        </div>
        <Button onClick={() => setReviewOpen(true)} data-testid="review-submit-button">
          Review &amp; submit
        </Button>
      </div>

      <Tabs defaultValue={initial.rubric.categories[0]?.key}>
        <TabsList>
          {initial.rubric.categories.map((c) => (
            <TabsTrigger key={c.key} value={c.key}>
              {c.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {initial.rubric.categories.map((category) => (
          <TabsContent key={category.key} value={category.key} className="space-y-4">
            {category.parameters.map((parameter) => {
              const keys = parameterRowKeys(parameter);
              const parameterRows = keys.map((rk) => rows[rowKeyOf(parameter.key, rk)]).filter(Boolean);
              return (
                <ParameterCard
                  key={parameter.key}
                  parameter={parameter}
                  statusOptions={initial.rubric.statusOptions}
                  rows={parameterRows}
                  resolvedByRowKey={resolvedByParameter[parameter.key] ?? EMPTY_RESOLVED}
                  errorByRowKey={errorByParameter[parameter.key] ?? EMPTY_ERRORS}
                  onChange={handleCardChange}
                  onRetry={handleCardRetry}
                />
              );
            })}
          </TabsContent>
        ))}
      </Tabs>

      <SubmitReviewDialog
        evaluationId={evaluationId}
        revision={revision}
        progress={progress}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
      />
    </div>
  );
}
