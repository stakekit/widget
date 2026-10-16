import { RegistryProvider, useAtomSet, useAtomValue } from "@effect/atom-react";
import { describe, expect, it, vi } from "@effect/vitest";
import { Context, Deferred, Effect, Layer, Schema } from "effect";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { base } from "viem/chains";
import { userEvent } from "vitest/browser";
import type { Connector } from "wagmi";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../../src/app/runtime/wallet-runtime";
import { Action as BorrowAction } from "../../../src/domain/borrow/execution/action";
import { ActionCommand } from "../../../src/domain/borrow/execution/action-command";
import type {
  Transaction as BorrowTransaction,
  SubmitTransactionCommand,
} from "../../../src/domain/borrow/execution/transaction";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  BorrowFlowSession,
  type BorrowTransactionFlowReview,
  makeBorrowFlowNavigationState,
} from "../../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
import {
  BorrowTransactionFlowCompletionGuard,
  BorrowTransactionFlowExecutionScope,
  BorrowTransactionFlowReviewRoute,
  BorrowTransactionFlowRoute,
  useBorrowTransactionFlowExecution,
  useBorrowTransactionFlowReview,
} from "../../../src/features/borrow-transaction-flow/react/borrow-flow-route";
import { BorrowTransactionFlowService } from "../../../src/features/borrow-transaction-flow/state/orchestration/borrow-transaction-flow-service";
import { BorrowCompletePage } from "../../../src/features/borrow-transaction-flow/ui/complete";
import { BorrowReviewPage } from "../../../src/features/borrow-transaction-flow/ui/review";
import { BorrowStepsPage } from "../../../src/features/borrow-transaction-flow/ui/steps";
import { useBorrowExecution } from "../../../src/features/borrow-transaction-flow/ui/use-borrow-execution";
import { WalletScopeRoute } from "../../../src/features/wallet/react/wallet-scope-route";
import { withResponseDecodeError } from "../../../src/services/api/api-operation";
import { BorrowOperations } from "../../../src/services/api/operations";
import { ApiRequestError } from "../../../src/services/api/resource-sources";
import { WidgetConfigService } from "../../../src/services/config/widget-config";
import { makeWidgetNavigation } from "../../../src/services/navigation/widget-navigation";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { WalletOwnerMismatchError } from "../../../src/services/wallet/wallet-errors";
import { WalletService } from "../../../src/services/wallet/wallet-service";
import {
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
} from "../../../src/services/wallet/wallet-state";
import {
  borrowEntryFlowEntry,
  withUnserializedState,
} from "../../utils/borrow-flow-entry";
import { makeTestTracking } from "../../utils/services/tracking-service";
import { makeTestWallet } from "../../utils/services/wallet-service";
import { makeTestNavigation } from "../../utils/services/widget-navigation";
import { render } from "../../utils/test-utils";
import { makeTransactionWorkflowTestKit } from "../../utils/transaction-workflow-test-kit";
import type { WalletOperations } from "../../utils/wallet-operations";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const transactionHash =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const walletScope = new WalletScopeKey({ address, network: "base" });
const i18nInstance = createWidgetI18nInstance();

type ActionDto = typeof BorrowAction.Encoded;
type TransactionDto = typeof BorrowTransaction.Encoded;
type SubmitTransactionDto = typeof SubmitTransactionCommand.Encoded;

