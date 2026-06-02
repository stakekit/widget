import type { Yield } from "./yields";

// kyc contract is not in the generated client yet; mirrored from the api here

export enum KycStatus {
  NotRequired = "not_required",
  NotStarted = "not_started",
  Pending = "pending",
  Approved = "approved",
  Rejected = "rejected",
}

export enum KycMode {
  OauthRedirect = "oauth_redirect",
}

export enum KycAccreditation {
  Retail = "retail",
  QualifiedPurchaser = "qualified_purchaser",
  Accredited = "accredited",
}

export enum KycSubjectType {
  Kyc = "KYC",
  Kyb = "KYB",
}

export interface YieldKycEligibility {
  countries?: string[];
  usPersonAllowed?: boolean;
  accreditation?: KycAccreditation;
  subjectType?: KycSubjectType;
}

export interface YieldKycMetadata {
  kycMode: KycMode;
  iframeAllowed: boolean;
  authorizeUrl?: string;
  notes?: string;
  eligibility?: YieldKycEligibility;
}

export type KycStatusResult = {
  kycStatus: KycStatus;
  kycUrl?: string;
};

type RequirementsWithKyc = {
  readonly kycRequired?: boolean;
  readonly kycUrl?: string;
  readonly kyc?: YieldKycMetadata;
};

export type YieldKycRequirement = {
  required: boolean;
  kyc?: YieldKycMetadata;
  legacyKycUrl?: string;
};

export const getYieldKycRequirement = (
  yieldDto: Yield
): YieldKycRequirement => {
  // kyc block is not in the generated requirements type yet
  const requirements = yieldDto.mechanics.requirements as
    | RequirementsWithKyc
    | undefined;

  return {
    required: !!requirements?.kycRequired || !!requirements?.kyc,
    kyc: requirements?.kyc,
    legacyKycUrl: requirements?.kycUrl,
  };
};

// statuses that block entry
export const kycNeedsVerification = (status: KycStatus): boolean =>
  status === KycStatus.NotStarted ||
  status === KycStatus.Pending ||
  status === KycStatus.Rejected;

// live per-address kycUrl wins over the static issuer page
export const resolveKycUrl = (args: {
  statusKycUrl?: string;
  kyc?: YieldKycMetadata;
  legacyKycUrl?: string;
}): string | undefined =>
  args.statusKycUrl ?? args.kyc?.authorizeUrl ?? args.legacyKycUrl;
