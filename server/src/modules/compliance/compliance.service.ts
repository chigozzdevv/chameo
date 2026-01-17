import { env } from "@/config";
import { InternalError } from "@/shared";
import type { RiskAssessment, ComplianceCheckResult } from "./compliance.model";

const RISK_THRESHOLD = 6; // Range uses 1-10 scale, 6+ is "High risk"

export async function checkWalletCompliance(address: string): Promise<ComplianceCheckResult> {
  if (!env.range.apiKey) {
    throw new InternalError("RANGE_API_KEY not configured");
  }

  const [riskResult, sanctionsResult] = await Promise.all([fetchRiskScore(address), fetchSanctionsCheck(address)]);

  const assessment: RiskAssessment = {
    address,
    riskScore: riskResult.riskScore,
    riskLevel: mapRiskLevel(riskResult.riskScore),
    isSanctioned: sanctionsResult.is_ofac_sanctioned,
    isBlacklisted: sanctionsResult.is_token_blacklisted,
    flags: riskResult.maliciousAddressesFound?.map((m) => `${m.category}: ${m.name_tag || m.address}`) || [],
    checkedAt: Date.now(),
  };

  if (sanctionsResult.is_ofac_sanctioned) {
    return {
      isCompliant: false,
      assessment,
      blockedReason: `Address is OFAC sanctioned: ${sanctionsResult.ofac_info?.name_tag || "Unknown"}`,
    };
  }

  if (sanctionsResult.is_token_blacklisted) {
    return {
      isCompliant: false,
      assessment,
      blockedReason: "Address is blacklisted by stablecoin issuer(s)",
    };
  }

  // Range uses 1-10 scale, 6+ is high risk
  if (riskResult.riskScore >= RISK_THRESHOLD) {
    return {
      isCompliant: false,
      assessment,
      blockedReason: `Risk score ${riskResult.riskScore}/10 exceeds threshold (${riskResult.riskLevel})`,
    };
  }

  return { isCompliant: true, assessment };
}

interface RiskScoreResponse {
  riskScore: number;
  riskLevel: string;
  numHops: number;
  maliciousAddressesFound: Array<{
    address: string;
    distance: number;
    name_tag: string | null;
    entity: string | null;
    category: string;
  }>;
  reasoning: string;
}

async function fetchRiskScore(address: string): Promise<RiskScoreResponse> {
  const params = new URLSearchParams({ address, network: "solana" });
  const res = await fetch(`https://api.range.org/v1/risk/address?${params}`, {
    headers: { Authorization: `Bearer ${env.range.apiKey}` },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Range Risk API error: ${res.status} - ${error}`);
  }

  return res.json();
}

interface SanctionsResponse {
  address: string;
  is_token_blacklisted: boolean;
  is_ofac_sanctioned: boolean;
  ofac_info: {
    name_tag: string;
    category: string;
  } | null;
}

async function fetchSanctionsCheck(address: string): Promise<SanctionsResponse> {
  const params = new URLSearchParams({ include_details: "false" });
  const res = await fetch(`https://api.range.org/v1/risk/sanctions/${address}?${params}`, {
    headers: { Authorization: `Bearer ${env.range.apiKey}` },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Range Sanctions API error: ${res.status} - ${error}`);
  }

  return res.json();
}

function mapRiskLevel(score: number): RiskAssessment["riskLevel"] {
  if (score >= 10) return "severe";
  if (score >= 6) return "high";
  if (score >= 4) return "medium";
  return "low";
}
