import { sendEmail } from "@/lib/messaging";
import { createMagicLink } from "./verification.service";

export async function sendBatchNotifications(
  recipients: string[],
  authMethod: string,
  campaignId: string,
  campaignName: string,
  payoutAmount: number,
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

      const amountInSol = (payoutAmount / 1e9).toFixed(4);
      const subject = `Claim ${amountInSol} SOL from ${campaignName}`;
      const html = `
        <p>Hello,</p>
        <p>You're eligible to claim <strong>${amountInSol} SOL</strong> from the <strong>${campaignName}</strong> campaign.</p>
        <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;text-decoration:none;border-radius:6px;">Claim Now</a></p>
        <p>Or copy this link: ${link}</p>
      `;

      const success = authMethod === "email" ? await sendEmail(recipient, subject, html) : false;

      if (success) sent++;
      else failed++;
    } catch (error) {
      console.error(`Failed to notify ${recipient}:`, error);
      failed++;
    }
  }

  return { sent, failed };
}
