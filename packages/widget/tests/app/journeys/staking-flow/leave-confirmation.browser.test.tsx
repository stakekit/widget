import { avalanche } from "viem/chains";
import { userEvent } from "vitest/browser";
import { formatAddress } from "../../../../src/shared/lib/general";
import { describe, expect, it, vi } from "../../../utils/test-extend";
import { renderApp } from "../../../utils/test-utils";
import { setup } from "./setup";

describe("Staking flow Leave Confirmation", () => {
  it("asks before Cancel abandons a stake the wallet is signing", async ({
    worker,
  }) => {
    const { customConnectors, account, requestFn } = await setup(worker);
    // The wallet never answers the signature request: Steps stays Signing.
    requestFn.mockImplementation(async ({ method }: { method: string }) => {
      switch (method) {
        case "eth_sendTransaction":
          return Promise.withResolvers<never>().promise;
        case "eth_chainId":
          return avalanche.id;
        case "eth_requestAccounts":
          return [account];
        default:
          throw new Error("unhandled method");
      }
    });
    const trackEvent = vi.fn();
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        tracking: { trackEvent },
      },
      walletListFactory: customConnectors,
    });
    const cancelled = () =>
      trackEvent.mock.calls.filter(
        ([event]) => event === "Action steps cancelled"
      ).length;

    await expect
      .element(app.getByText(formatAddress(account)))
      .toBeInTheDocument();
    await app.getByTestId("select-opportunity").click();
    await app
      .getByTestId("select-modal__container")
      .getByTestId(/^select-opportunity__item_avalanche-avax-liquid-staking/)
      .click();
    await userEvent.click(app.getByTestId("number-input"));
    await userEvent.keyboard("0.1");
    await userEvent.click(app.getByText("Stake").last());
    await userEvent.click(
      app.getByRole("button", { exact: true, name: "Confirm" })
    );
    await expect
      .poll(() => requestFn)
      .toHaveBeenCalledWith(
        { method: "eth_sendTransaction", params: expect.anything() },
        undefined
      );

    await userEvent.click(app.getByRole("button", { name: "Cancel" }));
    await userEvent.click(app.getByRole("button", { name: "Stay" }));
    await expect
      .element(app.getByTestId("leave-confirmation"))
      .not.toBeInTheDocument();
    await expect.element(app.getByText("Follow Steps")).toBeInTheDocument();
    expect(cancelled()).toBe(0);

    await userEvent.click(app.getByRole("button", { name: "Cancel" }));
    await userEvent.click(app.getByRole("button", { name: "Leave" }));
    await expect
      .element(app.getByRole("button", { exact: true, name: "Confirm" }))
      .toBeInTheDocument();
    expect(cancelled()).toBe(1);

    await app.unmount();
  });
});
