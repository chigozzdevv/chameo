export interface SocialVerificationResult {
  valid: boolean;
  identifier?: string;
  error?: string;
}

export interface AuthProvider {
  getAuthUrl(campaignId: string, redirectUri: string): string;
  verify(code: string, authData?: Record<string, string>): Promise<SocialVerificationResult>;
}
