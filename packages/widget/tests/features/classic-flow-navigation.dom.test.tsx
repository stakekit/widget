import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { HttpResponse, http } from "msw";
import { act } from "react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { normalizeWidgetConfig } from "../../src/app/config/settings";
import { ActionCommand } from "../../src/domain/schema/action-models";
import type { ClassicTransactionFlowIntake } from "../../src/features/transaction-flow/model/classic-transaction-flow";
import {
  ClassicFlowReviewNavigation,
  ClassicFlowStepsNavigation,
} from "../../src/features/transaction-flow/react/classic-flow-navigation";
import { useClassicFlowSessionFacade } from "../../src/features/transaction-flow/react/classic-flow-session-context";
import { EnterClassicFlowRouteGuard } from "../../src/features/transaction-flow/react/request-route-guards";
import { classicFlowSessionStore } from "../../src/features/transaction-flow/state/classic-flow-session-store";
import { WalletScopeRoute } from "../../src/features/wallet/react/wallet-scope-route";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import type { NormalizedWalletState } from "../../src/services/wallet/domain/state";
import { disconnectedNormalizedWalletState } from "../../src/services/wallet/domain/state";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";
import { TestAtomRuntimeProvider } from "../utils/atom-runtime-provider";
import { describe, expect, it, vi } from "../utils/test-extend.dom";
import { render } from "../utils/test-utils.dom";

const yieldApiUrl = "https://yield.example.com";
const legacyApiUrl = "https://api.example.com";
const command = Schema.decodeUnknownSync(ActionCommand)({
  address: "0xWallet",
  yieldId: "ethereum-eth-native-staking",
});
const selectedStake = yieldApiYieldFixture({ id: command.yieldId });
const walletScope = new WalletScopeKey({
  address: command.address,
  network: "ethereum",
});
const connectedWalletState: NormalizedWalletState = {
  additionalAddresses: null,
  address: command.address,
  chain: {} as never,
  connector: {} as never,
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum",
  status: "connected",
};

const intake: ClassicTransactionFlowIntake = {
  _tag: "Enter",
  gasFeeToken: selectedStake.mechanics.gasFeeToken,
  providersDetails: [],
  request: command,
  selectedStake,
  selectedToken: selectedStake.token,
  selectedValidators: new Map(),
  walletScope,
};

const StartPage = () => {
  const session = useAtomValue(classicFlowSessionStore.currentSessionAtom);
  const start = useAtomSet(classicFlowSessionStore.startAtom);
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => start(intake)}>
        Start
      </button>
      <button
        type="button"
        disabled={!session}
        onClick={() => navigate("/review")}
      >
        Review
      </button>
    </>
  );
};

const ReviewPage = () => {
  const facade = useClassicFlowSessionFacade();
  useAtomMount(facade.reviewRouteAtom);
  const review = useAtomValue(facade.reviewViewAtom);
  const preview = useAtomValue(facade.actionPreviewAtom);
  const confirm = useAtomSet(facade.confirmAtom);

  return (
    <>
      <output data-testid="review-session">{facade.session.key}</output>
      <output data-testid="review-prices">
        {review.prices ? "ready" : "loading"}
      </output>
      <button
        type="button"
        disabled={!AsyncResult.isSuccess(preview)}
        onClick={() => confirm(undefined)}
      >
        Confirm
      </button>
      <ClassicFlowStepsNavigation to="/steps" />
    </>
  );
};

const StepsPage = () => {
  const facade = useClassicFlowSessionFacade();
  useAtomMount(facade.stepsRouteAtom);
  const back = useAtomSet(facade.backAtom);
  const navigate = useNavigate();

  return (
    <>
      <output data-testid="steps-session">{facade.session.key}</output>
      <button type="button" onClick={() => back(undefined)}>
        Back
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        Browser Back
      </button>
      <ClassicFlowReviewNavigation to="/review" />
    </>
  );
};

