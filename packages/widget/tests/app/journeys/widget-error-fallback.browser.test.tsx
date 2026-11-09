import { onTestFinished } from "vitest";

import type { SKAppProps } from "../../../src/public-api/react-types";
import { formatAddress } from "../../../src/shared/lib/general";
import { describe, expect, it, vi } from "../../utils/test-extend";
import { renderApp, rerenderApp } from "../../utils/test-utils";
import { setup } from "./external-provider/setup";

const externalProviders = {
  type: "generic",
  provider: {
    signMessage: async () => "hash",
    switchChain: async () => {},
    sendTransaction: async () => "hash",
  },
  currentAddress: "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7",
} satisfies SKAppProps["externalProviders"];

const ThrowingHostContent = () => {
  throw new Error("host content failed");
};

/** Keeps the errors the failure reports out of the console, for one test. */
const silenceConsoleErrors = () => {
  // The browser setup already spies console.error to filter known noise.
  const consoleError = vi.spyOn(console, "error");
  const filter = consoleError.getMockImplementation();
  consoleError.mockImplementation(() => undefined);
  onTestFinished(() => {
    if (filter) consoleError.mockImplementation(filter);
    else consoleError.mockRestore();
  });
};

describe("Widget error fallback", () => {
  it("shows the widget-unavailable notice when the Wallet Runtime invariant fails", async ({
    worker,
  }) => {
    setup(worker);
    silenceConsoleErrors();
    const apiKey = import.meta.env.VITE_API_KEY;

    const app = await renderApp({ skProps: { apiKey, externalProviders } });
    await expect
      .element(app.getByText(formatAddress(externalProviders.currentAddress)))
      .toBeInTheDocument();

    // Removing the external provider after Wallet Bootstrap violates the
    // Wallet Runtime invariant.
    await rerenderApp(app, { skProps: { apiKey } });

    await expect
      .element(
        app.getByTestId("widget-unavailable").getByText("Something went wrong")
      )
      .toBeInTheDocument();
    expect(app.container.textContent).not.toContain(
      "WalletRuntimeInvariantError"
    );

    await app.unmount();
  });

  it("shows the widget-unavailable notice when Wallet Runtime initialization throws", async ({
    worker,
  }) => {
    setup(worker);
    silenceConsoleErrors();

    const app = await renderApp({
      skProps: { apiKey: import.meta.env.VITE_API_KEY },
      walletListFactory: () => {
        throw new Error("wallet list factory failed");
      },
    });

    await expect
      .element(
        app.getByTestId("widget-unavailable").getByText("Something went wrong")
      )
      .toBeInTheDocument();
    expect(app.container.textContent).not.toContain(
      "wallet list factory failed"
    );

    await app.unmount();
  });

  it("shows the widget-unavailable notice when rendering fails outside the routes", async ({
    worker,
  }) => {
    setup(worker);
    silenceConsoleErrors();

    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        // Host children render inside the Widget root, above the router.
        children: <ThrowingHostContent />,
      },
    });

    await expect
      .element(
        app.getByTestId("widget-unavailable").getByText("Something went wrong")
      )
      .toBeInTheDocument();
    expect(app.container.textContent).not.toContain("host content failed");

    await app.unmount();
  });
});
