import { Schema } from "effect";
import { act, createContext, useContext, useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import type { Chain } from "viem";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { useWalletScopeRoute } from "../../src/features/wallet/index";
import { WalletScopeRoute } from "../../src/features/wallet/react/wallet-scope-route";
import type { NormalizedWalletState } from "../../src/services/wallet/wallet-state";
import { disconnectedNormalizedWalletState } from "../../src/services/wallet/wallet-state";
import { render } from "../utils/test-utils.dom.tsx";

const firstAddress = Schema.decodeSync(WalletAddress)("0xwallet-a");
const secondAddress = Schema.decodeSync(WalletAddress)("0xwallet-b");
const connectedWalletState = ({
  additionalAddresses = null,
  address = firstAddress,
}: {
  readonly additionalAddresses?: Extract<
    NormalizedWalletState,
    { readonly status: "connected" }
  >["additionalAddresses"];
  readonly address?: typeof WalletAddress.Type;
} = {}): Extract<NormalizedWalletState, { readonly status: "connected" }> => ({
  additionalAddresses,
  address,
  chain: {} as Chain,
  connector: {} as Connector,
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum",
  status: "connected",
});

const WalletScopeProbe = () => {
  const scope = useWalletScopeRoute();

  return <div data-testid="scope">{scope.address}</div>;
};

const ReplaceWalletContext = createContext<
  (state: NormalizedWalletState) => void
>(() => undefined);

const WalletScopeReplacement = ({
  state,
}: {
  state: NormalizedWalletState;
}) => {
  const replaceWallet = useContext(ReplaceWalletContext);

  return (
    <button
      data-testid="replace-wallet"
      onClick={() => replaceWallet(state)}
      type="button"
    >
      replace
    </button>
  );
};

const TestRouter = ({
  initialState,
  replacement,
}: {
  readonly initialState: NormalizedWalletState;
  readonly replacement?: NormalizedWalletState;
}) => {
  const [walletState, setWalletState] = useState(initialState);

  return (
    <ReplaceWalletContext.Provider value={setWalletState}>
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            element={
              <WalletScopeRoute
                fallbackPath="/safe"
                walletState={walletState}
              />
            }
          >
            <Route
              path="protected"
              element={
                <>
                  <WalletScopeProbe />
                  {replacement ? (
                    <WalletScopeReplacement state={replacement} />
                  ) : null}
                </>
              }
            />
          </Route>
          <Route path="safe" element={<div data-testid="safe">safe</div>} />
        </Routes>
      </MemoryRouter>
    </ReplaceWalletContext.Provider>
  );
};

const renderRoute = (
  state: NormalizedWalletState,
  replacement?: NormalizedWalletState
) => render(<TestRouter initialState={state} replacement={replacement} />);

describe("wallet scope route", () => {
  it("provides a concrete wallet scope to protected content", async () => {
    const app = await renderRoute(connectedWalletState());

    expect(
      app.container.querySelector('[data-testid="scope"]')?.textContent
    ).toBe(firstAddress);
  });

  it("redirects a disconnected wallet to the route fallback", async () => {
    const app = await renderRoute(disconnectedNormalizedWalletState);

    await vi.waitFor(() => {
      expect(
        app.container.querySelector('[data-testid="safe"]')?.textContent
      ).toBe("safe");
    });
  });

  it("redirects when the wallet owner changes", async () => {
    const app = await renderRoute(
      connectedWalletState(),
      connectedWalletState({ address: secondAddress })
    );

    await act(async () => {
      app.container
        .querySelector<HTMLButtonElement>('[data-testid="replace-wallet"]')
        ?.click();
    });
    await vi.waitFor(() => {
      expect(
        app.container.querySelector('[data-testid="safe"]')?.textContent
      ).toBe("safe");
    });
  });

  it("keeps the route mounted while the same Wallet Scope Owner is connecting", async () => {
    const connected = connectedWalletState();
    const app = await renderRoute(connected, {
      ...connected,
      status: "connecting",
    });

    await act(async () => {
      app.container
        .querySelector<HTMLButtonElement>('[data-testid="replace-wallet"]')
        ?.click();
    });

    expect(
      app.container.querySelector('[data-testid="scope"]')?.textContent
    ).toBe(firstAddress);
    expect(app.container.querySelector('[data-testid="safe"]')).toBeNull();
  });

  it("keeps the route mounted when additional addresses refresh", async () => {
    const app = await renderRoute(
      connectedWalletState(),
      connectedWalletState({
        additionalAddresses: { binanceBeaconAddress: "bnb-refreshed" },
      })
    );

    await act(async () => {
      app.container
        .querySelector<HTMLButtonElement>('[data-testid="replace-wallet"]')
        ?.click();
    });

    expect(
      app.container.querySelector('[data-testid="scope"]')?.textContent
    ).toBe(firstAddress);
    expect(app.container.querySelector('[data-testid="safe"]')).toBeNull();
  });
});
