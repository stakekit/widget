import { describe, expect, it } from "vitest";
import { getMaxYieldRateForToken } from "../../src/hooks/api/use-token-list-yields";
import { yieldApiYieldFixture, yieldRewardRateFixture } from "../fixtures";

describe("getMaxYieldRateForToken", () => {
  it("formats uppercase reward rate types from the yield API", () => {
    const yieldDto = yieldApiYieldFixture({
      id: "ethereum-eth-native-staking",
      rewardRate: yieldRewardRateFixture({
        total: 0.0349,
        rateType: "APY",
      }),
    });

    expect(
      getMaxYieldRateForToken(
        ["ethereum-eth-native-staking"],
        new Map([[yieldDto.id, yieldDto]])
      )
    ).toEqual({
      rateFormatted: "3.49%",
      rateTypeLabel: "APY",
    });
  });
});
