import { RegistryProvider } from "@effect/atom-react";
import BigNumber from "bignumber.js";
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
import {
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { walletScopeAtom } from "../../../src/features/wallet/index";
import {
  makeYieldFlowSession,
  type YieldFlowSession,
} from "../../../src/features/yield-transaction-flow/model/yield-transaction-flow";
import {
  useYieldFlowSession,
  YieldFlowRoute,
} from "../../../src/features/yield-transaction-flow/react/yield-flow-route";
import { yieldApiYieldFixture } from "../../fixtures";
import { render } from "../../utils/test-utils.dom.tsx";

const address = Schema.decodeSync(WalletAddress)("0xWallet");
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const otherWalletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)("0xOther"),
  network: "ethereum",
});

const makeEnterSession = () => {
  const selectedStake = yieldApiYieldFixture();
  return makeYieldFlowSession(
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
        selectedProviderOption: null,
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
  return makeYieldFlowSession(
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
        integrationId: Schema.decodeSync(YieldId)("yield"),
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

/** A flow page that shows which Session it renders, numbered by first sight. */
const SessionPage = ({
  name,
  sessions,
}: {
  readonly name: string;
  readonly sessions: Array<YieldFlowSession>;
}) => {
  const session = useYieldFlowSession();
  if (!sessions.includes(session)) sessions.push(session);
  return (
    <output data-testid="page">
      {name}:{sessions.indexOf(session) + 1}
    </output>
  );
};

const renderFlow = async (
  entry: {
    readonly pathname: string;
    readonly state?: unknown;
  },
  connectedWalletScope: WalletScopeKey | null = walletScope
) => {
  const sessions: Array<YieldFlowSession> = [];
  const navigation: { current: NavigateFunction | null } = { current: null };
  // Production renders the widget in StrictMode with the default idle TTL.
  const app = await render(
    <StrictMode>
      <RegistryProvider
        initialValues={[[walletScopeAtom, connectedWalletScope]]}
      >
        <MemoryRouter initialEntries={[entry]}>
          <NavigationCapture
            capture={(navigate) => {
              navigation.current = navigate;
            }}
          />
          <Routes>
            <Route element={<YieldFlowRoute expected="Enter" mount="Earn" />}>
              <Route
                path="/review"
                element={<SessionPage name="Review" sessions={sessions} />}
              />
              <Route
                path="/steps"
                element={<SessionPage name="Steps" sessions={sessions} />}
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

describe("Yield Flow route", () => {
  it("redirects home when it was not navigated to with a Session", async () => {
    const flow = await renderFlow({ pathname: "/review" });

    await expect.poll(flow.location).toBe("/");
    expect(flow.sessions).toEqual([]);
  });

  it("redirects home when the navigated Session has another intake variant", async () => {
    const flow = await renderFlow({
      pathname: "/review",
      state: { yieldFlowSession: makeExitSession() },
    });

    await expect.poll(flow.location).toBe("/");
    expect(flow.sessions).toEqual([]);
  });

  it("redirects home when the connected wallet does not own the Session", async () => {
    const flow = await renderFlow(
      {
        pathname: "/review",
        state: { yieldFlowSession: makeEnterSession() },
      },
      otherWalletScope
    );

    await expect.poll(flow.location).toBe("/");
    expect(flow.sessions).toEqual([]);
  });

  it("keeps the navigated Session from Review through Steps and drops it on leave", async () => {
    const session = makeEnterSession();
    const flow = await renderFlow({
      pathname: "/review",
      state: { yieldFlowSession: session },
    });
    await expect.poll(flow.page).toBe("Review:1");

    await flow.navigate("/steps");
    await expect.poll(flow.page).toBe("Steps:1");
    expect(flow.sessions).toHaveLength(1);
    expect(flow.sessions[0]).toBe(session);

    await flow.navigate("/");
    await expect.poll(flow.location).toBe("/");
    expect(flow.page()).toBeUndefined();

    // Arriving again without a Start finds no Session to resume.
    await flow.navigate("/steps");
    await expect.poll(flow.location).toBe("/");
    expect(flow.page()).toBeUndefined();
    expect(flow.sessions).toEqual([session]);
  });

  it("replaces its Session when a new Start navigates to it while mounted", async () => {
    const first = makeEnterSession();
    const second = makeEnterSession();
    const flow = await renderFlow({
      pathname: "/review",
      state: { yieldFlowSession: first },
    });
    await expect.poll(flow.page).toBe("Review:1");

    await flow.navigate("/review", { yieldFlowSession: second });
    await expect.poll(flow.page).toBe("Review:2");

    await flow.navigate("/steps");
    await expect.poll(flow.page).toBe("Steps:2");
    expect(flow.sessions).toHaveLength(2);
    expect(flow.sessions[0]).toBe(first);
    expect(flow.sessions[1]).toBe(second);
  });
});
