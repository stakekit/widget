import { Cause, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { base } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { appRuntime } from "../../src/app/runtime";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  ActionRequest,
  Action as BorrowAction,
  BorrowExecutionEventsService,
  BorrowExecutionKey,
  type BorrowExecutionMachineState,
  type Transaction as BorrowTransaction,
  BorrowTransactionFailedError,
  BorrowTransactionNotConfirmedError,
  BorrowWalletExecutionService,
  borrowCreateActionAtom,
  borrowExecutionAtom,
  borrowExecutionRuntimeRefreshAtom,
  borrowIntegrationsAtom,
  type SubmitTransactionCommand,
} from "../../src/features/borrow/core";
import type { NormalizedWalletState } from "../../src/features/wallet/state/wallet";
import { BorrowApiService } from "../../src/services/api/borrow-api-service";
import { WalletService } from "../../src/services/wallet/wallet-service";
import type { WalletOperations } from "../utils/wallet-operations";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
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

const walletService = ({
  broadcasted = true,
  signedTx = transactionHash,
}: {
  readonly broadcasted?: boolean;
  readonly signedTx?: string;
} = {}): WalletOperations =>
  ({
    getState: () => connectedWalletState,
    signTransaction: () =>
      Effect.succeed({
        broadcasted,
        signedTx,
      }),
  }) as unknown as WalletOperations;

const defaultWalletService = walletService();

const createRegistry = ({
  executeAction = action(),
  getActions = [],
  stepActions = [],
  wallet = defaultWalletService,
}: {
  readonly executeAction?: ActionDto;
  readonly getActions?: ReadonlyArray<ActionDto>;
  readonly stepActions?: ReadonlyArray<ActionDto>;
  readonly wallet?: WalletOperations;
}) => {
  const queuedGetActions = [...getActions];
  const queuedStepActions = [...stepActions];
  const executeActionOperation = vi.fn(() =>
    Effect.succeed(Schema.decodeUnknownSync(BorrowAction)(executeAction))
  );
  const getActionOperation = vi.fn(() =>
    Effect.succeed(
      Schema.decodeUnknownSync(BorrowAction)(
        queuedGetActions.shift() ?? getActions.at(-1) ?? executeAction
      )
    )
  );
  const stepActionOperation = vi.fn(() =>
    Effect.succeed(
      Schema.decodeUnknownSync(BorrowAction)(
        queuedStepActions.shift() ?? stepActions.at(-1) ?? executeAction
      )
    )
  );
  const submitTransactionOperation = vi.fn(
    (_request: {
      readonly command: SubmitTransactionDto;
      readonly transactionId: string;
    }) =>
      Effect.succeed({
        link: "https://basescan.org/tx/0x111",
        status: "BROADCASTED" as const,
        transactionHash,
      })
  );
  const getIntegrationsOperation = vi.fn(() => Effect.succeed([]));
  const walletLayer = Layer.succeed(
    WalletService,
    wallet as WalletService["Service"]
  );
  const registry = AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(
          Layer.succeed(BorrowApiService, {
            executeAction: executeActionOperation,
            getAction: getActionOperation,
            getIntegrations: getIntegrationsOperation,
            stepAction: stepActionOperation,
            submitTransaction: submitTransactionOperation,
          } as never),
          walletLayer,
          BorrowWalletExecutionService.layer.pipe(Layer.provide(walletLayer)),
          BorrowExecutionEventsService.layer
        ).pipe(Layer.fresh)
      ),
    ],
  });

  return {
    operations: {
      executeAction: executeActionOperation,
      getAction: getActionOperation,
      getIntegrations: getIntegrationsOperation,
      stepAction: stepActionOperation,
      submitTransaction: submitTransactionOperation,
    },
    registry,
  };
};

const waitForExecution = async (
  registry: AtomRegistry.AtomRegistry,
  atom: ReturnType<typeof borrowExecutionAtom>,
  predicate: (
    result: AsyncResult.AsyncResult<BorrowExecutionMachineState, unknown>
  ) => boolean
) => {
  const unmount = registry.mount(atom);

  try {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = registry.get(atom) as AsyncResult.AsyncResult<
        BorrowExecutionMachineState,
        unknown
      >;

      if (predicate(result)) {
        return result;
      }

      await Effect.runPromise(Effect.yieldNow);
    }

    return registry.get(atom) as AsyncResult.AsyncResult<
      BorrowExecutionMachineState,
      unknown
    >;
  } finally {
    unmount();
  }
};

