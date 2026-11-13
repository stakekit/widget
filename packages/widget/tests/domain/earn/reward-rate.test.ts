import { describe, expect, it } from "vitest";

import {
  getEffectiveYieldRewardRateDetails,
  getRateComposition,
  type YieldRewardRate,
} from "../../../src/domain/earn/reward-rate";
import { exactDecimal } from "../../../src/domain/finance/exact";
import {
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
  yieldRewardRateFixture,
} from "../../fixtures";
import { decodeValidator } from "../../utils/validators";

const token = yieldApiYieldFixture().token;

const component = (
  rate: number,
  yieldSource: YieldRewardRate["components"][number]["yieldSource"],
  rateType = "APY"
): YieldRewardRate["components"][number] => ({
  rate: exactDecimal(rate),
  rateType,
  token,
  yieldSource,
});

const nativeComponent = (rate: number) => component(rate, "staking");

const parts = (rewardRate: YieldRewardRate) => {
  const { native, protocolIncentive, campaign, total } =
    getRateComposition(rewardRate);
  const part = (value: typeof native | null) =>
    value ? [value.rate.toNumber(), value.rateType] : null;
  return {
    native: part(native),
    protocolIncentive: part(protocolIncentive),
    campaign: part(campaign),
    total: part(total),
  };
};

describe("getRateComposition", () => {
  it("splits the yield's own rate, protocol incentives and the campaign part, each in its rate type", () => {
    expect(
      parts(
        yieldRewardRateFixture({
          total: 0.102,
          components: [
            component(0.058, "vault"),
            component(0.002, "protocol_incentive"),
            component(0.042, "campaign_incentive", "APR"),
          ],
        })
      )
    ).toEqual({
      native: [0.058, "APY"],
      protocolIncentive: [0.002, "APY"],
      campaign: [0.042, "APR"],
      total: [0.102, "APY"],
    });
  });

  it("keeps the listed own rate and the total as given, even when they don't add up", () => {
    expect(
      parts(
        yieldRewardRateFixture({
          total: 0.0455,
          components: [
            component(0.0427, "vault"),
            component(0.0028, "protocol_incentive", "APR"),
            component(0.002, "campaign_incentive", "APR"),
          ],
        })
      )
    ).toEqual({
      native: [0.0427, "APY"],
      protocolIncentive: [0.0028, "APR"],
      campaign: [0.002, "APR"],
      total: [0.0455, "APY"],
    });
  });

  it("counts as the own rate of a rate listing none what the incentives leave of the total", () => {
    expect(
      parts(
        yieldRewardRateFixture({
          total: 0.042,
          components: [component(0.042, "campaign_incentive", "APR")],
        })
      ).native
    ).toEqual([0, "APY"]);
    expect(
      parts(yieldRewardRateFixture({ total: 0.058, components: [] }))
    ).toEqual({
      native: [0.058, "APY"],
      protocolIncentive: null,
      campaign: null,
      total: [0.058, "APY"],
    });
  });
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
      selectedValidators: new Map([[validator.key, validator]]),
      yieldDto,
    });

    expect(rewardRate?.total.isEqualTo("0.1582")).toBe(true);
    expect(rewardRate?.components[0]?.rate.isEqualTo("0.1582")).toBe(true);
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
        [firstValidator.key, firstValidator],
        [secondValidator.key, secondValidator],
      ]),
      yieldDto,
    });

    expect(rewardRate?.total.isEqualTo("0.17")).toBe(true);
    expect(rewardRate?.components[0]?.rate.isEqualTo("0.17")).toBe(true);
  });
});
