import { withApiHandler } from "@/app/api/_lib/http";
import { getMethodology } from "@/server/services/rubric-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiHandler(() => getMethodology(id));
}
