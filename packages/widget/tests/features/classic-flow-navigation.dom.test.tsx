import { RegistryProvider, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Layer, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { HttpResponse, http } from "msw";
import { act } from "react";
import {
  Route,
  RouterProvider,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { ApplicationRouteContentProvider } from "../../src/app/composition/application-route-content";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../src/app/config/settings";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import {
  applicationRouterAtom,
  applicationRouterRuntime,
} from "../../src/app/runtime/application-router-runtime";
import { ActionCommand } from "../../src/domain/schema/action-models";
import {
  classicFlowSessionStore,
  makeStartClassicFlowSession,
} from "../../src/features/classic-transaction-flow/facade";
import type { ClassicTransactionFlowIntake } from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import {
  ClassicFlowExecutionScope,
  ClassicFlowReviewScope,
  EnterClassicFlowRoute,
  useClassicFlowExecution,
  useClassicFlowReview,
  useClassicFlowSession,
} from "../../src/features/classic-transaction-flow/react/classic-flow-route";
import { WalletScopeRoute } from "../../src/features/wallet/react/wallet-scope-route";
import { ApplicationRouter } from "../../src/services/navigation/application-router";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import type { NormalizedWalletState } from "../../src/services/wallet/domain/state";
import { disconnectedNormalizedWalletState } from "../../src/services/wallet/domain/state";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";
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
      <button
        type="button"
        onClick={() => start(makeStartClassicFlowSession(intake))}
      >
        Start
      </button>
      <button
        type="button"
        disabled={!session}
        onClick={() => navigate("/review")}
      >
        Review
      </button>
      <button
        type="button"
        disabled={!session}
        onClick={() => navigate("/steps")}
      >
        Steps
      </button>
    </>
  );
};

const ReviewPage = () => {
  useClassicFlowSession();
  const reviewFacade = useClassicFlowReview();
  const navigate = useNavigate();
  const review = useAtomValue(reviewFacade.reviewViewAtom);
  const confirm = useAtomSet(reviewFacade.confirmAtom);
  const start = useAtomSet(classicFlowSessionStore.startAtom);

  return (
    <>
      <output data-testid="review-session">present</output>
      <output data-testid="review-action">{review.action?.id}</output>
      <output data-testid="review-prices">
        {review.prices ? "ready" : "loading"}
      </output>
      <button
        type="button"
        disabled={!review.action}
        onClick={() => confirm(undefined)}
      >
        Confirm
      </button>
      <button type="button" onClick={() => navigate(1)}>
        Browser Forward
      </button>
      <button
        type="button"
        onClick={() => start(makeStartClassicFlowSession(intake))}
      >
        Replace Session
      </button>
    </>
  );
};

const StepsPage = () => {
  useClassicFlowSession();
  const execution = useClassicFlowExecution();
  const action = useAtomValue(execution.actionAtom);
  const back = useAtomSet(execution.backAtom);
  const navigate = useNavigate();

  return (
    <>
      <output data-testid="steps-session">present</output>
      <output data-testid="steps-action">{action.id}</output>
      <button type="button" onClick={() => back(undefined)}>
        Back
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        Browser Back
      </button>
      <button type="button" onClick={() => navigate("/complete")}>
        Complete
      </button>
      <button type="button" onClick={() => navigate("/review")}>
        Host Review
      </button>
    </>
  );
};

