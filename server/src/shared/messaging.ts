import nodemailer from "nodemailer";
import { config } from "@/config";

const transporter = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!transporter) {
    console.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}`);
    return true;
  }
  try {
    await transporter.sendMail({ from: config.smtp.from, to, subject, html });
    return true;
  } catch (error) {
    console.error("Email send failed:", error);
    return false;
  }
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!config.twilio.accountSid) {
    console.log(`[DEV SMS] To: ${to} | Body: ${body}`);
    return true;
  }
  try {
    const auth = Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: config.twilio.phoneNumber, Body: body }),
    });
    return res.ok;
  } catch (error) {
    console.error("SMS send failed:", error);
    return false;
  }
}
