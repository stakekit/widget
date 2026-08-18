import {
  Deferred,
  Effect,
  Exit,
  Fiber,
  Option,
  Schema,
  Scope,
  Stream,
} from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it, vi } from "vitest";
import type { ActionTransaction } from "../../src/domain/action/models";
import { Action } from "../../src/domain/borrow/execution/action";
import { Transaction } from "../../src/domain/borrow/execution/transaction";
import { WalletAddress, YieldId } from "../../src/domain/identity/identifiers";
import type { ActionMeta } from "../../src/public-api/types";
import {
  BorrowOperations,
  YieldOperations,
} from "../../src/services/api/operations";
import {
  type WidgetDomainEvent,
  WidgetDomainEvents,
} from "../../src/services/events/widget-domain-events";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import {
  BorrowTransactionWorkflowInput,
  ClassicTransactionWorkflowInput,
  type TransactionWorkflowState,
} from "../../src/services/transaction-workflow/transaction-workflow-model";
import {
  type TransactionWorkflowHandle,
  TransactionWorkflowService,
} from "../../src/services/transaction-workflow/transaction-workflow-service";
import { WalletSigningError } from "../../src/services/wallet/wallet-errors";
import {
  WalletScopeKey,
  walletScopeOwnerKey,
} from "../../src/services/wallet/wallet-scope";
import { WalletService } from "../../src/services/wallet/wallet-service";
import { yieldApiTransactionFixture } from "../fixtures";
import {
  makeTransactionWorkflowTestLayer,
  type TransactionWorkflowTestCapabilities,
} from "../utils/transaction-workflow-layer";

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

type WorkflowTestCapabilities = Omit<
  TransactionWorkflowTestCapabilities,
  "events"
>;

type CapabilityOverrides<Service> = Partial<Record<keyof Service, unknown>>;

type WorkflowTestCapabilityOverrides = {
  readonly borrow?: CapabilityOverrides<BorrowOperations["Service"]>;
  readonly tracking?: CapabilityOverrides<TrackingService["Service"]>;
  readonly wallet?: CapabilityOverrides<WalletService["Service"]>;
  readonly yieldOperations?: CapabilityOverrides<YieldOperations["Service"]>;
};

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
    rawArguments: {
      amount: "1",
      amountRaw: "1000000",
      marketId: "market-1",
    },
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

const walletServiceState = (connection: ReturnType<typeof walletState>) => ({
  connection,
  ledger: {
    accounts: [],
    currentAccountId: undefined,
    disabledChains: [],
  },
});

const makeCapabilities = (
  overrides: WorkflowTestCapabilityOverrides = {}
): WorkflowTestCapabilities => ({
  borrow: BorrowOperations.of({
    executeAction: () => Effect.die("unexpected borrow execution"),
    getAction: () => Effect.succeed(null),
    stepAction: () => Effect.die("unexpected borrow step"),
    submitTransaction: () =>
      Effect.succeed({
        link: "https://explorer.test/borrow",
        status: "BROADCASTED",
        transactionHash,
      }),
    ...overrides.borrow,
  } as never),
  tracking: TrackingService.of({
    trackEvent: () => Effect.void,
    trackPageView: () => Effect.void,
    ...overrides.tracking,
  } as never),
  wallet: WalletService.of({
    state: Effect.succeed(walletServiceState(walletState("ethereum"))),
    signMessage: () => Effect.succeed(signedPayload),
    signTransaction: () =>
      Effect.succeed({ broadcasted: false, signedTx: signedPayload }),
    ...overrides.wallet,
  } as never),
  yieldOperations: YieldOperations.of({
    getTransactionStatus: () =>
      Effect.succeed({
        explorerUrl: "https://explorer.test/tx",
        status: "CONFIRMED",
      } as never),
    previewAction: () => Effect.die("unexpected action preview"),
    submitSignedTransaction: () => Effect.void,
    submitTransactionHash: () => Effect.void,
    ...overrides.yieldOperations,
  } as never),
});

const makeWorkflowFromService = ({
  events,
  key,
  capabilities,
}: {
  readonly capabilities: WorkflowTestCapabilities;
  readonly events?: WidgetDomainEvents["Service"];
  readonly key:
    | ClassicTransactionWorkflowInput
    | BorrowTransactionWorkflowInput;
}) =>
  TransactionWorkflowService.use(({ make }) => make(key)).pipe(
    Effect.provide(
      makeTransactionWorkflowTestLayer({ ...capabilities, events })
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
  capabilities: WorkflowTestCapabilities
) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const machine = yield* makeWorkflowFromService({ capabilities, key });
        const completed = yield* waitForState(
          machine,
          (state) => state._tag === "Completed"
        );
        const finalState = Option.getOrThrow(yield* Fiber.join(completed));
        return { finalState };
      })
    )
  );

