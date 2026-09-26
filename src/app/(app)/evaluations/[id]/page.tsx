import { notFound, redirect } from "next/navigation";
import { getEvaluationForEdit } from "@/server/actions/evaluations";
import { ActionError } from "@/server/actions/shared";
import { redirectIfUnauthenticated } from "@/lib/auth/page-guard";
import { EvaluationEditor } from "@/components/evaluation/evaluation-editor";

export default async function EvaluationEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let payload;
  try {
    payload = await getEvaluationForEdit(id);
  } catch (err) {
    redirectIfUnauthenticated(err, `/evaluations/${id}`);
    if (err instanceof ActionError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  if (payload.evaluation.status === "SUBMITTED") {
    redirect(`/evaluations/${id}/results`);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {payload.evaluation.countryName} ({payload.evaluation.countryCode})
        </h1>
        <p className="text-sm text-muted-foreground">Draft evaluation · autosaves as you go</p>
      </div>
      <EvaluationEditor initial={payload} />
    </div>
  );
}
