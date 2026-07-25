import { Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, createContext, useContext, useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import type { Chain } from "viem";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  useWalletScopeRoute,
  WalletScopeRoute,
} from "../../src/features/wallet/ui";
import type { NormalizedWalletState } from "../../src/services/wallet/domain/state";
import { disconnectedNormalizedWalletState } from "../../src/services/wallet/domain/state";
import { render } from "../utils/test-utils.dom";

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
} = {}): NormalizedWalletState => ({
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
  initialResult,
  replacement,
}: {
  readonly initialResult: AsyncResult.AsyncResult<NormalizedWalletState, never>;
  readonly replacement?: NormalizedWalletState;
}) => {
  const [result, setResult] = useState(initialResult);

  return (
    <ReplaceWalletContext.Provider
      value={(state) => setResult(AsyncResult.success(state))}
    >
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            element={
              <WalletScopeRoute
                fallbackPath="/safe"
                walletStateResult={result}
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
  result: AsyncResult.AsyncResult<NormalizedWalletState, never>,
  replacement?: NormalizedWalletState
) => render(<TestRouter initialResult={result} replacement={replacement} />);

describe("wallet scope route", () => {
  it("provides a concrete wallet scope to protected content", async () => {
    const app = await renderRoute(AsyncResult.success(connectedWalletState()));

    expect(
      app.container.querySelector('[data-testid="scope"]')?.textContent
    ).toBe(firstAddress);
  });

  it("redirects a disconnected wallet to the route fallback", async () => {
    const app = await renderRoute(
      AsyncResult.success(disconnectedNormalizedWalletState)
    );

    await vi.waitFor(() => {
      expect(
        app.container.querySelector('[data-testid="safe"]')?.textContent
      ).toBe("safe");
    });
  });

  it("waits while the wallet scope is resolving", async () => {
    const app = await renderRoute(
      AsyncResult.waiting(
        AsyncResult.success(disconnectedNormalizedWalletState)
      )
    );

    expect(app.container.textContent).toBe("");
  });

  it("redirects when the wallet owner changes", async () => {
    const app = await renderRoute(
      AsyncResult.success(connectedWalletState()),
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

  it("keeps the route mounted when additional addresses refresh", async () => {
    const app = await renderRoute(
      AsyncResult.success(connectedWalletState()),
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