const command = Schema.decodeSync(ActionCommand)({
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
  command,
  riskVerdict: { _tag: "Allow" },
  summary: {
    action: "borrowAndSupply",
    borrowAmount: "25",
    debtPrincipalAmount: "25",
    loanTokenPriceUsd: "1",
    originationFeeAmount: "0",
    collateralAmount: "0.5",
    collateralFeeAmount: "0.025",
    collateralTokenSymbol: "cbBTC",
    effectiveCollateralAmount: "0.475",
    existingCollateralUsd: "1000",
    existingDebtUsd: "400",
    loanTokenSymbol: "USDC",
    marketLabel: "cbBTC / USDC",
    network: "base",
    projectedCollateralUsd: "1500",
    projectedDebtUsd: "425",
    providerName: "Morpho Blue",
    riskStatus: "unavailable",
    warnings: [],
  },
};
const withdrawSession = new BorrowFlowSession({
  intake: {
    command: Schema.decodeSync(ActionCommand)({
      action: "withdraw",
      address,
      args: {
        amount: "2",
        marketId: command.args.marketId,
        tokenAddress: "0x0000000000000000000000000000000000000003",
      },
      integrationId: "morpho-blue",
    }),
    entry: borrowEntryFlowEntry,
    riskVerdict: { _tag: "Allow" },
    summary: {
      action: "withdraw",
      collateralAmount: "2",
      collateralTokenSymbol: "USDC",
      existingCollateralUsd: "2",
      marketLabel: "USDC",
      network: "base",
      projectedCollateralUsd: "0",
      providerName: "Aave V3",
      riskStatus: "unavailable",
      warnings: [],
    },
  },
  walletScope,
});
const session = new BorrowFlowSession({
  intake: {
    ...reviewState,
    entry: borrowEntryFlowEntry,
  },
  walletScope,
});

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
  currentStep: 1,
  hasNextStep: false,
  id: "action-1",
  integrationId: "morpho-blue",
  rawArguments: command.args,
  status: "CREATED",
  totalSteps: 1,
  transactions: [transaction()],
  ...overrides,
});

