import { expect, it, vi } from "vitest";
import { render } from "../../utils/test-utils";

const header = vi.hoisted(() => ({ showBack: false, showDisconnect: true }));

vi.mock("../../../src/features/wallet/views", async (importOriginal) => {
  const actual = await importOriginal<object>();

  return {
    ...actual,
    AccountModal: () => <div>Account</div>,
    ChainModal: () => <div>Chain</div>,
  };
});

vi.mock(
  "../../../src/features/mount-animation/index",
  async (importOriginal) => {
    const actual = await importOriginal<object>();

    return {
      ...actual,
      useMountAnimation: () => ({
        state: { earnPage: true, layout: true },
        dispatch: vi.fn(),
      }),
      useMountRevealReady: () => true,
    };
  }
);

vi.mock(
  "../../../src/features/widget-configuration/index",
  async (importOriginal) => {
    const actual = await importOriginal<object>();

    return { ...actual, useWidgetConfig: () => true };
  }
);

vi.mock("../../../src/features/widget-shell/react/use-header", () => ({
  useHeader: () => ({
    hidesHeaderWalletControl: false,
    hideChainSelector: false,
    isConnected: true,
    isConnecting: false,
    leaveConfirmationDialog: { onLeave: vi.fn(), onStay: vi.fn(), open: false },
    onLeftIconPress: vi.fn(),
    onXPress: vi.fn(),
    showBack: header.showBack,
    showDisconnect: header.showDisconnect,
    walletConfigReady: true,
  }),
}));

import { CompactFrame } from "../../../src/features/widget-shell/ui/compact/header/index";

const renderFrame = () =>
  render(
    <div data-rk="stakekit" style={{ width: 440 }}>
      <CompactFrame pageKey="page">
        <div>Page</div>
      </CompactFrame>
    </div>
  );

it.each([false, true])(
  "puts the disconnect button on the wallet controls' row (back shown: %s)",
  async (showBack) => {
    header.showBack = showBack;
    header.showDisconnect = true;
    const app = await renderFrame();

    const disconnect = app.getByRole("button", { name: /disconnect/i });
    await expect.element(disconnect).toBeInTheDocument();
    const button = disconnect.element().getBoundingClientRect();
    const pill = app.getByText("Account").element().getBoundingClientRect();

    // One row: the button sits level with the pills, after them.
    expect(button.top).toBeLessThan(pill.bottom);
    expect(button.bottom).toBeGreaterThan(pill.top);
    expect(button.left).toBeGreaterThanOrEqual(pill.right);
  }
);

it.each([true, false])(
  "centres the wallet controls in the frame (disconnect shown: %s)",
  async (showDisconnect) => {
    header.showBack = false;
    header.showDisconnect = showDisconnect;
    const app = await renderFrame();

    await expect.element(app.getByText("Account")).toBeInTheDocument();
    const chain = app.getByText("Chain").element().getBoundingClientRect();
    const account = app.getByText("Account").element().getBoundingClientRect();
    const row = app.container
      .querySelector('[data-rk="header"]')
      ?.getBoundingClientRect();
    if (!row) throw new Error("No header row");

    expect(
      Math.abs((chain.left + account.right) / 2 - (row.left + row.width / 2))
    ).toBeLessThanOrEqual(1);
  }
);
