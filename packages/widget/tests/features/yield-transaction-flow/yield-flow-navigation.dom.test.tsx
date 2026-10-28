import { RegistryProvider, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect, Layer, Schema, Stream, SubscriptionRef } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { HttpResponse, http } from "msw";
import { act, StrictMode, useEffect, useState } from "react";
import {
  createMemoryRouter,
  type DataRouter,
  type NavigateFunction,
  Route,
  RouterProvider,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { ApplicationRouteContentProvider } from "../../../src/app/composition/application-route-content";
import { applicationRoutes } from "../../../src/app/routes/application-routes";
import { applicationBaseRuntime } from "../../../src/app/runtime/application-base-runtime";
import { walletRuntime } from "../../../src/app/runtime/wallet-runtime";
import { ActionCommand } from "../../../src/domain/action/models";
import { TransactionWorkflowId } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { walletScopeAtom } from "../../../src/features/wallet/index";
import { WalletScopeRoute } from "../../../src/features/wallet/react/wallet-scope-route";
import {
  getYieldFlowRouteGroup,
  startYieldTransactionFlowAtom,
} from "../../../src/features/yield-transaction-flow/index";
import type { YieldTransactionFlowIntake } from "../../../src/features/yield-transaction-flow/model/yield-transaction-flow";
import {
  useYieldFlowExecution,
  useYieldFlowReview,
  useYieldFlowSession,
  YieldFlowExecutionPage,
  YieldFlowExecutionRoute,
  YieldFlowRoute,
} from "../../../src/features/yield-transaction-flow/react/yield-flow-route";
import { WidgetConfigService } from "../../../src/services/config/widget-config";
import { ApplicationRouter } from "../../../src/services/navigation/application-router";
import { makeWidgetNavigation } from "../../../src/services/navigation/widget-navigation";
import {
  widgetRoutes,
  widgetTargetPath,
  widgetTargetState,
} from "../../../src/services/navigation/widget-routes";
import { initializeTransactionWorkflow } from "../../../src/services/transaction-workflow/internal/model";
import {
  makeTransactionSignError,
  type TransactionWorkflowState,
} from "../../../src/services/transaction-workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../../src/services/transaction-workflow/transaction-workflow-service";
import { WalletService } from "../../../src/services/wallet/wallet-service";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
  type WalletState,
} from "../../../src/services/wallet/wallet-state";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../../fixtures";
import { makeConnectedWalletState } from "../../fixtures/wallet-state";
import type { server } from "../../mocks/server";
import { makeTestTracking } from "../../utils/services/tracking-service";
import { makeTestWallet } from "../../utils/services/wallet-service";
import { makeTestNavigation } from "../../utils/services/widget-navigation";
import { makeTestZamaLayer } from "../../utils/services/zama-service";
import { makeTestStakeKitApiLayer } from "../../utils/stakekit-api-layer";
import { describe, expect, it, vi } from "../../utils/test-extend.dom.ts";
import { render } from "../../utils/test-utils.dom.tsx";

