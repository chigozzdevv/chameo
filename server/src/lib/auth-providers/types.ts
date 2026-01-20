export interface SocialVerificationResult {
  valid: boolean;
  identifier?: string;
  error?: string;
}

export interface AuthProvider {
  getAuthUrl(params: {
    campaignId: string;
    redirectUri: string;
    state: string;
    codeChallenge?: string;
  }): string;
  verify(params: {
    code?: string;
    redirectUri?: string;
    codeVerifier?: string;
    authData?: Record<string, string>;
  }): Promise<SocialVerificationResult>;
}
