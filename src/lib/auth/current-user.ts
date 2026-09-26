import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./server";
import { prisma } from "@/lib/db";

export class AuthError extends Error {
  code: "UNAUTHENTICATED" | "NO_ORGANIZATION" | "FORBIDDEN";
  constructor(code: "UNAUTHENTICATED" | "NO_ORGANIZATION" | "FORBIDDEN") {
    super(code);
    this.code = code;
  }
}

/** Deduplicated per request via React `cache()` — layouts, pages and services can all call it freely. */
export const getCurrentSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/**
 * Resolves the authenticated user's organization membership server-side.
 * Never accept an organizationId from the client — every evaluation
 * operation must be scoped to the membership resolved here.
 * Deduplicated per request (never across requests or users) via React `cache()`.
 */
export const requireCurrentUserWithOrg = cache(async () => {
  const session = await getCurrentSession();
  if (!session) {
    throw new AuthError("UNAUTHENTICATED");
  }
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) {
    throw new AuthError("NO_ORGANIZATION");
  }
  return { user: session.user, organization: membership.organization, membership };
});
