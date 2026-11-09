import { userEvent } from "vitest/browser";

import { setup } from "../../app/journeys/trust-incentive-apy/setup";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

/** More than the position, and the wallet, hold. */
const moreThanHeld = "2000000";

describe("Position details actions", () => {
  it("opens on the exit and switches to entering further without changing the URL", async ({
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

    // A vault names its amount actions Withdraw and Deposit, as tabs; the
    // exit is selected first.
    const tabs = app.getByRole("tablist", { name: "Position actions" });
    const withdraw = tabs.getByRole("tab", { name: "Withdraw", exact: true });
    const deposit = tabs.getByRole("tab", { name: "Deposit", exact: true });

    await expect.element(withdraw).toHaveAttribute("aria-selected", "true");
    await expect.element(deposit).toHaveAttribute("aria-selected", "false");
    expect(app.getByRole("button", { name: "Deposit" }).query()).toBeNull();
    const path = window.location.pathname;

    await userEvent.click(deposit);

    await expect.element(deposit).toHaveAttribute("aria-selected", "true");
    await expect.element(withdraw).toHaveAttribute("aria-selected", "false");
    await expect
      .element(app.getByTestId("position-details-enter-amount"))
      .toBeInTheDocument();
    expect(window.location.pathname).toBe(path);

    // Depositing more than the wallet holds says so.
    await userEvent.click(app.getByRole("textbox", { name: "Amount" }));
    await userEvent.keyboard(moreThanHeld);
    await expect
      .element(app.getByText("Insufficient balance"))
      .toBeInTheDocument();

    await app.unmount();
  });

  it("leads with the summary and opens the details at first", async ({
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

    const summary = app.getByTestId("position-summary");
    await expect.element(summary.getByText("Your position")).toBeVisible();
    await expect
      .element(summary.getByText("Personalized APY", { exact: false }))
      .toBeVisible();
    await expect
      .element(summary.getByText("Projected · per year", { exact: true }))
      .toBeVisible();

    const details = app.getByTestId("position-details-disclosure");
    await expect.element(details).toHaveAttribute("aria-expanded", "true");
    await expect
      .element(app.getByTestId("personalized-reward-rate-breakdown"))
      .toBeVisible();
    // The yield's facts follow the position's Details in their own section,
    // open; no fact is listed twice: the Details hold only the position's own.
    await expect.element(app.getByText("Reward claiming")).toBeVisible();
    expect(app.getByText("Reward claiming").elements()).toHaveLength(1);

    await userEvent.click(details);
    await expect.element(details).toHaveAttribute("aria-expanded", "false");

    await app.unmount();
  });

  it("offers only the exit in the compact Layout, with no action tabs", async ({
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

    await expect
      .element(app.getByRole("textbox", { name: "Amount" }))
      .toBeInTheDocument();
    await expect.element(app.getByTestId("position-summary")).toBeVisible();
    expect(
      app.getByRole("tablist", { name: "Position actions" }).query()
    ).toBeNull();

    // Exiting more than the position holds says so.
    await userEvent.click(app.getByRole("textbox", { name: "Amount" }));
    await userEvent.keyboard(moreThanHeld);
    await expect
      .element(app.getByText("Insufficient balance"))
      .toBeInTheDocument();

    await app.unmount();
  });
});
