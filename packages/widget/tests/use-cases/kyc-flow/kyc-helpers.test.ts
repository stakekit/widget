import { describe, expect, it } from "vitest";
import {
  getYieldKycRequirement,
  KycMode,
  KycStatus,
  kycNeedsVerification,
  resolveKycUrl,
} from "../../../src/domain/types/kyc";
import type { Yield } from "../../../src/domain/types/yields";

const yieldWith = (requirements: unknown) =>
  ({ mechanics: { requirements } }) as unknown as Yield;

const kycMeta = { kycMode: KycMode.OauthRedirect, iframeAllowed: true };

describe("KYC helpers", () => {
  it("flags requirement from legacy kycRequired and the kyc block", () => {
    expect(getYieldKycRequirement(yieldWith(undefined)).required).toBe(false);
    expect(
      getYieldKycRequirement(yieldWith({ kycRequired: true })).required
    ).toBe(true);
    expect(getYieldKycRequirement(yieldWith({ kyc: kycMeta })).required).toBe(
      true
    );
  });

  it("blocks entry only for non-approved, non-exempt statuses", () => {
    expect(kycNeedsVerification(KycStatus.NotStarted)).toBe(true);
    expect(kycNeedsVerification(KycStatus.Pending)).toBe(true);
    expect(kycNeedsVerification(KycStatus.Rejected)).toBe(true);
    expect(kycNeedsVerification(KycStatus.Approved)).toBe(false);
    expect(kycNeedsVerification(KycStatus.NotRequired)).toBe(false);
  });

  it("prefers live status url, then metadata, then legacy", () => {
    expect(
      resolveKycUrl({
        statusKycUrl: "https://live",
        kyc: { ...kycMeta, authorizeUrl: "https://meta" },
        legacyKycUrl: "https://legacy",
      })
    ).toBe("https://live");
    expect(
      resolveKycUrl({
        kyc: { ...kycMeta, authorizeUrl: "https://meta" },
        legacyKycUrl: "https://legacy",
      })
    ).toBe("https://meta");
    expect(resolveKycUrl({ legacyKycUrl: "https://legacy" })).toBe(
      "https://legacy"
    );
    expect(resolveKycUrl({})).toBeUndefined();
  });
});
