"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { submitEvaluation } from "@/server/actions/submit";
import type { ScoringResult } from "@/lib/scoring/engine";
import { TOTAL_SCORED_ROWS } from "./types";

export function SubmitReviewDialog({
  evaluationId,
  revision,
  progress,
  open,
  onOpenChange,
}: {
  evaluationId: string;
  revision: number;
  progress: ScoringResult;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [navigating, startNavigation] = useTransition();

  const answeredCount = TOTAL_SCORED_ROWS - progress.errors.length;
  const missingByParameter = new Map<string, string[]>();
  for (const error of progress.errors) {
    const list = missingByParameter.get(error.parameterKey) ?? [];
    list.push(error.message);
    missingByParameter.set(error.parameterKey, list);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const result = await submitEvaluation(evaluationId, revision);
      if (!result.ok) {
        if (result.code === "STALE_REVISION") {
          toast.error(result.message);
          router.refresh();
        } else {
          toast.error("This evaluation is still incomplete — nothing was submitted.");
        }
        return;
      }
      toast.success("Evaluation submitted");
      startNavigation(() => router.push(`/evaluations/${evaluationId}/results`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit evaluation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review before submitting</DialogTitle>
          <DialogDescription>
            All 24 scored rows must be complete before this evaluation can be scored and submitted.
            Submitted evaluations are read-only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Progress value={(answeredCount / TOTAL_SCORED_ROWS) * 100} className="h-2" />
            <span className="whitespace-nowrap text-sm text-muted-foreground">
              {answeredCount} / {TOTAL_SCORED_ROWS} rows
            </span>
          </div>

          {progress.ok ? (
            <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" /> This evaluation is complete and ready to submit.
            </div>
          ) : (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                <CircleAlert className="h-4 w-4" /> {progress.errors.length} row(s) still need attention:
              </p>
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-3 text-sm text-muted-foreground">
                {[...missingByParameter.entries()].map(([parameterKey, messages]) => (
                  <li key={parameterKey}>
                    <span className="font-medium text-foreground">{parameterKey.replace(/_/g, " ")}</span>
                    {": "}
                    {messages[0]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep editing
          </Button>
          <Button onClick={handleSubmit} disabled={!progress.ok || submitting || navigating} data-testid="confirm-submit-button">
            {submitting || navigating ? "Submitting…" : "Submit evaluation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
