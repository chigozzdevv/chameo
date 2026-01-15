export interface SocialVerificationResult {
  valid: boolean;
  identifier?: string;
  error?: string;
}

export interface AuthProvider {
  getAuthUrl(campaignId: string, redirectUri: string): string;
  verify(code: string, identifier?: string, campaignId?: string): Promise<SocialVerificationResult>;
}
