import { withApiHandler } from "@/app/api/_lib/http";
import { createEvaluation } from "@/server/services/evaluation-service";

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const body = await request.json();
    return createEvaluation(body);
  });
}
