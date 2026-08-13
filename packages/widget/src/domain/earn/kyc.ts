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

const getKycGateUrlFields = ({
  kycUrl,
  yieldDto,
}: {
  readonly kycUrl?: string;
  readonly yieldDto?: EarnYieldWithProvider | null;
}) => ({
  ...(kycUrl ? { kycUrl } : {}),
  ...(kycUrl && yieldDto?.mechanics.requirements?.kyc?.iframeAllowed === true
    ? { iframeAllowed: true as const }
    : {}),
});

export const mapKycStatusToGate = ({
  status,
  yieldDto,
}: {
  readonly status?: KycStatus | null;
  readonly yieldDto?: EarnYieldWithProvider | null;
}): KycGate => {
  const kycUrl = getKycUrl({ status, yieldDto });

  switch (status?.kycStatus) {
    case "not_required":
    case "approved":
      return { state: "pass" };
    case "not_started":
      return {
        state: "start_kyc",
        ...getKycGateUrlFields({ kycUrl, yieldDto }),
      };
    case "pending":
      return {
        state: "pending",
        ...getKycGateUrlFields({ kycUrl, yieldDto }),
      };
    case "rejected":
      return {
        state: "rejected",
        ...getKycGateUrlFields({ kycUrl, yieldDto }),
      };
    default:
      return {
        state: "unknown",
        retryable: true,
        ...getKycGateUrlFields({ kycUrl, yieldDto }),
      };
  }
};

export const isKycGateBlocking = (gate: KycGate) => gate.state !== "pass";
