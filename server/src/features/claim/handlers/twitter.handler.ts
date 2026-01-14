import { config } from "@/config";
import type { SocialHandler, SocialVerificationResult } from "./handler.types";

export const twitterHandler: SocialHandler = {
  getAuthUrl(campaignId: string, redirectUri: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.oauth.twitter.clientId,
      redirect_uri: redirectUri,
      scope: "users.read tweet.read",
      state: campaignId,
      code_challenge: "challenge",
      code_challenge_method: "plain",
    });
    return `https://twitter.com/i/oauth2/authorize?${params}`;
  },
  async verify(code: string): Promise<SocialVerificationResult> {
    try {
      const auth = Buffer.from(`${config.oauth.twitter.clientId}:${config.oauth.twitter.clientSecret}`).toString("base64");
      const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: config.oauth.twitter.redirectUri,
          code_verifier: "challenge",
        }),
      });
      const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
      if (!tokenData.access_token) return { valid: false, error: tokenData.error || "Failed to get access token" };
      const userRes = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = (await userRes.json()) as { data?: { username?: string } };
      if (!userData.data?.username) return { valid: false, error: "Failed to get user info" };
      return { valid: true, identifier: userData.data.username.toLowerCase() };
    } catch (error) {
      console.error("Twitter verification error:", error);
      return { valid: false, error: "Twitter verification failed" };
    }
  },
};
