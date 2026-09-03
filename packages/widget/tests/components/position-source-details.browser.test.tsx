import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import type { EarnYieldWithProvider } from "../../src/domain/earn/models";
import { PositionSourceDetails } from "../../src/features/position-details/ui/classic/components/position-source-details";
import { YieldDetails } from "../../src/features/position-details/ui/classic/components/yield-details";
import { createWidgetI18nInstance } from "../../src/services/translation/widget-translation";
import {
  yieldApiProviderFixture,
  yieldApiYieldFixture,
  yieldRewardRateFixture,
} from "../fixtures";
import { render } from "../utils/test-utils";

const i18nInstance = createWidgetI18nInstance();
const baseYield = yieldApiYieldFixture();
const integration: EarnYieldWithProvider = {
  ...baseYield,
  mechanics: {
    ...baseYield.mechanics,
    lockupPeriod: { seconds: 7 * 24 * 60 * 60 },
    rewardClaiming: "auto",
    rewardSchedule: "day",
    type: "vault",
    warmupPeriod: { seconds: 3 * 24 * 60 * 60 },
  },
  provider: yieldApiProviderFixture({
    name: "Aave",
    website: "https://www.aave.com",
  }),
  rewardRate: yieldRewardRateFixture({ total: 0.04 }),
  state: {
    pricePerShareState: {
      price: 1.06274537,
      quoteToken: baseYield.token,
      shareToken: baseYield.token,
    },
  },
};

describe("Position source yield details", () => {
  it("reveals useful non-validator yield facts without repeating the visible rate", async () => {
    const app = await render(
      <I18nextProvider i18n={i18nInstance}>
        <YieldDetails integrationData={integration} showRewardRate={false} />
      </I18nextProvider>
    );

    await expect
      .element(app.getByText("Deposited via Aave"))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("Reward claiming"))
      .not.toBeInTheDocument();

    await userEvent.click(app.getByTestId("position-source-details-trigger"));

    await expect.element(app.getByText("aave.com")).toBeInTheDocument();
    await expect.element(app.getByText("Reward claiming")).toBeInTheDocument();
    await expect.element(app.getByText("Auto-compounding")).toBeInTheDocument();
    await expect.element(app.getByText("Reward schedule")).toBeInTheDocument();
    await expect
      .element(app.getByText("Day", { exact: true }))
      .toBeInTheDocument();
    await expect.element(app.getByText("Warmup")).toBeInTheDocument();
    await expect.element(app.getByText("3 days")).toBeInTheDocument();
    await expect.element(app.getByText("Lockup")).toBeInTheDocument();
    await expect.element(app.getByText("7 days")).toBeInTheDocument();
    await expect.element(app.getByText("Price per share")).toBeInTheDocument();
    await expect.element(app.getByText("1.06274537")).toBeInTheDocument();
    await expect.element(app.getByText("APY (7D)")).not.toBeInTheDocument();
  });

  it("shows the yield rate when it is not presented above the accordion", async () => {
    const app = await render(
      <I18nextProvider i18n={i18nInstance}>
        <YieldDetails integrationData={integration} showRewardRate />
      </I18nextProvider>
    );

    await userEvent.click(app.getByTestId("position-source-details-trigger"));

    await expect.element(app.getByText("APY (7D)")).toBeInTheDocument();
    await expect.element(app.getByText("4%")).toBeInTheDocument();
  });

  it("prioritizes fees over other optional facts", async () => {
    const app = await render(
      <I18nextProvider i18n={i18nInstance}>
        <YieldDetails
          integrationData={{
            ...integration,
            mechanics: {
              ...integration.mechanics,
              fee: { management: "0.02" },
            },
          }}
          showRewardRate={false}
        />
      </I18nextProvider>
    );

    await userEvent.click(app.getByTestId("position-source-details-trigger"));

    await expect.element(app.getByText("Fees")).toBeInTheDocument();
    await expect.element(app.getByText("2%")).toBeInTheDocument();
    await expect
      .element(app.getByText("Price per share"))
      .not.toBeInTheDocument();
  });

  it("does not offer disclosure when there are no detail rows", async () => {
    const app = await render(
      <I18nextProvider i18n={i18nInstance}>
        <PositionSourceDetails
          hasDetails={false}
          isFirst
          logo={undefined}
          name="Aave"
          stakeType="Deposited"
        />
      </I18nextProvider>
    );

    await expect
      .element(app.getByText("Deposited via Aave"))
      .toBeInTheDocument();
    await expect
      .element(app.getByTestId("position-source-details-trigger"))
      .not.toBeInTheDocument();
  });
});
