"use client";

import type { FormStatusOption } from "@/lib/rubric/formView";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function StatusSelect({
  statusOptions,
  value,
  onChange,
  disabled,
  testId,
}: {
  statusOptions: FormStatusOption[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  testId?: string;
}) {
  // Always pass a string so Radix keeps this a controlled component for its whole
  // lifetime — `undefined` would make it uncontrolled until the first selection.
  // An empty string renders the placeholder.
  return (
    <Select
      value={value ?? ""}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
      disabled={disabled}
    >
      <SelectTrigger className="w-full sm:w-56" data-testid={testId}>
        <SelectValue placeholder="Select implementation status" />
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((s) => (
          <SelectItem key={s.key} value={s.key}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
