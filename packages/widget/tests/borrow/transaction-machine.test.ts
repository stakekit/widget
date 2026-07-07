import { Cause, Effect, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import {
  Action as BorrowAction,
  BorrowExecutionKey,
  type BorrowExecutionMachineState,
  BorrowTransactionFailedError,
  BorrowTransactionNotConfirmedError,
  type BorrowWalletExecutionAdapter,
  borrowCreateActionAtom,
  borrowExecutionAtom,
  borrowWalletExecutionAdapterAtom,
} from "../../src/borrow";
import type {
  ActionDto,
  ActionsControllerExecuteActionV1RequestJson,
  SubmitTransactionDto,
  TransactionDto,
} from "../../src/generated/api/borrow";
import { stakeKitEffectApiClientAtom } from "../../src/providers/effect-atom-runtime/stakekit-api-service";

const address = "0x0000000000000000000000000000000000000001";
const transactionHash =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

const request: ActionsControllerExecuteActionV1RequestJson = {
  action: "borrow",
  address,
  args: {
    amount: "25",
    marketId: "morpho-blue-borrow-base-cbbtc-usdc-86",
    tokenAddress: "0x0000000000000000000000000000000000000002",
  },
  integrationId: "morpho-blue",
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

const walletAdapter = ({
  broadcasted = true,
  signedTx = transactionHash,
}: {
  readonly broadcasted?: boolean;
  readonly signedTx?: string;
} = {}): BorrowWalletExecutionAdapter => ({
  getState: () => ({ status: "connected" }) as never,
  signTransaction: () =>
    Effect.succeed({
      broadcasted,
      signedTx,
    }),
});

const createRegistry = ({
  executeAction = action(),
  getActions = [],
  stepActions = [],
  wallet = walletAdapter(),
}: {
  readonly executeAction?: ActionDto;
  readonly getActions?: ReadonlyArray<ActionDto>;
  readonly stepActions?: ReadonlyArray<ActionDto>;
  readonly wallet?: BorrowWalletExecutionAdapter;
}) => {
  const queuedGetActions = [...getActions];
  const queuedStepActions = [...stepActions];
  const ActionsControllerExecuteActionV1 = vi.fn(() =>
    Effect.succeed(executeAction)
  );
  const ActionsControllerGetActionV1 = vi.fn(() =>
    Effect.succeed(
      queuedGetActions.shift() ?? getActions.at(-1) ?? executeAction
    )
  );
  const ActionsControllerStepV1 = vi.fn(() =>
    Effect.succeed(
      queuedStepActions.shift() ?? stepActions.at(-1) ?? executeAction
    )
  );
  const TransactionsControllerSubmitTransactionV1 = vi.fn(
    (
      _transactionId: string,
      _options: { readonly payload: SubmitTransactionDto }
    ) =>
      Effect.succeed({
        link: "https://basescan.org/tx/0x111",
        status: "BROADCASTED" as const,
        transactionHash,
      })
  );
  const registry = AtomRegistry.make({
    initialValues: [
      Atom.initialValue(stakeKitEffectApiClientAtom, {
        borrow: {
          ActionsControllerExecuteActionV1,
          ActionsControllerGetActionV1,
          ActionsControllerStepV1,
          TransactionsControllerSubmitTransactionV1,
        },
      } as never),
      Atom.initialValue(borrowWalletExecutionAdapterAtom, wallet),
    ],
  });

  return {
    operations: {
      ActionsControllerExecuteActionV1,
      ActionsControllerGetActionV1,
      ActionsControllerStepV1,
      TransactionsControllerSubmitTransactionV1,
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
    expect(operations.ActionsControllerExecuteActionV1).toHaveBeenCalledWith({
      payload: request,
    });
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
    expect(operations.ActionsControllerExecuteActionV1).not.toHaveBeenCalled();
    expect(
      operations.TransactionsControllerSubmitTransactionV1
    ).toHaveBeenCalledWith("tx-1", {
      payload: { transactionHash },
    });
  });

  it("submits signed-only wallet output as signed payload", async () => {
    const signedPayload = "0xsigned-payload";
    const { operations, registry } = createRegistry({
      getActions: [
        action({
          status: "SUCCESS",
          transactions: [transaction({ status: "CONFIRMED" })],
        }),
      ],
      wallet: walletAdapter({
        broadcasted: false,
        signedTx: signedPayload,
      }),
    });

    await waitForExecution(
      registry,
      executionAtom(),
      (candidate) => AsyncResult.isSuccess(candidate) && candidate.value.isDone
    );

    expect(
      operations.TransactionsControllerSubmitTransactionV1
    ).toHaveBeenCalledWith("tx-1", {
      payload: { signedPayload },
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
    expect(
      operations.TransactionsControllerSubmitTransactionV1
    ).toHaveBeenCalledTimes(2);
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
    expect(operations.ActionsControllerStepV1).toHaveBeenCalledWith(
      "action-1",
      undefined
    );
    expect(
      operations.TransactionsControllerSubmitTransactionV1
    ).toHaveBeenCalledTimes(2);
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
