import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import type { Yield } from "../../src/domain/types/yields";
import { getEarnDetailsModel } from "../../src/pages-dashboard/overview/earn-details/earn-details-model";
import { yieldApiYieldFixture } from "../fixtures";

const t = (key: string, options?: Record<string, unknown>): string => {
  const translations: Record<string, string> = {
    "dashboard.earn_details.min_stake": "Min stake",
    "dashboard.earn_details.minimum_subscription": "Minimum subscription",
    "dashboard.earn_details.network": "Network",
    "dashboard.earn_details.price_per_share": "Price per share",
    "dashboard.earn_details.provider": "Provider",
    "dashboard.earn_details.reward_token": "Reward token",
    "dashboard.earn_details.yield_bearing_reward_token": `${options?.symbol ?? ""} (yield-bearing)`,
  };

  return translations[key] ?? key;
};

const minStakeMechanics = {
  ...yieldApiYieldFixture().mechanics,
  entryLimits: { minimum: "1", maximum: null, subsequentMinimum: null },
};

const makeYield = (overrides?: Partial<Yield>): Yield =>
  ({
    ...yieldApiYieldFixture(),
    provider: { name: "Midas" },
    ...overrides,
  }) as Yield;

describe("getEarnDetailsModel", () => {
  it("includes price per share in details when yield state provides it", () => {
    const model = getEarnDetailsModel({
      t: t as TFunction,
      yieldDto: makeYield({
        state: {
          pricePerShareState: {
            price: 1.06274537,
            quoteToken: yieldApiYieldFixture().token,
            shareToken: yieldApiYieldFixture().token,
          },
        },
      }),
    });

    expect(
      model.detailRows.find((row) => row.id === "price-per-share")
    ).toEqual({
      id: "price-per-share",
      label: "Price per share",
      value: "1.06274537",
    });
  });

  it("labels minimum amount as Minimum subscription for RWA yields", () => {
    const model = getEarnDetailsModel({
      t: t as TFunction,
      yieldDto: makeYield({
        mechanics: {
          ...minStakeMechanics,
          type: "real_world_asset",
        },
        token: {
          ...yieldApiYieldFixture().token,
          symbol: "USDC",
        },
      }),
    });

    expect(model.detailRows.find((row) => row.id === "min-stake")).toEqual(
      expect.objectContaining({
        label: "Minimum subscription",
      })
    );
  });

  it("labels minimum amount as Min stake for non-RWA yields", () => {
    const model = getEarnDetailsModel({
      t: t as TFunction,
      yieldDto: makeYield({
        mechanics: {
          ...minStakeMechanics,
          type: "vault",
        },
      }),
    });

    expect(model.detailRows.find((row) => row.id === "min-stake")).toEqual(
      expect.objectContaining({
        label: "Min stake",
      })
    );
  });

  it("omits price per share when yield state does not provide it", () => {
    const model = getEarnDetailsModel({
      t: t as TFunction,
      yieldDto: makeYield(),
    });

    expect(model.detailRows.map((row) => row.id)).not.toContain(
      "price-per-share"
    );
  });

  it("does not mark auto-claiming rewards as yield-bearing without price per share", () => {
    const model = getEarnDetailsModel({
      t: t as TFunction,
      yieldDto: makeYield({
        outputToken: {
          ...yieldApiYieldFixture().token,
          symbol: "stETH",
        },
      }),
    });

    expect(model.detailRows.find((row) => row.id === "reward-token")).toEqual({
      id: "reward-token",
      label: "Reward token",
      value: "stETH",
    });
  });

  it("marks distinct output tokens with price per share as yield-bearing", () => {
    const baseYield = yieldApiYieldFixture();
    const model = getEarnDetailsModel({
      t: t as TFunction,
      yieldDto: makeYield({
        mechanics: {
          ...baseYield.mechanics,
          rewardClaiming: "manual",
        },
        outputToken: {
          ...baseYield.token,
          symbol: "mUSDC",
        },
        state: {
          pricePerShareState: {
            price: 1.06274537,
            quoteToken: baseYield.token,
            shareToken: baseYield.token,
          },
        },
        token: {
          ...baseYield.token,
          symbol: "USDC",
        },
      }),
    });

    expect(model.detailRows.find((row) => row.id === "reward-token")).toEqual({
      id: "reward-token",
      label: "Reward token",
      value: "mUSDC (yield-bearing)",
    });
  });
});
