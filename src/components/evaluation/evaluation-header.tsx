"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SaveIndicator } from "./save-indicator";
import type { SaveState } from "./types";

export interface MetaState {
  countryCode: string;
  countryName: string;
  assessmentDate: string;
  title: string;
  analystNotes: string;
}

export function EvaluationHeader({
  meta,
  onChange,
  saveState,
}: {
  meta: MetaState;
  onChange: (patch: Partial<MetaState>) => void;
  saveState: SaveState;
}) {
  return (
    <Card>
      <CardContent className="grid gap-4 pt-6 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="meta-country-code">Country code</Label>
          <Input
            id="meta-country-code"
            maxLength={2}
            value={meta.countryCode}
            onChange={(e) => onChange({ countryCode: e.target.value.toUpperCase() })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="meta-country-name">Country name</Label>
          <Input
            id="meta-country-name"
            value={meta.countryName}
            onChange={(e) => onChange({ countryName: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-date">Assessment date</Label>
          <Input
            id="meta-date"
            type="date"
            value={meta.assessmentDate}
            onChange={(e) => onChange({ assessmentDate: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="meta-title">Title (optional)</Label>
          <Input id="meta-title" value={meta.title} onChange={(e) => onChange({ title: e.target.value })} />
        </div>
        <div className="flex items-end justify-end gap-2 sm:col-span-2">
          <SaveIndicator state={saveState} />
        </div>
        <div className="space-y-1.5 sm:col-span-4">
          <Label htmlFor="meta-notes">Analyst notes (optional)</Label>
          <Textarea
            id="meta-notes"
            rows={2}
            value={meta.analystNotes}
            onChange={(e) => onChange({ analystNotes: e.target.value })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
