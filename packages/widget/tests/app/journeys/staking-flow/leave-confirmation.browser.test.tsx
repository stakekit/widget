import { MotionGlobalConfig } from "motion/react";
import { avalanche } from "viem/chains";
import { afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { YieldCategory } from "../../../../src/public-api/types";
import { formatAddress } from "../../../../src/shared/lib/general";
import { describe, expect, it, vi } from "../../../utils/test-extend";
import { renderApp } from "../../../utils/test-utils";
import { waitForMs } from "../../../utils/wait";
import { setup } from "./setup";

/** Outlasts the page exit transition that used to drop the dialog. */
const pastPageExitMs = 1_000;

afterEach(() => {
  MotionGlobalConfig.skipAnimations = true;
});

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

  it("asks before a dashboard category tab abandons a stake the wallet is signing", async ({
    worker,
  }) => {
    MotionGlobalConfig.skipAnimations = false;
    const { customConnectors, account, requestFn } = await setup(worker, {
      includeDefiYield: true,
    });
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
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        dashboardVariant: true,
        yieldCategoryOrder: [YieldCategory.Stake, YieldCategory.DeFi],
      },
      walletListFactory: customConnectors,
    });
    const tab = (label: string) => {
      const section = app.container.querySelector("[data-rk='tabs-section']");
      const found = [...(section?.querySelectorAll("p") ?? [])].find(
        (el) => el.textContent === label
      );
      if (!found) throw new Error(`Missing dashboard tab: ${label}`);
      return found;
    };
    const tabState = (label: string) => tab(label).getAttribute("data-state");
    const signatureRequests = () =>
      requestFn.mock.calls.filter(
        ([{ method }]) => method === "eth_sendTransaction"
      ).length;
    const dialog = app.getByTestId("leave-confirmation");
    const steps = app.getByText("Follow Steps");

    await expect
      .element(app.getByText(formatAddress(account)))
      .toBeInTheDocument();
    await expect.poll(() => tabState("DeFi")).toBe("default");
    await expect.poll(() => tabState("Stake")).toBe("selected");

    await userEvent.click(app.getByTestId("number-input"));
    await userEvent.keyboard("0.1");
    await userEvent.click(
      app.getByRole("button", { exact: true, name: "Stake" }).last()
    );
    await userEvent.click(
      app.getByRole("button", { exact: true, name: "Confirm" })
    );
    await expect.poll(signatureRequests).toBe(1);
    await expect.element(steps).toBeInTheDocument();

    // Pressing a category asks first; the question outlasts the page exit.
    await userEvent.click(tab("DeFi"));
    await expect.element(dialog).toBeInTheDocument();
    await waitForMs(pastPageExitMs);
    expect(dialog.query()).not.toBeNull();
    expect(steps.query()).not.toBeNull();
    expect(tabState("Stake")).toBe("selected");
    expect(tabState("DeFi")).toBe("default");

    // Stay keeps the signing stake and drops the pressed category for good.
    await userEvent.click(app.getByRole("button", { name: "Stay" }));
    await expect.element(dialog).not.toBeInTheDocument();
    await waitForMs(pastPageExitMs);
    expect(dialog.query()).toBeNull();
    expect(steps.query()).not.toBeNull();
    expect(tabState("Stake")).toBe("selected");
    expect(tabState("DeFi")).toBe("default");
    expect(signatureRequests()).toBe(1);

    // A category left pending by Stay would swallow this second press.
    await userEvent.click(tab("DeFi"));
    await expect.element(dialog).toBeInTheDocument();
    await userEvent.click(app.getByRole("button", { name: "Leave" }));
    await expect.poll(() => tabState("DeFi")).toBe("selected");
    expect(tabState("Stake")).toBe("default");
    await expect.element(steps).not.toBeInTheDocument();
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(app.getByTestId("number-input")).toBeInTheDocument();
    expect(signatureRequests()).toBe(1);

    await app.unmount();
  });
});
