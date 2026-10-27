import { RegistryProvider } from "@effect/atom-react";
import { Schema } from "effect";
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
import { IntegrationId, MarketId } from "../../../src/domain/borrow/ids";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  BorrowFlowSession,
  type BorrowTransactionFlowEntry,
} from "../../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
import {
  BorrowTransactionFlowRoute,
  useBorrowTransactionFlow,
} from "../../../src/features/borrow-transaction-flow/react/borrow-flow-route";
import { walletScopeAtom } from "../../../src/features/wallet/index";
import {
  borrowEntryFlowEntry,
  withUnserializedState,
} from "../../utils/borrow-flow-entry";
import { render } from "../../utils/test-utils.dom.tsx";

const address = Schema.decodeSync(WalletAddress)("0xWallet");
const walletScope = new WalletScopeKey({ address, network: "base" });
const otherWalletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)("0xOther"),
  network: "base",
});

const makeSession = (entry: BorrowTransactionFlowEntry) =>
  new BorrowFlowSession({
    intake: {
      riskVerdict: { _tag: "Allow" },
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
        debtPrincipalAmount: "1",
        loanTokenPriceUsd: "1",
        originationFeeAmount: "0",
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
    walletScope,
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

/** A flow page that shows which Session it renders, numbered by first sight. */
const SessionPage = ({
  name,
  sessions,
}: {
  readonly name: string;
  readonly sessions: Array<BorrowFlowSession>;
}) => {
  const session = useBorrowTransactionFlow();
  if (!sessions.includes(session)) sessions.push(session);
  return (
    <output data-testid="page">
      {name}:{sessions.indexOf(session) + 1}
    </output>
  );
};

const renderFlow = async ({
  connectedWalletScope = walletScope,
  entry,
  expected,
}: {
  readonly connectedWalletScope?: WalletScopeKey | null;
  readonly entry: { readonly pathname: string; readonly state?: unknown };
  readonly expected: BorrowTransactionFlowEntry["_tag"];
}) => {
  const sessions: Array<BorrowFlowSession> = [];
  const navigation: { current: NavigateFunction | null } = { current: null };
  // Production renders the widget in StrictMode with the default idle TTL.
  const app = await render(
    <StrictMode>
      <RegistryProvider
        initialValues={[[walletScopeAtom, connectedWalletScope]]}
      >
        <MemoryRouter
          initialEntries={[withUnserializedState(entry, entry.state)]}
        >
          <NavigationCapture
            capture={(navigate) => {
              navigation.current = navigate;
            }}
          />
          <Routes>
            <Route element={<BorrowTransactionFlowRoute expected={expected} />}>
              <Route
                path="/borrow/review"
                element={<SessionPage name="Review" sessions={sessions} />}
              />
              <Route
                path="/borrow/steps"
                element={<SessionPage name="Steps" sessions={sessions} />}
              />
              <Route
                path="/positions/borrow/:marketId/review"
                element={<SessionPage name="Review" sessions={sessions} />}
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
  const location = () =>
    app.container.querySelector('[data-testid="location"]')?.textContent;
  const page = () =>
    app.container.querySelector('[data-testid="page"]')?.textContent;
  return { location, navigate, page, sessions };
};

describe("Borrow Flow route", () => {
  it("redirects to the entry when it was not navigated to with a Session", async () => {
    const flow = await renderFlow({
      entry: { pathname: "/borrow/review" },
      expected: "BorrowEntry",
    });

    await expect.poll(flow.location).toBe("/borrow");
    expect(flow.sessions).toEqual([]);
  });

  it("returns a mismatched Market Position Session to the routed market", async () => {
    const session = makeSession({
      _tag: "MarketPosition",
      marketId: Schema.decodeSync(MarketId)("market-a"),
    });
    const flow = await renderFlow({
      entry: {
        pathname: "/positions/borrow/market-b/review",
        state: { borrowFlowSession: session },
      },
      expected: "MarketPosition",
    });

    await expect.poll(flow.location).toBe("/positions/borrow/market-b");
    expect(flow.sessions).toEqual([]);
  });

  it.each([
    ["another wallet", otherWalletScope],
    ["no wallet", null],
  ] as const)(
    "redirects to where the flow began when %s is connected",
    async (_, connectedWalletScope) => {
      const session = makeSession({
        _tag: "MarketPosition",
        marketId: Schema.decodeSync(MarketId)("market-a"),
      });
      const flow = await renderFlow({
        connectedWalletScope,
        entry: {
          pathname: "/positions/borrow/market-a/review",
          state: { borrowFlowSession: session },
        },
        expected: "MarketPosition",
      });

      await expect.poll(flow.location).toBe("/positions/borrow/market-a");
      expect(flow.sessions).toEqual([]);
    }
  );

  it("keeps the navigated Session from Review through Steps and drops it on leave", async () => {
    const session = makeSession(borrowEntryFlowEntry);
    const flow = await renderFlow({
      entry: {
        pathname: "/borrow/review",
        state: { borrowFlowSession: session },
      },
      expected: "BorrowEntry",
    });
    await expect.poll(flow.page).toBe("Review:1");

    await flow.navigate("/borrow/steps");
    await expect.poll(flow.page).toBe("Steps:1");
    expect(flow.sessions).toEqual([session]);
    expect(flow.sessions[0]).toBe(session);

    await flow.navigate("/borrow");
    await expect.poll(flow.location).toBe("/borrow");
    expect(flow.page()).toBeUndefined();

    // Arriving again without a Start finds no Session to resume.
    await flow.navigate("/borrow/steps");
    await expect.poll(flow.location).toBe("/borrow");
    expect(flow.page()).toBeUndefined();
    expect(flow.sessions).toEqual([session]);
  });

  it("replaces its Session when a new Start navigates to it while mounted", async () => {
    const first = makeSession(borrowEntryFlowEntry);
    const second = makeSession(borrowEntryFlowEntry);
    const flow = await renderFlow({
      entry: {
        pathname: "/borrow/review",
        state: { borrowFlowSession: first },
      },
      expected: "BorrowEntry",
    });
    await expect.poll(flow.page).toBe("Review:1");

    await flow.navigate("/borrow/review", { borrowFlowSession: second });
    await expect.poll(flow.page).toBe("Review:2");

    await flow.navigate("/borrow/steps");
    await expect.poll(flow.page).toBe("Steps:2");
    expect(flow.sessions).toHaveLength(2);
    expect(flow.sessions[0]).toBe(first);
    expect(flow.sessions[1]).toBe(second);
  });
});