const waitForActionCreation = async (
  registry: AtomRegistry.AtomRegistry,
  predicate: (result: AsyncResult.AsyncResult<BorrowAction, unknown>) => boolean
) => {
  const unmount = registry.mount(borrowCreateActionAtom);

  try {
    registry.set(borrowCreateActionAtom, request);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = registry.get(
        borrowCreateActionAtom
      ) as AsyncResult.AsyncResult<BorrowAction, unknown>;

      if (predicate(result)) {
        return result;
      }

      await Effect.runPromise(Effect.yieldNow);
    }

    return registry.get(borrowCreateActionAtom) as AsyncResult.AsyncResult<
      BorrowAction,
      unknown
    >;
  } finally {
    unmount();
  }
};

const getFailureError = (result: AsyncResult.AsyncResult<unknown, unknown>) => {
  expect(AsyncResult.isFailure(result)).toBe(true);

  if (!AsyncResult.isFailure(result)) {
    throw new Error("Expected execution failure.");
  }

  const error = Cause.findErrorOption(result.cause);

  expect(Option.isSome(error)).toBe(true);

  if (Option.isNone(error)) {
    throw new Error("Expected typed execution error.");
  }

  return error.value;
};

const executionAtom = () =>
  borrowExecutionAtom(
    new BorrowExecutionKey({
      action: decodedAction(),
      confirmationPollAttempts: 0,
      confirmationPollIntervalMs: 0,
    })
  );

