import { RegistryProvider } from "@effect/atom-react";
import BigNumber from "bignumber.js";
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
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  type ClassicFlowSession,
  makeClassicFlowNavigationState,
  makeClassicFlowSession,
} from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import { ClassicFlowRoute } from "../../src/features/classic-transaction-flow/react/classic-flow-route";
import { ClassicTransactionFlowService } from "../../src/features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import { yieldApiYieldFixture } from "../fixtures";
import { render } from "../utils/test-utils.dom.tsx";

const address = Schema.decodeSync(WalletAddress)("0xWallet");
const walletScope = new WalletScopeKey({ address, network: "ethereum" });

const makeEnterSession = () => {
  const selectedStake = yieldApiYieldFixture();
  return makeClassicFlowSession(
    {
      intake: {
        _tag: "Enter",
        gasFeeToken: selectedStake.mechanics.gasFeeToken,
        providersDetails: [],
        request: {
          address,
          arguments: { amount: "1" },
          yieldId: selectedStake.id,
        },
        selectedStake,
        selectedToken: selectedStake.token,
        selectedValidators: new Map(),
        walletScope,
      },
      mount: { _tag: "Earn" },
    },
    walletScope
  );
};

const makeExitSession = () => {
  const integration = yieldApiYieldFixture();
  return makeClassicFlowSession(
    {
      intake: {
        _tag: "Exit",
        gasFeeToken: integration.mechanics.gasFeeToken,
        integration,
        providersDetails: [],
        receiveToken: null,
        request: {
          address,
          arguments: { amount: "1" },
          yieldId: integration.id,
        },
        unstakeAmount: new BigNumber(1),
        unstakeToken: integration.token,
        walletScope,
      },
      mount: {
        _tag: "PositionExit",
        balanceId: "balance",
        integrationId: "yield",
      },
    },
    walletScope
  );
};

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

const renderFlow = async (entry: {
  readonly pathname: string;
  readonly state?: unknown;
}) => {
  const opened: Array<ClassicFlowSession> = [];
  const closed: Array<ClassicFlowSession> = [];
  const navigation: { current: NavigateFunction | null } = { current: null };
  const service = ClassicTransactionFlowService.of({
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
            Layer.succeed(ClassicTransactionFlowService, service) as never,
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
            <Route element={<ClassicFlowRoute expected="Enter" />}>
              <Route path="/review" element={<div>Review</div>} />
              <Route path="/steps" element={<div>Steps</div>} />
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
  return { app, closed, location, navigate, opened };
};

describe("Classic Flow route", () => {
  it("redirects home when it was not navigated to with a Session", async () => {
    const flow = await renderFlow({ pathname: "/review" });

    await expect.poll(flow.location).toBe("/");
    expect(flow.opened).toEqual([]);
  });

  it("redirects home when the navigated Session has another intake variant", async () => {
    const flow = await renderFlow({
      pathname: "/review",
      state: makeClassicFlowNavigationState(makeExitSession()),
    });

    await expect.poll(flow.location).toBe("/");
    expect(flow.opened).toEqual([]);
  });

  it("owns the navigated Session from Review through Steps and ends it on leave", async () => {
    const session = makeEnterSession();
    const flow = await renderFlow({
      pathname: "/review",
      state: makeClassicFlowNavigationState(session),
    });
    await expect.poll(() => flow.app.container.textContent).toBe("Review");

    await flow.navigate("/steps");
    await expect.poll(() => flow.app.container.textContent).toBe("Steps");
    expect(flow.opened).toEqual([session]);
    expect(flow.closed).toEqual([]);

    await flow.navigate("/");
    await expect.poll(() => flow.closed).toEqual([session]);
    expect(flow.opened).toEqual([session]);
  });

  it("replaces its Session when a new Start navigates to it while mounted", async () => {
    const first = makeEnterSession();
    const second = makeEnterSession();
    const flow = await renderFlow({
      pathname: "/review",
      state: makeClassicFlowNavigationState(first),
    });
    await expect.poll(() => flow.opened).toEqual([first]);

    await flow.navigate("/review", makeClassicFlowNavigationState(second));

    await expect.poll(() => flow.closed).toEqual([first]);
    expect(flow.opened).toHaveLength(2);
    expect(flow.opened[0]).toBe(first);
    expect(flow.opened[1]).toBe(second);
    expect(flow.app.container.textContent).toBe("Review");
  });
});
