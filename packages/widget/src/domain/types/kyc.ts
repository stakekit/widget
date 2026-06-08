import type { KycStatusResponseDto } from "../../generated/api/yield";
import type { Yield } from "./yields";

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
  readonly status?: Pick<KycStatusResponseDto, "kycUrl"> | null;
  readonly yieldDto?: Yield | null;
};

export const getKycProviderName = (yieldDto: Yield | null | undefined) =>
  yieldDto?.provider?.name ?? null;

export const getKycUrl = ({ status, yieldDto }: KycUrlSource) =>
  status?.kycUrl ??
  yieldDto?.mechanics.requirements?.kyc?.authorizeUrl ??
  yieldDto?.mechanics.requirements?.kycUrl ??
  yieldDto?.provider?.website;

const getKycGateUrlFields = ({
  kycUrl,
  yieldDto,
}: {
  readonly kycUrl?: string;
  readonly yieldDto?: Yield | null;
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
  readonly status?: KycStatusResponseDto | null;
  readonly yieldDto?: Yield | null;
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
