import { env } from "@/config";
import type { AuthProvider, SocialVerificationResult } from "./types";

export const githubProvider: AuthProvider = {
  getAuthUrl({ redirectUri, state }: { campaignId: string; redirectUri: string; state: string }): string {
    if (!env.oauth.github.clientId || !env.oauth.github.clientSecret) {
      throw new Error("GitHub OAuth not configured");
    }
    const params = new URLSearchParams({
      client_id: env.oauth.github.clientId,
      redirect_uri: redirectUri,
      scope: "read:user",
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  },

  async verify({ code }: { code?: string }): Promise<SocialVerificationResult> {
    try {
      if (!code) {
        return { valid: false, error: "Missing authorization code" };
      }
      if (!env.oauth.github.clientId || !env.oauth.github.clientSecret) {
        return { valid: false, error: "GitHub OAuth not configured" };
      }
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: env.oauth.github.clientId,
          client_secret: env.oauth.github.clientSecret,
          code,
        }),
      });

      const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
      if (!tokenData.access_token) {
        return { valid: false, error: tokenData.error || "Failed to get access token" };
      }

      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "Chameo" },
      });

      const userData = (await userRes.json()) as { login?: string };
      if (!userData.login) {
        return { valid: false, error: "Failed to get user info" };
      }

      return { valid: true, identifier: userData.login.toLowerCase() };
    } catch (error) {
      console.error("GitHub verification error:", error);
      return { valid: false, error: "GitHub verification failed" };
    }
  },
};