describe("borrow transaction machine atom", () => {
  it("creates a borrow action before transaction execution", async () => {
    const { operations, registry } = createRegistry({
      executeAction: action({ id: "action-2" }),
    });
    const result = await waitForActionCreation(registry, AsyncResult.isSuccess);

    expect(AsyncResult.isSuccess(result)).toBe(true);
    if (AsyncResult.isSuccess(result)) {
      expect(result.value.id).toBe("action-2");
    }
    expect(operations.executeAction).toHaveBeenCalledWith(request);
  });

  it("signs, submits, checks, and completes a single transaction", async () => {
    const confirmedAction = action({
      status: "SUCCESS",
      transactions: [transaction({ status: "CONFIRMED" })],
    });
    const { operations, registry } = createRegistry({
      getActions: [confirmedAction],
    });
    const result = await waitForExecution(
      registry,
      executionAtom(),
      (candidate) => AsyncResult.isSuccess(candidate) && candidate.value.isDone
    );

    expect(AsyncResult.isSuccess(result)).toBe(true);
    if (AsyncResult.isSuccess(result)) {
      expect(result.value.action.status).toBe("SUCCESS");
      expect(result.value.submissions).toHaveLength(1);
    }
    expect(operations.executeAction).not.toHaveBeenCalled();
    expect(operations.submitTransaction).toHaveBeenCalledWith({
      command: { transactionHash },
      transactionId: "tx-1",
    });
  });

  it("refreshes borrow resources from feature-scoped execution events", async () => {
    const confirmedAction = action({
      status: "SUCCESS",
      transactions: [transaction({ status: "CONFIRMED" })],
    });
    const { operations, registry } = createRegistry({
      getActions: [confirmedAction],
    });
    const unmountRefresh = registry.mount(borrowExecutionRuntimeRefreshAtom);
    const unmountIntegrations = registry.mount(borrowIntegrationsAtom);

    await vi.waitFor(() => {
      expect(operations.getIntegrations).toHaveBeenCalledOnce();
    });

    await waitForExecution(
      registry,
      executionAtom(),
      (candidate) => AsyncResult.isSuccess(candidate) && candidate.value.isDone
    );

    await vi.waitFor(() => {
      expect(operations.getIntegrations.mock.calls.length).toBeGreaterThan(1);
    });

    unmountIntegrations();
    unmountRefresh();
  });

  it("submits signed-only wallet output as signed payload", async () => {
    const signedPayload = "0xsigned-payload";
    const signedPayloadWallet = walletService({
      broadcasted: false,
      signedTx: signedPayload,
    });
    const { operations, registry } = createRegistry({
      getActions: [
        action({
          status: "SUCCESS",
          transactions: [transaction({ status: "CONFIRMED" })],
        }),
      ],
      wallet: signedPayloadWallet,
    });

    await waitForExecution(
      registry,
      borrowExecutionAtom(
        new BorrowExecutionKey({
          action: decodedAction(),
          confirmationPollAttempts: 0,
          confirmationPollIntervalMs: 0,
        })
      ),
      (candidate) => AsyncResult.isSuccess(candidate) && candidate.value.isDone
    );

    expect(operations.submitTransaction).toHaveBeenCalledWith({
      command: { signedPayload },
      transactionId: "tx-1",
    });
  });

  it("advances through multiple transactions", async () => {
    const tx2 = transaction({ id: "tx-2", status: "WAITING_FOR_SIGNATURE" });
    const { operations, registry } = createRegistry({
      getActions: [
        action({
          status: "PROCESSING",
          transactions: [transaction({ status: "CONFIRMED" }), tx2],
        }),
        action({
          status: "SUCCESS",
          transactions: [
            transaction({ status: "CONFIRMED" }),
            transaction({ id: "tx-2", status: "CONFIRMED" }),
          ],
        }),
      ],
    });

    const result = await waitForExecution(
      registry,
      borrowExecutionAtom(
        new BorrowExecutionKey({
          action: decodedAction({
            transactions: [transaction(), tx2],
          }),
          confirmationPollAttempts: 0,
          confirmationPollIntervalMs: 0,
        })
      ),
      (candidate) => AsyncResult.isSuccess(candidate) && candidate.value.isDone
    );

    expect(AsyncResult.isSuccess(result)).toBe(true);
    if (AsyncResult.isSuccess(result)) {
      expect(result.value.submissions).toHaveLength(2);
    }
    expect(operations.submitTransaction).toHaveBeenCalledTimes(2);
  });

  it("advances through next-step actions", async () => {
    const stepTransaction = transaction({
      id: "tx-2",
      status: "WAITING_FOR_SIGNATURE",
    });
    const { operations, registry } = createRegistry({
      getActions: [
        action({
          hasNextStep: true,
          status: "WAITING_FOR_NEXT",
          transactions: [transaction({ status: "CONFIRMED" })],
        }),
        action({
          currentStep: 2,
          status: "SUCCESS",
          transactions: [
            stepTransaction,
            transaction({ id: "tx-2", status: "CONFIRMED" }),
          ],
        }),
      ],
      stepActions: [
        action({
          currentStep: 2,
          transactions: [stepTransaction],
        }),
      ],
    });

    const result = await waitForExecution(
      registry,
      executionAtom(),
      (candidate) => AsyncResult.isSuccess(candidate) && candidate.value.isDone
    );

    expect(AsyncResult.isSuccess(result)).toBe(true);
    expect(operations.stepAction).toHaveBeenCalledWith("action-1");
    expect(operations.submitTransaction).toHaveBeenCalledTimes(2);
  });

  it("fails with a typed transaction failure", async () => {
    const { registry } = createRegistry({
      getActions: [
        action({
          status: "PROCESSING",
          transactions: [transaction({ status: "FAILED" })],
        }),
      ],
    });
    const result = await waitForExecution(
      registry,
      executionAtom(),
      AsyncResult.isFailure
    );

    expect(getFailureError(result)).toBeInstanceOf(
      BorrowTransactionFailedError
    );
  });

  it("fails with a typed not-confirmed error after polling is exhausted", async () => {
    const { registry } = createRegistry({
      getActions: [
        action({
          status: "PROCESSING",
          transactions: [transaction({ status: "PENDING" })],
        }),
      ],
    });
    const result = await waitForExecution(
      registry,
      executionAtom(),
      AsyncResult.isFailure
    );

    expect(getFailureError(result)).toBeInstanceOf(
      BorrowTransactionNotConfirmedError
    );
  });

  it("fails when action creation returns a failed action", async () => {
    const { registry } = createRegistry({
      executeAction: action({
        status: "FAILED",
        transactions: [],
      }),
    });
    const result = await waitForActionCreation(registry, AsyncResult.isFailure);

    expect(AsyncResult.isFailure(result)).toBe(true);
  });
});
