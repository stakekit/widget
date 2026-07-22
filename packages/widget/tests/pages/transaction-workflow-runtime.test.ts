import { Deferred, Effect, Fiber, Layer, Option, Schema, Stream } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it, vi } from "vitest";
import { Action } from "../../src/domain/borrow/action";
import { Transaction } from "../../src/domain/borrow/transaction";
import type { ActionTransaction } from "../../src/domain/schema/action-models";
import { WalletAddress, YieldId } from "../../src/domain/schema/identifiers";
import type { ActionMeta } from "../../src/public-api/types";
import {
  ActivityInvalidationKey,
  SingleYieldBalancesInvalidationKey,
  WalletBalancesInvalidationKey,
  YieldPositionsInvalidationKey,
} from "../../src/services/resource-invalidation";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import {
  BorrowTransactionWorkflowInput,
  ClassicTransactionWorkflowInput,
  type TransactionWorkflowState,
} from "../../src/services/workflow/transaction-workflow-model";
import {
  getTransactionWorkflowSubmissionInvalidationKeys,
  TransactionWorkflowOperationsService,
} from "../../src/services/workflow/transaction-workflow-operations-service";
import {
  type TransactionWorkflowHandle,
  TransactionWorkflowService,
} from "../../src/services/workflow/transaction-workflow-service";
import { yieldApiTransactionFixture } from "../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const otherAddress = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000009"
);
const yieldId = Schema.decodeSync(YieldId)("yield-1");
const classicWalletScope = new WalletScopeKey({
  address,
  network: "ethereum",
});
const borrowWalletScope = new WalletScopeKey({ address, network: "base" });
const signedPayload = "0xsigned-payload";
const transactionHash =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const actionMeta = {
  actionId: "classic-action-1",
  actionType: "stake",
  address,
  amount: "1",
  inputToken: undefined,
  providersDetails: [],
  yieldId,
} as unknown as ActionMeta;

type TransactionWorkflowOperations =
  TransactionWorkflowOperationsService["Service"];

const classicTransaction = (
  id: string,
  overrides: Partial<ActionTransaction> = {}
) =>
  yieldApiTransactionFixture({
    id,
    network: "ethereum",
    status: "CREATED",
    stepIndex: 0,
    unsignedTransaction: "unsigned-payload",
    ...overrides,
  });

const borrowTransaction = (
  id: string,
  overrides: Record<string, unknown> = {}
) =>
  Schema.decodeUnknownSync(Transaction)({
    address,
    chainId: "8453",
    id,
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

const borrowAction = ({
  currentStep = 1,
  hasNextStep = false,
  id = "borrow-action-1",
  status = "CREATED",
  totalSteps = 1,
  transactions = [borrowTransaction("borrow-1")],
}: {
  readonly currentStep?: number;
  readonly hasNextStep?: boolean;
  readonly id?: string;
  readonly status?: string;
  readonly totalSteps?: number;
  readonly transactions?: ReadonlyArray<Transaction>;
} = {}) =>
  Schema.decodeUnknownSync(Action)({
    address,
    action: "borrow",
    createdAt: "2026-07-10T12:00:00.000Z",
    currentStep,
    hasNextStep,
    id,
    integrationId: "morpho-blue",
    status,
    totalSteps,
    transactions: transactions.map((transaction) =>
      Schema.encodeSync(Transaction)(transaction)
    ),
  });

const walletState = (
  network: "base" | "ethereum",
  walletAddress = address
) => ({
  address: walletAddress,
  network,
  status: "connected",
});

const makeOperations = (
  overrides: Partial<Record<keyof TransactionWorkflowOperations, unknown>> = {}
): TransactionWorkflowOperations =>
  ({
    completeWorkflow: () => Effect.void,
    getBorrowAction: () => Effect.succeed(null),
    getClassicStatus: () =>
      Effect.succeed({
        explorerUrl: "https://explorer.test/tx",
        status: "CONFIRMED",
      }),
    getWalletState: Effect.succeed(walletState("ethereum")),
    signMessage: () => Effect.succeed(signedPayload),
    signTransaction: () =>
      Effect.succeed({ broadcasted: false, signedTx: signedPayload }),
    stepBorrowAction: () => Effect.die("unexpected borrow step"),
    submitBorrowTransaction: () =>
      Effect.succeed({
        link: "https://explorer.test/borrow",
        status: "BROADCASTED",
        transactionHash,
      }),
    submitClassicHash: () => Effect.void,
    submitClassicSigned: () => Effect.void,
    submitWorkflow: () => Effect.void,
    trackEvent: () => Effect.void,
    ...overrides,
  }) as unknown as TransactionWorkflowOperations;

const makeWorkflowFromService = ({
  key,
  operations,
}: {
  readonly key:
    | ClassicTransactionWorkflowInput
    | BorrowTransactionWorkflowInput;
  readonly operations: TransactionWorkflowOperations;
}) =>
  TransactionWorkflowService.use(({ make }) => make(key)).pipe(
    Effect.provide(
      TransactionWorkflowService.layer.pipe(
        Layer.provide(
          Layer.succeed(TransactionWorkflowOperationsService, operations)
        )
      )
    )
  );

const waitForState = (
  machine: TransactionWorkflowHandle,
  predicate: (state: TransactionWorkflowState) => boolean
) =>
  machine.states.pipe(
    Stream.filter(predicate),
    Stream.runHead,
    Effect.forkChild
  );

const runToCompletion = (
  key: ClassicTransactionWorkflowInput | BorrowTransactionWorkflowInput,
  operations: TransactionWorkflowOperations
) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const machine = yield* makeWorkflowFromService({ key, operations });
        const completed = yield* waitForState(
          machine,
          (state) => state._tag === "Completed"
        );
        const finalState = Option.getOrThrow(yield* Fiber.join(completed));
        const events = yield* machine.events.pipe(
          Stream.takeUntil(
            (event) => event._tag === "TransactionWorkflowCompleted"
          ),
          Stream.runCollect
        );

        return { events: Array.from(events), finalState };
      })
    )
  );

