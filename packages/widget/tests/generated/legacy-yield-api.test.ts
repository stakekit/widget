import { Effect } from "effect";
import { HttpClient } from "effect/http";
import * as Schema from "effect/Schema";
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
    expect(Schema.isSchema(LegacySchema.PriceResponseDto)).toBe(true);
    expect(Schema.isSchema(LegacySchema.TokenDto)).toBe(true);
    expect(Schema.isSchema(LegacySchema.TransactionDto)).toBe(true);
    expect(Schema.isSchema(LegacySchema.TronResourceType)).toBe(true);
    expect(Schema.isSchema(LegacySchema.YieldRewardsSummaryResponseDto)).toBe(
      true
    );
    expect("make" in LegacySchema).toBe(false);
  });

  it("exposes only allowlisted client operations", () => {
    const client = LegacyClient.make(httpClient);

    expect(Object.keys(client).sort()).toEqual([
      "NetworkAddressesTokenV2ControllerGetTokenBalances",
      "TokenControllerGetTokenBalances",
      "TokenControllerGetTokenPrices",
      "TokenControllerGetTokens",
      "YieldControllerGetSingleYieldRewardsSummary",
      "httpClient",
    ]);
    expect(Effect.isEffect(client.TokenControllerGetTokens(undefined))).toBe(
      true
    );
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
        merklRewardsClaiming: false,
      })
    ).toEqual({
      id: "66f299cd-aaaa-4bbb-8ccc-d1f26e3a02db",
      default: true,
      managementFeeBps: 100,
      performanceFeeBps: 1000,
      depositFeeBps: 0,
      allocatorVaultContractAddress:
        "0x80ac24aa929eaf5013f6436cda2a7ba190f5cc0b",
      merklRewardsClaiming: false,
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

  it("validates balance price ranges", () => {
    expect(
      Schema.decodeUnknownSync(YieldSchema.BalanceDto)({
        ...yieldBalanceFixture(),
        priceRange: { min: "2700", max: "3310" },
      }).priceRange
    ).toEqual({ min: "2700", max: "3310" });
    expect(() =>
      Schema.decodeUnknownSync(YieldSchema.BalanceDto)({
        ...yieldBalanceFixture(),
        priceRange: { min: 2700, max: 3310 },
      })
    ).toThrow();
  });
});
