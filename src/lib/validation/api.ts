import { z } from "zod";
import { entryInputBaseSchema, refineRawPercentage } from "./evaluation";

/** PUT /api/assessments/:id/responses/:rowId — parameterKey/rowKey come from the URL, not the body. */
export const restEntryUpdateSchema = entryInputBaseSchema
  .omit({ parameterKey: true, rowKey: true })
  .extend({ expectedRevision: z.coerce.number().int().nonnegative() })
  .superRefine(refineRawPercentage);
export type RestEntryUpdateInput = z.infer<typeof restEntryUpdateSchema>;

export const finalizeRequestSchema = z.object({
  expectedRevision: z.coerce.number().int().nonnegative(),
});
export type FinalizeRequestInput = z.infer<typeof finalizeRequestSchema>;
