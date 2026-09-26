import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ActionError } from "@/server/actions/shared";
import { AuthError } from "@/lib/auth/current-user";

const ACTION_ERROR_STATUS: Record<ActionError["code"], number> = {
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  ALREADY_SUBMITTED: 409,
  STALE_REVISION: 409,
  VALIDATION: 422,
  INCOMPLETE: 409,
};

const AUTH_ERROR_STATUS: Record<AuthError["code"], number> = {
  UNAUTHENTICATED: 401,
  NO_ORGANIZATION: 403,
  FORBIDDEN: 403,
};

/** Maps a known error type to an HTTP error response, or returns null if the error isn't recognized (caller should rethrow). */
export function actionErrorToResponse(err: unknown): NextResponse | null {
  if (err instanceof ActionError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: ACTION_ERROR_STATUS[err.code] ?? 500 }
    );
  }
  if (err instanceof AuthError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: AUTH_ERROR_STATUS[err.code] ?? 500 }
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: err.issues[0]?.message ?? "Invalid input", issues: err.issues } },
      { status: 422 }
    );
  }
  return null;
}

/** For services that return a `{ok:false, code, message}` result instead of throwing (saveEntry, saveEvaluationMeta, submitEvaluation) — maps that code to an HTTP status. */
export function statusForResultCode(code: string): number {
  return (ACTION_ERROR_STATUS as Record<string, number>)[code] ?? 500;
}

/** Wraps a route handler body: 200 { data } on success; maps known errors to their status code; rethrows (→ 500) otherwise. */
export async function withApiHandler<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json({ data });
  } catch (err) {
    const mapped = actionErrorToResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
