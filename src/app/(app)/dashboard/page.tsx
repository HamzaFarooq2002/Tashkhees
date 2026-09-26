import Link from "next/link";
import { listEvaluations } from "@/server/actions/evaluations";
import { NewEvaluationDialog } from "@/components/dashboard/new-evaluation-dialog";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { EvaluationRowActions } from "@/components/dashboard/evaluation-row-actions";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDisplay, Decimal } from "@/lib/scoring/decimal-config";
import { redirectIfUnauthenticated } from "@/lib/auth/page-guard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const status = params.status === "DRAFT" || params.status === "SUBMITTED" ? params.status : "ALL";

  let evaluations: Awaited<ReturnType<typeof listEvaluations>> = [];
  let loadError: string | null = null;
  try {
    evaluations = await listEvaluations({ search: params.q, status });
  } catch (err) {
    redirectIfUnauthenticated(err, "/dashboard");
    console.error("Failed to load evaluations", err);
    loadError = "We couldn't load your evaluations. Please refresh the page to try again.";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Evaluations</h1>
          <p className="text-sm text-muted-foreground">
            Country-level Instant Payment System readiness assessments.
          </p>
        </div>
        <NewEvaluationDialog />
      </div>

      <DashboardFilters />

      {loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {loadError}
        </div>
      ) : evaluations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm font-medium text-foreground">No evaluations yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first evaluation to start assessing a country&apos;s readiness.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>Assessment date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Last edited</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluations.map((evaluation) => (
                <TableRow key={evaluation.id}>
                  <TableCell>
                    <Link
                      href={
                        evaluation.status === "SUBMITTED"
                          ? `/evaluations/${evaluation.id}/results`
                          : `/evaluations/${evaluation.id}`
                      }
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {evaluation.countryName}
                      <span className="ml-1 text-muted-foreground">({evaluation.countryCode})</span>
                    </Link>
                    {evaluation.title && <p className="text-xs text-muted-foreground">{evaluation.title}</p>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(evaluation.assessmentDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={evaluation.status === "SUBMITTED" ? "default" : "secondary"}>
                      {evaluation.status === "SUBMITTED" ? "Submitted" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {evaluation.totalScore !== null ? `${formatDisplay(new Decimal(evaluation.totalScore))} / 100` : "Not scored"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(evaluation.updatedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <EvaluationRowActions
                      evaluationId={evaluation.id}
                      countryName={evaluation.countryName}
                      status={evaluation.status}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
