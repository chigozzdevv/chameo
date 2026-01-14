export interface SocialVerificationResult {
  valid: boolean;
  identifier?: string;
  error?: string;
}
export interface SocialHandler {
  getAuthUrl(campaignId: string, redirectUri: string): string;
  verify(code: string, state: string): Promise<SocialVerificationResult>;
}
