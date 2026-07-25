import { RegistryProvider, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Deferred, Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { ReactNode } from "react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { base } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { Connector } from "wagmi";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { Action as BorrowAction } from "../../src/domain/borrow/action";
import { ActionRequest } from "../../src/domain/borrow/action-request";
import type {
  Transaction as BorrowTransaction,
  SubmitTransactionCommand,
} from "../../src/domain/borrow/transaction";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  BorrowTransactionFlowCompletionGuard,
  BorrowTransactionFlowExecutionScope,
  BorrowTransactionFlowReviewRoute,
  BorrowTransactionFlowRoute,
  useBorrowTransactionFlow,
  useBorrowTransactionFlowExecution,
} from "../../src/features/borrow-transaction-flow/react/borrow-flow-route";
import type { BorrowTransactionFlowReview } from "../../src/features/borrow-transaction-flow/state";
import type { BorrowFlowSession } from "../../src/features/borrow-transaction-flow/state/borrow-flow-session-store";
import { borrowFlowSessionStore } from "../../src/features/borrow-transaction-flow/state/borrow-flow-session-store";
import { BorrowStepsPage } from "../../src/features/borrow-transaction-flow/ui/steps";
import { useBorrowExecution } from "../../src/features/borrow-transaction-flow/ui/use-borrow-execution";
import { WalletScopeRoute } from "../../src/features/wallet/ui";
import { BorrowOperations } from "../../src/services/api/borrow-operations";
import { WidgetNavigation } from "../../src/services/navigation/widget-navigation";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import {
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
} from "../../src/services/wallet/domain/state";
import { WalletService } from "../../src/services/wallet/wallet-service";
import { TransactionWorkflowOperationsService } from "../../src/services/workflow/transaction-workflow-operations-service";
import { TransactionWorkflowService } from "../../src/services/workflow/transaction-workflow-service";
import { render } from "../utils/test-utils";
import type { WalletOperations } from "../utils/wallet-operations";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const transactionHash =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const walletScope = new WalletScopeKey({ address, network: "base" });

type ActionDto = typeof BorrowAction.Encoded;
type TransactionDto = typeof BorrowTransaction.Encoded;
type SubmitTransactionDto = typeof SubmitTransactionCommand.Encoded;

const request = Schema.decodeUnknownSync(ActionRequest)({
  action: "borrow",
  address,
  args: {
    amount: "25",
    marketId: "morpho-blue-borrow-base-cbbtc-usdc-86",
    tokenAddress: "0x0000000000000000000000000000000000000002",
  },
  integrationId: "morpho-blue",
});

const reviewState: BorrowTransactionFlowReview = {
  request,
  summary: {
    action: "borrow",
    borrowAmount: "25",
    collateralAmount: "0.5",
    collateralTokenSymbol: "cbBTC",
    loanTokenSymbol: "USDC",
    marketLabel: "cbBTC / USDC",
    network: "base",
    providerName: "Morpho Blue",
  },
};
const session: BorrowFlowSession = {
  epoch: 1,
  intake: {
    ...reviewState,
    entry: { _tag: "BorrowDashboard" },
  },
  walletScope,
};

const transaction = (
  overrides: Partial<TransactionDto> = {}
): TransactionDto => ({
  address,
  chainId: "8453",
  id: "tx-1",
  network: "base",
  signablePayload: JSON.stringify({
    data: "0xabcdef",
    from: address,
    gasLimit: "21000",
    to: "0x0000000000000000000000000000000000000002",
    value: "0",
  }),
  signingFormat: "EVM_TRANSACTION",
  status: "WAITING_FOR_SIGNATURE",
  type: "BORROW",
  ...overrides,
});

const action = (overrides: Partial<ActionDto> = {}): ActionDto => ({
  action: "borrow",
  address,
  createdAt: "2026-01-01T00:00:00.000Z",
  currentStep: 1,
  hasNextStep: false,
  id: "action-1",
  integrationId: "morpho-blue",
  rawArguments: request.args,
  status: "CREATED",
  totalSteps: 1,
  transactions: [transaction()],
  ...overrides,
});

const decodedAction = (overrides: Partial<ActionDto> = {}) =>
  Schema.decodeUnknownSync(BorrowAction)(action(overrides));

const connectedWalletState = {
  additionalAddresses: null,
  address,
  chain: base,
  connector: { id: "test", uid: "test" } as Connector,
  connectorChains: [base],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "base",
  status: "connected",
} satisfies NormalizedWalletState;

const wallet = {
  state: Effect.succeed({
    connection: connectedWalletState,
    ledger: {
      accounts: [],
      currentAccountId: undefined,
      disabledChains: [],
    },
  }),
  signTransaction: () =>
    Effect.succeed({
      broadcasted: true as const,
      signedTx: transactionHash,
    }),
} as unknown as WalletOperations;

