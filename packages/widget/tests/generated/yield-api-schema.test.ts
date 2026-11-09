import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import * as YieldSchema from "../../src/generated/api/yield-schema";
import { yieldApiYieldDtoFixture, yieldBalanceFixture } from "../fixtures";

describe("generated Yield API", () => {
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
        rewardRate: { total: 0.03, rateType: "APY", components: [] },
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
      rewardRate: { total: 0.03, rateType: "APY", components: [] },
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
