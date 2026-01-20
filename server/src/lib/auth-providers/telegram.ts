import * as crypto from "crypto";
import { env } from "@/config";
import type { AuthProvider, SocialVerificationResult } from "./types";

export const telegramProvider: AuthProvider = {
  getAuthUrl({ redirectUri, state }: { campaignId: string; redirectUri: string; state: string }): string {
    if (!env.oauth.telegram.botId || !env.oauth.telegram.botToken) {
      throw new Error("Telegram OAuth not configured");
    }
    const returnTo = new URL(redirectUri);
    returnTo.searchParams.set("state", state);
    const origin = new URL(redirectUri).origin;
    const params = new URLSearchParams({
      bot_id: env.oauth.telegram.botId,
      origin,
      return_to: returnTo.toString(),
    });
    return `https://oauth.telegram.org/auth?${params}`;
  },

  async verify({
    authData,
  }: {
    authData?: Record<string, string>;
  }): Promise<SocialVerificationResult> {
    try {
      if (!env.oauth.telegram.botToken) {
        return { valid: false, error: "Telegram OAuth not configured" };
      }
      if (!authData || !authData.id || !authData.hash || !authData.auth_date) {
        return { valid: false, error: "Missing Telegram auth data" };
      }

      // Verify Telegram auth hash using bot token
      const { hash, ...data } = authData;
      const dataCheckString = Object.keys(data)
        .sort()
        .map((key) => `${key}=${data[key]}`)
        .join("\n");

      const secretKey = crypto.createHash("sha256").update(env.oauth.telegram.botToken).digest();
      const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

      if (hmac !== hash) {
        return { valid: false, error: "Invalid Telegram auth hash" };
      }

      // Reject auth data older than 24 hours
      const authDate = parseInt(authData.auth_date, 10);
      if (Date.now() / 1000 - authDate > 86400) {
        return { valid: false, error: "Telegram auth expired" };
      }

      const identifier = authData.username ? authData.username.toLowerCase() : authData.id;
      return { valid: true, identifier };
    } catch (error) {
      console.error("Telegram verification error:", error);
      return { valid: false, error: "Telegram verification failed" };
    }
  },
};
