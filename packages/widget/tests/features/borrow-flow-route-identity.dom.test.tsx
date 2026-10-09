import { RegistryProvider } from "@effect/atom-react";
import { Effect, Layer, Schema } from "effect";
import { act, StrictMode } from "react";
import {
  MemoryRouter,
  type NavigateFunction,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { describe, expect, it } from "vitest";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { IntegrationId, MarketId } from "../../src/domain/borrow/ids";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  BorrowFlowSession,
  type BorrowTransactionFlowEntry,
  makeBorrowFlowNavigationState,
} from "../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
import { BorrowTransactionFlowRoute } from "../../src/features/borrow-transaction-flow/react/borrow-flow-route";
import { BorrowTransactionFlowService } from "../../src/features/borrow-transaction-flow/state/orchestration/borrow-transaction-flow-service";
import { render } from "../utils/test-utils.dom.tsx";

const address = Schema.decodeSync(WalletAddress)("0xWallet");

const makeSession = (entry: BorrowTransactionFlowEntry) =>
  new BorrowFlowSession({
    intake: {
      command: {
        action: "borrow",
        address,
        args: { marketId: Schema.decodeSync(MarketId)("market-a") },
        integrationId: Schema.decodeSync(IntegrationId)("provider-1"),
      },
      entry,
      summary: {
        action: "borrow",
        borrowAmount: "1",
        existingCollateralUsd: "100",
        existingDebtUsd: "0",
        loanTokenSymbol: "USDC",
        marketLabel: "USDC market",
        network: "base",
        projectedCollateralUsd: "100",
        projectedDebtUsd: "1",
        providerName: "Provider",
        riskStatus: "unavailable",
        warnings: [],
      },
    },
    walletScope: new WalletScopeKey({ address, network: "base" }),
  });

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
};

const NavigationCapture = ({
  capture,
}: {
  readonly capture: (navigate: NavigateFunction) => void;
}) => {
  capture(useNavigate());
  return null;
};

const renderFlow = async ({
  entry,
  expected,
}: {
  readonly entry: { readonly pathname: string; readonly state?: unknown };
  readonly expected: BorrowTransactionFlowEntry["_tag"];
}) => {
  const opened: Array<BorrowFlowSession> = [];
  const closed: Array<BorrowFlowSession> = [];
  const navigation: { current: NavigateFunction | null } = { current: null };
  const service = BorrowTransactionFlowService.of({
    openSession: (session) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          opened.push(session);
          return {
            acquireExecution: () => Effect.die("Not used"),
            acquireReview: () => Effect.die("Not used"),
            intake: session.intake,
          };
        }),
        () => Effect.sync(() => closed.push(session))
      ),
    start: () => Effect.die("Not used"),
  });
  // Production renders the widget in StrictMode with the default idle TTL.
  const app = await render(
    <StrictMode>
      <RegistryProvider
        initialValues={[
          [
            walletRuntime.layer,
            Layer.succeed(BorrowTransactionFlowService, service) as never,
          ],
        ]}
      >
        <MemoryRouter initialEntries={[entry]}>
          <NavigationCapture
            capture={(navigate) => {
              navigation.current = navigate;
            }}
          />
          <Routes>
            <Route element={<BorrowTransactionFlowRoute expected={expected} />}>
              <Route path="/borrow/review" element={<div>Review</div>} />
              <Route path="/borrow/steps" element={<div>Steps</div>} />
              <Route
                path="/positions/borrow/:marketId/review"
                element={<div>Review</div>}
              />
            </Route>
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </RegistryProvider>
    </StrictMode>
  );
  const navigate = (to: string, state?: unknown) =>
    act(async () => {
      await navigation.current?.(to, { state });
    });
  return { app, closed, navigate, opened };
};

describe("Borrow Flow route", () => {
  it("redirects to the entry when it was not navigated to with a Session", async () => {
    const { app, opened } = await renderFlow({
      entry: { pathname: "/borrow/review" },
      expected: "BorrowEntry",
    });

    expect(
      app.container.querySelector('[data-testid="location"]')?.textContent
    ).toBe("/borrow");
    expect(opened).toEqual([]);
  });

  it("returns a mismatched Market Position Session to the routed market", async () => {
    const session = makeSession({
      _tag: "MarketPosition",
      marketId: Schema.decodeSync(MarketId)("market-a"),
    });
    const { app, opened } = await renderFlow({
      entry: {
        pathname: "/positions/borrow/market-b/review",
        state: makeBorrowFlowNavigationState(session),
      },
      expected: "MarketPosition",
    });

    expect(
      app.container.querySelector('[data-testid="location"]')?.textContent
    ).toBe("/positions/borrow/market-b");
    expect(opened).toEqual([]);
  });

  it("owns the navigated Session from Review through Steps and ends it on leave", async () => {
    const session = makeSession({ _tag: "BorrowEntry" });
    const flow = await renderFlow({
      entry: {
        pathname: "/borrow/review",
        state: makeBorrowFlowNavigationState(session),
      },
      expected: "BorrowEntry",
    });
    await expect.poll(() => flow.app.container.textContent).toBe("Review");

    await flow.navigate("/borrow/steps");
    await expect.poll(() => flow.app.container.textContent).toBe("Steps");
    expect(flow.opened).toEqual([session]);
    expect(flow.closed).toEqual([]);

    await flow.navigate("/borrow");
    await expect.poll(() => flow.closed).toEqual([session]);
    expect(flow.opened).toEqual([session]);
  });

  it("replaces its Session when a new Start navigates to it while mounted", async () => {
    const first = makeSession({ _tag: "BorrowEntry" });
    const second = makeSession({ _tag: "BorrowEntry" });
    const flow = await renderFlow({
      entry: {
        pathname: "/borrow/review",
        state: makeBorrowFlowNavigationState(first),
      },
      expected: "BorrowEntry",
    });
    await expect.poll(() => flow.opened).toEqual([first]);

    await flow.navigate(
      "/borrow/review",
      makeBorrowFlowNavigationState(second)
    );

    await expect.poll(() => flow.closed).toEqual([first]);
    expect(flow.opened).toEqual([first, second]);
    expect(flow.opened[1]).toBe(second);
  });
});
