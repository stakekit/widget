import { describe, expect, it } from "vitest";
import {
  getEffectiveYieldRewardRateDetails,
  getRewardRateBreakdown,
  type YieldRewardRate,
} from "../../src/domain/earn/reward-rate";
import { exactDecimal } from "../../src/domain/finance/exact";
import {
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
  yieldRewardRateFixture,
} from "../fixtures";
import { decodeValidator } from "../utils/validators";

const token = yieldApiYieldFixture().token;

const nativeComponent = (
  rate: number
): YieldRewardRate["components"][number] => ({
  rate: exactDecimal(rate),
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
    ).toBe(yieldDto.rewardRate);
  });

  it("uses the selected validator reward rate", () => {
    const yieldDto = yieldApiYieldFixture({
      rewardRate: yieldRewardRateFixture({ total: 0.1539 }),
    });
    const validator = decodeValidator(
      yieldApiValidatorFixture({
        address: "validator-1",
        rewardRate: yieldRewardRateFixture({
          total: 0.1582,
          components: [nativeComponent(0.1582)],
        }),
      })
    );

    const rewardRate = getEffectiveYieldRewardRateDetails({
      selectedValidators: new Map([[validator.address, validator]]),
      yieldDto,
    });

    expect(rewardRate?.total.isEqualTo("0.1582")).toBe(true);
    expect(
      getRewardRateBreakdown(rewardRate)[0]?.rate.isEqualTo("0.1582")
    ).toBe(true);
  });

  it("averages selected validator reward rates", () => {
    const yieldDto = yieldApiYieldFixture({
      rewardRate: yieldRewardRateFixture({ total: 0.1539 }),
    });
    const firstValidator = decodeValidator(
      yieldApiValidatorFixture({
        address: "validator-1",
        rewardRate: yieldRewardRateFixture({
          total: 0.16,
          components: [nativeComponent(0.16)],
        }),
      })
    );
    const secondValidator = decodeValidator(
      yieldApiValidatorFixture({
        address: "validator-2",
        rewardRate: yieldRewardRateFixture({
          total: 0.18,
          components: [nativeComponent(0.18)],
        }),
      })
    );

    const rewardRate = getEffectiveYieldRewardRateDetails({
      selectedValidators: new Map([
        [firstValidator.address, firstValidator],
        [secondValidator.address, secondValidator],
      ]),
      yieldDto,
    });

    expect(rewardRate?.total.isEqualTo("0.17")).toBe(true);
    expect(getRewardRateBreakdown(rewardRate)[0]?.rate.isEqualTo("0.17")).toBe(
      true
    );
  });
});
