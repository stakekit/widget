import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import type { EarnYieldWithProvider } from "../../../src/domain/earn/yield-schema";
import type { PositionOverviewModel } from "../../../src/features/position-details/model/position-overview";
import { PositionDetailsDisclosure } from "../../../src/features/position-details/ui/components/position-details-disclosure";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { yieldApiYieldFixture, yieldRewardRateFixture } from "../../fixtures";
import { render } from "../../utils/test-utils.dom";

const presentation = vi.hoisted(() => ({
  integration: null as EarnYieldWithProvider | null,
  overview: null as PositionOverviewModel | null,
}));

vi.mock(
  "../../../src/features/position-details/ui/use-position-overview",
  () => ({
    usePositionOverview: () => presentation.overview,
  })
);
vi.mock(
  "../../../src/features/position-details/ui/use-position-details",
  () => ({
    usePositionDetails: () => ({
      page: { _tag: "Ready" },
      integrationData: presentation.integration,
      apyCompositionRewardRate: presentation.integration?.rewardRate,
      personalizedRewardRate: null,
      shareToAmountConversions: [],
      positionSource: "yield",
    }),
  })
);

describe("Makina position details", () => {
  it.each([false, true])(
    "shows the APY breakdown only with earning funds (active: %s)",
    async (hasActive) => {
      const integrationData = yieldApiYieldFixture({
        id: "ethereum-wbtc-dbit-makina-vault",
        providerId: "makina",
        rewardRate: yieldRewardRateFixture({
          total: 0.05,
          components: [
            {
              rate: 0.03,
              rateType: "APY",
              yieldSource: "staking",
              token: yieldApiYieldFixture().token,
            },
            {
              rate: 0.02,
              rateType: "APY",
              yieldSource: "protocol_incentive",
              token: yieldApiYieldFixture().token,
            },
          ],
        }),
      });
      const i18n = createWidgetI18nInstance();
      presentation.integration = integrationData;
      presentation.overview = {
        breakdownRows: [],
        detailRows: [],
        hasEarningBalances: hasActive,
        omittedYieldFacts: [],
        summary: { value: "$1.00", rows: [] },
      };

      const { container } = await render(
        <I18nextProvider i18n={i18n}>
          <PositionDetailsDisclosure />
        </I18nextProvider>
      );

      expect(
        container.querySelector('[data-testid="reward-rate-breakdown"]') !==
          null
      ).toBe(hasActive);
    }
  );
});
