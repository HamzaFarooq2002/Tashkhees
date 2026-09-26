import { z } from "zod";

export const countryCodeSchema = z
  .string()
  .trim()
  .length(2, "Use a 2-letter ISO 3166-1 alpha-2 country code")
  .regex(/^[A-Za-z]{2}$/, "Use a 2-letter ISO 3166-1 alpha-2 country code")
  .transform((v) => v.toUpperCase());

export const evaluationMetaSchema = z.object({
  countryCode: countryCodeSchema,
  countryName: z.string().trim().min(1).max(200),
  assessmentDate: z.coerce.date(),
  title: z.string().trim().max(200).nullable().optional(),
  analystNotes: z.string().trim().max(4000).nullable().optional(),
});

export type EvaluationMetaInput = z.infer<typeof evaluationMetaSchema>;

export const availabilityMapSchema = z.record(z.string(), z.boolean());

/**
 * Normalizes an analyst-entered evidence link. Bare domains ("sbp.org.pk/report") get an
 * https:// prefix; only http(s) URLs with a dotted host are accepted. Returns "" for blank input
 * and null when the value can't be made into a valid link. Shared by the editor (to avoid
 * autosaving half-typed URLs) and the server schema (so both agree on what's valid).
 */
export function normalizeEvidenceUrl(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return "";
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url.toString();
  } catch {
    return null;
  }
}

const evidenceUrlSchema = z
  .string()
  .transform((value, ctx) => {
    const normalized = normalizeEvidenceUrl(value);
    if (normalized === null) {
      ctx.addIssue({ code: "custom", message: "Enter a valid evidence link, e.g. https://example.org/report" });
      return z.NEVER;
    }
    return normalized;
  });

// Kept separate from entryInputSchema so REST-only variants (see src/lib/validation/api.ts) can
// .omit()/.extend() the shape — Zod disallows .omit() on a schema that already carries a refinement.
export const entryInputBaseSchema = z.object({
  parameterKey: z.string().min(1),
  rowKey: z.string().min(1),
  standardKey: z.string().min(1).nullable().optional(),
  availability: availabilityMapSchema.nullable().optional(),
  availabilityConfirmed: z.boolean().optional().default(false),
  rawPercentage: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((v) => (v === null || v === undefined || v === "" ? null : Number(v))),
  booleanCapability: z.boolean().nullable().optional(),
  statusKey: z.string().min(1).nullable().optional(),
  evidenceUrl: evidenceUrlSchema.nullable().optional(),
  sourceTitle: z.string().trim().max(300).nullable().optional(),
  sourceDate: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

export function refineRawPercentage<T extends { rawPercentage?: number | null }>(val: T, ctx: z.RefinementCtx) {
  if (val.rawPercentage !== null && val.rawPercentage !== undefined) {
    if (Number.isNaN(val.rawPercentage) || val.rawPercentage < 0 || val.rawPercentage > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["rawPercentage"],
        message: "Percentage must be between 0 and 100",
      });
    }
  }
}

export const entryInputSchema = entryInputBaseSchema.superRefine(refineRawPercentage);

export type EntryInputPayload = z.infer<typeof entryInputSchema>;
