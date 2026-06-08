import { describe, expect, it } from "vitest";
import {
  getKycProviderName,
  getKycUrl,
  mapKycStatusToGate,
} from "../../src/domain/types/kyc";
import type { Yield } from "../../src/domain/types/yields";
import {
  legacyYieldFixture,
  yieldApiProviderFixture,
  yieldApiYieldFixture,
} from "../fixtures";

const createYield = (overrides?: Partial<Yield>): Yield =>
  ({
    ...yieldApiYieldFixture(),
    __fallback__: legacyYieldFixture(),
    provider: yieldApiProviderFixture({
      name: "Superstate",
      website: "https://superstate.com",
    }),
    ...overrides,
  }) as Yield;

describe("KYC gate mapping", () => {
  it("allows approved and not required statuses", () => {
    expect(
      mapKycStatusToGate({
        status: { kycStatus: "approved" },
        yieldDto: createYield(),
      })
    ).toEqual({ state: "pass" });

    expect(
      mapKycStatusToGate({
        status: { kycStatus: "not_required" },
        yieldDto: createYield(),
      })
    ).toEqual({ state: "pass" });
  });

  it("maps blocking statuses with url fallback", () => {
    const yieldDto = createYield({
      mechanics: {
        ...yieldApiYieldFixture().mechanics,
        requirements: {
          kycRequired: true,
          kyc: {
            kycMode: "oauth_redirect",
            iframeAllowed: false,
            authorizeUrl: "https://issuer.example/verify",
          },
        },
      },
    });

    expect(
      mapKycStatusToGate({
        status: { kycStatus: "not_started" },
        yieldDto,
      })
    ).toEqual({
      state: "start_kyc",
      kycUrl: "https://issuer.example/verify",
    });

    expect(
      mapKycStatusToGate({
        status: { kycStatus: "pending", kycUrl: "https://status.example" },
        yieldDto,
      })
    ).toEqual({ state: "pending", kycUrl: "https://status.example" });

    expect(
      mapKycStatusToGate({
        status: { kycStatus: "rejected" },
        yieldDto,
      })
    ).toEqual({
      state: "rejected",
      kycUrl: "https://issuer.example/verify",
    });
  });

  it("marks blocking gates as iframe-allowed from yield metadata", () => {
    const yieldDto = createYield({
      mechanics: {
        ...yieldApiYieldFixture().mechanics,
        requirements: {
          kycRequired: true,
          kyc: {
            kycMode: "oauth_redirect",
            iframeAllowed: true,
            authorizeUrl: "https://issuer.example/verify",
          },
        },
      },
    });

    expect(
      mapKycStatusToGate({
        status: { kycStatus: "not_started" },
        yieldDto,
      })
    ).toEqual({
      state: "start_kyc",
      kycUrl: "https://issuer.example/verify",
      iframeAllowed: true,
    });
  });

  it("uses provider details as provider fallback", () => {
    const yieldDto = createYield();

    expect(getKycProviderName(yieldDto)).toBe("Superstate");
    expect(getKycUrl({ yieldDto })).toBe("https://superstate.com");
  });
});
