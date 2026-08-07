import { expect, it, vi } from "vitest";
import { render } from "../utils/test-utils";

vi.mock("@stakekit/rainbowkit", async (importOriginal) => {
  const actual = await importOriginal<object>();

  return {
    ...actual,
    ConnectButton: {
      Custom: ({
        children,
      }: {
        children: (state: object) => React.ReactNode;
      }) =>
        children({
          account: { address: "0x1234" },
          chain: { id: 1 },
          mounted: true,
        }),
    },
  };
});

vi.mock("../../src/features/wallet/ui", async (importOriginal) => {
  const actual = await importOriginal<object>();

  return {
    ...actual,
    AccountModal: () => <div>Account</div>,
    ChainModal: () => <div>Chain</div>,
  };
});

vi.mock("../../src/features/widget-shell/header/use-header", () => ({
  useHeader: () => ({
    containerRef: { current: null },
    hideAccountAndChainSelector: false,
    hideChainSelector: false,
    isConnected: true,
    isConnecting: false,
    onXPress: vi.fn(),
    showDisconnect: true,
    walletConfigReady: true,
  }),
}));

import { Header } from "../../src/features/widget-shell/dashboard/components/header";

it("scopes the dashboard disconnect hit target to the icon", async () => {
  const app = await render(
    <div data-rk="stakekit">
      <Header />
    </div>
  );
  const disconnectButton = app.container.querySelector("button");
  const disconnectIcon = disconnectButton?.querySelector("svg");

  expect(disconnectButton).not.toBeNull();
  expect(disconnectIcon?.getBoundingClientRect()).toMatchObject({
    height: 24,
    width: 24,
  });
  expect(disconnectButton?.getBoundingClientRect()).toMatchObject({
    height: 24,
    width: 24,
  });
});
