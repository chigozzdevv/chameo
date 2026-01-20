import { env } from "@/config";
import type { AuthProvider, SocialVerificationResult } from "./types";

export const twitterProvider: AuthProvider = {
  getAuthUrl({
    redirectUri,
    state,
    codeChallenge,
  }: {
    campaignId: string;
    redirectUri: string;
    state: string;
    codeChallenge?: string;
  }): string {
    if (!env.oauth.twitter.clientId || !env.oauth.twitter.clientSecret) {
      throw new Error("Twitter OAuth not configured");
    }
    if (!codeChallenge) {
      throw new Error("Twitter PKCE code challenge required");
    }
    const params = new URLSearchParams({
      response_type: "code",
      client_id: env.oauth.twitter.clientId,
      redirect_uri: redirectUri,
      scope: "users.read tweet.read",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    return `https://twitter.com/i/oauth2/authorize?${params}`;
  },

  async verify({
    code,
    redirectUri,
    codeVerifier,
  }: {
    code?: string;
    redirectUri?: string;
    codeVerifier?: string;
  }): Promise<SocialVerificationResult> {
    try {
      if (!code) {
        return { valid: false, error: "Missing authorization code" };
      }
      if (!codeVerifier) {
        return { valid: false, error: "Missing PKCE code verifier" };
      }
      if (!env.oauth.twitter.clientId || !env.oauth.twitter.clientSecret) {
        return { valid: false, error: "Twitter OAuth not configured" };
      }
      const auth = Buffer.from(`${env.oauth.twitter.clientId}:${env.oauth.twitter.clientSecret}`).toString("base64");

      const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri || env.oauth.twitter.redirectUri,
          code_verifier: codeVerifier,
        }),
      });

      const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
      if (!tokenData.access_token) {
        return { valid: false, error: tokenData.error || "Failed to get access token" };
      }

      const userRes = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      const userData = (await userRes.json()) as { data?: { username?: string } };
      if (!userData.data?.username) {
        return { valid: false, error: "Failed to get user info" };
      }

      return { valid: true, identifier: userData.data.username.toLowerCase() };
    } catch (error) {
      console.error("Twitter verification error:", error);
      return { valid: false, error: "Twitter verification failed" };
    }
  },
};