describe("transaction workflow runtime", () => {
  it("invalidates a submitted classic workflow before confirmation", async () => {
    const getClassicStatus = vi.fn(() => Effect.never);
    const submittedKey = new ClassicTransactionWorkflowInput({
      actionMeta,
      transactions: [classicTransaction("submitted-before-route-exit")],
      walletScope: classicWalletScope,
      yieldId,
    });
    let invalidatedKeys: ReadonlyArray<unknown> = [];
    const submitWorkflow = vi.fn(
      (workflowKey: ClassicTransactionWorkflowInput) =>
        Effect.sync(() => {
          invalidatedKeys =
            getTransactionWorkflowSubmissionInvalidationKeys(workflowKey);
        })
    );

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* makeWorkflowFromService({
            key: submittedKey,
            operations: makeOperations({
              getClassicStatus,
              submitClassicSigned: () => Effect.void,
              submitWorkflow,
            }),
          });

          yield* Effect.promise(() =>
            vi.waitFor(() =>
              expect(submitWorkflow).toHaveBeenCalledWith(submittedKey)
            )
          );
        })
      )
    );

    expect(invalidatedKeys).toEqual([
      new WalletBalancesInvalidationKey({ scope: classicWalletScope }),
      new YieldPositionsInvalidationKey({ scope: classicWalletScope }),
      new SingleYieldBalancesInvalidationKey({
        address: classicWalletScope.address,
      }),
      new ActivityInvalidationKey({ scope: classicWalletScope }),
    ]);
    expect(getClassicStatus).toHaveBeenCalledOnce();
  });

  it("awaits semantic invalidation before completion and skips it on failure", async () => {
    const invalidationStarted = await Effect.runPromise(
      Deferred.make<ClassicTransactionWorkflowInput>()
    );
    const invalidationRelease = await Effect.runPromise(Deferred.make<void>());
    const completedKey = new ClassicTransactionWorkflowInput({
      actionMeta,
      transactions: [classicTransaction("awaited-invalidation")],
      walletScope: classicWalletScope,
      yieldId,
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const machine = yield* makeWorkflowFromService({
            key: completedKey,
            operations: makeOperations({
              completeWorkflow: (
                workflowKey: ClassicTransactionWorkflowInput
              ) =>
                Deferred.succeed(invalidationStarted, workflowKey).pipe(
                  Effect.andThen(Deferred.await(invalidationRelease))
                ),
            }),
          });
          const completed = yield* waitForState(
            machine,
            (state) => state._tag === "Completed"
          );

          expect(yield* Deferred.await(invalidationStarted)).toEqual(
            completedKey
          );
          expect(completed.pollUnsafe()).toBeUndefined();

          yield* Deferred.succeed(invalidationRelease, undefined);
          expect(Option.getOrThrow(yield* Fiber.join(completed))._tag).toBe(
            "Completed"
          );
        })
      )
    );

    const completeWorkflow = vi.fn(() => Effect.void);
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const machine = yield* makeWorkflowFromService({
            key: new ClassicTransactionWorkflowInput({
              actionMeta,
              transactions: [classicTransaction("failed-before-invalidation")],
              walletScope: classicWalletScope,
              yieldId,
            }),
            operations: makeOperations({
              completeWorkflow,
              signTransaction: () => Effect.fail(new Error("rejected")),
            }),
          });
          const failed = yield* waitForState(
            machine,
            (state) => state._tag === "SignFailed"
          );
          yield* Fiber.join(failed);
        })
      )
    );

    expect(completeWorkflow).not.toHaveBeenCalled();
  });

  it("auto-starts classic signed-payload and broadcast submission paths", async () => {
    const submitSigned = vi.fn(() => Effect.void);
    const signed = await runToCompletion(
      new ClassicTransactionWorkflowInput({
        actionMeta,
        transactions: [classicTransaction("classic-signed")],
        walletScope: classicWalletScope,
        yieldId,
      }),
      makeOperations({ submitClassicSigned: submitSigned })
    );

    expect(submitSigned).toHaveBeenCalledWith({
      payload: { signedTransaction: signedPayload },
      transactionId: "classic-signed",
    });
    expect(signed.events.map(({ _tag }) => _tag)).toEqual([
      "TransactionWorkflowSigned",
      "TransactionWorkflowSubmitted",
      "TransactionWorkflowCompleted",
    ]);

    const submitHash = vi.fn(() => Effect.void);
    await runToCompletion(
      new ClassicTransactionWorkflowInput({
        actionMeta,
        transactions: [classicTransaction("classic-broadcast")],
        walletScope: classicWalletScope,
        yieldId,
      }),
      makeOperations({
        signTransaction: () =>
          Effect.succeed({ broadcasted: true, signedTx: transactionHash }),
        submitClassicHash: submitHash,
      })
    );

    expect(submitHash).toHaveBeenCalledWith({
      payload: { hash: transactionHash },
      transactionId: "classic-broadcast",
    });
  });

  it("uses one phase-accurate retry and ignores duplicate stale retries", async () => {
    let signAttempts = 0;
    let submitAttempts = 0;
    const operations = makeOperations({
      signTransaction: () =>
        Effect.suspend(() => {
          signAttempts += 1;
          return signAttempts === 1
            ? Effect.fail(new Error("sign failed"))
            : Effect.succeed({
                broadcasted: false as const,
                signedTx: signedPayload,
              });
        }) as never,
      submitClassicSigned: () =>
        Effect.suspend(() => {
          submitAttempts += 1;
          return submitAttempts === 1
            ? Effect.fail(new Error("submit failed"))
            : Effect.void;
        }),
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const machine = yield* makeWorkflowFromService({
            key: new ClassicTransactionWorkflowInput({
              actionMeta,
              transactions: [classicTransaction("retry")],
              walletScope: classicWalletScope,
              yieldId,
            }),
            operations,
          });
          const signFailed = yield* waitForState(
            machine,
            (state) => state._tag === "SignFailed"
          );
          yield* Fiber.join(signFailed);

          const submitFailed = yield* waitForState(
            machine,
            (state) => state._tag === "SubmissionFailed"
          );
          yield* machine.dispatch({ _tag: "Retry" });
          yield* machine.dispatch({ _tag: "Retry" });
          yield* Fiber.join(submitFailed);
          expect({ signAttempts, submitAttempts }).toEqual({
            signAttempts: 2,
            submitAttempts: 1,
          });

          const completed = yield* waitForState(
            machine,
            (state) => state._tag === "Completed"
          );
          yield* machine.dispatch({ _tag: "Retry" });
          yield* Fiber.join(completed);
        })
      )
    );

    expect({ signAttempts, submitAttempts }).toEqual({
      signAttempts: 2,
      submitAttempts: 2,
    });
  });

  it("validates wallet identity and borrow payloads before signing", async () => {
    const action = borrowAction();
    const key = new BorrowTransactionWorkflowInput({
      action,
      walletScope: borrowWalletScope,
    });
    const wrongWallet = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const machine = yield* makeWorkflowFromService({
            key,
            operations: makeOperations({
              getWalletState: Effect.succeed(walletState("base", otherAddress)),
            }),
          });
          const failed = yield* waitForState(
            machine,
            (state) => state._tag === "SignFailed"
          );
          return Option.getOrThrow(yield* Fiber.join(failed));
        })
      )
    );
    expect(wrongWallet).toMatchObject({
      _tag: "SignFailed",
      error: { _tag: "TransactionSignError", transactionId: "borrow-1" },
    });

    const invalidAction = borrowAction({
      id: "borrow-invalid",
      transactions: [
        borrowTransaction("invalid", { signablePayload: "not-json" }),
      ],
    });
    const invalidPayload = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const machine = yield* makeWorkflowFromService({
            key: new BorrowTransactionWorkflowInput({
              action: invalidAction,
              walletScope: borrowWalletScope,
            }),
            operations: makeOperations({
              getWalletState: Effect.succeed(walletState("base")),
            }),
          });
          const failed = yield* waitForState(
            machine,
            (state) => state._tag === "SignFailed"
          );
          return Option.getOrThrow(yield* Fiber.join(failed));
        })
      )
    );
    expect(invalidPayload).toMatchObject({
      _tag: "SignFailed",
      error: {
        _tag: "TransactionSignError",
        message: "Borrow transaction payload could not be decoded.",
      },
    });
  });

  it("normalizes borrow signed and broadcast submissions", async () => {
    const confirmed = (action: Action) =>
      borrowAction({
        id: action.id,
        status: "SUCCESS",
        transactions: action.transactions.map((transaction) =>
          borrowTransaction(transaction.id, { status: "CONFIRMED" })
        ),
      });

    for (const broadcasted of [false, true]) {
      const action = borrowAction({ id: `borrow-${broadcasted}` });
      const submit = vi.fn(() =>
        Effect.succeed({
          link: "https://explorer.test/borrow",
          status: "BROADCASTED" as const,
          transactionHash,
        })
      );
      const result = await runToCompletion(
        new BorrowTransactionWorkflowInput({
          action,
          walletScope: borrowWalletScope,
        }),
        makeOperations({
          getBorrowAction: () => Effect.succeed(confirmed(action)),
          getWalletState: Effect.succeed(walletState("base")),
          signTransaction: () =>
            Effect.succeed({
              broadcasted,
              signedTx: broadcasted ? transactionHash : signedPayload,
            }) as never,
          submitBorrowTransaction: submit,
        })
      );
      const submission = result.finalState.context.submissions[0];

      expect(submit).toHaveBeenCalledWith({
        command: broadcasted
          ? { transactionHash }
          : { signedPayload: signedPayload },
        transactionId: "borrow-1",
      });
      expect(submission).toMatchObject({
        hash: transactionHash,
        link: "https://explorer.test/borrow",
        signedPayload: broadcasted ? null : signedPayload,
      });
    }
  });

  it("polls on schedule and interrupts polling with its scope", async () => {
    let checks = 0;
    const firstCheck = await Effect.runPromise(Deferred.make<void>());
    const operations = makeOperations({
      getClassicStatus: () =>
        Effect.gen(function* () {
          checks += 1;
          yield* Deferred.succeed(firstCheck, undefined);
          return { explorerUrl: null, status: "PENDING" as const };
        }),
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* Effect.scoped(
          Effect.gen(function* () {
            yield* makeWorkflowFromService({
              key: new ClassicTransactionWorkflowInput({
                actionMeta,
                transactions: [classicTransaction("pending")],
                walletScope: classicWalletScope,
                yieldId,
              }),
              operations,
            });
            yield* Deferred.await(firstCheck);
          })
        );

        yield* TestClock.adjust("1 minute");
        yield* Effect.yieldNow;
      }).pipe(Effect.provide(TestClock.layer()))
    );

    expect(checks).toBe(1);
  });

  it("uses the classic confirmation interval and exhausts its attempt limit", async () => {
    let checks = 0;
    const firstCheck = await Effect.runPromise(Deferred.make<void>());
    const failed = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const machine = yield* makeWorkflowFromService({
            key: new ClassicTransactionWorkflowInput({
              actionMeta,
              transactions: [classicTransaction("exhausted")],
              walletScope: classicWalletScope,
              yieldId,
            }),
            operations: makeOperations({
              getClassicStatus: () =>
                Effect.gen(function* () {
                  checks += 1;
                  if (checks === 1) {
                    yield* Deferred.succeed(firstCheck, undefined);
                  }

                  return { explorerUrl: null, status: "PENDING" as const };
                }),
            }),
          });
          const failedState = yield* waitForState(
            machine,
            (state) => state._tag === "ConfirmationFailed"
          );
          yield* Deferred.await(firstCheck);
          expect(checks).toBe(1);
          yield* TestClock.adjust("3999 millis");
          expect(checks).toBe(1);
          yield* TestClock.adjust("1 millis");
          expect(checks).toBe(2);
          yield* TestClock.adjust("5 minutes");

          return Option.getOrThrow(yield* Fiber.join(failedState));
        }).pipe(Effect.provide(TestClock.layer()))
      )
    );

    expect(checks).toBe(75);
    expect(failed).toMatchObject({
      _tag: "ConfirmationFailed",
      error: { _tag: "TransactionConfirmationError" },
    });
  });

  it("processes multiple borrow transactions in one batch", async () => {
    const first = borrowAction({
      transactions: [
        borrowTransaction("borrow-1"),
        borrowTransaction("borrow-2"),
      ],
    });
    const firstConfirmed = borrowAction({
      transactions: [
        borrowTransaction("borrow-1", { status: "CONFIRMED" }),
        borrowTransaction("borrow-2"),
      ],
    });
    const completed = borrowAction({
      status: "SUCCESS",
      transactions: [
        borrowTransaction("borrow-1", { status: "CONFIRMED" }),
        borrowTransaction("borrow-2", { status: "CONFIRMED" }),
      ],
    });
    let checks = 0;
    const result = await runToCompletion(
      new BorrowTransactionWorkflowInput({
        action: first,
        walletScope: borrowWalletScope,
      }),
      makeOperations({
        getBorrowAction: () => {
          checks += 1;
          return Effect.succeed(checks === 1 ? firstConfirmed : completed);
        },
        getWalletState: Effect.succeed(walletState("base")),
      })
    );

    expect(result.finalState.context.batches).toHaveLength(1);
    expect(result.finalState.context.submissions).toHaveLength(2);
    expect(
      result.finalState.context.batches[0]?.transactions.every(
        ({ meta }) => meta.done
      )
    ).toBe(true);
  });

  it("preserves history and event order across borrow transaction batches", async () => {
    const first = borrowAction({
      hasNextStep: true,
      totalSteps: 2,
      transactions: [borrowTransaction("borrow-1")],
    });
    const firstConfirmed = borrowAction({
      hasNextStep: true,
      totalSteps: 2,
      transactions: [borrowTransaction("borrow-1", { status: "CONFIRMED" })],
    });
    const second = borrowAction({
      currentStep: 2,
      id: first.id,
      totalSteps: 2,
      transactions: [borrowTransaction("borrow-2")],
    });
    const secondConfirmed = borrowAction({
      currentStep: 2,
      id: first.id,
      status: "SUCCESS",
      totalSteps: 2,
      transactions: [borrowTransaction("borrow-2", { status: "CONFIRMED" })],
    });
    let checks = 0;
    const result = await runToCompletion(
      new BorrowTransactionWorkflowInput({
        action: first,
        walletScope: borrowWalletScope,
      }),
      makeOperations({
        getBorrowAction: () => {
          checks += 1;
          return Effect.succeed(
            checks === 1 ? firstConfirmed : secondConfirmed
          );
        },
        getWalletState: Effect.succeed(walletState("base")),
        stepBorrowAction: () => Effect.succeed(second),
      })
    );

    expect(result.finalState.context.batches.map(({ id }) => id)).toEqual([
      "borrow-step-1",
      "borrow-step-2",
    ]);
    expect(result.finalState.context.submissions).toHaveLength(2);
    expect(result.events.map(({ _tag }) => _tag)).toEqual([
      "TransactionWorkflowSigned",
      "TransactionWorkflowSubmitted",
      "TransactionWorkflowBatchAdvanced",
      "TransactionWorkflowSigned",
      "TransactionWorkflowSubmitted",
      "TransactionWorkflowCompleted",
    ]);
  });

  it("reconciles an ambiguous failed borrow advancement before retrying", async () => {
    const first = borrowAction({ hasNextStep: true, totalSteps: 2 });
    const firstConfirmed = borrowAction({
      hasNextStep: true,
      totalSteps: 2,
      transactions: [borrowTransaction("borrow-1", { status: "CONFIRMED" })],
    });
    const second = borrowAction({
      currentStep: 2,
      id: first.id,
      status: "SUCCESS",
      totalSteps: 2,
      transactions: [],
    });
    let statusChecks = 0;
    const step = vi.fn(() => Effect.fail(new Error("response lost")));

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const machine = yield* makeWorkflowFromService({
            key: new BorrowTransactionWorkflowInput({
              action: first,
              walletScope: borrowWalletScope,
            }),
            operations: makeOperations({
              getBorrowAction: () => {
                statusChecks += 1;
                return Effect.succeed(
                  statusChecks === 1 ? firstConfirmed : second
                );
              },
              getWalletState: Effect.succeed(walletState("base")),
              stepBorrowAction: step,
            }),
          });
          const failed = yield* waitForState(
            machine,
            (state) => state._tag === "AdvanceFailed"
          );
          yield* Fiber.join(failed);
          const completed = yield* waitForState(
            machine,
            (state) => state._tag === "Completed"
          );
          yield* machine.dispatch({ _tag: "Retry" });
          yield* Fiber.join(completed);
        })
      )
    );

    expect(step).toHaveBeenCalledTimes(1);
  });

  it("uses a reconciled next batch without repeating an ambiguous borrow step", async () => {
    const first = borrowAction({ hasNextStep: true, totalSteps: 2 });
    const firstConfirmed = borrowAction({
      hasNextStep: true,
      totalSteps: 2,
      transactions: [borrowTransaction("borrow-1", { status: "CONFIRMED" })],
    });
    const second = borrowAction({
      currentStep: 2,
      id: first.id,
      totalSteps: 2,
      transactions: [borrowTransaction("borrow-2")],
    });
    const secondCompleted = borrowAction({
      currentStep: 2,
      id: first.id,
      status: "SUCCESS",
      totalSteps: 2,
      transactions: [borrowTransaction("borrow-2", { status: "CONFIRMED" })],
    });
    let statusChecks = 0;
    const step = vi.fn(() => Effect.fail(new Error("response lost")));

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const machine = yield* makeWorkflowFromService({
            key: new BorrowTransactionWorkflowInput({
              action: first,
              walletScope: borrowWalletScope,
            }),
            operations: makeOperations({
              getBorrowAction: () => {
                statusChecks += 1;
                return Effect.succeed(
                  statusChecks === 1
                    ? firstConfirmed
                    : statusChecks === 2
                      ? second
                      : secondCompleted
                );
              },
              getWalletState: Effect.succeed(walletState("base")),
              stepBorrowAction: step,
            }),
          });
          const failed = yield* waitForState(
            machine,
            (state) => state._tag === "AdvanceFailed"
          );
          yield* Fiber.join(failed);
          const completed = yield* waitForState(
            machine,
            (state) => state._tag === "Completed"
          );
          yield* machine.dispatch({ _tag: "Retry" });

          return Option.getOrThrow(yield* Fiber.join(completed));
        })
      )
    );

    expect(step).toHaveBeenCalledTimes(1);
    expect(result.context.batches.map(({ id }) => id)).toEqual([
      "borrow-step-1",
      "borrow-step-2",
    ]);
  });
});
