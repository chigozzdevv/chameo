import { Resend } from "resend";
import { env } from "@/config";

const resend = new Resend(env.resend.apiKey);

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options?: { from?: string }
): Promise<boolean> {
  if (!env.resend.apiKey) {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from: options?.from || env.resend.from,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("Email send failed:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Email send failed:", error);
    return false;
  }
}
