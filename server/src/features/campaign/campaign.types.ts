export type AuthMethod = "email" | "phone" | "twitter" | "discord" | "github";
export interface CampaignDoc {
  id: string;
  hostHash: string;
  authMethod: AuthMethod;
  payoutAmount: number;
  maxClaims: number;
  claimCount: number;
  expiresAt: number;
  fundingAddress: string;
  funded: boolean;
  fundedAmount: number;
  requireCompliance: boolean;
  eligibleHashes: string[];
  createdAt: number;
}
export interface CreateCampaignInput {
  hostIdentifier: string;
  authMethod: AuthMethod;
  payoutAmount: number;
  maxClaims: number;
  expiresAt: number;
  recipients: string[];
  requireCompliance?: boolean;
}
export interface CampaignPublic {
  id: string;
  authMethod: AuthMethod;
  payoutAmount: number;
  maxClaims: number;
  claimCount: number;
  expiresAt: number;
  funded: boolean;
  fundedAmount: number;
  requireCompliance: boolean;
}
