import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { EarnPosition } from "../../../src/domain/earn/balance";
import { YieldCampaign } from "../../../src/domain/earn/campaign";
import type { EarnYieldWithProvider } from "../../../src/domain/earn/yield-schema";
import { toPositionsData } from "../../../src/domain/portfolio/positions";
import {
  type PositionItem,
  toPositionItems,
} from "../../../src/features/portfolio/model/positions";
import { getPositionsAverageRate } from "../../../src/features/portfolio/state/read-models/summary";
import {
  encodeYieldRewardRateFixture,
  yieldApiCampaignDtoFixture,
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
  yieldBalanceFixture,
} from "../../fixtures";

type RateInput = Parameters<typeof encodeYieldRewardRateFixture>[0];

/** A position worth `valueUsd` in `yieldDto`, with the balances' own rate. */
const position = ({
  yieldDto,
  valueUsd,
  balanceRate,
  validatorRates,
}: {
  readonly yieldDto: EarnYieldWithProvider;
  readonly valueUsd: string;
  readonly balanceRate?: RateInput;
  readonly validatorRates?: ReadonlyArray<RateInput>;
}) => {
  const decoded = Schema.decodeSync(EarnPosition)({
    yieldId: yieldDto.id,
    balances: [
      yieldBalanceFixture({
        amount: valueUsd,
        amountUsd: valueUsd,
        token: yieldDto.token,
        ...(validatorRates
          ? {
              validators: validatorRates.map((rewardRate) =>
                yieldApiValidatorFixture({ rewardRate })
              ),
            }
          : {}),
      }),
    ],
    ...(balanceRate
      ? { rewardRate: encodeYieldRewardRateFixture(balanceRate) }
      : {}),
  });
  return toPositionItems(toPositionsData([decoded]), false);
};

const average = (
  items: ReadonlyArray<PositionItem>,
  yields: ReadonlyArray<EarnYieldWithProvider>,
  shownCampaign: YieldCampaign | null = null
) => {
  const { rate, rateType } = getPositionsAverageRate(
    items,
    new Map(yields.map((yieldDto) => [yieldDto.id, yieldDto])),
    () => shownCampaign
  );
  return { rate: rate.toFixed(), rateType };
};

const token = yieldApiYieldFixture().token;

describe("the Manage summary's average rate", () => {
  it("weighs a validator position at its validators' mean, as its page shows it", () => {
    const staking = yieldApiYieldFixture({
      id: "cosmos-atom-native-staking",
      rewardRate: { rateType: "APY", total: 0.05, components: [] },
    });
    const vault = yieldApiYieldFixture({
      id: "ethereum-usdc-vault",
      rewardRate: { rateType: "APY", total: 0.1, components: [] },
    });

    expect(
      average(
        [
          ...position({
            yieldDto: staking,
            valueUsd: "100",
            validatorRates: [
              { rateType: "APY", total: 0.04 },
              { rateType: "APY", total: 0.08 },
            ],
          }),
          ...position({ yieldDto: vault, valueUsd: "300" }),
        ],
        [staking, vault]
      )
    ).toEqual({ rate: "9", rateType: "apy" });
  });

  describe("a position whose balance rate lists its own campaign part", () => {
    // The yield's 5.8% plus its campaign's 4.2%; the wallet earns 3% of it.
    const campaignVault = yieldApiYieldFixture({
      id: "campaign-vault",
      rewardRate: {
        rateType: "APY",
        total: 0.1,
        components: [
          { rate: 0.058, rateType: "APY", token, yieldSource: "vault" },
          {
            rate: 0.042,
            rateType: "APR",
            token,
            yieldSource: "campaign_incentive",
          },
        ],
      },
    });
    const items = position({
      yieldDto: campaignVault,
      valueUsd: "100",
      balanceRate: {
        rateType: "APY",
        total: 0.088,
        components: [
          { rate: 0.058, rateType: "APY", token, yieldSource: "vault" },
          {
            rate: 0.03,
            rateType: "APR",
            token,
            yieldSource: "campaign_incentive",
          },
        ],
      },
    });
    const decodeCampaign = (overrides?: Record<string, unknown>) =>
      Schema.decodeUnknownSync(YieldCampaign)(
        yieldApiCampaignDtoFixture({ yieldId: "campaign-vault", ...overrides })
      );

    it("weighs the wallet's own rate under the shown campaign's per-wallet cap", () => {
      expect(average(items, [campaignVault], decodeCampaign())).toEqual({
        rate: "8.8",
        rateType: "apy",
      });
    });

    it("weighs the yield's rate without a cap, or while no campaign shows", () => {
      const uncapped = decodeCampaign({
        qualificationConfig: { type: "min_token_amount", threshold: "10" },
      });

      expect(average(items, [campaignVault], uncapped)).toEqual({
        rate: "10",
        rateType: "apy",
      });
      expect(average(items, [campaignVault], null)).toEqual({
        rate: "10",
        rateType: "apy",
      });
    });
  });

  it("names the rate type its positions share, and none of APR and APY mixed", () => {
    const aprYield = yieldApiYieldFixture({
      id: "solana-sol-native-staking",
      rewardRate: { rateType: "APR", total: 0.04, components: [] },
    });
    const apyYield = yieldApiYieldFixture({
      id: "ethereum-usdc-vault",
      rewardRate: { rateType: "APY", total: 0.08, components: [] },
    });
    const aprPosition = position({ yieldDto: aprYield, valueUsd: "100" });

    expect(average(aprPosition, [aprYield])).toEqual({
      rate: "4",
      rateType: "apr",
    });
    expect(
      average(
        [...aprPosition, ...position({ yieldDto: apyYield, valueUsd: "100" })],
        [aprYield, apyYield]
      )
    ).toEqual({ rate: "6", rateType: "mixed" });
  });

  it("names no rate type for a rate type it doesn't know, rather than read it as APY", () => {
    const unknownYield = yieldApiYieldFixture({
      id: "ethereum-points-vault",
      rewardRate: { rateType: "variable", total: 0.05, components: [] },
    });

    expect(
      average(position({ yieldDto: unknownYield, valueUsd: "100" }), [
        unknownYield,
      ])
    ).toEqual({ rate: "5", rateType: "mixed" });
  });
});