const decodedAction = (overrides: Partial<ActionDto> = {}) =>
  Schema.decodeSync(BorrowAction)(action(overrides));

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
  failFirstSubmit = false,
  getActions = [],
  stepActions = [],
}: {
  readonly executeAction?: Effect.Effect<ActionDto, never>;
  readonly failFirstSubmit?: boolean;
  readonly getActions?: ReadonlyArray<ActionDto>;
  readonly stepActions?: ReadonlyArray<ActionDto>;
}) => {
  const queuedGetActions = [...getActions];
  const queuedStepActions = [...stepActions];
  let submitCalls = 0;
  const submit = (_request: {
    readonly command: SubmitTransactionDto;
    readonly transactionId: string;
  }) => {
    submitCalls += 1;
    return failFirstSubmit && submitCalls === 1
      ? Effect.fail(
          new ApiRequestError({
            cause: new Error("Submission rejected"),
            failure: { _tag: "Unreachable" },
            operation: "borrow-transaction-submit",
          })
        )
      : Effect.succeed({
          link: "https://basescan.org/tx/0x111",
          status: "BROADCASTED" as const,
          transactionHash,
        });
  };

  return {
    executeAction: vi.fn<BorrowOperations["Service"]["executeAction"]>(() =>
      executeAction.pipe(
        Effect.flatMap((value) =>
          Schema.decodeEffect(BorrowAction)(value).pipe(
            withResponseDecodeError("borrow-action-create")
          )
        )
      )
    ),
    getAction: vi.fn(() =>
      Effect.suspend(() =>
        Schema.decodeEffect(BorrowAction)(
          queuedGetActions.shift() ?? getActions.at(-1) ?? action()
        ).pipe(withResponseDecodeError("borrow-action-status"))
      )
    ),
    stepAction: vi.fn(() =>
      Effect.suspend(() =>
        Schema.decodeEffect(BorrowAction)(
          queuedStepActions.shift() ?? stepActions.at(-1) ?? action()
        ).pipe(withResponseDecodeError("borrow-action-step"))
      )
    ),
    submitTransaction: vi.fn(submit),
    submitTransactionInBackground: vi.fn(submit),
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
  const review = useBorrowTransactionFlowReview();
  const confirm = useAtomSet(review.confirmAtom);

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

const renderExecution = (
  borrow: ReturnType<typeof makeBorrowApi>,
  options: {
    readonly action?: BorrowAction;
    readonly autoStart?: boolean;
    readonly completeElement?: ReactNode;
    readonly historyControls?: boolean;
    readonly initialEntries?: ReadonlyArray<string>;
    readonly initialIndex?: number;
    readonly initialPath?: string;
    readonly reviewElement?: ReactNode;
    readonly session?: BorrowFlowSession;
    readonly stepsElement?: ReactNode;
    readonly wallet?: WalletOperations;
  } = {}
) =>
  Effect.gen(function* () {
    const navigation: {
      current: ReturnType<typeof useNavigate> | null;
    } = { current: null };
    const navigationService = makeWidgetNavigation({
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
    const testNavigation = yield* makeTestNavigation({
      execute: navigationService.execute,
    });
    const tracking = yield* makeTestTracking();
    const activeWallet = options.wallet ?? wallet;
    const workflowAction = options.action ?? decodedAction();
    borrow.executeAction.mockImplementation(() =>
      Effect.succeed(workflowAction)
    );
    const walletLayer = Layer.succeed(
      WalletService,
      activeWallet as WalletService["Service"]
    );
    const flowWallet = yield* makeTestWallet({
      addLedgerAccount: activeWallet.addLedgerAccount,
      enabledNetworks: activeWallet.enabledNetworks,
      initialState: {
        connection: connectedWalletState,
        ledger: {
          accounts: [],
          currentAccountId: undefined,
          disabledChains: [],
        },
      },
      logout: activeWallet.logout,
      signMessage: activeWallet.signMessage,
      signTransaction: activeWallet.signTransaction,
      switchAccount: activeWallet.switchAccount,
      wagmiConfig: activeWallet.wagmiConfig,
    });
    const workflow = yield* makeTransactionWorkflowTestKit({
      borrow,
      walletService: activeWallet as WalletService["Service"],
    });
    const workflowLayer = workflow.layer;
    const flowDependencies = Layer.mergeAll(
      Layer.succeed(BorrowOperations, borrow as never),
      tracking.layer,
      WidgetConfigService.layer({
        apiKey: "test-api-key",
        borrowEnabled: true,
        dashboardVariant: true,
        variant: "default",
      }),
      testNavigation.layer,
      workflowLayer,
      flowWallet.layer
    );
    const flowContext = yield* Layer.build(
      BorrowTransactionFlowService.layer.pipe(Layer.provide(flowDependencies))
    );
    const flowService = Context.get(flowContext, BorrowTransactionFlowService);
    // Start hands its Session to the flow route through navigation state.
    const flowState = makeBorrowFlowNavigationState(options.session ?? session);
    const initialEntries = (
      options.initialEntries ?? [options.initialPath ?? "/borrow/review"]
    ).map((pathname) =>
      pathname === "/borrow"
        ? pathname
        : withUnserializedState({ pathname }, flowState)
    );

    const app = yield* Effect.acquireRelease(
      Effect.promise(() =>
        render(
          <I18nextProvider i18n={i18nInstance}>
            <RegistryProvider
              initialValues={[
                applicationRuntimeInitInitialValue({
                  apiKey: "test-api-key",
                  borrowEnabled: true,
                  dashboardVariant: true,
                  variant: "default",
                }),
                [
                  appRuntime.layer,
                  Layer.mergeAll(
                    Layer.succeed(BorrowOperations, borrow as never),
                    tracking.layer,
                    testNavigation.layer,
                    WidgetConfigService.layer({
                      apiKey: "test-api-key",
                      borrowEnabled: true,
                      dashboardVariant: true,
                      variant: "default",
                    })
                  ).pipe(Layer.fresh),
                ],
                [
                  walletRuntime.layer,
                  Layer.mergeAll(
                    workflowLayer,
                    walletLayer,
                    Layer.succeed(BorrowTransactionFlowService, flowService)
                  ).pipe(Layer.fresh),
                ],
              ]}
            >
              <MemoryRouter
                initialEntries={initialEntries}
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
                        walletState={connectedWalletState}
                      />
                    }
                  >
                    <Route path="/borrow" element={<div>Borrow home</div>} />
                    <Route
                      element={
                        <BorrowTransactionFlowRoute expected="BorrowEntry" />
                      }
                    >
                      <Route element={<BorrowTransactionFlowReviewRoute />}>
                        <Route
                          path="/borrow/review"
                          element={
                            options.reviewElement ?? <StartExecutionProbe />
                          }
                        />
                      </Route>
                      <Route element={<BorrowTransactionFlowExecutionScope />}>
                        <Route
                          path="/borrow/steps"
                          element={options.stepsElement ?? <ExecutionProbe />}
                        />
                        <Route
                          element={<BorrowTransactionFlowCompletionGuard />}
                        >
                          <Route
                            path="/borrow/complete"
                            element={
                              options.completeElement ?? <CompleteProbe />
                            }
                          />
                        </Route>
                      </Route>
                    </Route>
                  </Route>
                </Routes>
              </MemoryRouter>
            </RegistryProvider>
          </I18nextProvider>
        )
      ),
      (app) => Effect.promise(() => app.unmount())
    );

    if (
      options.autoStart !== false &&
      options.initialPath !== "/borrow/complete"
    ) {
      yield* Effect.promise(() =>
        userEvent.click(app.getByTestId("start-execution"))
      );
    }

    return app;
  });

describe("borrow execution flow component", () => {
  it.live(
    "shows localized confirmation feedback without internal error details",
    () =>
      Effect.gen(function* () {
        const app = yield* renderExecution(makeBorrowApi({}), {
          action: decodedAction({ status: "FAILED" }),
          autoStart: false,
          reviewElement: <BorrowReviewPage />,
        });

        yield* Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Confirm" }))
        );

        yield* Effect.promise(() =>
          expect.element(app.getByText("Borrow failed")).toBeInTheDocument()
        );
        yield* Effect.promise(() =>
          expect
            .element(
              app.getByText(
                "We couldn't prepare this transaction. Please try again."
              )
            )
            .toBeInTheDocument()
        );
        yield* Effect.promise(() =>
          expect
            .element(app.getByText("Borrow action ended with FAILED status."))
            .not.toBeInTheDocument()
        );
      })
  );

  it.live("shows the API's reason when it refuses to create the action", () =>
    Effect.gen(function* () {
      const reason =
        "Insufficient WETH balance to repay the full debt: you have 0.0001 WETH but need at least 0.00010006 WETH.";
      const borrow = makeBorrowApi({});
      const app = yield* renderExecution(borrow, {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
      });
      borrow.executeAction.mockImplementation(() =>
        Effect.fail(
          new ApiRequestError({
            cause: undefined,
            failure: {
              _tag: "ErrorStatus",
              body: { message: reason },
              status: 412,
            },
            operation: "borrow-action-create",
          })
        )
      );

      yield* Effect.promise(() =>
        userEvent.click(app.getByRole("button", { name: "Confirm" }))
      );

      yield* Effect.promise(() =>
        expect.element(app.getByText(reason)).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect
          .element(
            app.getByText(
              "We couldn't prepare this transaction. Please try again."
            )
          )
          .not.toBeInTheDocument()
      );
    })
  );

  it.live("labels a repayment amount on Review", () =>
    Effect.gen(function* () {
      const repaySession = new BorrowFlowSession({
        ...session,
        intake: {
          ...session.intake,
          command: {
            ...session.intake.command,
            action: "repay",
            args: {
              amount: "25",
              marketId: command.args.marketId,
              tokenAddress: command.args.tokenAddress,
            },
          },
          summary: {
            action: "repay",
            borrowAmount: "25",
            existingDebtUsd: "400",
            loanTokenSymbol: "USDC",
            marketLabel: "cbBTC / USDC",
            network: "base",
            projectedDebtUsd: "375",
            providerName: "Morpho Blue",
            riskStatus: "available",
            projectedLtv: "0.25",
            warnings: [],
          },
        },
      });
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
        session: repaySession,
      });

      yield* Effect.promise(() =>
        expect.element(app.getByText("Repay amount")).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("Borrow amount")).not.toBeInTheDocument()
      );
    })
  );

  it.live("titles Review with the action, asset, provider and network", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
      });

      yield* Effect.promise(() =>
        expect.element(app.getByText("Borrow USDC")).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("Morpho Blue · Base")).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("cbBTC / USDC")).toBeInTheDocument()
      );
      const text = app.container.textContent ?? "";
      expect(text).not.toContain("Requested action");
      expect(text).not.toContain(command.args.marketId);
      expect(text).not.toContain("Confirming will open");
      expect(text).not.toContain("Shown in wallet");
    })
  );

  it.live("titles a collateral toggle with its asset", () =>
    Effect.gen(function* () {
      const toggleSession = new BorrowFlowSession({
        ...session,
        intake: {
          ...session.intake,
          summary: {
            action: "disableCollateral",
            collateralTokenSymbol: "USDC",
            existingCollateralUsd: "100",
            marketLabel: "USDC",
            network: "ethereum",
            providerName: "Aave V3",
            riskStatus: "unavailable",
            warnings: [],
          },
        },
      });
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
        session: toggleSession,
      });

      yield* Effect.promise(() =>
        expect
          .element(app.getByText("Disable USDC as collateral"))
          .toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("Aave V3 · Ethereum")).toBeInTheDocument()
      );
    })
  );

  it.live("shows current to projected risk on Review", () =>
    Effect.gen(function* () {
      const riskSession = new BorrowFlowSession({
        ...session,
        intake: {
          ...session.intake,
          summary: {
            ...session.intake.summary,
            currentHealthFactor: "2",
            currentLtv: "0.4",
            projectedHealthFactor: "1.5",
            projectedLtv: "0.5",
            riskStatus: "available",
          },
        },
      });
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
        session: riskSession,
      });

      yield* Effect.promise(() =>
        expect.element(app.getByText("40% → 50%")).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("2 → 1.5")).toBeInTheDocument()
      );
    })
  );

  it.live("omits projected metrics when risk is unavailable", () =>
    Effect.gen(function* () {
      const unavailableSession = new BorrowFlowSession({
        ...session,
        intake: {
          ...session.intake,
          summary: {
            ...session.intake.summary,
            riskStatus: "unavailable",
          },
        },
      });
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
        session: unavailableSession,
      });

      yield* Effect.promise(() =>
        expect
          .element(app.getByText("Projected risk unavailable"))
          .not.toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("0.025 cbBTC")).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("0.475 cbBTC")).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect
          .element(app.getByRole("button", { name: "Confirm" }))
          .toBeEnabled()
      );
    })
  );

  it.live("shows known constraint warnings without blocking Confirm", () =>
    Effect.gen(function* () {
      const warnedSession = new BorrowFlowSession({
        ...session,
        intake: {
          ...session.intake,
          summary: {
            ...session.intake.summary,
            warnings: ["RiskCapacityExceeded"],
          },
        },
      });
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
        session: warnedSession,
      });

      yield* Effect.promise(() =>
        expect.element(app.getByText("Review warning")).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect
          .element(app.getByText(/exceeds the currently known borrow capacity/))
          .toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect
          .element(app.getByRole("button", { name: "Confirm" }))
          .toBeEnabled()
      );
    })
  );

  it.live("blocks Confirm on a health factor Block verdict", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
        session: new BorrowFlowSession({
          ...session,
          intake: {
            ...session.intake,
            riskVerdict: { _tag: "Block", reason: "healthFactor" },
          },
        }),
      });

      yield* Effect.promise(() =>
        expect
          .element(app.getByRole("button", { name: "Confirm" }))
          .toBeDisabled()
      );
      yield* Effect.promise(() =>
        expect
          .element(app.getByText(/health factor would fall below 1/))
          .toBeInTheDocument()
      );
    })
  );

  it.live("blocks Confirm on an LTV Block verdict", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
        session: new BorrowFlowSession({
          ...session,
          intake: {
            ...session.intake,
            riskVerdict: { _tag: "Block", reason: "ltv" },
          },
        }),
      });

      yield* Effect.promise(() =>
        expect
          .element(app.getByRole("button", { name: "Confirm" }))
          .toBeDisabled()
      );
      yield* Effect.promise(() =>
        expect
          .element(app.getByText(/LTV would exceed the market's max LTV/))
          .toBeInTheDocument()
      );
    })
  );

  it.live(
    "decides Confirm from the carried verdict, not the displayed risk figures",
    () =>
      Effect.gen(function* () {
        const app = yield* renderExecution(makeBorrowApi({}), {
          autoStart: false,
          reviewElement: <BorrowReviewPage />,
          session: new BorrowFlowSession({
            ...session,
            intake: {
              ...session.intake,
              riskVerdict: { _tag: "Allow" },
              summary: {
                ...session.intake.summary,
                maxLtv: "0.75",
                projectedHealthFactor: "0.8",
                projectedLtv: "0.9",
                riskStatus: "available",
              },
            },
          }),
        });

        yield* Effect.promise(() =>
          expect
            .element(app.getByRole("button", { name: "Confirm" }))
            .toBeEnabled()
        );
      })
  );

  it.live("routes an incomplete direct completion page back to Borrow", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(makeBorrowApi({}), {
        initialPath: "/borrow/complete",
        wallet: {
          ...wallet,
          signTransaction: () => Effect.never,
        },
      });

      yield* Effect.promise(() =>
        expect.element(app.getByText("Borrow home")).toBeInTheDocument()
      );
    })
  );

  it.live("returns to Borrow when Transaction Workflow setup fails", () =>
    Effect.gen(function* () {
      const otherAddress = yield* Schema.decodeEffect(WalletAddress)(
        "0x0000000000000000000000000000000000000002"
      );
      const app = yield* renderExecution(makeBorrowApi({}), {
        action: decodedAction({
          address: otherAddress,
        }),
      });

      yield* Effect.promise(() =>
        expect.element(app.getByText("Borrow home")).toBeInTheDocument()
      );
    })
  );

  it.live(
    "renders running state while execution waits for wallet signing",
    () =>
      Effect.gen(function* () {
        const app = yield* renderExecution(makeBorrowApi({}), {
          wallet: {
            ...wallet,
            signTransaction: () => Effect.never,
          },
        });

        yield* Effect.promise(() =>
          expect.element(app.getByTestId("phase")).toHaveTextContent("signing")
        );
        yield* Effect.promise(() =>
          expect.element(app.getByTestId("running")).toHaveTextContent("true")
        );
      })
  );

  it.live("leaves Steps while the wallet holds the transaction", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(makeBorrowApi({}), {
        stepsElement: <BorrowStepsPage />,
        wallet: {
          ...wallet,
          signTransaction: () => Effect.never,
        },
      });

      yield* Effect.promise(() =>
        userEvent.click(app.getByRole("button", { name: "Cancel" }))
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("Borrow home")).toBeInTheDocument()
      );
    })
  );

  it.live(
    "leaves Steps after hash submission fails and registers the held hash",
    () =>
      Effect.gen(function* () {
        const borrow = makeBorrowApi({ failFirstSubmit: true });
        const app = yield* renderExecution(borrow, {
          stepsElement: <BorrowStepsPage />,
        });

        yield* Effect.promise(() =>
          expect
            .element(
              app.getByText("Borrow transaction could not be submitted.")
            )
            .toBeInTheDocument()
        );
        yield* Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Cancel" }))
        );
        yield* Effect.promise(() =>
          expect.element(app.getByText("Borrow home")).toBeInTheDocument()
        );
        yield* Effect.promise(() =>
          expect
            .poll(() => borrow.submitTransactionInBackground)
            .toHaveBeenCalledOnce()
        );
        expect(borrow.submitTransaction).toHaveBeenCalledOnce();
        expect(borrow.submitTransactionInBackground).toHaveBeenCalledWith({
          command: { transactionHash },
          transactionId: "tx-1",
        });
      })
  );

  it.live("labels steps with human-readable transaction types", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(makeBorrowApi({}), {
        action: decodedAction({
          action: "disableCollateral",
          transactions: [transaction({ type: "DISABLE_COLLATERAL" })],
        }),
        stepsElement: <BorrowStepsPage />,
        wallet: {
          ...wallet,
          signTransaction: () => Effect.never,
        },
      });

      yield* Effect.promise(() =>
        expect
          .element(app.getByText("Transaction - Disable collateral"))
          .toBeInTheDocument()
      );
      expect(app.container.textContent).not.toContain("DISABLE_COLLATERAL");
    })
  );

  it.live("renders each borrow transaction as a step in a timeline", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(makeBorrowApi({}), {
        action: decodedAction({
          transactions: [
            transaction({ id: "tx-1", type: "APPROVAL" }),
            transaction({ id: "tx-2", type: "SUPPLY" }),
          ],
        }),
        stepsElement: <BorrowStepsPage />,
        wallet: {
          ...wallet,
          signTransaction: () => Effect.never,
        },
      });

      yield* Effect.promise(() =>
        expect
          .element(app.getByText("Transaction 1 / 2 - Token approval"))
          .toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect
          .element(app.getByText("Transaction 2 / 2 - Supply"))
          .toBeInTheDocument()
      );
      // The signing step of the first transaction is active.
      yield* Effect.promise(() =>
        expect
          .poll(() =>
            Array.from(
              app.container.querySelectorAll(
                '[data-rk="tx-state-step-circle"]'
              ),
              (circle) => circle.getAttribute("data-state")
            ).slice(0, 2)
          )
          .toEqual(["success", "pending"])
      );
      expect(app.container.textContent).not.toContain("Transaction history");
    })
  );

  it.live("shows that the next action step is being prepared", () =>
    Effect.gen(function* () {
      const borrow = makeBorrowApi({
        getActions: [
          action({
            hasNextStep: true,
            totalSteps: 2,
            transactions: [transaction({ status: "CONFIRMED" })],
          }),
        ],
      });
      borrow.stepAction.mockImplementation(() => Effect.never);
      const app = yield* renderExecution(borrow, {
        action: decodedAction({ hasNextStep: true, totalSteps: 2 }),
        stepsElement: <BorrowStepsPage />,
      });

      yield* Effect.promise(() =>
        expect
          .element(app.getByText("Preparing the next step"))
          .toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("Step 1 of 2")).toBeInTheDocument()
      );
    })
  );

  it.live("routes to success when execution completes", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(
        makeBorrowApi({
          getActions: [
            action({
              status: "SUCCESS",
              transactions: [transaction({ status: "CONFIRMED" })],
            }),
          ],
        })
      );

      yield* Effect.promise(() =>
        expect
          .element(app.getByTestId("complete"))
          .toHaveTextContent("/borrow/complete action-1")
      );
    })
  );

  it.live("labels every completed transaction with its type", () =>
    Effect.gen(function* () {
      const transactions = [
        transaction({ id: "tx-1", type: "APPROVAL" }),
        transaction({ id: "tx-2", type: "SUPPLY" }),
        transaction({ id: "tx-3", type: "BORROW" }),
      ];
      // The provider confirms one transaction per poll; reporting the action
      // SUCCESS early would leave the rest unsigned (batch reconciliation).
      const confirmedThrough = (count: number) =>
        transactions.map((tx, index) => ({
          ...tx,
          status:
            index < count
              ? ("CONFIRMED" as const)
              : ("WAITING_FOR_SIGNATURE" as const),
        }));
      const app = yield* renderExecution(
        makeBorrowApi({
          getActions: [
            action({
              status: "PROCESSING",
              transactions: confirmedThrough(1),
            }),
            action({
              status: "PROCESSING",
              transactions: confirmedThrough(2),
            }),
            action({
              status: "SUCCESS",
              transactions: confirmedThrough(3),
            }),
          ],
        }),
        {
          action: decodedAction({ transactions }),
          completeElement: <BorrowCompletePage />,
        }
      );

      yield* Effect.promise(() =>
        expect.element(app.getByText("Borrow complete")).toBeInTheDocument()
      );
      for (const label of ["Token approval", "Supply", "Borrow"]) {
        yield* Effect.promise(() =>
          expect
            .element(
              app.getByRole("button", { name: `View ${label} transaction` })
            )
            .toBeInTheDocument()
        );
      }
      expect(app.container.textContent).not.toContain("View transaction");
    })
  );

  it.live("titles completion with the action that ran", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(
        makeBorrowApi({
          getActions: [
            action({
              action: "withdraw",
              status: "SUCCESS",
              transactions: [
                transaction({ status: "CONFIRMED", type: "WITHDRAW" }),
              ],
            }),
          ],
        }),
        {
          action: decodedAction({
            action: "withdraw",
            transactions: [transaction({ type: "WITHDRAW" })],
          }),
          completeElement: <BorrowCompletePage />,
          session: withdrawSession,
        }
      );

      yield* Effect.promise(() =>
        expect.element(app.getByText("Withdrawal complete")).toBeInTheDocument()
      );
      expect(app.container.textContent).not.toContain("Borrow complete");
    })
  );

  it.live("titles an execution failure with the action that ran", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(
        makeBorrowApi({
          getActions: [
            action({
              action: "withdraw",
              status: "PROCESSING",
              transactions: [
                transaction({ status: "FAILED", type: "WITHDRAW" }),
              ],
            }),
          ],
        }),
        {
          action: decodedAction({
            action: "withdraw",
            transactions: [transaction({ type: "WITHDRAW" })],
          }),
          session: withdrawSession,
          stepsElement: <BorrowStepsPage />,
        }
      );

      yield* Effect.promise(() =>
        expect.element(app.getByText("Withdrawal failed")).toBeInTheDocument()
      );
      expect(app.container.textContent).not.toContain(
        "Borrow transaction failed"
      );
    })
  );

  it.live("renders retryable failure and routes after retry succeeds", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(
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

      yield* Effect.promise(() =>
        expect.element(app.getByTestId("retry")).toBeInTheDocument()
      );

      yield* Effect.promise(() => userEvent.click(app.getByTestId("retry")));

      yield* Effect.promise(() =>
        expect
          .element(app.getByTestId("complete"))
          .toHaveTextContent("/borrow/complete action-1")
      );
    })
  );

  it.live("retries after reconnecting without signing twice", () =>
    Effect.gen(function* () {
      let state: NormalizedWalletState = disconnectedNormalizedWalletState;
      const signTransaction = vi.fn((_input: unknown) =>
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
        // WalletService checks the expected owner on the signing command
        // itself and signs nothing while the wallet is disconnected.
        signTransaction: (input: unknown) =>
          state.status === "connected"
            ? signTransaction(input)
            : Effect.fail(
                new WalletOwnerMismatchError({
                  operation: "transaction",
                  reason: "disconnected",
                })
              ),
      };
      const app = yield* renderExecution(
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

      yield* Effect.promise(() =>
        expect.element(app.getByTestId("retry")).toBeInTheDocument()
      );
      expect(signTransaction).not.toHaveBeenCalled();

      state = connectedWalletState;
      yield* Effect.promise(() => userEvent.click(app.getByTestId("retry")));

      yield* Effect.promise(() =>
        expect
          .element(app.getByTestId("complete"))
          .toHaveTextContent("/borrow/complete action-1")
      );
      expect(signTransaction).toHaveBeenCalledOnce();
    })
  );

  it.live(
    "shows the next action step while retaining prior transaction batches",
    () =>
      Effect.gen(function* () {
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
        const app = yield* renderExecution(
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

        yield* Effect.promise(() =>
          expect
            .element(app.getByTestId("action-step"))
            .toHaveTextContent("2/2")
        );
        yield* Effect.promise(() =>
          expect.element(app.getByTestId("batch-count")).toHaveTextContent("2")
        );
        yield* Effect.promise(() =>
          expect
            .element(app.getByTestId("current-transaction"))
            .toHaveTextContent("tx-2")
        );
        yield* Effect.promise(() =>
          expect.element(app.getByTestId("phase")).toHaveTextContent("signing")
        );
      })
  );

  it.live(
    "returns to a fresh Review without resuming an abandoned workflow from browser history",
    () =>
      Effect.gen(function* () {
        const confirmationInterrupted = yield* Deferred.make<void>();
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
        const app = yield* renderExecution(borrow, {
          action: decodedAction(),
          historyControls: true,
          initialEntries: ["/borrow", "/borrow/review"],
          initialIndex: 1,
          stepsElement: <BorrowStepsPage />,
          wallet: activeWallet,
        });

        yield* Effect.promise(() =>
          expect
            .element(app.getByTestId("history-path"))
            .toHaveTextContent("/borrow/steps")
        );

        yield* Effect.promise(() =>
          vi.waitFor(() => {
            expect(signTransaction).toHaveBeenCalledOnce();
            expect(borrow.submitTransaction).toHaveBeenCalledOnce();
            expect(borrow.getAction).toHaveBeenCalledOnce();
          })
        );

        yield* Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Back" }))
        );
        yield* Effect.promise(() =>
          expect
            .element(app.getByTestId("history-path"))
            .toHaveTextContent("/borrow/review")
        );
        yield* Deferred.await(confirmationInterrupted);

        yield* Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Back" }))
        );
        yield* Effect.promise(() =>
          expect
            .element(app.getByTestId("history-path"))
            .toHaveTextContent("/borrow")
        );
        yield* Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Forward" }))
        );
        // Forward reopens Review with a fresh Session; execution needs a new Confirm.
        yield* Effect.promise(() =>
          expect
            .element(app.getByTestId("history-path"))
            .toHaveTextContent("/borrow/review")
        );
        yield* Effect.promise(() =>
          expect.element(app.getByTestId("start-execution")).toBeInTheDocument()
        );

        expect(
          app.container.querySelector('[data-rk="borrow-steps-page"]')
        ).not.toBeInTheDocument();
        expect(signTransaction).toHaveBeenCalledOnce();
        expect(borrow.submitTransaction).toHaveBeenCalledOnce();
      })
  );
});
