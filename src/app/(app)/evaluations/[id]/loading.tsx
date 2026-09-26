import { Skeleton } from "@/components/ui/skeleton";

export default function EvaluationLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading evaluation">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-52" />
      </div>
      <Skeleton className="h-44 w-full rounded-xl" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-2 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-9 w-full max-w-lg" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-56 w-full rounded-xl" />
      ))}
    </div>
  );
}
