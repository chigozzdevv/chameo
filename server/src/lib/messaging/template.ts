import { env } from "@/config";

type EmailTemplateOptions = {
  title: string;
  body: string;
  cta?: { label: string; url: string };
  footer?: string;
  preheader?: string;
};

export function getFrontendUrl(): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  const origin = env.cors.origin?.split(",")[0]?.trim();
  return origin || "http://localhost:3000";
}

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function renderEmailTemplate({ title, body, cta, footer, preheader }: EmailTemplateOptions): string {
  const baseUrl = normalizeBaseUrl(getFrontendUrl());
  const logoUrl = `${baseUrl}/chameo-logo.png`;
  const ctaHtml = cta
    ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
          <tr>
            <td>
              <a
                href="${cta.url}"
                style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:600;"
              >
                ${cta.label}
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:12px;color:#94a3b8;">
          If the button doesn't work, paste this link into your browser:
          <br />
          <a href="${cta.url}" style="color:#0f172a;text-decoration:none;">${cta.url}</a>
        </p>
      `
    : "";
  const footerHtml =
    footer ||
    "Chameo · Privacy-first payouts and encrypted voting.";
  const preheaderHtml = preheader
    ? `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;mso-hide:all;">${preheader}</span>`
    : "";

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;background:#f8fafc;">
    ${preheaderHtml}
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;text-align:left;font-family:Space Grotesk,Arial,sans-serif;">
            <tr>
              <td>
                <img src="${logoUrl}" alt="Chameo" width="120" style="display:block;border:0;outline:none;text-decoration:none;margin-bottom:20px;" />
                <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f172a;">${title}</h1>
                <div style="font-size:15px;line-height:1.6;color:#475569;">
                  ${body}
                </div>
                ${ctaHtml}
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;font-family:Space Grotesk,Arial,sans-serif;">
            ${footerHtml}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}
