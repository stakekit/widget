import { RegistryProvider, useAtomSet, useAtomValue } from "@effect/atom-react";
import { vi } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import {
  createMemoryRouter,
  createRoutesFromElements,
  Outlet,
  Route,
  RouterProvider,
  useLocation,
  useNavigate,
} from "react-router";
import { base } from "viem/chains";
import type { Connector } from "wagmi";

import { Action as BorrowAction } from "../../../src/domain/borrow/action";
import { ActionCommand } from "../../../src/domain/borrow/action-command";
import type {
  Transaction as BorrowTransaction,
  SubmitTransactionCommand,
} from "../../../src/domain/borrow/transaction";
import {
  TransactionHash,
  WalletAddress,
} from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import type { BorrowTransactionFlowReview } from "../../../src/features/borrow-transaction-flow/model/review";
import { BorrowFlowSession } from "../../../src/features/borrow-transaction-flow/model/session";
import {
  BorrowTransactionFlowExecutionPage,
  BorrowTransactionFlowExecutionRoute,
  BorrowTransactionFlowRoute,
} from "../../../src/features/borrow-transaction-flow/ui/borrow-flow-route";
import {
  useBorrowTransactionFlowExecution,
  useBorrowTransactionFlowReview,
} from "../../../src/features/borrow-transaction-flow/ui/borrow-flow-session";
import { useBorrowExecution } from "../../../src/features/borrow-transaction-flow/ui/use-borrow-execution";
import { WalletScopeRoute } from "../../../src/features/wallet/ui/wallet-scope-route";
import type { SKAppProps } from "../../../src/public-api/react-types";
import { appRuntime } from "../../../src/runtime/app-runtime";
import { walletRuntime } from "../../../src/runtime/wallet-runtime";
import { withResponseDecodeError } from "../../../src/services/api/internal/api-operation";
import type { BorrowOperations } from "../../../src/services/api/operations";
import { ApiRequestError } from "../../../src/services/api/resource-sources";
import { WidgetConfigService } from "../../../src/services/config/widget-config";
import { makeWidgetNavigation } from "../../../src/services/navigation/widget-navigation";
import {
  widgetRoutes,
  widgetTargetPath,
  widgetTargetState,
} from "../../../src/services/navigation/widget-routes";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import type { WalletService } from "../../../src/services/wallet/wallet-service";
import type { NormalizedWalletState } from "../../../src/services/wallet/wallet-state";
import {
  borrowEntryFlowEntry,
  withUnserializedState,
} from "../../utils/borrow-flow-entry";
import { borrowOperationsLayer } from "../../utils/services/borrow-operations";
import { makeTestTracking } from "../../utils/services/tracking-service";
import { makeTestWallet } from "../../utils/services/wallet-service";
import { makeTestNavigation } from "../../utils/services/widget-navigation";
import { makeTransactionWorkflowTestKit } from "../../utils/transaction-workflow-test-kit";
import type { WalletOperations } from "../../utils/wallet-operations";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

const hostConfiguration: SKAppProps = {
  apiKey: "test-api-key",
  borrowEnabled: true,
  dashboardVariant: true,
  variant: "default",
};

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
export const transactionHash = TransactionHash.make(
  "0x1111111111111111111111111111111111111111111111111111111111111111"
);
const walletScope = new WalletScopeKey({ address, network: "base" });
const i18nInstance = createWidgetI18nInstance();

type ActionDto = typeof BorrowAction.Encoded;
type TransactionDto = typeof BorrowTransaction.Encoded;
type SubmitTransactionDto = typeof SubmitTransactionCommand.Encoded;

