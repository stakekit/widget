import { describe, expect, it } from "../../../utils/test-extend";
import { renderApp } from "../../../utils/test-utils";
import { setup } from "./setup";

describe("Trust incentive APY", () => {
  it("shows APY composition during discovery", async ({ worker }) => {
    const { account, customConnectors, yieldId, setUrl } = await setup(worker);

    setUrl({
      accountId: account,
      yieldId,
    });

    const app = await renderApp({
      walletListFactory: customConnectors,
    });

    await expect
      .element(
        app.getByTestId("estimated-reward__percent").getByText("4.55%").first()
      )
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
          .getByText("Up to 0.20%")
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
    // The rate's label names its type alone.
    await expect
      .element(selectContainer.getByText("APY", { exact: true }))
      .toBeInTheDocument();

    await app.unmount();
  });

  it("shows personalized APY on the position details page", async ({
    worker,
  }) => {
    const { account, customConnectors, yieldId, setUrl } = await setup(worker);

    setUrl({
      accountId: account,
      balanceId: "default",
      yieldId,
    });

    const app = await renderApp({
      walletListFactory: customConnectors,
    });

    // The summary card leads with the personalized rate; its composition is
    // under the Details, open at first.
    await expect
      .element(
        app
          .getByTestId("position-summary")
          .getByText("4.53% Personalized APY", { exact: true })
      )
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

    await app.unmount();
  });

  it("falls back to yield APY composition when the balance has no campaign component", async ({
    worker,
  }) => {
    const { account, customConnectors, yieldId, setUrl } = await setup(worker, {
      useRewardRateWithoutCampaign: true,
    });

    setUrl({
      accountId: account,
      balanceId: "default",
      yieldId,
    });

    const app = await renderApp({
      walletListFactory: customConnectors,
    });

    await expect.poll(() => app.getByText("Personalized APY").length).toBe(0);
    await expect
      .poll(
        () =>
          app.getByTestId("personalized-reward-rate-breakdown__campaign").length
      )
      .toBe(0);
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
          .getByText("Up to 0.20%")
      )
      .toBeInTheDocument();

    await app.unmount();
  });
});
