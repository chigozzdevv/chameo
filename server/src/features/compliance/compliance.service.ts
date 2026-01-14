import { config } from "@/config";
import type { RiskAssessment, ComplianceCheckResult } from "./compliance.types";

const RISK_THRESHOLD = 70;

export async function checkWalletCompliance(address: string): Promise<ComplianceCheckResult> {
  if (!config.range.apiKey) {
    return {
      isCompliant: true,
      assessment: {
        address,
        riskScore: 0,
        riskLevel: "low",
        isSanctioned: false,
        flags: [],
        checkedAt: Date.now(),
      },
    };
  }
  const assessment = await fetchRiskAssessment(address);
  if (assessment.isSanctioned) {
    return {
      isCompliant: false,
      assessment,
      blockedReason: "Address is on OFAC sanctions list",
    };
  }
  if (assessment.riskScore >= RISK_THRESHOLD) {
    return {
      isCompliant: false,
      assessment,
      blockedReason: `Risk score ${assessment.riskScore} exceeds threshold ${RISK_THRESHOLD}`,
    };
  }
  return { isCompliant: true, assessment };
}

async function fetchRiskAssessment(address: string): Promise<RiskAssessment> {
  const res = await fetch(`https://api.range.org/v1/addresses/${address}/risk`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.range.apiKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Range API error: ${res.status} - ${error}`);
  }
  const data = await res.json() as {
    risk_score: number;
    is_sanctioned: boolean;
    risk_indicators: Array<{ category: string; description: string }>;
  };
  const riskScore = data.risk_score;
  let riskLevel: RiskAssessment["riskLevel"] = "low";
  if (riskScore >= 80) riskLevel = "severe";
  else if (riskScore >= 60) riskLevel = "high";
  else if (riskScore >= 40) riskLevel = "medium";
  return {
    address,
    riskScore,
    riskLevel,
    isSanctioned: data.is_sanctioned,
    flags: data.risk_indicators?.map((i) => `${i.category}: ${i.description}`) || [],
    checkedAt: Date.now(),
  };
}
