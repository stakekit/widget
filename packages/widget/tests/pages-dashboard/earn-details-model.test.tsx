import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import type { Yield } from "../../src/domain/types/yields";
import { getEarnDetailsModel } from "../../src/pages-dashboard/overview/earn-details/earn-details-model";
import { yieldApiYieldFixture } from "../fixtures";

const t = (key: string): string => {
  const translations: Record<string, string> = {
    "dashboard.earn_details.network": "Network",
    "dashboard.earn_details.price_per_share": "Price per share",
    "dashboard.earn_details.provider": "Provider",
    "dashboard.earn_details.reward_token": "Reward token",
  };

  return translations[key] ?? key;
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

  it("omits price per share when yield state does not provide it", () => {
    const model = getEarnDetailsModel({
      t: t as TFunction,
      yieldDto: makeYield(),
    });

    expect(model.detailRows.map((row) => row.id)).not.toContain(
      "price-per-share"
    );
  });
});