const makeBorrowApi = ({
  executeAction = Effect.succeed(action()),
  getActions = [],
  stepActions = [],
}: {
  readonly executeAction?: Effect.Effect<ActionDto, never>;
  readonly getActions?: ReadonlyArray<ActionDto>;
  readonly stepActions?: ReadonlyArray<ActionDto>;
}) => {
  const queuedGetActions = [...getActions];
  const queuedStepActions = [...stepActions];

  return {
    executeAction: vi.fn(() =>
      executeAction.pipe(Effect.flatMap(Schema.decodeEffect(BorrowAction)))
    ),
    getAction: vi.fn(() =>
      Schema.decodeEffect(BorrowAction)(
        queuedGetActions.shift() ?? getActions.at(-1) ?? action()
      )
    ),
    stepAction: vi.fn(() =>
      Schema.decodeEffect(BorrowAction)(
        queuedStepActions.shift() ?? stepActions.at(-1) ?? action()
      )
    ),
    submitTransaction: vi.fn(
      (_request: {
        readonly command: SubmitTransactionDto;
        readonly transactionId: string;
      }) =>
        Effect.succeed({
          link: "https://basescan.org/tx/0x111",
          status: "BROADCASTED" as const,
          transactionHash,
        })
    ),
  };
};

const ExecutionProbe = () => {
  const execution = useBorrowExecution();

  return (
    <div>
      <div data-testid="phase">{execution.phase}</div>
      <div data-testid="running">{String(execution.isRunning)}</div>
      <div data-testid="action-step">
        {execution.currentStep}/{execution.totalSteps}
      </div>
      <div data-testid="batch-count">{execution.batches.length}</div>
      <div data-testid="current-transaction">
        {execution.currentTransaction?.id ?? "none"}
      </div>
      {execution.error && (
        <button data-testid="retry" onClick={execution.retry} type="button">
          Retry
        </button>
      )}
    </div>
  );
};

const NavigationCapture = ({
  capture,
}: {
  readonly capture: (navigate: ReturnType<typeof useNavigate>) => void;
}) => {
  capture(useNavigate());
  return null;
};

const StartExecutionProbe = () => {
  const flow = useBorrowTransactionFlow();
  const confirm = useAtomSet(flow.confirmAtom);

  return (
    <button
      data-testid="start-execution"
      onClick={() => confirm(undefined)}
      type="button"
    >
      Start
    </button>
  );
};

const CompleteProbe = () => {
  const location = useLocation();
  const execution = useBorrowTransactionFlowExecution();
  const result = useAtomValue(execution.viewAtom).completionResult;

  return (
    <div data-testid="complete">
      {location.pathname} {result?.action.id}
    </div>
  );
};

const HistoryControls = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <div data-testid="history-path">{location.pathname}</div>
      <button onClick={() => navigate(-1)} type="button">
        Back
      </button>
      <button onClick={() => navigate(1)} type="button">
        Forward
      </button>
    </>
  );
};