const yieldApiUrl = "https://yield.example.com";
const legacyApiUrl = "https://api.example.com";
const command = Schema.decodeSync(ActionCommand)({
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
// Each Execution's workflow state, in start order; tests drive the latest.
const workflows: Array<
  SubscriptionRef.SubscriptionRef<TransactionWorkflowState>
> = [];
// How many of those workflows their Execution has ended.
const ended = { workflows: 0 };
const setWorkflowState = (
  next: (state: TransactionWorkflowState) => TransactionWorkflowState
) => {
  const state = workflows.at(-1);
  if (!state) throw new Error("Expected a running Execution workflow");
  return act(async () => {
    // ast-grep-ignore: no-run-effect-in-test -- React act is a Promise-based boundary; keep Effect-driven React updates inside it.
    await Effect.runPromise(SubscriptionRef.update(state, next));
  });
};
const disconnectTestWalletAtom = walletRuntime
  .fn(() => WalletService.use((wallet) => wallet.logout))
  .pipe(Atom.withLabel("disconnectTestWalletAtom"));
const walletLayer = Layer.merge(
  Layer.unwrap(
    Effect.gen(function* () {
      const state = yield* SubscriptionRef.make<WalletState>(
        makeConnectedWalletState(walletScope)
      );
      const wallet = yield* makeTestWallet({
        logout: SubscriptionRef.set(state, {
          connection: disconnectedNormalizedWalletState,
          ledger: disconnectedLedgerConnectorState,
        }),
        state,
      });
      return wallet.layer;
    })
  ),
  Layer.succeed(
    TransactionWorkflowService,
    TransactionWorkflowService.of({
      leaveGuarded: Stream.make(false),
      make: (input) =>
        SubscriptionRef.make(initializeTransactionWorkflow(input)).pipe(
          Effect.tap(() =>
            Effect.addFinalizer(() =>
              Effect.sync(() => {
                ended.workflows += 1;
              })
            )
          ),
          Effect.map((state) => {
            workflows.push(state);
            return {
              dispatch: () => Effect.void,
              states: SubscriptionRef.changes(state),
            };
          })
        ),
    })
  )
);
const apiLayer = makeTestStakeKitApiLayer({
  apiKey: "test-key",
  baseUrl: legacyApiUrl,
  borrowApiUrl: "https://borrow.example.com",
  yieldsApiUrl: yieldApiUrl,
});
const trackingLayer = Layer.unwrap(
  makeTestTracking().pipe(Effect.map((tracking) => tracking.layer))
);

const intake: YieldTransactionFlowIntake = {
  _tag: "Enter",
  gasFeeToken: selectedStake.mechanics.gasFeeToken,
  providersDetails: [],
  request: command,
  selectedProviderOption: null,
  selectedStake,
  selectedToken: selectedStake.token,
  selectedValidators: new Map(),
  walletScope,
};

type TestNavigationChannel = {
  navigate: NavigateFunction | null;
};
const testNavigationChannel: TestNavigationChannel = { navigate: null };

const TestNavigationBridge = ({
  channel,
}: {
  readonly channel: TestNavigationChannel;
}) => {
  const navigate = useNavigate();
  useEffect(() => {
    // biome-ignore lint/nursery/useReactCompiler: Test bridge intentionally publishes navigation outside React.
    channel.navigate = navigate;
    return () => {
      channel.navigate = null;
    };
  }, [channel, navigate]);
  return null;
};

const StartPage = () => {
  const start = useAtomSet(startYieldTransactionFlowAtom);
  const navigate = useNavigate();

  return (
    <>
      <button
        type="button"
        onClick={() => start({ intake, mount: { _tag: "Earn" } })}
      >
        Start
      </button>
      <button type="button" onClick={() => navigate("/review")}>
        Review
      </button>
      <button type="button" onClick={() => navigate("/steps")}>
        Steps
      </button>
    </>
  );
};

const ReviewPage = () => {
  useYieldFlowSession();
  const reviewFacade = useYieldFlowReview();
  const navigate = useNavigate();
  const review = useAtomValue(reviewFacade.reviewViewAtom);
  const confirm = useAtomSet(reviewFacade.confirmAtom);
  const start = useAtomSet(startYieldTransactionFlowAtom);

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
      <button type="button" onClick={() => navigate("/steps")}>
        Host Steps
      </button>
      <button
        type="button"
        onClick={() => start({ intake, mount: { _tag: "Earn" } })}
      >
        Replace Session
      </button>
    </>
  );
};

const StepsPage = () => {
  useYieldFlowSession();
  const execution = useYieldFlowExecution();
  const back = useAtomSet(execution.backAtom);
  const navigate = useNavigate();
  // Moving within this Execution keeps its navigation state.
  const { state } = useLocation();

  return (
    <>
      <output data-testid="steps-session">present</output>
      <output data-testid="steps-execution">{workflows.length}</output>
      <button type="button" onClick={() => back(undefined)}>
        Back
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        Browser Back
      </button>
      <button type="button" onClick={() => navigate("/complete", { state })}>
        Complete
      </button>
      <button type="button" onClick={() => navigate("/review")}>
        Host Review
      </button>
    </>
  );
};

const CompletePage = () => {
  useYieldFlowExecution();
  const navigate = useNavigate();

  return (
    <>
      <output data-testid="complete-execution">{workflows.length}</output>
      <button type="button" onClick={() => navigate(-1)}>
        History Back
      </button>
      <button type="button" onClick={() => navigate("/steps")}>
        Host Steps
      </button>
    </>
  );
};

const FlowRoutes = ({
  navigationChannel,
  walletState,
}: {
  readonly navigationChannel: TestNavigationChannel;
  readonly walletState: NormalizedWalletState;
}) => {
  const location = useLocation();
  // Mirrors the Compact layout: one flow mount's routes share a key, so the
  // flow subtree (which owns its Session) stays mounted across them.
  const group = getYieldFlowRouteGroup(location.pathname);
  const key = group === null ? location.key : `flow:${group}`;

  return (
    <>
      <TestNavigationBridge channel={navigationChannel} />
      <Routes key={key}>
        <Route path="/" element={<StartPage />} />
        <Route
          element={
            <WalletScopeRoute
              fallbackPath={widgetRoutes.earn.build()}
              walletState={walletState}
            />
          }
        >
          <Route element={<YieldFlowRoute expected="Enter" mount="Earn" />}>
            <Route path="review" element={<ReviewPage />} />
            <Route element={<YieldFlowExecutionRoute />}>
              <Route
                path="steps"
                element={
                  <YieldFlowExecutionPage page="Steps">
                    <StepsPage />
                  </YieldFlowExecutionPage>
                }
              />
              <Route
                path="complete"
                element={
                  <YieldFlowExecutionPage page="Complete">
                    <CompletePage />
                  </YieldFlowExecutionPage>
                }
              />
            </Route>
          </Route>
        </Route>
      </Routes>
    </>
  );
};

const FlowTestApp = ({
  initialPath = "/",
  walletState = connectedWalletState,
}: {
  readonly initialPath?: string;
  readonly walletState?: NormalizedWalletState;
}) => {
  const hostConfiguration = {
    apiKey: "test-key",
    baseUrl: legacyApiUrl,
    variant: "default" as const,
    yieldsApiUrl: yieldApiUrl,
  };
  const [router] = useState(() =>
    createMemoryRouter([...applicationRoutes], {
      initialEntries: [initialPath],
    })
  );
  const applicationRouterLayer = Layer.merge(
    Layer.succeed(
      ApplicationRouter,
      ApplicationRouter.of({ locations: Stream.never, router })
    ),
    WidgetConfigService.layer(hostConfiguration)
  );
  const navigation = makeWidgetNavigation({
    back: () =>
      Effect.sync(() => {
        testNavigationChannel.navigate?.(-1);
      }),
    push: (to) =>
      Effect.sync(() => {
        if (!testNavigationChannel.navigate) {
          throw new Error("Test navigation bridge is unavailable");
        }
        testNavigationChannel.navigate(widgetTargetPath(to), {
          state: widgetTargetState(to),
        });
      }),
    replace: (to) =>
      Effect.sync(() => {
        testNavigationChannel.navigate?.(widgetTargetPath(to), {
          replace: true,
          state: widgetTargetState(to),
        });
      }),
  });
  const navigationLayer = Layer.unwrap(
    makeTestNavigation({ execute: navigation.execute }).pipe(
      Effect.map((testNavigation) => testNavigation.layer)
    )
  );
  const yieldWalletLayer = Layer.mergeAll(
    apiLayer,
    navigationLayer,
    trackingLayer,
    walletLayer,
    makeTestZamaLayer()
  );
  // Production renders the widget in StrictMode; Execution must still take
  // its confirmed action exactly once.
  return (
    <StrictMode>
      <RegistryProvider
        initialValues={[
          [walletScopeAtom, walletScope],
          [walletRuntime.layer, yieldWalletLayer as never],
          [applicationBaseRuntime.layer, applicationRouterLayer],
        ]}
      >
        <WalletStateBridge />
        <FlowRouter
          navigationChannel={testNavigationChannel}
          router={router}
          walletState={walletState}
        />
      </RegistryProvider>
    </StrictMode>
  );
};

const WalletStateBridge = () => {
  const disconnectWallet = useAtomSet(disconnectTestWalletAtom);
  return (
    <form
      data-testid="apply-wallet-state"
      hidden
      onSubmit={(event) => {
        event.preventDefault();
        disconnectWallet();
      }}
    />
  );
};

const FlowRouter = ({
  navigationChannel,
  router,
  walletState,
}: {
  readonly navigationChannel: TestNavigationChannel;
  readonly router: DataRouter;
  readonly walletState: NormalizedWalletState;
}) => {
  return (
    <ApplicationRouteContentProvider
      value={
        <FlowRoutes
          navigationChannel={navigationChannel}
          walletState={walletState}
        />
      }
    >
      <RouterProvider router={router} />
    </ApplicationRouteContentProvider>
  );
};

describe("Yield Transaction Flow navigation", () => {
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
    await act(async () => button("Steps").click());
    await vi.waitFor(() => expect(button("Start")).toBeDefined());
    await act(async () => button("Start").click());
    await vi.waitFor(() => expect(button("Host Steps")).toBeDefined());
    await act(async () => button("Host Steps").click());
    await vi.waitFor(() =>
      expect(directSteps.container.textContent).toContain("Start")
    );
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

  const renderExecution = async (worker: Pick<typeof server, "use">) => {
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
    const output = (testId: string) =>
      app.container.querySelector(`[data-testid="${testId}"]`)?.textContent;

    await act(async () => button("Start").click());
    await vi.waitFor(() => expect(button("Confirm").disabled).toBe(false));
    await act(async () => button("Confirm").click());
    await vi.waitFor(() => expect(output("steps-execution")).toBeTruthy());

    return { button, executionId: output("steps-execution"), output };
  };

  it("shows Complete only once the Execution's workflow finishes", async ({
    worker,
  }) => {
    const { button, executionId, output } = await renderExecution(worker);
    const endedBefore = ended.workflows;

    await act(async () => button("Complete").click());
    await vi.waitFor(() => expect(output("steps-execution")).toBe(executionId));
    expect(output("complete-execution")).toBeUndefined();

    await setWorkflowState((state) => ({
      _tag: "SignFailed",
      context: state.context,
      error: makeTransactionSignError({
        batchId: "yield",
        network: "ethereum",
        reason: { _tag: "WalletUnavailable", detail: "disconnected" },
        transactionId: null,
        workflowId: TransactionWorkflowId.make("yield-workflow"),
      }),
    }));
    await act(async () => button("Complete").click());
    await vi.waitFor(() => expect(output("steps-execution")).toBe(executionId));
    expect(output("complete-execution")).toBeUndefined();

    await setWorkflowState((state) => ({
      _tag: "Completed",
      context: state.context,
    }));
    await vi.waitFor(() =>
      expect(output("complete-execution")).toBe(executionId)
    );
    // Steps of a finished Execution belongs to Complete.
    await act(async () => button("History Back").click());
    await vi.waitFor(() =>
      expect(output("complete-execution")).toBe(executionId)
    );
    expect(output("steps-execution")).toBeUndefined();
    // Steps and Complete share one Execution.
    expect(ended.workflows).toBe(endedBefore);

    // Without its Execution's action id, Steps leaves the flow.
    await act(async () => button("Host Steps").click());
    await vi.waitFor(() => expect(button("Start")).toBeDefined());
    expect(output("complete-execution")).toBeUndefined();
    expect(output("steps-execution")).toBeUndefined();
  });

  it("ends the Execution's workflow when the user leaves Steps", async ({
    worker,
  }) => {
    const { button, output } = await renderExecution(worker);
    const started = workflows.length;
    const endedBefore = ended.workflows;

    await act(async () => button("Browser Back").click());
    await vi.waitFor(() => expect(ended.workflows).toBe(endedBefore + 1));
    expect(output("review-session")).toBe("present");
    expect(output("steps-execution")).toBeUndefined();
    expect(workflows.length).toBe(started);
  });

  it("admits Complete once every transaction was skipped", async ({
    worker,
  }) => {
    const { executionId, output } = await renderExecution(worker);

    await setWorkflowState((state) => ({
      _tag: "Disabled",
      context: state.context,
    }));
    await vi.waitFor(() =>
      expect(output("complete-execution")).toBe(executionId)
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
    await act(async () => {
      app.container
        .querySelector<HTMLFormElement>('[data-testid="apply-wallet-state"]')
        ?.requestSubmit();
    });
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="review-session"]')
      ).toBeNull()
    );
    await vi.waitFor(() => expect(buttons()[0]?.textContent).toBe("Start"));
    await act(async () => buttons()[1]?.click());
    await vi.waitFor(() => expect(buttons()[0]?.textContent).toBe("Start"));
    expect(
      app.container.querySelector('[data-testid="review-session"]')
    ).toBeNull();
  });
});
