export async function sendSms(to: string, body: string): Promise<boolean> {
  console.log(`[SMS] To: ${to} | Body: ${body}`);
  return true;
}
