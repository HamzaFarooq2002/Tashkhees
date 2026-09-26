import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { actionErrorToResponse, statusForResultCode } from "@/app/api/_lib/http";
import { restEntryUpdateSchema } from "@/lib/validation/api";
import { parseRowId } from "@/lib/validation/rowId";
import { saveEntry } from "@/server/services/entry-service";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; rowId: string }> }) {
  const { id, rowId } = await params;
  const parsedRowId = parseRowId(rowId);
  if (!parsedRowId) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: `Invalid row id "${rowId}" — expected "parameterKey:rowKey"` } },
      { status: 422 }
    );
  }

  try {
    const body = await request.json();
    const { expectedRevision, ...entryFields } = restEntryUpdateSchema.parse(body);

    const result = await saveEntry(id, expectedRevision, {
      parameterKey: parsedRowId.parameterKey,
      rowKey: parsedRowId.rowKey,
      ...entryFields,
    });

    if (!result.ok) {
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