const renderExecution = async (
  borrow: ReturnType<typeof makeBorrowApi>,
  options: {
    readonly action?: BorrowAction;
    readonly historyControls?: boolean;
    readonly initialEntries?: ReadonlyArray<string>;
    readonly initialIndex?: number;
    readonly initialPath?: string;
    readonly stepsElement?: ReactNode;
    readonly wallet?: WalletOperations;
  } = {}
) => {
  const navigation: {
    current: ReturnType<typeof useNavigate> | null;
  } = { current: null };
  const navigationService = WidgetNavigation.of({
    back: () =>
      Effect.sync(() => {
        navigation.current?.(-1);
      }),
    push: (path, options) =>
      Effect.sync(() => {
        navigation.current?.(path, { state: options?.state });
      }),
    replace: (path, options) =>
      Effect.sync(() => {
        navigation.current?.(path, {
          replace: true,
          state: options?.state,
        });
      }),
  });
  const activeWallet = options.wallet ?? wallet;
  const workflowAction = options.action ?? decodedAction();
  borrow.executeAction.mockImplementation(() => Effect.succeed(workflowAction));
  const walletLayer = Layer.succeed(
    WalletService,
    activeWallet as WalletService["Service"]
  );
  const operations = {
    completeWorkflow: () => Effect.void,
    getBorrowAction: borrow.getAction,
    getClassicStatus: () => Effect.die("unexpected classic status"),
    getWalletState: activeWallet.state.pipe(
      Effect.map((state) => state.connection)
    ),
    signMessage: () => Effect.die("unexpected message signing"),
    signTransaction: activeWallet.signTransaction,
    stepBorrowAction: borrow.stepAction,
    submitBorrowTransaction: borrow.submitTransaction,
    submitClassicHash: () => Effect.die("unexpected classic hash submission"),
    submitClassicSigned: () =>
      Effect.die("unexpected classic signed submission"),
    submitWorkflow: () => Effect.void,
    trackEvent: () => Effect.void,
  } as unknown as TransactionWorkflowOperationsService["Service"];
  const workflowLayer = TransactionWorkflowService.layer.pipe(
    Layer.provide(
      Layer.succeed(TransactionWorkflowOperationsService, operations)
    )
  );

  const app = await render(
    <RegistryProvider
      initialValues={[
        [
          borrowFlowSessionStore.stateAtom,
          { current: session, nextEpoch: session.epoch + 1 },
        ],
        [
          appRuntime.layer,
          Layer.mergeAll(
            Layer.succeed(BorrowOperations, borrow as never),
            Layer.succeed(TrackingService, {
              trackEvent: () => Effect.void,
              trackPageView: () => Effect.void,
            } as TrackingService["Service"]),
            Layer.succeed(WidgetNavigation, navigationService)
          ).pipe(Layer.fresh),
        ],
        [
          walletRuntime.layer,
          Layer.mergeAll(workflowLayer, walletLayer).pipe(Layer.fresh),
        ],
      ]}
    >
      <MemoryRouter
        initialEntries={
          options.initialEntries
            ? [...options.initialEntries]
            : [options.initialPath ?? "/borrow/review"]
        }
        initialIndex={options.initialIndex}
      >
        <NavigationCapture
          capture={(navigate) => (navigation.current = navigate)}
        />
        {options.historyControls ? <HistoryControls /> : null}
        <Routes>
          <Route
            element={
              <WalletScopeRoute
                fallbackPath="/borrow"
                walletStateResult={AsyncResult.success(connectedWalletState)}
              />
            }
          >
            <Route path="/borrow" element={<div>Borrow home</div>} />
            <Route
              element={
                <BorrowTransactionFlowRoute expected="BorrowDashboard" />
              }
            >
              <Route element={<BorrowTransactionFlowReviewRoute />}>
                <Route
                  path="/borrow/review"
                  element={<StartExecutionProbe />}
                />
              </Route>
              <Route element={<BorrowTransactionFlowExecutionScope />}>
                <Route
                  path="/borrow/steps"
                  element={options.stepsElement ?? <ExecutionProbe />}
                />
                <Route element={<BorrowTransactionFlowCompletionGuard />}>
                  <Route path="/borrow/complete" element={<CompleteProbe />} />
                </Route>
              </Route>
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </RegistryProvider>
  );

  if (options.initialPath !== "/borrow/complete") {
    await userEvent.click(app.getByTestId("start-execution"));
  }

  return app;
};