const CompletePage = () => {
  const execution = useClassicFlowExecution();
  const action = useAtomValue(execution.actionAtom);
  const navigate = useNavigate();

  return (
    <>
      <output data-testid="complete-action">{action.id}</output>
      <button type="button" onClick={() => navigate(-1)}>
        Back to Steps
      </button>
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
    session && /^\/(?:review|steps|complete)$/.test(location.pathname)
      ? "flow-session"
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
        <Route element={<EnterClassicFlowRoute />}>
          <Route
            path="review"
            element={
              <ClassicFlowReviewScope>
                <ReviewPage />
              </ClassicFlowReviewScope>
            }
          />
          <Route element={<ClassicFlowExecutionScope />}>
            <Route path="steps" element={<StepsPage />} />
            <Route path="complete" element={<CompletePage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
};

const FlowTestApp = ({
  initialPath = "/",
  walletState = connectedWalletState,
}: {
  readonly initialPath?: string;
  readonly walletState?: NormalizedWalletState;
}) => {
  const settings = normalizeWidgetConfig({
    apiKey: "test-key",
    baseUrl: legacyApiUrl,
    variant: "default",
    yieldsApiUrl: yieldApiUrl,
  });
  return (
    <RegistryProvider
      initialValues={[
        [widgetConfigAtom, settings],
        [
          applicationRouterRuntime.layer,
          ApplicationRouter.layer(applicationRoutes, {
            initialEntries: [initialPath],
          }).pipe(Layer.fresh),
        ],
      ]}
    >
      <FlowRouter walletState={walletState} />
    </RegistryProvider>
  );
};

const FlowRouter = ({
  walletState,
}: {
  readonly walletState: NormalizedWalletState;
}) => {
  const router = useAtomValue(applicationRouterAtom);

  return (
    <ApplicationRouteContentProvider
      value={<FlowRoutes walletState={walletState} />}
    >
      <RouterProvider router={router} />
    </ApplicationRouteContentProvider>
  );
};

describe("Classic Transaction Flow navigation", () => {
  it("redirects routes with missing intake or execution action", async () => {
    const directReview = await render(<FlowTestApp initialPath="/review" />);
    await vi.waitFor(() =>
      expect(directReview.container.textContent).toContain("Start")
    );
    directReview.unmount();

    const directSteps = await render(<FlowTestApp />);
    const button = (label: string) => {
      const match = [
        ...directSteps.container.querySelectorAll<HTMLButtonElement>("button"),
      ].find((candidate) => candidate.textContent === label);
      if (!match) throw new Error(`Expected ${label} button`);
      return match;
    };
    await act(async () => button("Start").click());
    await vi.waitFor(() => expect(button("Steps").disabled).toBe(false));
    await act(async () => button("Steps").click());
    await vi.waitFor(() => expect(button("Review").disabled).toBe(true));
  });

  it("remounts the Flow Session boundary for a replacement snapshot", async ({
    worker,
  }) => {
    let actionPreviewCalls = 0;
    worker.use(
      http.post(`${legacyApiUrl}/v1/tokens/prices`, () =>
        HttpResponse.json({
          "ethereum-": { price: 1, price_24_h: 0 },
        })
      ),
      http.post(`${yieldApiUrl}/v1/actions/enter`, () => {
        actionPreviewCalls += 1;
        return HttpResponse.json(
          yieldApiActionFixture({ id: `action-${actionPreviewCalls}` })
        );
      })
    );

    const app = await render(<FlowTestApp />);
    const getButton = (label: string) => {
      const button = [
        ...app.container.querySelectorAll<HTMLButtonElement>("button"),
      ].find((candidate) => candidate.textContent === label);
      if (!button) throw new Error(`Expected ${label} button`);
      return button;
    };

    await act(async () => getButton("Start").click());
    await vi.waitFor(() => expect(getButton("Review").disabled).toBe(false));
    await act(async () => getButton("Review").click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="review-action"]')
          ?.textContent
      ).toBe("action-1")
    );

    await act(async () => getButton("Replace Session").click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="review-action"]')
          ?.textContent
      ).toBe("action-2")
    );

    await act(async () => getButton("Confirm").click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="steps-session"]')
      ).not.toBeNull()
    );
    expect(actionPreviewCalls).toBe(2);
  });

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

    const sessionMarker = app.container.querySelector(
      '[data-testid="review-session"]'
    )?.textContent;
    await act(async () => buttons()[0]?.click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="steps-session"]')
          ?.textContent
      ).toBe(sessionMarker)
    );

    await act(async () => buttons()[0]?.click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="review-session"]')
          ?.textContent
      ).toBe(sessionMarker)
    );

    expect(priceCalls).toBe(1);
    await vi.waitFor(() => expect(actionPreviewCalls).toBe(2));
    await vi.waitFor(() => expect(buttons()[0]?.disabled).toBe(false));

    await act(async () => buttons()[0]?.click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="steps-session"]')
          ?.textContent
      ).toBe(sessionMarker)
    );

    await act(async () => buttons()[3]?.click());
    await vi.waitFor(() => expect(actionPreviewCalls).toBe(3));
    expect(
      app.container.querySelector('[data-testid="review-session"]')?.textContent
    ).toBe(sessionMarker);

    await act(async () => buttons()[0]?.click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="steps-session"]')
          ?.textContent
      ).toBe(sessionMarker)
    );
    await act(async () => buttons()[1]?.click());
    await vi.waitFor(() => expect(actionPreviewCalls).toBe(4));
    expect(
      app.container.querySelector('[data-testid="review-session"]')?.textContent
    ).toBe(sessionMarker);

    await act(async () => buttons()[1]?.click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="review-session"]')
      ).toBeNull()
    );
    expect(
      app.container.querySelector('[data-testid="steps-session"]')
    ).toBeNull();
  });

  it("keeps one Execution scope across Steps and Complete", async ({
    worker,
  }) => {
    worker.use(
      http.post(`${legacyApiUrl}/v1/tokens/prices`, () =>
        HttpResponse.json({
          "ethereum-": { price: 1, price_24_h: 0 },
        })
      ),
      http.post(`${yieldApiUrl}/v1/actions/enter`, () =>
        HttpResponse.json(yieldApiActionFixture({ id: "execution-action" }))
      )
    );
    const app = await render(<FlowTestApp />);
    const button = (label: string) => {
      const match = [
        ...app.container.querySelectorAll<HTMLButtonElement>("button"),
      ].find((candidate) => candidate.textContent === label);
      if (!match) throw new Error(`Expected ${label} button`);
      return match;
    };

    await act(async () => button("Start").click());
    await vi.waitFor(() => expect(button("Review").disabled).toBe(false));
    await act(async () => button("Review").click());
    await vi.waitFor(() => expect(button("Confirm").disabled).toBe(false));
    await act(async () => button("Confirm").click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="steps-action"]')?.textContent
      ).toBe("execution-action")
    );

    await act(async () => button("Complete").click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="complete-action"]')
          ?.textContent
      ).toBe("execution-action")
    );
    await act(async () => button("Back to Steps").click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="steps-action"]')?.textContent
      ).toBe("execution-action")
    );
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
