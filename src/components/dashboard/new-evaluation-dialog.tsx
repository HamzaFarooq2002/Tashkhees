"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { createEvaluation } from "@/server/actions/evaluations";

export function NewEvaluationDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [countryCode, setCountryCode] = useState("");
  const [countryName, setCountryName] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navigating, startNavigation] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await createEvaluation({ countryCode, countryName, assessmentDate, title });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const { id } = result;
      toast.success("Draft evaluation created");
      // Keep the dialog in its pending state until the editor has rendered.
      startNavigation(() => router.push(`/evaluations/${id}`));
    } catch (err) {
      console.error(err);
      setError("Could not create the evaluation. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="new-evaluation-trigger">
          <Plus className="h-4 w-4" />
          New evaluation
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New evaluation</DialogTitle>
            <DialogDescription>
              Start a new draft assessment. You can complete it over multiple sessions before submitting.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="countryCode">Country code</Label>
                <Input
                  id="countryCode"
                  placeholder="PK"
                  maxLength={2}
                  pattern="[A-Za-z]{2}"
                  title="Use a 2-letter ISO country code, e.g. PK"
                  required
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assessmentDate">Assessment date</Label>
                <Input
                  id="assessmentDate"
                  type="date"
                  required
                  value={assessmentDate}
                  onChange={(e) => setAssessmentDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="countryName">Country name</Label>
              <Input
                id="countryName"
                placeholder="Pakistan"
                required
                value={countryName}
                onChange={(e) => setCountryName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                placeholder="e.g. 2026 annual review"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || navigating} data-testid="create-evaluation-submit">
              {loading || navigating ? "Creating…" : "Create draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
