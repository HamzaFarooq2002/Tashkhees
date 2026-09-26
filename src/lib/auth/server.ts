import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email/mailer";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ to: user.email, url });
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Every new account gets its own private organization; all
          // evaluations are scoped to organizations, never directly to
          // users, and every server operation checks membership.
          const organization = await prisma.organization.create({
            data: { name: `${user.name || user.email}'s Organization` },
          });
          await prisma.membership.create({
            data: { userId: user.id, organizationId: organization.id, role: "OWNER" },
          });
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
