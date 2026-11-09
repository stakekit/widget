import { userEvent } from "vitest/browser";

import { setup } from "../../app/journeys/trust-incentive-apy/setup";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

const moreThanHeld = "2000000";

describe("Position amount over the available balance", () => {
  it("says the balance is insufficient when exiting more than the position holds", async ({
    worker,
  }) => {
    const { account, customConnectors, yieldId, setUrl } = await setup(worker, {
      editableAmounts: true,
    });

    setUrl({
      accountId: account,
      balanceId: "default",
      yieldId,
    });

    const app = await renderApp({ walletListFactory: customConnectors });

    await userEvent.click(app.getByRole("textbox", { name: "Amount" }));
    await userEvent.keyboard(moreThanHeld);

    await expect
      .element(app.getByText("Insufficient balance"))
      .toBeInTheDocument();

    await app.unmount();
  });

  it("says the balance is insufficient when depositing more than the wallet holds", async ({
    worker,
  }) => {
    const { account, customConnectors, yieldId, setUrl } = await setup(worker, {
      editableAmounts: true,
    });

    setUrl({
      accountId: account,
      balanceId: "default",
      yieldId,
    });

    const app = await renderApp({
      walletListFactory: customConnectors,
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        layout: "dashboard",
      },
    });

    await userEvent.click(
      app.getByRole("tab", { name: "Deposit", exact: true })
    );
    await userEvent.click(app.getByRole("textbox", { name: "Amount" }));
    await userEvent.keyboard(moreThanHeld);

    await expect
      .element(app.getByText("Insufficient balance"))
      .toBeInTheDocument();

    await app.unmount();
  });
});
