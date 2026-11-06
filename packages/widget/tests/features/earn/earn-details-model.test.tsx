import BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import type { EarnYieldWithProvider } from "../../../src/domain/earn/models";
import {
  canPresentRewardRateHistory,
  getEarnDetailsModel,
} from "../../../src/features/earn/ui/dashboard/earn-details/earn-details-model";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../../fixtures";
import { decodeValidator } from "../../utils/validators";

const t: TFunction = createWidgetI18nInstance().getFixedT("en");

const makeYield = (
  overrides?: Partial<EarnYieldWithProvider>
): EarnYieldWithProvider =>
  ({
    ...yieldApiYieldFixture(),
    provider: { name: "Midas" },
    ...overrides,
  }) as EarnYieldWithProvider;

describe("canPresentRewardRateHistory", () => {
  it("presents reward-rate history only when validator selection is not required", () => {
    const ordinaryYield = makeYield();
    const validatorMechanicYield = makeYield({
      mechanics: {
        ...ordinaryYield.mechanics,
        requiresValidatorSelection: true,
      },
    });
    const validatorArgumentYield = makeYield({
      mechanics: {
        ...ordinaryYield.mechanics,
        arguments: {
          ...ordinaryYield.mechanics.arguments,
          enter: {
            fields: {
              validatorAddress: {
                required: true,
              },
            },
          },
        },
      },
    });

    expect(canPresentRewardRateHistory(ordinaryYield)).toBe(true);
    expect(canPresentRewardRateHistory(validatorMechanicYield)).toBe(false);
    expect(canPresentRewardRateHistory(validatorArgumentYield)).toBe(false);
  });
});
describe("getEarnDetailsModel", () => {
  it("uses all selected validators in the header provider name", () => {
    const firstValidator = decodeValidator(
      yieldApiValidatorFixture({
        address: "validator-1",
        name: "Kiln",
      })
    );
    const secondValidator = decodeValidator(
      yieldApiValidatorFixture({
        address: "validator-2",
        name: "P2P",
      })
    );

    const model = getEarnDetailsModel({
      locale: "en",
      selectedValidators: new Map([
        [firstValidator.key, firstValidator],
        [secondValidator.key, secondValidator],
      ]),
      t: t as TFunction,
      yieldDto: makeYield(),
    });

    expect(model.providerName).toBe("Kiln, P2P");
  });

  it("leads with up to three metric cards and leaves only them out of the yield's facts", () => {
    const model = getEarnDetailsModel({
      locale: "en",
      t: t as TFunction,
      yieldDto: makeYield({
        mechanics: { ...yieldApiYieldFixture().mechanics, type: "staking" },
      }),
    });

    expect(model.metricCards.length).toBeGreaterThan(0);
    expect(model.metricCards.length).toBeLessThanOrEqual(3);
    expect(model.omittedYieldFacts).toHaveLength(model.metricCards.length);
    expect(model.omittedYieldFacts).not.toContain("website");
    expect(model.omittedYieldFacts[0]).toBe("reward-rate");
  });

  it("lists a DeFi yield's fees with its facts, never as metric cards", () => {
    const model = getEarnDetailsModel({
      locale: "en",
      t: t as TFunction,
      yieldDto: makeYield({
        mechanics: {
          ...yieldApiYieldFixture().mechanics,
          fee: {
            deposit: new BigNumber("0.5"),
            management: new BigNumber("2"),
            performance: new BigNumber("20"),
            withdrawal: new BigNumber("0.1"),
          },
          type: "vault",
        },
      }),
    });

    expect(model.omittedYieldFacts.filter((id) => id.endsWith("-fee"))).toEqual(
      []
    );
    expect(model.metricCards.map((card) => card.label)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/fee$/)])
    );
  });
});
