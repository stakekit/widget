import { expect, it, vi } from "vitest";
import { render } from "../../utils/test-utils";

vi.mock("../../../src/features/wallet/views", async (importOriginal) => {
  const actual = await importOriginal<object>();

  return {
    ...actual,
    AccountModal: () => <div>Account</div>,
    ChainModal: () => <div>Chain</div>,
  };
});

vi.mock("../../../src/features/widget-shell/react/use-header", () => ({
  useHeader: () => ({
    hideAccountAndChainSelector: false,
    hideChainSelector: false,
    isConnected: true,
    isConnecting: false,
    leaveConfirmationDialog: { onLeave: vi.fn(), onStay: vi.fn(), open: false },
    onXPress: vi.fn(),
    showDisconnect: true,
    walletConfigReady: true,
  }),
}));

import { Header } from "../../../src/features/widget-shell/ui/dashboard/header";

it("puts the dashboard disconnect button beside the wallet controls", async () => {
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
