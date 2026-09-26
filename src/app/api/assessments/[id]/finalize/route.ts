import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { actionErrorToResponse, statusForResultCode } from "@/app/api/_lib/http";
import { finalizeRequestSchema } from "@/lib/validation/api";
import { finalizeEvaluation } from "@/server/services/submit-service";

/** REST "finalize" is the same operation as the existing "submit" concept — see SCORING_DECISIONS.md. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { expectedRevision } = finalizeRequestSchema.parse(body);

    const result = await finalizeEvaluation(id, expectedRevision);

    if (!result.ok) {
      if (result.code === "INCOMPLETE") {
        return NextResponse.json(
          { error: { code: "INCOMPLETE", message: "Evaluation cannot be finalized: some rows are missing, invalid, or unresolved", errors: result.errors } },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: { code: result.code, message: result.message } },
        { status: statusForResultCode(result.code) }
      );
    }
    return NextResponse.json({ data: result });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: err.issues[0]?.message ?? "Invalid input", issues: err.issues } },
        { status: 422 }
      );
    }
    const mapped = actionErrorToResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
