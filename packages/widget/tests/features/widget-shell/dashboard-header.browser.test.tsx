import { expect, it, vi } from "vitest";

import { render } from "../../utils/test-utils";

const wallet = vi.hoisted(() => ({ isConnected: true }));

vi.mock("../../../src/features/wallet/views", async (importOriginal) => {
  const actual = await importOriginal<object>();

  return {
    ...actual,
    AccountModal: () => <div>Account</div>,
    ChainModal: () => <div>Chain</div>,
  };
});

vi.mock("../../../src/features/widget-shell/ui/use-header", () => ({
  useHeader: () => ({
    hideAccountAndChainSelector: false,
    hideChainSelector: false,
    isConnected: wallet.isConnected,
    isConnecting: false,
    leaveConfirmationDialog: { onLeave: vi.fn(), onStay: vi.fn(), open: false },
    onXPress: vi.fn(),
    showDisconnect: true,
    walletConfigReady: true,
  }),
}));

import { Header } from "../../../src/features/widget-shell/ui/dashboard/header";

it("puts the dashboard disconnect button beside the wallet controls", async () => {
  wallet.isConnected = true;
  const app = await render(
    <div data-rk="stakekit">
      <Header />
    </div>
  );

  const header = app.container.querySelector('[data-rk="header"]');
  const disconnect = app.getByRole("button", { name: /disconnect/i });

  await expect.element(disconnect).toBeInTheDocument();
  expect(header?.textContent).toContain("Chain");
  expect(header?.textContent).toContain("Account");
  expect(header?.contains(disconnect.element())).toBe(true);
});

it("leaves no band while no wallet is connected", async () => {
  wallet.isConnected = false;
  const app = await render(
    <div data-rk="stakekit" data-testid="frame">
      <Header />
    </div>
  );

  const frame = app.getByTestId("frame").element();

  expect(app.container.querySelector('[data-rk="header"]')).toBeNull();
  expect(frame.getBoundingClientRect().height).toBe(0);
});
