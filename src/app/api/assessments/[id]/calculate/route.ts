import { withApiHandler } from "@/app/api/_lib/http";
import { calculateEvaluation } from "@/server/services/evaluation-service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiHandler(() => calculateEvaluation(id));
}
