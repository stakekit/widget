import { Effect } from "effect";
import * as Schema from "effect/Schema";
import { HttpClient } from "effect/unstable/http";
import { describe, expect, it } from "vitest";
import * as LegacyClient from "../../src/generated/api/legacy";
import * as LegacySchema from "../../src/generated/api/legacy-schema";
import * as YieldClient from "../../src/generated/api/yield";
import * as YieldSchema from "../../src/generated/api/yield-schema";
import { yieldApiYieldDtoFixture, yieldBalanceFixture } from "../fixtures";

const httpClient = HttpClient.make(() =>
  Effect.die("generated operation must not execute")
);

describe("generated Legacy API", () => {
  it("exposes runtime DTO schemas", () => {
    expect(Schema.isSchema(LegacySchema.HealthStatusDto)).toBe(true);
    expect(Schema.isSchema(LegacySchema.PriceResponseDto)).toBe(true);
    expect(Schema.isSchema(LegacySchema.TokenDto)).toBe(true);
    expect(Schema.isSchema(LegacySchema.YieldDto)).toBe(true);
    expect("make" in LegacySchema).toBe(false);
  });

  it("exposes typed Effect client operations separately from schemas", () => {
    const client = LegacyClient.make(httpClient);

    expect(client).toEqual(
      expect.objectContaining({
        TokenControllerGetTokenPrices: expect.any(Function),
        YieldControllerGetMyNetworks: expect.any(Function),
      })
    );
    expect(
      Effect.isEffect(client.YieldControllerGetMyNetworks(undefined))
    ).toBe(true);
  });
});

describe("generated Yield API", () => {
  it("exposes runtime DTO schemas", () => {
    expect(Schema.isSchema(YieldSchema.ActionDto)).toBe(true);
    expect(Schema.isSchema(YieldSchema.HealthStatusDto)).toBe(true);
    expect(Schema.isSchema(YieldSchema.TokenDto)).toBe(true);
    expect(Schema.isSchema(YieldSchema.ValidatorDto)).toBe(true);
    expect(Schema.isSchema(YieldSchema.YieldDto)).toBe(true);
    expect("make" in YieldSchema).toBe(false);
  });

  it("exposes typed Effect client operations separately from schemas", () => {
    const client = YieldClient.make(httpClient);

    expect(client).toEqual(
      expect.objectContaining({
        YieldsControllerGetYield: expect.any(Function),
        YieldsControllerGetYields: expect.any(Function),
      })
    );
    expect(Effect.isEffect(client.YieldsControllerGetYields(undefined))).toBe(
      true
    );
  });

  it("decodes concrete nullable DTO fields without empty-object placeholders", () => {
    expect(
      Schema.decodeSync(YieldSchema.YieldFeeConfigurationDto)({
        id: "66f299cd-aaaa-4bbb-8ccc-d1f26e3a02db",
        default: true,
        managementFeeBps: 100,
        performanceFeeBps: 1000,
        depositFeeBps: 0,
        allocatorVaultContractAddress:
          "0x80ac24aa929eaf5013f6436cda2a7ba190f5cc0b",
      })
    ).toEqual({
      id: "66f299cd-aaaa-4bbb-8ccc-d1f26e3a02db",
      default: true,
      managementFeeBps: 100,
      performanceFeeBps: 1000,
      depositFeeBps: 0,
      allocatorVaultContractAddress:
        "0x80ac24aa929eaf5013f6436cda2a7ba190f5cc0b",
    });

    expect(
      Schema.decodeSync(YieldSchema.ProviderDto)({
        name: "StakeKit",
        id: "stakekit",
        logoURI: "https://stakek.it/logo.svg",
        description: "Infrastructure provider",
        website: "https://stakek.it",
        tvlUsd: "10200000",
        type: "protocol",
      }).tvlUsd
    ).toBe("10200000");

    expect(
      Schema.decodeSync(YieldSchema.ValidatorDto)({
        address: "validator-address",
        provider: {
          name: "StakeKit",
          id: "stakekit",
          logoURI: "https://stakek.it/logo.svg",
          description: "Infrastructure provider",
          website: "https://stakek.it",
          tvlUsd: "10200000",
          type: "validator_provider",
          rank: 1,
          preferred: true,
        },
      }).provider?.tvlUsd
    ).toBe("10200000");

    expect(
      Schema.decodeSync(YieldSchema.YieldDto)({
        ...yieldApiYieldDtoFixture(),
        curator: {
          name: "Curator",
          description: "Curated vault",
          logoURI: "https://stakek.it/curator.svg",
        },
      }).curator
    ).toEqual({
      name: "Curator",
      description: "Curated vault",
      logoURI: "https://stakek.it/curator.svg",
    });
  });

  it("decodes concrete risk metrics and validates balance price ranges", () => {
    expect(
      Schema.decodeSync(YieldSchema.YieldRiskCredoraDto)({
        rating: "A",
        score: 4.5,
        psl: 0.01,
        publishDate: "2026-01-01",
        curator: "Credora",
      })
    ).toEqual({
      rating: "A",
      score: 4.5,
      psl: 0.01,
      publishDate: "2026-01-01",
      curator: "Credora",
    });

    expect(
      Schema.decodeSync(YieldSchema.YieldRiskStakingRewardsDto)({
        rating: "A",
        score: 4,
        potentialRating: "A+",
        potentialScore: 4.5,
        ratedAt: "2026-01-01",
        ratedSince: "2025-01-01",
        profileUrl: "https://stakingrewards.com/provider",
        reportUrl: "https://stakingrewards.com/report",
        providerName: "Provider",
        version: "v1",
        type: "validator",
        chain: "ethereum",
        contractAddress: "0x0000000000000000000000000000000000000001",
        riskMetrics: { users: 1000 },
      }).riskMetrics
    ).toEqual({ users: 1000 });

    expect(
      Schema.decodeUnknownSync(YieldSchema.BalanceDto)(
        yieldBalanceFixture({
          priceRange: { min: "2700", max: "3310" },
        })
      ).priceRange
    ).toEqual({ min: "2700", max: "3310" });
    expect(() =>
      Schema.decodeUnknownSync(YieldSchema.BalanceDto)(
        yieldBalanceFixture({
          priceRange: { min: 2700, max: 3310 } as never,
        })
      )
    ).toThrow();
  });
});