describe("borrow execution flow component", () => {
  it("routes an incomplete direct completion page back to Borrow", async () => {
    const app = await renderExecution(makeBorrowApi({}), {
      initialPath: "/borrow/complete",
      wallet: {
        ...wallet,
        signTransaction: () => Effect.never,
      },
    });

    await expect.element(app.getByText("Borrow home")).toBeInTheDocument();

    app.unmount();
  });

  it("renders running state while execution waits for wallet signing", async () => {
    const app = await renderExecution(makeBorrowApi({}), {
      wallet: {
        ...wallet,
        signTransaction: () => Effect.never,
      },
    });

    await expect.element(app.getByTestId("phase")).toHaveTextContent("signing");
    await expect.element(app.getByTestId("running")).toHaveTextContent("true");

    app.unmount();
  });

  it("routes to success when execution completes", async () => {
    const app = await renderExecution(
      makeBorrowApi({
        getActions: [
          action({
            status: "SUCCESS",
            transactions: [transaction({ status: "CONFIRMED" })],
          }),
        ],
      })
    );

    await expect
      .element(app.getByTestId("complete"))
      .toHaveTextContent("/borrow/complete action-1");

    app.unmount();
  });

  it("renders retryable failure and routes after retry succeeds", async () => {
    const app = await renderExecution(
      makeBorrowApi({
        getActions: [
          action({
            status: "PROCESSING",
            transactions: [transaction({ status: "FAILED" })],
          }),
          action({
            status: "SUCCESS",
            transactions: [transaction({ status: "CONFIRMED" })],
          }),
        ],
      })
    );

    await expect.element(app.getByTestId("retry")).toBeInTheDocument();

    await userEvent.click(app.getByTestId("retry"));

    await expect
      .element(app.getByTestId("complete"))
      .toHaveTextContent("/borrow/complete action-1");

    app.unmount();
  });

  it("retries after reconnecting without signing twice", async () => {
    let state: NormalizedWalletState = disconnectedNormalizedWalletState;
    const signTransaction = vi.fn(() =>
      Effect.succeed({
        broadcasted: true as const,
        signedTx: transactionHash,
      })
    );
    const reconnectingWallet = {
      ...wallet,
      state: Effect.sync(() => ({
        connection: state,
        ledger: {
          accounts: [],
          currentAccountId: undefined,
          disabledChains: [],
        },
      })),
      signTransaction,
    };
    const app = await renderExecution(
      makeBorrowApi({
        getActions: [
          action({
            status: "SUCCESS",
            transactions: [transaction({ status: "CONFIRMED" })],
          }),
        ],
      }),
      { wallet: reconnectingWallet }
    );

    await expect.element(app.getByTestId("retry")).toBeInTheDocument();
    expect(signTransaction).not.toHaveBeenCalled();

    state = connectedWalletState;
    await userEvent.click(app.getByTestId("retry"));

    await expect
      .element(app.getByTestId("complete"))
      .toHaveTextContent("/borrow/complete action-1");
    expect(signTransaction).toHaveBeenCalledOnce();

    app.unmount();
  });

  it("shows the next action step while retaining prior transaction batches", async () => {
    let signCalls = 0;
    const multiStepWallet = {
      ...wallet,
      signTransaction: () => {
        signCalls += 1;
        return signCalls === 1
          ? Effect.succeed({
              broadcasted: true as const,
              signedTx: transactionHash,
            })
          : Effect.never;
      },
    };
    const first = decodedAction({
      hasNextStep: true,
      totalSteps: 2,
    });
    const app = await renderExecution(
      makeBorrowApi({
        getActions: [
          action({
            hasNextStep: true,
            totalSteps: 2,
            transactions: [transaction({ status: "CONFIRMED" })],
          }),
        ],
        stepActions: [
          action({
            currentStep: 2,
            id: first.id,
            totalSteps: 2,
            transactions: [transaction({ id: "tx-2" })],
          }),
        ],
      }),
      { action: first, wallet: multiStepWallet }
    );

    await expect
      .element(app.getByTestId("action-step"))
      .toHaveTextContent("2/2");
    await expect.element(app.getByTestId("batch-count")).toHaveTextContent("2");
    await expect
      .element(app.getByTestId("current-transaction"))
      .toHaveTextContent("tx-2");
    await expect.element(app.getByTestId("phase")).toHaveTextContent("signing");

    app.unmount();
  });

  it("does not restart an abandoned submitted workflow from browser history", async () => {
    const confirmationInterrupted = await Effect.runPromise(
      Deferred.make<void>()
    );
    const signTransaction = vi.fn(() =>
      Effect.succeed({
        broadcasted: true as const,
        signedTx: transactionHash,
      })
    );
    const borrow = makeBorrowApi({});
    borrow.getAction.mockImplementation(() =>
      Effect.never.pipe(
        Effect.onInterrupt(() =>
          Deferred.succeed(confirmationInterrupted, undefined)
        )
      )
    );
    const activeWallet = { ...wallet, signTransaction };
    const app = await renderExecution(borrow, {
      action: decodedAction(),
      historyControls: true,
      initialEntries: ["/borrow", "/borrow/review"],
      initialIndex: 1,
      stepsElement: <BorrowStepsPage />,
      wallet: activeWallet,
    });

    await expect
      .element(app.getByTestId("history-path"))
      .toHaveTextContent("/borrow/steps");

    await vi.waitFor(() => {
      expect(signTransaction).toHaveBeenCalledOnce();
      expect(borrow.submitTransaction).toHaveBeenCalledOnce();
      expect(borrow.getAction).toHaveBeenCalledOnce();
    });

    await userEvent.click(app.getByRole("button", { name: "Back" }));
    await expect
      .element(app.getByTestId("history-path"))
      .toHaveTextContent("/borrow/review");
    await Effect.runPromise(Deferred.await(confirmationInterrupted));

    await userEvent.click(app.getByRole("button", { name: "Back" }));
    await expect
      .element(app.getByTestId("history-path"))
      .toHaveTextContent("/borrow");
    await userEvent.click(app.getByRole("button", { name: "Forward" }));
    await expect
      .element(app.getByTestId("history-path"))
      .toHaveTextContent("/borrow");

    expect(
      app.container.querySelector('[data-rk="borrow-steps-page"]')
    ).not.toBeInTheDocument();
    expect(signTransaction).toHaveBeenCalledOnce();
    expect(borrow.submitTransaction).toHaveBeenCalledOnce();

    app.unmount();
  });
});
