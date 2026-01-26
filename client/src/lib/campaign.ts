import { API_BASE, apiFetch } from "./api";
import { getAuthToken } from "./auth";

export type CampaignTheme = {
  primary?: string;
  secondary?: string;
  background?: string;
};

export type CampaignSummary = {
  id: string;
  name: string;
  type: "payout" | "escrow";
  status: string;
  claimCount?: number;
  maxClaims?: number;
  expiresAt?: number;
};

export type CampaignEditable = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  type: "payout" | "escrow";
  authMethod: "email" | "twitter" | "discord" | "github" | "telegram";
  payoutAmount: number;
  maxClaims: number;
  expiresAt: number;
  winnersDeadline?: number;
  participantCount: number;
  funded: boolean;
  status: string;
  refundAddress?: string;
  theme?: CampaignTheme;
};

export type FundingStatus = {
  balance: number;
  totalRequired: number;
  funded: boolean;
  onChainBalance: number;
  campaignWallet: string;
  depositTx?: string;
  warnings?: string[];
  onChainFresh?: boolean;
  privacyFresh?: boolean;
};

export type CreateCampaignInput = {
  name: string;
  description?: string;
  type: "payout" | "escrow";
  authMethod: "email" | "twitter" | "discord" | "github" | "telegram";
  payoutAmount: number;
  maxClaims: number;
  expiresAt: number;
  winnersDeadline?: number;
  recipients: string[];
  requireCompliance?: boolean;
  refundAddress?: string;
  theme?: CampaignTheme;
};

export type UpdateCampaignInput = {
  name?: string;
  description?: string;
  payoutAmount?: number;
  maxClaims?: number;
  expiresAt?: number;
  winnersDeadline?: number | null;
  refundAddress?: string | null;
  theme?: CampaignTheme;
};

export async function listCampaigns(): Promise<CampaignSummary[]> {
  const token = getAuthToken();
  const result = await apiFetch<{ success: boolean; campaigns: CampaignSummary[] }>(
    "/api/campaign",
    {},
    token
  );
  return result.campaigns || [];
}

export async function createCampaign(input: CreateCampaignInput): Promise<{
  success: boolean;
  campaignId: string;
  fundingAddress: string;
  totalRequired: number;
}> {
  const token = getAuthToken();
  return apiFetch(
    "/api/campaign",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token
  );
}

export async function getFundingAddress(campaignId: string): Promise<{
  fundingAddress: string;
  totalRequired: number;
}> {
  const token = getAuthToken();
  return apiFetch(`/api/campaign/${campaignId}/funding-address`, {}, token);
}

export async function getCampaignForEdit(campaignId: string): Promise<{
  campaign: CampaignEditable;
  fundingAddress: string;
  totalRequired: number;
}> {
  const token = getAuthToken();
  return apiFetch(`/api/campaign/${campaignId}/edit`, {}, token);
}

export async function updateCampaign(
  campaignId: string,
  input: UpdateCampaignInput
): Promise<{
  campaign: CampaignEditable;
  fundingAddress: string;
  totalRequired: number;
}> {
  const token = getAuthToken();
  return apiFetch(
    `/api/campaign/${campaignId}/update`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token
  );
}

export async function checkFunding(campaignId: string): Promise<FundingStatus> {
  const token = getAuthToken();
  return apiFetch(`/api/campaign/${campaignId}/check-funding`, { method: "POST" }, token);
}

export async function addRecipients(campaignId: string, recipients: string[]): Promise<{ added: number }> {
  const token = getAuthToken();
  return apiFetch(
    `/api/campaign/${campaignId}/recipients`,
    {
      method: "POST",
      body: JSON.stringify({ recipients }),
    },
    token
  );
}

export async function replaceRecipients(
  campaignId: string,
  recipients: string[]
): Promise<{ total: number }> {
  const token = getAuthToken();
  return apiFetch(
    `/api/campaign/${campaignId}/recipients/replace`,
    {
      method: "POST",
      body: JSON.stringify({ recipients }),
    },
    token
  );
}

export async function closeCampaign(
  campaignId: string,
  reclaimAddress: string
): Promise<{ reclaimedAmount: number; signature?: string }> {
  const token = getAuthToken();
  return apiFetch(
    `/api/campaign/${campaignId}/close`,
    {
      method: "POST",
      body: JSON.stringify({ reclaimAddress }),
    },
    token
  );
}

export async function deleteCampaign(campaignId: string): Promise<{ success: boolean }> {
  const token = getAuthToken();
  return apiFetch(`/api/campaign/${campaignId}`, { method: "DELETE" }, token);
}

export async function updateCampaignTheme(campaignId: string, theme: CampaignTheme) {
  const token = getAuthToken();
  return apiFetch<{ success: boolean; theme: CampaignTheme }>(
    `/api/campaign/${campaignId}/theme`,
    {
      method: "POST",
      body: JSON.stringify({ theme }),
    },
    token
  );
}

export async function uploadCampaignImage(
  campaignId: string,
  params: { file?: File | null; imageUrl?: string }
) {
  const token = getAuthToken();
  const formData = new FormData();
  if (params.file) {
    formData.append("image", params.file);
  }
  if (params.imageUrl) {
    formData.append("imageUrl", params.imageUrl);
  }

  const res = await fetch(`${API_BASE}/api/campaign/${campaignId}/upload-image`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  const data = (await res.json()) as { success: boolean; imageUrl?: string; message?: string; error?: string };
  if (!res.ok || !data.success) {
    throw new Error(data.message || data.error || "Upload failed");
  }
  return data;
}
