"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizeEvidenceUrl } from "@/lib/validation/evaluation";

export function EvidenceFields({
  evidenceUrl,
  sourceTitle,
  sourceDate,
  notes,
  onChange,
  disabled,
  idPrefix,
}: {
  evidenceUrl: string;
  sourceTitle: string;
  sourceDate: string;
  notes: string;
  onChange: (patch: { evidenceUrl?: string; sourceTitle?: string; sourceDate?: string; notes?: string }) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  const [open, setOpen] = useState(Boolean(evidenceUrl || sourceTitle || sourceDate || notes));
  const urlInvalid = normalizeEvidenceUrl(evidenceUrl) === null;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Evidence &amp; notes (optional)
      </button>
      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-evidence`} className="text-xs">
              Evidence URL
            </Label>
            <Input
              id={`${idPrefix}-evidence`}
              value={evidenceUrl}
              disabled={disabled}
              onChange={(e) => onChange({ evidenceUrl: e.target.value })}
              placeholder="https://…"
              aria-invalid={urlInvalid || undefined}
              aria-describedby={urlInvalid ? `${idPrefix}-evidence-error` : undefined}
            />
            {urlInvalid && (
              <p id={`${idPrefix}-evidence-error`} className="text-xs text-destructive">
                Enter a full link, e.g. https://example.org/report — it will save once valid.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-source-title`} className="text-xs">
              Source title
            </Label>
            <Input
              id={`${idPrefix}-source-title`}
              value={sourceTitle}
              disabled={disabled}
              onChange={(e) => onChange({ sourceTitle: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-source-date`} className="text-xs">
              Source date / year
            </Label>
            <Input
              id={`${idPrefix}-source-date`}
              value={sourceDate}
              disabled={disabled}
              onChange={(e) => onChange({ sourceDate: e.target.value })}
              placeholder="2025"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`${idPrefix}-notes`} className="text-xs">
              Analyst notes
            </Label>
            <Textarea
              id={`${idPrefix}-notes`}
              value={notes}
              disabled={disabled}
              onChange={(e) => onChange({ notes: e.target.value })}
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}
