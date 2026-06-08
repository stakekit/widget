import { describe, expect, it } from "vitest";
import {
  getEffectiveYieldRewardRateDetails,
  getRewardRateBreakdown,
} from "../../src/domain/types/reward-rate";
import type { RewardDto } from "../../src/generated/api/yield";
import {
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
  yieldRewardRateFixture,
} from "../fixtures";

const token = yieldApiYieldFixture().token;

const nativeComponent = (rate: number): RewardDto => ({
  rate,
  rateType: "APY",
  token,
  yieldSource: "staking",
});

describe("getEffectiveYieldRewardRateDetails", () => {
  it("falls back to the yield reward rate when no validator is selected", () => {
    const rewardRate = yieldRewardRateFixture({
      total: 0.1539,
      components: [nativeComponent(0.1539)],
    });
    const yieldDto = yieldApiYieldFixture({ rewardRate });

    expect(
      getEffectiveYieldRewardRateDetails({
        selectedValidators: new Map(),
        yieldDto,
      })
    ).toBe(rewardRate);
  });

  it("uses the selected validator reward rate", () => {
    const yieldDto = yieldApiYieldFixture({
      rewardRate: yieldRewardRateFixture({ total: 0.1539 }),
    });
    const validator = yieldApiValidatorFixture({
      address: "validator-1",
      rewardRate: yieldRewardRateFixture({
        total: 0.1582,
        components: [nativeComponent(0.1582)],
      }),
    });

    const rewardRate = getEffectiveYieldRewardRateDetails({
      selectedValidators: new Map([[validator.address, validator]]),
      yieldDto,
    });

    expect(rewardRate?.total).toBe(0.1582);
    expect(getRewardRateBreakdown(rewardRate)[0]?.rate).toBe(0.1582);
  });

  it("averages selected validator reward rates", () => {
    const yieldDto = yieldApiYieldFixture({
      rewardRate: yieldRewardRateFixture({ total: 0.1539 }),
    });
    const firstValidator = yieldApiValidatorFixture({
      address: "validator-1",
      rewardRate: yieldRewardRateFixture({
        total: 0.16,
        components: [nativeComponent(0.16)],
      }),
    });
    const secondValidator = yieldApiValidatorFixture({
      address: "validator-2",
      rewardRate: yieldRewardRateFixture({
        total: 0.18,
        components: [nativeComponent(0.18)],
      }),
    });

    const rewardRate = getEffectiveYieldRewardRateDetails({
      selectedValidators: new Map([
        [firstValidator.address, firstValidator],
        [secondValidator.address, secondValidator],
      ]),
      yieldDto,
    });

    expect(rewardRate?.total).toBeCloseTo(0.17);
    expect(getRewardRateBreakdown(rewardRate)[0]?.rate).toBeCloseTo(0.17);
  });
});