const FlowRoutes = ({
  walletState,
}: {
  readonly walletState: NormalizedWalletState;
}) => {
  const location = useLocation();
  const session = useAtomValue(classicFlowSessionStore.currentSessionAtom);
  const key =
    session && /^\/(?:review|steps)$/.test(location.pathname)
      ? `flow-session-${session.key}`
      : location.key;

  return (
    <Routes key={key}>
      <Route path="/" element={<StartPage />} />
      <Route
        element={
          <WalletScopeRoute
            fallbackPath="/"
            walletStateResult={AsyncResult.success(walletState)}
          />
        }
      >
        <Route element={<EnterClassicFlowRouteGuard />}>
          <Route path="review" element={<ReviewPage />} />
          <Route path="steps" element={<StepsPage />} />
        </Route>
      </Route>
    </Routes>
  );
};

const FlowTestApp = ({
  walletState = connectedWalletState,
}: {
  readonly walletState?: NormalizedWalletState;
}) => (
  <TestAtomRuntimeProvider
    settings={normalizeWidgetConfig({
      apiKey: "test-key",
      baseUrl: legacyApiUrl,
      variant: "default",
      yieldsApiUrl: yieldApiUrl,
    })}
  >
    <MemoryRouter initialEntries={["/"]}>
      <FlowRoutes walletState={walletState} />
    </MemoryRouter>
  </TestAtomRuntimeProvider>
);

describe("Classic Transaction Flow navigation", () => {
  it("keeps the session and prepares a fresh action after Back", async ({
    worker,
  }) => {
    let actionPreviewCalls = 0;
    let priceCalls = 0;
    worker.use(
      http.post(`${legacyApiUrl}/v1/tokens/prices`, () => {
        priceCalls += 1;
        return HttpResponse.json({
          "ethereum-": { price: 1, price_24_h: 0 },
        });
      }),
      http.post(`${yieldApiUrl}/v1/actions/enter`, () => {
        actionPreviewCalls += 1;
        return HttpResponse.json(
          yieldApiActionFixture({ id: `action-${actionPreviewCalls}` })
        );
      })
    );

    const app = await render(<FlowTestApp />);

    const buttons = () => [
      ...app.container.querySelectorAll<HTMLButtonElement>("button"),
    ];
    await act(async () => buttons()[0]?.click());
    await vi.waitFor(() => expect(buttons()[1]?.disabled).toBe(false));
    await act(async () => buttons()[1]?.click());
    await vi.waitFor(() => expect(buttons()[0]?.disabled).toBe(false));
    expect(actionPreviewCalls).toBe(1);
    await vi.waitFor(() => expect(priceCalls).toBe(1));

    const sessionKey = app.container.querySelector(
      '[data-testid="review-session"]'
    )?.textContent;
    await act(async () => buttons()[0]?.click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="steps-session"]')
          ?.textContent
      ).toBe(sessionKey)
    );

    await act(async () => buttons()[0]?.click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="review-session"]')
          ?.textContent
      ).toBe(sessionKey)
    );

    expect(priceCalls).toBe(1);
    await vi.waitFor(() => expect(actionPreviewCalls).toBe(2));
    await vi.waitFor(() => expect(buttons()[0]?.disabled).toBe(false));

    await act(async () => buttons()[0]?.click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="steps-session"]')
          ?.textContent
      ).toBe(sessionKey)
    );
    await act(async () => buttons()[1]?.click());
    await vi.waitFor(() => expect(actionPreviewCalls).toBe(3));
    expect(
      app.container.querySelector('[data-testid="review-session"]')?.textContent
    ).toBe(sessionKey);
  });

  it("ejects and disposes the session when the wallet disconnects", async ({
    worker,
  }) => {
    worker.use(
      http.post(`${yieldApiUrl}/v1/actions/enter`, () =>
        HttpResponse.json(yieldApiActionFixture())
      )
    );
    const app = await render(<FlowTestApp />);
    const buttons = () => [
      ...app.container.querySelectorAll<HTMLButtonElement>("button"),
    ];

    await act(async () => buttons()[0]?.click());
    await vi.waitFor(() => expect(buttons()[1]?.disabled).toBe(false));
    await act(async () => buttons()[1]?.click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="review-session"]')
      ).not.toBeNull()
    );

    await app.rerender(
      <FlowTestApp walletState={disconnectedNormalizedWalletState} />
    );
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="review-session"]')
      ).toBeNull()
    );
    await vi.waitFor(() => expect(buttons()[1]?.disabled).toBe(true));
  });
});
