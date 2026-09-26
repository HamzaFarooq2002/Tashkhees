import { withApiHandler } from "@/app/api/_lib/http";
import { listMethodologies } from "@/server/services/rubric-service";

export async function GET() {
  return withApiHandler(() => listMethodologies());
}
