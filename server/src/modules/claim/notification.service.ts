import { sendEmail, sendSms } from "@/lib/messaging";
import { createMagicLink } from "./verification.service";

export async function sendBatchNotifications(
  recipients: string[],
  authMethod: string,
  campaignId: string,
  campaignName: string,
  baseUrl: string,
  useMagicLinks: boolean
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      let link: string;

      if (useMagicLinks) {
        const token = await createMagicLink(authMethod, recipient, campaignId);
        link = `${baseUrl}/claim/${campaignId}?token=${token}`;
      } else {
        link = `${baseUrl}/claim/${campaignId}`;
      }

      const subject = `Claim your ${campaignName} payout`;
      const html = `
        <p>You have a payout waiting from <strong>${campaignName}</strong>!</p>
        <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;text-decoration:none;border-radius:6px;">Claim Now</a></p>
        <p>Or copy this link: ${link}</p>
      `;

      const success = authMethod === "email" ? await sendEmail(recipient, subject, html) : await sendSms(recipient, `${subject}: ${link}`);

      if (success) sent++;
      else failed++;
    } catch (error) {
      console.error(`Failed to notify ${recipient}:`, error);
      failed++;
    }
  }

  return { sent, failed };
}
