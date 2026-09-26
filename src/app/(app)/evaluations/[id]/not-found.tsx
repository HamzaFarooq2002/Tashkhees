import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EvaluationNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <FileQuestion className="h-6 w-6" />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">Evaluation not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This evaluation doesn&apos;t exist, was deleted, or belongs to a different account. Make sure you&apos;re
        signed in with the account that created it.
      </p>
      <Button className="mt-6" asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
