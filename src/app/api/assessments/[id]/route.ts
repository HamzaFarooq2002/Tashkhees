import { withApiHandler } from "@/app/api/_lib/http";
import { getEvaluationForEdit } from "@/server/services/evaluation-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiHandler(() => getEvaluationForEdit(id));
}
