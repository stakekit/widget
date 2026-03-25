import { describe, expect, it } from "vitest";
import { renderApp } from "../../utils/test-utils";
import { setup } from "./setup";

describe("Trust incentive APY", () => {
  it("shows APY composition during discovery", async () => {
    const { account, customConnectors, legacyYield, setUrl } = await setup();

    setUrl({
      accountId: account,
      yieldId: legacyYield.id,
    });

    const app = await renderApp({
      wagmi: {
        __customConnectors__: customConnectors,
      },
    });

    await expect
      .element(app.getByTestId("estimated-reward__percent").getByText("4.55%"))
      .toBeInTheDocument();

    await expect.element(app.getByText("APY composition")).toBeInTheDocument();
    await expect
      .element(
        app.getByTestId("reward-rate-breakdown__native").getByText("4.27%")
      )
      .toBeInTheDocument();
    await expect
      .element(
        app
          .getByTestId("reward-rate-breakdown__protocol-incentive")
          .getByText("0.28%")
      )
      .toBeInTheDocument();
    await expect
      .element(
        app
          .getByTestId("reward-rate-breakdown__campaign")
          .getByText("Up to 0.2%")
      )
      .toBeInTheDocument();

    await app.getByTestId("select-opportunity").click();

    const selectContainer = app.getByTestId("select-modal__container");

    await expect
      .element(selectContainer.getByText("Trust USDA Earn"))
      .toBeInTheDocument();
    await expect
      .element(selectContainer.getByText("4.55%"))
      .toBeInTheDocument();
    await expect
      .element(selectContainer.getByText("Up to 4.55%"))
      .toBeInTheDocument();

    app.unmount();
  });

  it("shows personalized APY on the position details page", async () => {
    const { account, customConnectors, legacyYield, setUrl } = await setup();

    setUrl({
      accountId: account,
      balanceId: "default",
      yieldId: legacyYield.id,
    });

    const app = await renderApp({
      wagmi: {
        __customConnectors__: customConnectors,
      },
    });

    await expect.element(app.getByText("Personalized APY")).toBeInTheDocument();
    await expect
      .element(app.getByTestId("personalized-reward-rate").getByText("4.53%"))
      .toBeInTheDocument();
    await expect
      .element(
        app
          .getByTestId("personalized-reward-rate-breakdown__native")
          .getByText("4.27%")
      )
      .toBeInTheDocument();
    await expect
      .element(
        app
          .getByTestId("personalized-reward-rate-breakdown__protocol-incentive")
          .getByText("0.28%")
      )
      .toBeInTheDocument();
    await expect
      .element(
        app
          .getByTestId("personalized-reward-rate-breakdown__campaign")
          .getByText("0.18%")
      )
      .toBeInTheDocument();

    app.unmount();
  });
});
