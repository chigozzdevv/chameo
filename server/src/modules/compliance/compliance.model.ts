export interface RiskAssessment {
  address: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "severe";
  isSanctioned: boolean;
  isBlacklisted: boolean;
  flags: string[];
  checkedAt: number;
}

export interface ComplianceCheckResult {
  isCompliant: boolean;
  assessment: RiskAssessment;
  blockedReason?: string;
}
