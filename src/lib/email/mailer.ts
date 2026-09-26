import "server-only";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let cachedTransporter: Transporter | null = null;

function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "localhost",
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
  }
  return cachedTransporter;
}

export async function sendPasswordResetEmail({ to, url }: { to: string; url: string }) {
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || "Tashkhees <no-reply@tashkhees.local>",
    to,
    subject: "Reset your Tashkhees password",
    text: `A password reset was requested for your Tashkhees account.\n\nReset your password: ${url}\n\nThis link expires in 1 hour and can only be used once. If you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family: sans-serif; color: #0f172a;">
        <h2 style="color:#0f172a;">Reset your Tashkhees password</h2>
        <p>A password reset was requested for your Tashkhees account.</p>
        <p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#0d9488;color:#fff;border-radius:6px;text-decoration:none;">Reset your password</a></p>
        <p style="color:#475569;font-size:13px;">This link expires in 1 hour and can only be used once. If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}
