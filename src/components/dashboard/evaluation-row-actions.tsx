"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteEvaluation, duplicateEvaluation } from "@/server/actions/evaluations";

export function EvaluationRowActions({
  evaluationId,
  countryName,
  status,
}: {
  evaluationId: string;
  countryName: string;
  status: "DRAFT" | "SUBMITTED";
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleOpen() {
    router.push(status === "SUBMITTED" ? `/evaluations/${evaluationId}/results` : `/evaluations/${evaluationId}`);
  }

  async function handleDuplicate() {
    setBusy(true);
    try {
      const { id } = await duplicateEvaluation(evaluationId);
      toast.success("Duplicated as a new draft");
      router.push(`/evaluations/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not duplicate evaluation");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteEvaluation(evaluationId);
      toast.success("Evaluation deleted");
      setConfirmOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete evaluation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${countryName}`} data-testid="row-actions-trigger">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleOpen} data-testid="row-action-open">
            Open
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDuplicate} disabled={busy} data-testid="row-action-duplicate">
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setConfirmOpen(true)}
            data-testid="row-action-delete"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete evaluation?</DialogTitle>
            <DialogDescription>
              This permanently deletes the {status === "SUBMITTED" ? "submitted" : "draft"} evaluation for{" "}
              <span className="font-medium text-foreground">{countryName}</span>. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy} data-testid="confirm-delete-button">
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
