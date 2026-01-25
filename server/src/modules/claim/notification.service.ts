import { sendEmail } from "@/lib/messaging";
import { renderEmailTemplate } from "@/lib/messaging/template";
import { env } from "@/config";
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
      const html = renderEmailTemplate({
        title: `Claim ${amountInSol} SOL`,
        preheader: `Claim ${amountInSol} SOL from ${campaignName}.`,
        body: `
          <p style="margin:0 0 12px;">You're eligible to claim <strong>${amountInSol} SOL</strong> from <strong>${campaignName}</strong>.</p>
          <p style="margin:0;">Use the link below to complete your claim.</p>
        `,
        cta: { label: "Claim payout", url: link },
      });

      const success =
        authMethod === "email"
          ? await sendEmail(recipient, subject, html, { from: env.resend.fromClaims })
          : false;

      if (success) sent++;
      else failed++;
    } catch (error) {
      console.error(`Failed to notify ${recipient}:`, error);
      failed++;
    }
  }

  return { sent, failed };
}
