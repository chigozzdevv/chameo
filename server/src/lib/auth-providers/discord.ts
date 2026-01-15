import { env } from "@/config";
import type { AuthProvider, SocialVerificationResult } from "./types";

export const discordProvider: AuthProvider = {
  getAuthUrl(campaignId: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: env.oauth.discord.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "identify",
      state: campaignId,
    });
    return `https://discord.com/api/oauth2/authorize?${params}`;
  },

  async verify(code: string): Promise<SocialVerificationResult> {
    try {
      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.oauth.discord.clientId,
          client_secret: env.oauth.discord.clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: env.oauth.discord.redirectUri,
        }),
      });

      const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
      if (!tokenData.access_token) {
        return { valid: false, error: tokenData.error || "Failed to get access token" };
      }

      const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      const userData = (await userRes.json()) as { id?: string; username?: string };
      if (!userData.id) {
        return { valid: false, error: "Failed to get user info" };
      }

      return { valid: true, identifier: userData.id };
    } catch (error) {
      console.error("Discord verification error:", error);
      return { valid: false, error: "Discord verification failed" };
    }
  },
};
