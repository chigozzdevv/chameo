import nodemailer from "nodemailer";
import { env } from "@/config";

const transporter = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : null;

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!transporter) {
    console.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}`);
    return true;
  }
  try {
    await transporter.sendMail({ from: env.smtp.from, to, subject, html });
    return true;
  } catch (error) {
    console.error("Email send failed:", error);
    return false;
  }
}
