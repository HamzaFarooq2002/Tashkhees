import { notFound, redirect } from "next/navigation";
import { getEvaluationResults } from "@/server/actions/results";
import { ActionError } from "@/server/actions/shared";
import { redirectIfUnauthenticated } from "@/lib/auth/page-guard";
import { ResultsView } from "@/components/results/results-view";
import { EvaluationRowActions } from "@/components/dashboard/evaluation-row-actions";
import { Badge } from "@/components/ui/badge";

export default async function EvaluationResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data;
  try {
    data = await getEvaluationResults(id);
  } catch (err) {
    redirectIfUnauthenticated(err, `/evaluations/${id}/results`);
    if (err instanceof ActionError && err.code === "NOT_FOUND") notFound();
    if (err instanceof ActionError && err.code === "VALIDATION") redirect(`/evaluations/${id}`);
    throw err;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {data.evaluation.countryName} ({data.evaluation.countryCode})
            </h1>
            <Badge>Submitted</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Assessment date {new Date(data.evaluation.assessmentDate).toLocaleDateString()} · Submitted{" "}
            {data.evaluation.submittedAt ? new Date(data.evaluation.submittedAt).toLocaleString() : "—"}
          </p>
        </div>
        <EvaluationRowActions evaluationId={id} countryName={data.evaluation.countryName} status="SUBMITTED" />
      </div>

      <ResultsView data={data} />
    </div>
  );
}