describe("transaction workflow runtime", () => {
  it("publishes owner-scoped lifecycle facts around a successful workflow", async () => {
    const published: Array<WidgetDomainEvent> = [];
    const events = WidgetDomainEvents.of({
      events: Stream.never,
      publish: (event) =>
        Effect.sync(() => {
          published.push(event);
        }),
    });
    const key = new ClassicTransactionWorkflowInput({
      actionMeta,
      transactions: [classicTransaction("lifecycle-events")],
      walletScope: classicWalletScope,
      yieldId,
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const workflowScope = yield* Scope.make();
          yield* makeWorkflowFromService({
            capabilities: makeCapabilities(),
            events,
            key,
          }).pipe(Effect.provideService(Scope.Scope, workflowScope));

          expect(published).toEqual([
            {
              _tag: "TransactionWorkflowStarted",
              owner: walletScopeOwnerKey(classicWalletScope),
            },
          ]);

          yield* Scope.close(workflowScope, Exit.void);
          yield* Scope.close(workflowScope, Exit.void);
        })
      )
    );

    expect(published).toEqual([
      {
        _tag: "TransactionWorkflowStarted",
        owner: walletScopeOwnerKey(classicWalletScope),
      },
      {
        _tag: "TransactionWorkflowEnded",
        owner: walletScopeOwnerKey(classicWalletScope),
        workflowKind: "Classic",
      },
    ]);
  });

  it("closes its state Stream when the workflow Scope closes", async () => {
    const key = new ClassicTransactionWorkflowInput({
      actionMeta,
      transactions: [classicTransaction("scope-close")],
      walletScope: classicWalletScope,
      yieldId,
    });

    const streamExit = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const workflowScope = yield* Scope.make();
          const workflow = yield* makeWorkflowFromService({
            capabilities: makeCapabilities(),
            key,
          }).pipe(Effect.provideService(Scope.Scope, workflowScope));
          const stream = yield* workflow.states.pipe(
            Stream.runDrain,
            Effect.forkChild
          );
          yield* Effect.yieldNow;
          yield* Scope.close(workflowScope, Exit.void);
          return yield* Fiber.await(stream);
        })
      )
    );

    expect(streamExit._tag).toBe("Success");
  });

  it("auto-starts classic signed-payload and broadcast submission paths", async () => {
    const submitSigned = vi.fn(() => Effect.void);
    await runToCompletion(
      new ClassicTransactionWorkflowInput({
        actionMeta,
        transactions: [classicTransaction("classic-signed")],
        walletScope: classicWalletScope,
        yieldId,
      }),
      makeCapabilities({
        yieldOperations: { submitSignedTransaction: submitSigned },
      })
    );

    expect(submitSigned).toHaveBeenCalledWith({
      payload: { signedTransaction: signedPayload },
      transactionId: "classic-signed",
    });

    const submitHash = vi.fn(() => Effect.void);
    await runToCompletion(
      new ClassicTransactionWorkflowInput({
        actionMeta,
        transactions: [classicTransaction("classic-broadcast")],
        walletScope: classicWalletScope,
        yieldId,
      }),
      makeCapabilities({
        wallet: {
          signTransaction: () =>
            Effect.succeed({ broadcasted: true, signedTx: transactionHash }),
        },
        yieldOperations: { submitTransactionHash: submitHash },
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
    const capabilities = makeCapabilities({
      wallet: {
        signTransaction: () =>
          Effect.suspend(() => {
            signAttempts += 1;
            return signAttempts === 1
              ? Effect.fail(
                  new WalletSigningError({
                    cause: new Error("sign failed"),
                    operation: "transaction",
                  })
                )
              : Effect.succeed({
                  broadcasted: false as const,
                  signedTx: signedPayload,
                });
          }),
      },
      yieldOperations: {
        submitSignedTransaction: () =>
          Effect.suspend(() => {
            submitAttempts += 1;
            return submitAttempts === 1
              ? Effect.fail(new Error("submit failed"))
              : Effect.void;
          }),
      },
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const machine = yield* makeWorkflowFromService({
            capabilities,
            key: new ClassicTransactionWorkflowInput({
              actionMeta,
              transactions: [classicTransaction("retry")],
              walletScope: classicWalletScope,
              yieldId,
            }),
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
            capabilities: makeCapabilities({
              wallet: {
                state: Effect.succeed(
                  walletServiceState(walletState("base", otherAddress))
                ),
              },
            }),
            key,
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
      error: {
        _tag: "TransactionSignError",
        reason: { _tag: "WalletUnavailable", detail: "account-changed" },
        transactionId: "borrow-1",
      },
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
            capabilities: makeCapabilities({
              wallet: {
                state: Effect.succeed(walletServiceState(walletState("base"))),
              },
            }),
            key: new BorrowTransactionWorkflowInput({
              action: invalidAction,
              walletScope: borrowWalletScope,
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
        reason: { _tag: "DecodeFailed" },
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
      const signTransaction = vi.fn(
        () =>
          Effect.succeed({
            broadcasted,
            signedTx: broadcasted ? transactionHash : signedPayload,
          }) as never
      );
      const result = await runToCompletion(
        new BorrowTransactionWorkflowInput({
          action,
          walletScope: borrowWalletScope,
        }),
        makeCapabilities({
          borrow: {
            getAction: () => Effect.succeed(confirmed(action)),
            submitTransaction: submit,
          },
          wallet: {
            signTransaction,
            state: Effect.succeed(walletServiceState(walletState("base"))),
          },
        })
      );
      const submission = result.finalState.context.submissions[0];

      expect(signTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          family: "borrow",
          txMeta: {
            actionId: `borrow-${broadcasted}`,
            actionType: "borrow",
            address,
            integrationId: "morpho-blue",
            rawArguments: {
              amount: "1",
              amountRaw: "1000000",
              marketId: "market-1",
            },
            txId: "borrow-1",
            txType: "BORROW",
          },
        })
      );
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
    const capabilities = makeCapabilities({
      yieldOperations: {
        getTransactionStatus: () =>
          Effect.gen(function* () {
            checks += 1;
            yield* Deferred.succeed(firstCheck, undefined);
            return { explorerUrl: null, status: "PENDING" as const } as never;
          }),
      },
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* Effect.scoped(
          Effect.gen(function* () {
            yield* makeWorkflowFromService({
              capabilities,
              key: new ClassicTransactionWorkflowInput({
                actionMeta,
                transactions: [classicTransaction("pending")],
                walletScope: classicWalletScope,
                yieldId,
              }),
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

  it("completes a live classic transaction when the API skips it", async () => {
    const getClassicStatus = vi.fn(() =>
      Effect.succeed({ explorerUrl: null, status: "SKIPPED" as const })
    );

    const result = await runToCompletion(
      new ClassicTransactionWorkflowInput({
        actionMeta,
        transactions: [classicTransaction("skipped-live")],
        walletScope: classicWalletScope,
        yieldId,
      }),
      makeCapabilities({
        yieldOperations: { getTransactionStatus: getClassicStatus as never },
      })
    );

    expect(result.finalState._tag).toBe("Completed");
    expect(getClassicStatus).toHaveBeenCalledOnce();
  });

  it("uses the classic confirmation interval and exhausts its attempt limit", async () => {
    let checks = 0;
    const firstCheck = await Effect.runPromise(Deferred.make<void>());
    const failed = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const machine = yield* makeWorkflowFromService({
            capabilities: makeCapabilities({
              yieldOperations: {
                getTransactionStatus: () =>
                  Effect.gen(function* () {
                    checks += 1;
                    if (checks === 1) {
                      yield* Deferred.succeed(firstCheck, undefined);
                    }

                    return {
                      explorerUrl: null,
                      status: "PENDING" as const,
                    } as never;
                  }),
              },
            }),
            key: new ClassicTransactionWorkflowInput({
              actionMeta,
              transactions: [classicTransaction("exhausted")],
              walletScope: classicWalletScope,
              yieldId,
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
      makeCapabilities({
        borrow: {
          getAction: () => {
            checks += 1;
            return Effect.succeed(checks === 1 ? firstConfirmed : completed);
          },
        },
        wallet: {
          state: Effect.succeed(walletServiceState(walletState("base"))),
        },
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
      makeCapabilities({
        borrow: {
          getAction: () => {
            checks += 1;
            return Effect.succeed(
              checks === 1 ? firstConfirmed : secondConfirmed
            );
          },
          stepAction: () => Effect.succeed(second),
        },
        wallet: {
          state: Effect.succeed(walletServiceState(walletState("base"))),
        },
      })
    );

    expect(result.finalState.context.batches.map(({ id }) => id)).toEqual([
      "borrow-step-1",
      "borrow-step-2",
    ]);
    expect(result.finalState.context.submissions).toHaveLength(2);
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
            capabilities: makeCapabilities({
              borrow: {
                getAction: () => {
                  statusChecks += 1;
                  return Effect.succeed(
                    statusChecks === 1 ? firstConfirmed : second
                  );
                },
                stepAction: step,
              },
              wallet: {
                state: Effect.succeed(walletServiceState(walletState("base"))),
              },
            }),
            key: new BorrowTransactionWorkflowInput({
              action: first,
              walletScope: borrowWalletScope,
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
            capabilities: makeCapabilities({
              borrow: {
                getAction: () => {
                  statusChecks += 1;
                  if (statusChecks === 1) return Effect.succeed(firstConfirmed);
                  if (statusChecks === 2) return Effect.succeed(second);
                  return Effect.succeed(secondCompleted);
                },
                stepAction: step,
              },
              wallet: {
                state: Effect.succeed(walletServiceState(walletState("base"))),
              },
            }),
            key: new BorrowTransactionWorkflowInput({
              action: first,
              walletScope: borrowWalletScope,
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
