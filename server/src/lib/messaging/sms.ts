import { env } from "@/config";

export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!env.twilio.accountSid) {
    console.log(`[DEV SMS] To: ${to} | Body: ${body}`);
    return true;
  }
  try {
    const auth = Buffer.from(`${env.twilio.accountSid}:${env.twilio.authToken}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.twilio.accountSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: env.twilio.phoneNumber, Body: body }),
    });
    return res.ok;
  } catch (error) {
    console.error("SMS send failed:", error);
    return false;
  }
}
