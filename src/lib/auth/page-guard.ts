import "server-only";
import { redirect } from "next/navigation";
import { AuthError } from "./current-user";

/**
 * For Server Component pages: turns an expired/missing session into a redirect to the login page
 * (returning the user here afterwards) instead of a 500. Any other error is left for the caller.
 */
export function redirectIfUnauthenticated(err: unknown, returnTo: string): void {
  if (err instanceof AuthError && err.code === "UNAUTHENTICATED") {
    redirect(`/login?redirectTo=${encodeURIComponent(returnTo)}`);
  }
}
