import { RegistryProvider, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect, Layer, Schema, Stream, SubscriptionRef } from "effect";
import { HttpResponse, http } from "msw";
import { act, useEffect, useState } from "react";
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
import { ApplicationRouteContentProvider } from "../../src/app/composition/application-route-content";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import { applicationBaseRuntime } from "../../src/app/runtime/application-base-runtime";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { ActionCommand } from "../../src/domain/action/models";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  isActiveClassicTransactionFlowPathAtom,
  startClassicTransactionFlowAtom,
} from "../../src/features/classic-transaction-flow/index";
import type { ClassicTransactionFlowIntake } from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import {
  ClassicFlowExecutionScope,
  ClassicFlowReviewScope,
  ClassicFlowRoute,
  useClassicFlowExecution,
  useClassicFlowReview,
  useClassicFlowSession,
} from "../../src/features/classic-transaction-flow/react/classic-flow-route";
import { ClassicTransactionFlowService } from "../../src/features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import { walletScopeAtom } from "../../src/features/wallet/index";
import { WalletScopeRoute } from "../../src/features/wallet/react/wallet-scope-route";
import { WidgetConfigService } from "../../src/services/config/widget-config";
import { ApplicationRouter } from "../../src/services/navigation/application-router";
import {
  makeWidgetNavigation,
  WidgetNavigation,
} from "../../src/services/navigation/widget-navigation";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import { TransactionWorkflowService } from "../../src/services/transaction-workflow/transaction-workflow-service";
import { WalletService } from "../../src/services/wallet/wallet-service";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
  type WalletState,
} from "../../src/services/wallet/wallet-state";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";
import { makeTestStakeKitApiLayer } from "../utils/stakekit-api-layer";
import { describe, expect, it, vi } from "../utils/test-extend.dom.ts";
import { render } from "../utils/test-utils.dom.tsx";

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
// ast-grep-ignore: no-run-effect-in-test -- module fixture setup requires the synchronous ref value
const walletStateRef = Effect.runSync(
  SubscriptionRef.make<WalletState>({
    connection: connectedWalletState,
    ledger: disconnectedLedgerConnectorState,
  })
);
const walletLayer = Layer.mergeAll(
  Layer.succeed(
    WalletService,
    WalletService.of({
      state: SubscriptionRef.get(walletStateRef),
      states: SubscriptionRef.changes(walletStateRef),
      wagmiConfig: {},
    } as never)
  ),
  Layer.succeed(
    TransactionWorkflowService,
    TransactionWorkflowService.of({
      make: () =>
        Effect.succeed({
          dispatch: () => Effect.void,
          states: Stream.never,
        }),
    })
  )
);
const apiLayer = makeTestStakeKitApiLayer({
  apiKey: "test-key",
  baseUrl: legacyApiUrl,
  borrowApiUrl: "https://borrow.example.com",
  yieldsApiUrl: yieldApiUrl,
});
const trackingLayer = Layer.succeed(
  TrackingService,
  TrackingService.of({
    trackEvent: () => Effect.void,
    trackPageView: () => Effect.void,
  })
);

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

const executionFacades: Array<object> = [];
const getExecutionFacadeId = (facade: object) => {
  const existing = executionFacades.indexOf(facade);
  if (existing >= 0) return existing + 1;
  executionFacades.push(facade);
  return executionFacades.length;
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
  const isActive = useAtomValue(
    isActiveClassicTransactionFlowPathAtom("/review")
  );
  const start = useAtomSet(startClassicTransactionFlowAtom);
  const navigate = useNavigate();

  return (
    <>
      <button
        type="button"
        onClick={() => start({ intake, mount: { _tag: "Earn" } })}
      >
        Start
      </button>
      <button
        type="button"
        disabled={!isActive}
        onClick={() => navigate("/review")}
      >
        Review
      </button>
      <button
        type="button"
        disabled={!isActive}
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
  const start = useAtomSet(startClassicTransactionFlowAtom);

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
  useClassicFlowSession();
  const execution = useClassicFlowExecution();
  const back = useAtomSet(execution.backAtom);
  const navigate = useNavigate();

  return (
    <>
      <output data-testid="steps-session">present</output>
      <output data-testid="steps-execution">
        {getExecutionFacadeId(execution)}
      </output>
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
  const navigate = useNavigate();

  return (
    <>
      <output data-testid="complete-execution">
        {getExecutionFacadeId(execution)}
      </output>
      <button type="button" onClick={() => navigate(-1)}>
        Back to Steps
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
  const isActive = useAtomValue(
    isActiveClassicTransactionFlowPathAtom(location.pathname)
  );
  const key = isActive ? "flow-session" : location.key;

  return (
    <>
      <TestNavigationBridge channel={navigationChannel} />
      <Routes key={key}>
        <Route path="/" element={<StartPage />} />
        <Route
          element={
            <WalletScopeRoute fallbackPath="/" walletState={walletState} />
          }
        >
          <Route element={<ClassicFlowRoute expected="Enter" />}>
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
      ApplicationRouter.of({ pathnames: Stream.never, router })
    ),
    WidgetConfigService.layer(hostConfiguration)
  );
  const navigationLayer = Layer.succeed(
    WidgetNavigation,
    makeWidgetNavigation({
      back: () =>
        Effect.sync(() => {
          testNavigationChannel.navigate?.(-1);
        }),
      push: (path, options) =>
        Effect.sync(() => {
          if (!testNavigationChannel.navigate) {
            throw new Error("Test navigation bridge is unavailable");
          }
          testNavigationChannel.navigate(path, { state: options?.state });
        }),
      replace: (path, options) =>
        Effect.sync(() => {
          testNavigationChannel.navigate?.(path, {
            replace: true,
            state: options?.state,
          });
        }),
    })
  );
  const classicDependencies = Layer.mergeAll(
    apiLayer,
    navigationLayer,
    trackingLayer,
    walletLayer
  );
  const classicWalletLayer = Layer.merge(
    classicDependencies,
    ClassicTransactionFlowService.layer.pipe(Layer.provide(classicDependencies))
  );
  return (
    <RegistryProvider
      initialValues={[
        [walletScopeAtom, walletScope],
        [walletRuntime.layer, classicWalletLayer as never],
        [applicationBaseRuntime.layer, applicationRouterLayer],
      ]}
    >
      <WalletStateBridge walletState={walletState} />
      <FlowRouter
        navigationChannel={testNavigationChannel}
        router={router}
        walletState={walletState}
      />
    </RegistryProvider>
  );
};

const WalletStateBridge = ({
  walletState,
}: {
  readonly walletState: NormalizedWalletState;
}) => {
  useEffect(() => {
    // ast-grep-ignore: no-run-effect-in-test -- React effects are synchronous non-Effect boundaries
    Effect.runSync(
      SubscriptionRef.set(walletStateRef, {
        connection: walletState,
        ledger: disconnectedLedgerConnectorState,
      })
    );
  }, [walletState]);
  return null;
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
    await vi.waitFor(() => expect(button("Confirm").disabled).toBe(false));
    await act(async () => button("Confirm").click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="steps-execution"]')
          ?.textContent
      ).not.toBe("")
    );
    const executionId = app.container.querySelector(
      '[data-testid="steps-execution"]'
    )?.textContent;

    await act(async () => button("Complete").click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="complete-execution"]')
          ?.textContent
      ).toBe(executionId)
    );
    await act(async () => button("Back to Steps").click());
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="steps-execution"]')
          ?.textContent
      ).toBe(executionId)
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
