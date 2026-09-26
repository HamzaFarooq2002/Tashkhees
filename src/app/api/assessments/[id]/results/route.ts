import { withApiHandler } from "@/app/api/_lib/http";
import { getEvaluationResults } from "@/server/services/results-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiHandler(() => getEvaluationResults(id));
}