export const command = Schema.decodeSync(ActionCommand)({
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
export const withdrawSession = new BorrowFlowSession({
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
export const enableCollateralSession = new BorrowFlowSession({
  intake: {
    command: Schema.decodeSync(ActionCommand)({
      action: "enableCollateral",
      address,
      args: {
        marketId: command.args.marketId,
        tokenAddress: "0x0000000000000000000000000000000000000003",
      },
      integrationId: "morpho-blue",
    }),
    entry: borrowEntryFlowEntry,
    riskVerdict: { _tag: "Allow" },
    summary: {
      action: "enableCollateral",
      collateralTokenSymbol: "WETH",
      existingCollateralUsd: "2",
      marketLabel: "WETH",
      network: "base",
      providerName: "Aave V3",
      riskStatus: "unavailable",
      warnings: [],
    },
  },
  walletScope,
});
export const session = new BorrowFlowSession({
  intake: {
    ...reviewState,
    entry: borrowEntryFlowEntry,
  },
  walletScope,
});

export const transaction = (
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

export const action = (overrides: Partial<ActionDto> = {}): ActionDto => ({
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

export const decodedAction = (overrides: Partial<ActionDto> = {}) =>
  Schema.decodeSync(BorrowAction)(action(overrides));

export const connectedWalletState = {
  additionalAddresses: null,
  address,
  chain: base,
  connector: { id: "test", name: "Test Wallet", uid: "test" } as Connector,
  connectorChains: [base],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "base",
  status: "connected",
} satisfies NormalizedWalletState;

export const wallet = {
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

export const makeBorrowApi = ({
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

/** The fake Borrow API a flow test drives. */
export type BorrowApi = ReturnType<typeof makeBorrowApi>;

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
      <button onClick={() => void navigate(-1)} type="button">
        Back
      </button>
      <button onClick={() => void navigate(1)} type="button">
        Forward
      </button>
    </>
  );
};

export type ExecutionOptions = {
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
  /** The connector the flow's wallet state shows, such as the host's. */
  readonly walletConnector?: Connector;
};

/**
 * The Borrow flow's routes from Review to Complete on the given API and
 * wallet, ready to render; Review starts the Execution through the
 * `start-execution` button unless `reviewElement` replaces it.
 */
export const makeExecutionApp = (
  borrow: BorrowApi,
  options: ExecutionOptions = {}
) =>
  Effect.gen(function* () {
    const navigation: {
      current: ReturnType<typeof useNavigate> | null;
    } = { current: null };
    const navigationService = makeWidgetNavigation({
      back: (options) =>
        Effect.sync(() => {
          void navigation.current?.(-(options?.steps ?? 1));
        }),
      push: (to) =>
        Effect.sync(() => {
          void navigation.current?.(widgetTargetPath(to), {
            state: widgetTargetState(to),
          });
        }),
      replace: (to) =>
        Effect.sync(() => {
          void navigation.current?.(widgetTargetPath(to), {
            replace: true,
            state: widgetTargetState(to),
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
    const flowWallet = yield* makeTestWallet({
      addLedgerAccount: activeWallet.addLedgerAccount,
      enabledNetworks: activeWallet.enabledNetworks,
      initialState: {
        connection: options.walletConnector
          ? { ...connectedWalletState, connector: options.walletConnector }
          : connectedWalletState,
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
    // Both runtimes share these services; the registry builds each once.
    const appLayer = Layer.mergeAll(
      borrowOperationsLayer(borrow),
      tracking.layer,
      testNavigation.layer,
      WidgetConfigService.layer(hostConfiguration)
    );
    // Review, Steps, and Complete run their page modules on the wallet
    // runtime. The flow wallet answers the route's wallet-scope check; the
    // workflow signs with the case's wallet.
    const walletLayer = Layer.mergeAll(
      appLayer,
      workflow.layer,
      flowWallet.layer
    );
    // Start hands its Session to the flow route through navigation state,
    // pushing Review over the page it started from.
    const flowState = { borrowFlowSession: options.session ?? session };
    const initialEntries = (
      options.initialEntries ?? [
        "/borrow",
        options.initialPath ?? "/borrow/review",
      ]
    ).map((pathname) =>
      pathname === "/borrow"
        ? pathname
        : withUnserializedState({ pathname }, flowState)
    );

    // Steps guards leaving through a blocker, which needs a data router.
    const router = createMemoryRouter(
      createRoutesFromElements(
        <Route
          element={
            <>
              <NavigationCapture
                capture={(navigate) => (navigation.current = navigate)}
              />
              {options.historyControls ? <HistoryControls /> : null}
              <Outlet />
            </>
          }
        >
          <Route
            element={
              <WalletScopeRoute
                fallbackPath={widgetRoutes.borrow.build("Dashboard")}
                walletState={connectedWalletState}
              />
            }
          >
            <Route path="/borrow" element={<div>Borrow home</div>} />
            <Route
              element={<BorrowTransactionFlowRoute expected="BorrowEntry" />}
            >
              <Route
                path="/borrow/review"
                element={options.reviewElement ?? <StartExecutionProbe />}
              />
              <Route element={<BorrowTransactionFlowExecutionRoute />}>
                <Route
                  path="/borrow/steps"
                  element={
                    <BorrowTransactionFlowExecutionPage page="Steps">
                      {options.stepsElement ?? <ExecutionProbe />}
                    </BorrowTransactionFlowExecutionPage>
                  }
                />
                <Route
                  path="/borrow/complete"
                  element={
                    <BorrowTransactionFlowExecutionPage page="Complete">
                      {options.completeElement ?? <CompleteProbe />}
                    </BorrowTransactionFlowExecutionPage>
                  }
                />
              </Route>
            </Route>
          </Route>
        </Route>
      ),
      {
        initialEntries,
        ...(options.initialIndex === undefined
          ? {}
          : { initialIndex: options.initialIndex }),
      }
    );

    return (
      <I18nextProvider i18n={i18nInstance}>
        <RegistryProvider
          initialValues={[
            applicationRuntimeInitInitialValue(hostConfiguration),
            [appRuntime.layer, appLayer],
            [walletRuntime.layer, walletLayer],
          ]}
        >
          <RouterProvider router={router} />
        </RegistryProvider>
      </I18nextProvider>
    );
  });
