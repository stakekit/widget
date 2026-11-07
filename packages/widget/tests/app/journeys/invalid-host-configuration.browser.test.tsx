import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

describe("Invalid initial Host Configuration", () => {
  it("shows the widget-unavailable notice and keeps the host rendered", async () => {
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        // Borrow requires the dashboard variant.
        borrowEnabled: true,
        dashboardVariant: false,
        children: <p>host content</p>,
      },
    });

    const notice = app.getByTestId("widget-unavailable");
    await expect
      .element(notice.getByText("Something went wrong"))
      .toBeInTheDocument();
    await expect.element(app.getByText("host content")).toBeInTheDocument();

    await app.unmount();
  });

  it("shows the notice when the rejected configuration also has an unknown theme token", async () => {
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        borrowEnabled: true,
        dashboardVariant: false,
        // A bundle host's stale token, outside the theme contract.
        theme: JSON.parse('{"color":{"notAThemeToken":"#ff0000"}}'),
      },
    });

    await expect
      .element(
        app.getByTestId("widget-unavailable").getByText("Something went wrong")
      )
      .toBeInTheDocument();

    await app.unmount();
  });

  it("shows the notice for an external provider with the Finery variant's institutional wallets", async () => {
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        variant: "finery",
        externalProviders: {
          type: "generic",
          provider: {
            signMessage: async () => "hash",
            switchChain: async () => {},
            sendTransaction: async () => "hash",
          },
          currentAddress: "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7",
        },
      },
    });

    await expect
      .element(
        app.getByTestId("widget-unavailable").getByText("Something went wrong")
      )
      .toBeInTheDocument();

    await app.unmount();
  });
});
