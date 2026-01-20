import { env } from "@/config";
import type { AuthProvider, SocialVerificationResult } from "./types";

export const discordProvider: AuthProvider = {
  getAuthUrl({ redirectUri, state }: { campaignId: string; redirectUri: string; state: string }): string {
    if (!env.oauth.discord.clientId || !env.oauth.discord.clientSecret) {
      throw new Error("Discord OAuth not configured");
    }
    const params = new URLSearchParams({
      client_id: env.oauth.discord.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "identify",
      state,
    });
    return `https://discord.com/api/oauth2/authorize?${params}`;
  },

  async verify({
    code,
    redirectUri,
  }: {
    code?: string;
    redirectUri?: string;
  }): Promise<SocialVerificationResult> {
    try {
      if (!code) {
        return { valid: false, error: "Missing authorization code" };
      }
      if (!env.oauth.discord.clientId || !env.oauth.discord.clientSecret) {
        return { valid: false, error: "Discord OAuth not configured" };
      }
      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.oauth.discord.clientId,
          client_secret: env.oauth.discord.clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri || env.oauth.discord.redirectUri,
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

      const identifier = userData.username ? userData.username.toLowerCase() : userData.id;
      return { valid: true, identifier };
    } catch (error) {
      console.error("Discord verification error:", error);
      return { valid: false, error: "Discord verification failed" };
    }
  },
};
