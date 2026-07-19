import { RegistryProvider } from "@effect/atom-react";
import { Deferred, Effect, Layer, Schema } from "effect";
import { useEffect } from "react";
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
  BorrowCompletionRouteGuard,
  BorrowTransactionWorkflowGuard,
  useBorrowCompletionRouteState,
} from "../../src/features/borrow/ui/borrow-execution-route";
import { borrowExecutionInputAtom } from "../../src/features/borrow/ui/execution-state";
import type {
  BorrowExecutionInput,
  BorrowReviewState,
} from "../../src/features/borrow/ui/review-state";
import { BorrowStepsPage } from "../../src/features/borrow/ui/steps";
import { useBorrowExecution } from "../../src/features/borrow/ui/use-borrow-execution";
import { currentWalletScopeAtom } from "../../src/features/wallet/state/selectors";
import { BorrowApiService } from "../../src/services/api/borrow-api-service";
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

const reviewState: BorrowReviewState = {
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
  const navigate = useNavigate();

  useEffect(() => {
    if (!execution.completionResult) {
      return;
    }

    navigate("/borrow/complete", { replace: true });
  }, [execution.completionResult, navigate]);

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

const CompleteProbe = () => {
  const location = useLocation();
  const { result } = useBorrowCompletionRouteState();

  return (
    <div data-testid="complete">
      {location.pathname} {result.action.id}
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

const renderExecution = (
  borrow: ReturnType<typeof makeBorrowApi>,
  options: {
    readonly action?: BorrowAction;
    readonly initialPath?: string;
    readonly wallet?: WalletOperations;
  } = {}
) => {
  const activeWallet = options.wallet ?? wallet;
  const action = options.action ?? decodedAction();
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

  return render(
    <RegistryProvider
      initialValues={[
        [borrowExecutionInputAtom, { ...reviewState, action }],
        [currentWalletScopeAtom, walletScope],
        [
          appRuntime.layer,
          Layer.succeed(BorrowApiService, borrow as never).pipe(Layer.fresh),
        ],
        [
          walletRuntime.layer,
          Layer.mergeAll(workflowLayer, walletLayer).pipe(Layer.fresh),
        ],
      ]}
    >
      <MemoryRouter initialEntries={[options.initialPath ?? "/borrow/steps"]}>
        <Routes>
          <Route element={<BorrowTransactionWorkflowGuard />}>
            <Route path="/borrow/steps" element={<ExecutionProbe />} />
            <Route element={<BorrowCompletionRouteGuard />}>
              <Route path="/borrow/complete" element={<CompleteProbe />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </RegistryProvider>
  );
};

describe("borrow execution flow component", () => {
  it("routes an incomplete completion page back to execution", async () => {
    const app = await renderExecution(makeBorrowApi({}), {
      initialPath: "/borrow/complete",
      wallet: {
        ...wallet,
        signTransaction: () => Effect.never,
      },
    });

    await expect.element(app.getByTestId("phase")).toHaveTextContent("signing");

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

  it("does not restart a submitted workflow after Back and Forward navigation", async () => {
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
    const workflowAction = decodedAction();
    const executionInput: BorrowExecutionInput = {
      ...reviewState,
      action: workflowAction,
    };
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
    const runtimeLayer = Layer.mergeAll(
      Layer.succeed(BorrowApiService, borrow as never),
      Layer.succeed(TrackingService, {
        trackEvent: () => Effect.void,
        trackPageView: () => Effect.void,
      } as TrackingService["Service"]),
      Layer.succeed(
        WalletService,
        activeWallet as unknown as WalletService["Service"]
      ),
      TransactionWorkflowService.layer.pipe(
        Layer.provide(
          Layer.succeed(TransactionWorkflowOperationsService, operations)
        )
      )
    ).pipe(Layer.fresh);
    const app = await render(
      <RegistryProvider
        initialValues={[
          [
            appRuntime.layer,
            Layer.mergeAll(
              Layer.succeed(BorrowApiService, borrow as never),
              Layer.succeed(TrackingService, {
                trackEvent: () => Effect.void,
                trackPageView: () => Effect.void,
              } as TrackingService["Service"])
            ).pipe(Layer.fresh),
          ],
          [walletRuntime.layer, runtimeLayer],
          [borrowExecutionInputAtom, executionInput],
          [currentWalletScopeAtom, walletScope],
        ]}
      >
        <MemoryRouter
          initialEntries={["/borrow", "/borrow/steps"]}
          initialIndex={1}
        >
          <HistoryControls />
          <Routes>
            <Route path="/borrow" element={<div>Borrow home</div>} />
            <Route element={<BorrowTransactionWorkflowGuard />}>
              <Route path="/borrow/steps" element={<BorrowStepsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </RegistryProvider>
    );

    await vi.waitFor(() => {
      expect(signTransaction).toHaveBeenCalledOnce();
      expect(borrow.submitTransaction).toHaveBeenCalledOnce();
      expect(borrow.getAction).toHaveBeenCalledOnce();
    });

    await userEvent.click(app.getByRole("button", { name: "Back" }));
    await expect
      .element(app.getByTestId("history-path"))
      .toHaveTextContent("/borrow");
    await Effect.runPromise(Deferred.await(confirmationInterrupted));

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
