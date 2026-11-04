import type { KycStatus } from "../portfolio/models";
import type { EarnYieldWithProvider } from "./models";

export type KycGate =
  | { state: "pass" }
  | { state: "start_kyc"; kycUrl?: string; iframeAllowed?: true }
  | { state: "pending"; kycUrl?: string; iframeAllowed?: true }
  | { state: "rejected"; kycUrl?: string; iframeAllowed?: true }
  | {
      state: "unknown";
      retryable: boolean;
      kycUrl?: string;
      iframeAllowed?: true;
    };

type KycUrlSource = {
  readonly status?: Pick<KycStatus, "authorizeUrl"> | null;
  readonly yieldDto?: EarnYieldWithProvider | null;
};

export const getKycProviderName = (
  yieldDto: EarnYieldWithProvider | null | undefined
) => yieldDto?.provider?.name ?? null;

export const getKycUrl = ({ status, yieldDto }: KycUrlSource) =>
  status?.authorizeUrl ??
  yieldDto?.mechanics.requirements?.kyc?.authorizeUrl ??
  yieldDto?.provider?.website;

const getKycGateUrlFields = (
  kycUrl: string | undefined,
  yieldDto: EarnYieldWithProvider | null | undefined
) => ({
  ...(kycUrl ? { kycUrl } : {}),
  ...(kycUrl && yieldDto?.mechanics.requirements?.kyc?.iframeAllowed === true
    ? { iframeAllowed: true as const }
    : {}),
});

export const mapKycStatusToGate = (source: {
  readonly status?: KycStatus | null;
  readonly yieldDto?: EarnYieldWithProvider | null;
}): KycGate => {
  const urlFields = getKycGateUrlFields(getKycUrl(source), source.yieldDto);

  switch (source.status?.kycStatus) {
    case "not_required":
    case "approved":
      return { state: "pass" };
    case "not_started":
      return { state: "start_kyc", ...urlFields };
    case "pending":
      return { state: "pending", ...urlFields };
    case "rejected":
      return { state: "rejected", ...urlFields };
    default:
      return { state: "unknown", retryable: true, ...urlFields };
  }
};

export const isKycGateBlocking = (gate: KycGate) => gate.state !== "pass";
