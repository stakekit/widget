import { RegistryProvider } from "@effect/atom-react";
import { Effect, Layer, Schema } from "effect";
import { useEffect } from "react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { userEvent } from "vitest/browser";
import {
  ActionRequest,
  Action as BorrowAction,
  type Transaction as BorrowTransaction,
  type BorrowWalletExecutionAdapter,
  borrowWalletExecutionAdapterAtom,
  type SubmitTransactionCommand,
} from "../../src/borrow";
import type { BorrowReviewState } from "../../src/pages-dashboard/borrow/review-state";
import { useBorrowExecution } from "../../src/pages-dashboard/borrow/use-borrow-execution";
import {
  StakeKitApiService,
  stakeKitApiLayerAtom,
} from "../../src/providers/effect-atom-runtime/stakekit-api-service";
import { describe, expect, it, vi } from "../utils/test-extend";
import { render } from "../utils/test-utils";

const address = "0x0000000000000000000000000000000000000001";
const transactionHash =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

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

const wallet: BorrowWalletExecutionAdapter = {
  getState: () => ({ status: "connected" }) as never,
  signTransaction: () =>
    Effect.succeed({
      broadcasted: true,
      signedTx: transactionHash,
    }),
};

const makeBorrowApi = ({
  executeAction = Effect.succeed(action()),
  getActions = [],
}: {
  readonly executeAction?: Effect.Effect<ActionDto, never>;
  readonly getActions?: ReadonlyArray<ActionDto>;
}) => {
  const queuedGetActions = [...getActions];

  return {
    ActionsControllerExecuteActionV1: vi.fn(() => executeAction),
    ActionsControllerGetActionV1: vi.fn(() =>
      Effect.succeed(queuedGetActions.shift() ?? getActions.at(-1) ?? action())
    ),
    ActionsControllerStepV1: vi.fn(() => Effect.succeed(action())),
    TransactionsControllerSubmitTransactionV1: vi.fn(
      (
        _transactionId: string,
        _options: { readonly payload: SubmitTransactionDto }
      ) =>
        Effect.succeed({
          link: "https://basescan.org/tx/0x111",
          status: "BROADCASTED" as const,
          transactionHash,
        })
    ),
  };
};

const ExecutionProbe = ({ action }: { readonly action: BorrowAction }) => {
  const execution = useBorrowExecution({ action });
  const navigate = useNavigate();

  useEffect(() => {
    if (!execution.completionResult) {
      return;
    }

    navigate("/borrow/complete", {
      replace: true,
      state: { ...reviewState, action, result: execution.completionResult },
    });
  }, [action, execution.completionResult, navigate]);

  return (
    <div>
      <div data-testid="phase">{execution.phase}</div>
      <div data-testid="running">{String(execution.isRunning)}</div>
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

  return (
    <div data-testid="complete">
      {location.pathname}
      {location.state ? " with-state" : ""}
    </div>
  );
};

const renderExecution = (
  borrow: ReturnType<typeof makeBorrowApi>,
  options: {
    readonly action?: BorrowAction;
    readonly wallet?: BorrowWalletExecutionAdapter;
  } = {}
) =>
  render(
    <RegistryProvider
      initialValues={[
        [
          stakeKitApiLayerAtom,
          Layer.succeed(StakeKitApiService, {
            borrow,
            borrowMutations: borrow,
          } as never),
        ],
        [borrowWalletExecutionAdapterAtom, options.wallet ?? wallet],
      ]}
    >
      <MemoryRouter initialEntries={["/borrow/steps"]}>
        <Routes>
          <Route
            path="/borrow/steps"
            element={
              <ExecutionProbe action={options.action ?? decodedAction()} />
            }
          />
          <Route path="/borrow/complete" element={<CompleteProbe />} />
        </Routes>
      </MemoryRouter>
    </RegistryProvider>
  );

describe("borrow execution flow component", () => {
  it("renders running state while execution waits for wallet signing", async () => {
    const app = await renderExecution(makeBorrowApi({}), {
      wallet: {
        getState: () => ({ status: "connected" }) as never,
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
      .toHaveTextContent("/borrow/complete with-state");

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
      .toHaveTextContent("/borrow/complete with-state");

    app.unmount();
  });
});
