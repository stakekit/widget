import { describe, expect, it } from "vitest";

import { exactDecimal } from "../../../src/domain/finance/exact";
import { resolveYieldSummaryView } from "../../../src/features/yield-summary/model/yield-summary";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../../fixtures";
import { decodeValidator } from "../../utils/validators";

describe("Yield Summary", () => {
  it("publishes semantic provider and reward-token facts", () => {
    const selectedYield = yieldApiYieldFixture();
    const view = resolveYieldSummaryView({
      validators: new Map(),
      yield: selectedYield,
    });

    expect(view).toMatchObject({
      providers: [
        {
          name: selectedYield.metadata.name,
        },
      ],
      rewardToken: null,
    });
  });

  it("names each validator with its own return and rate type", () => {
    const view = resolveYieldSummaryView({
      validators: [
        decodeValidator(
          yieldApiValidatorFixture({
            name: "Validator A",
            rewardRate: { components: [], rateType: "APR", total: 0.07 },
          })
        ),
      ],
      yield: yieldApiYieldFixture({
        rewardRate: { components: [], rateType: "APY", total: 0.05 },
      }),
    });

    expect(view.providers).toMatchObject([
      {
        name: "Validator A",
        rewardRate: exactDecimal("0.07"),
        rewardType: "apr",
      },
    ]);
  });
});
