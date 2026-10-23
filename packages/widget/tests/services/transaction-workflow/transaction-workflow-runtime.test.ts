import { describe, expect, it, vi } from "@effect/vitest";
import {
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  Schema,
  Scope,
  Stream,
} from "effect";
import {
  HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http";
import { TestClock } from "effect/testing";
import type { ActionTransaction } from "../../../src/domain/action/models";
import { Action } from "../../../src/domain/borrow/execution/action";
import { Transaction } from "../../../src/domain/borrow/execution/transaction";
import {
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import {
  WalletScopeKey,
  walletScopeOwnerKey,
} from "../../../src/domain/wallet/wallet-scope";
import { BorrowApiError } from "../../../src/generated/api/borrow-client";
import { makeBorrowOperations } from "../../../src/services/api/borrow-operations";
import type {
  BorrowOperations,
  YieldOperations,
} from "../../../src/services/api/operations";
import { ApiRequestError } from "../../../src/services/api/resource-sources";
import {
  BorrowTransactionWorkflowInput,
  ClassicTransactionWorkflowInput,
  type TransactionWorkflowState,
} from "../../../src/services/transaction-workflow/transaction-workflow-model";
import {
  type TransactionWorkflowHandle,
  TransactionWorkflowService,
} from "../../../src/services/transaction-workflow/transaction-workflow-service";
import {
  WalletOwnerMismatchError,
  WalletSigningError,
} from "../../../src/services/wallet/wallet-errors";
import type { WalletState } from "../../../src/services/wallet/wallet-state";
import type {
  ClassicActionMeta,
  WalletBroadcastResult,
  WalletSignedPayloadResult,
} from "../../../src/services/wallet/wallet-transactions";
import { yieldApiTransactionFixture } from "../../fixtures";
import { makeConnectedWalletState } from "../../fixtures/wallet-state";
import type { TestWalletBehaviorOptions } from "../../utils/services/wallet-service";
import {
  makeTransactionWorkflowTestKit,
  type TransactionWorkflowTestKitOptions,
} from "../../utils/transaction-workflow-test-kit";

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
} as unknown as ClassicActionMeta;

type WorkflowTestCapabilityOverrides = {
  readonly borrow?: Partial<BorrowOperations["Service"]>;
  readonly initialWalletState?: WalletState;
  readonly wallet?: TestWalletBehaviorOptions;
  readonly yieldOperations?: Partial<YieldOperations["Service"]>;
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
  Schema.decodeSync(Transaction)({
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

const makeCapabilities = (
  overrides: WorkflowTestCapabilityOverrides = {}
): TransactionWorkflowTestKitOptions => ({
  borrow: {
    getAction: () => Effect.succeed(null),
    submitTransaction: () =>
      Effect.succeed({
        link: "https://explorer.test/borrow",
        status: "BROADCASTED",
        transactionHash,
      }),
    ...overrides.borrow,
  },
  initialWalletState:
    overrides.initialWalletState ??
    makeConnectedWalletState(classicWalletScope),
  wallet: {
    signMessage: () => Effect.succeed(signedPayload),
    signTransaction: () =>
      Effect.succeed({ broadcasted: false, signedTx: signedPayload }),
    ...overrides.wallet,
  },
  yieldOperations: {
    getTransactionStatus: () =>
      Effect.succeed({
        explorerUrl: "https://explorer.test/tx",
        status: "CONFIRMED",
      } as never),
    previewAction: () => Effect.die("unexpected action preview"),
    submitSignedTransaction: () =>
      Effect.succeed({
        explorerUrl: null,
        hash: null,
        status: "BROADCASTED",
      } as never),
    submitTransactionHash: () =>
      Effect.succeed({
        explorerUrl: null,
        hash: transactionHash,
        status: "BROADCASTED",
      } as never),
    ...overrides.yieldOperations,
  },
});

const makeWorkflowFromService = ({
  key,
  capabilities,
}: {
  readonly capabilities: TransactionWorkflowTestKitOptions;
  readonly key:
    | ClassicTransactionWorkflowInput
    | BorrowTransactionWorkflowInput;
}) =>
  makeTransactionWorkflowTestKit(capabilities).pipe(
    // Built in the caller's Scope: the service outlives the workflow, as the
    // Application Runtime Generation does.
    Effect.flatMap((kit) => Layer.build(kit.layer)),
    Effect.flatMap((services) =>
      TransactionWorkflowService.use(({ make }) => make(key)).pipe(
        Effect.provide(services)
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
  capabilities: TransactionWorkflowTestKitOptions
) =>
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
  );

describe("transaction workflow runtime", () => {
  it.effect(
    "publishes owner-scoped lifecycle facts around a successful workflow",
    () =>
      Effect.gen(function* () {
        const key = new ClassicTransactionWorkflowInput({
          actionMeta,
          transactions: [classicTransaction("lifecycle-events")],
          walletScope: classicWalletScope,
          yieldId,
        });
        const kit = yield* makeTransactionWorkflowTestKit(makeCapabilities());

        yield* Effect.scoped(
          Effect.gen(function* () {
            const workflowScope = yield* Scope.make();
            yield* TransactionWorkflowService.use(({ make }) => make(key)).pipe(
              Effect.provide(kit.layer),
              Effect.provideService(Scope.Scope, workflowScope)
            );

            expect(yield* kit.events.publishedEvents).toEqual([
              {
                _tag: "TransactionWorkflowStarted",
                owner: walletScopeOwnerKey(classicWalletScope),
              },
            ]);

            yield* Scope.close(workflowScope, Exit.void);
            yield* Scope.close(workflowScope, Exit.void);
          })
        );

        expect(yield* kit.events.publishedEvents).toEqual([
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
      })
  );

  it.effect("closes its state Stream when the workflow Scope closes", () =>
    Effect.gen(function* () {
      const key = new ClassicTransactionWorkflowInput({
        actionMeta,
        transactions: [classicTransaction("scope-close")],
        walletScope: classicWalletScope,
        yieldId,
      });

      const streamExit = yield* Effect.scoped(
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
      );

      expect(streamExit._tag).toBe("Success");
    })
  );

  it.effect(
    "auto-starts classic signed-payload and broadcast submission paths",
    () =>
      Effect.gen(function* () {
        const submitSigned = vi.fn(() =>
          Effect.succeed({
            explorerUrl: null,
            hash: null,
            status: "BROADCASTED",
          } as never)
        );
        yield* runToCompletion(
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

        const submitHash = vi.fn(() =>
          Effect.succeed({
            explorerUrl: null,
            hash: transactionHash,
            status: "BROADCASTED",
          } as never)
        );
        yield* runToCompletion(
          new ClassicTransactionWorkflowInput({
            actionMeta,
            transactions: [classicTransaction("classic-broadcast")],
            walletScope: classicWalletScope,
            yieldId,
          }),
          makeCapabilities({
            wallet: {
              signTransaction: () =>
                Effect.succeed({
                  broadcasted: true,
                  signedTx: transactionHash,
                }),
            },
            yieldOperations: { submitTransactionHash: submitHash },
          })
        );

        expect(submitHash).toHaveBeenCalledWith({
          payload: { hash: transactionHash },
          transactionId: "classic-broadcast",
        });
      })
  );

  it.effect(
    "uses one phase-accurate retry and ignores duplicate stale retries",
    () =>
      Effect.gen(function* () {
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
                  ? Effect.fail(
                      new ApiRequestError({
                        cause: new Error("submit failed"),
                        failure: { _tag: "Unreachable" },
                        operation: "submitSignedTransaction",
                      })
                    )
                  : Effect.succeed({
                      explorerUrl: null,
                      hash: null,
                      status: "BROADCASTED",
                    } as never);
              }),
          },
        });

        yield* Effect.scoped(
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
        );

        expect({ signAttempts, submitAttempts }).toEqual({
          signAttempts: 2,
          submitAttempts: 2,
        });
      })
  );

  it.effect(
    "maps wallet owner mismatches and validates borrow payloads before signing",
    () =>
      Effect.gen(function* () {
        const action = borrowAction();
        const key = new BorrowTransactionWorkflowInput({
          action,
          walletScope: borrowWalletScope,
        });
        for (const reason of ["account-changed", "network-changed"] as const) {
          const signTransaction = vi.fn(() =>
            Effect.fail(
              new WalletOwnerMismatchError({ operation: "transaction", reason })
            )
          );
          const mismatched = yield* Effect.scoped(
            Effect.gen(function* () {
              const machine = yield* makeWorkflowFromService({
                capabilities: makeCapabilities({
                  initialWalletState: makeConnectedWalletState(
                    new WalletScopeKey({
                      address: otherAddress,
                      network: "base",
                    })
                  ),
                  wallet: { signTransaction },
                }),
                key,
              });
              const failed = yield* waitForState(
                machine,
                (state) => state._tag === "SignFailed"
              );
              return Option.getOrThrow(yield* Fiber.join(failed));
            })
          );
          expect(mismatched).toMatchObject({
            _tag: "SignFailed",
            error: {
              _tag: "TransactionSignError",
              reason: { _tag: "WalletUnavailable", detail: reason },
              transactionId: "borrow-1",
            },
          });
          expect(signTransaction).toHaveBeenCalledWith(
            expect.objectContaining({ expectedOwner: borrowWalletScope })
          );
        }

        const invalidAction = borrowAction({
          id: "borrow-invalid",
          transactions: [
            borrowTransaction("invalid", { signablePayload: "not-json" }),
          ],
        });
        const invalidPayload = yield* Effect.scoped(
          Effect.gen(function* () {
            const machine = yield* makeWorkflowFromService({
              capabilities: makeCapabilities({
                initialWalletState: makeConnectedWalletState(borrowWalletScope),
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
        );
        expect(invalidPayload).toMatchObject({
          _tag: "SignFailed",
          error: {
            _tag: "TransactionSignError",
            message: "Borrow transaction payload could not be decoded.",
            reason: { _tag: "DecodeFailed" },
          },
        });

        const signTransaction = vi.fn(() =>
          Effect.fail(
            new WalletSigningError({
              cause: new Error("typed data reached transaction signing"),
              operation: "transaction",
            })
          )
        );
        const signTypedData = vi.fn(() =>
          Effect.fail(
            new WalletSigningError({
              cause: new Error("typed-data signing rejected"),
              operation: "typed-data",
            })
          )
        );
        const typedDataAction = borrowAction({
          id: "borrow-typed-data",
          transactions: [
            borrowTransaction("typed-data", {
              signablePayload: JSON.stringify({
                domain: {
                  chainId: "8453",
                  name: "Borrow Authorization",
                  verifyingContract:
                    "0x0000000000000000000000000000000000000002",
                  version: "1",
                },
                message: { owner: address },
                primaryType: "Authorization",
                types: {
                  Authorization: [{ name: "owner", type: "address" }],
                  EIP712Domain: [{ name: "name", type: "string" }],
                },
              }),
              signingFormat: "EIP712_TYPED_DATA",
            }),
          ],
        });
        const typedDataPayload = yield* Effect.scoped(
          Effect.gen(function* () {
            const machine = yield* makeWorkflowFromService({
              capabilities: makeCapabilities({
                initialWalletState: makeConnectedWalletState(borrowWalletScope),
                wallet: { signTransaction, signTypedData },
              }),
              key: new BorrowTransactionWorkflowInput({
                action: typedDataAction,
                walletScope: borrowWalletScope,
              }),
            });
            const failed = yield* waitForState(
              machine,
              (state) => state._tag === "SignFailed"
            );
            return Option.getOrThrow(yield* Fiber.join(failed));
          })
        );

        expect(typedDataPayload).toMatchObject({
          _tag: "SignFailed",
          error: {
            _tag: "TransactionSignError",
            reason: {
              _tag: "WalletOperationFailed",
              operation: "typed-data",
            },
            transactionId: "typed-data",
          },
        });
        expect(signTransaction).not.toHaveBeenCalled();
        expect(signTypedData).toHaveBeenCalledWith({
          expectedOwner: borrowWalletScope,
          txMeta: expect.objectContaining({
            actionType: "borrow",
            txId: "typed-data",
            txType: "BORROW",
          }),
          typedData: {
            domain: {
              chainId: 8453,
              name: "Borrow Authorization",
              verifyingContract: "0x0000000000000000000000000000000000000002",
              version: "1",
            },
            message: { owner: address },
            primaryType: "Authorization",
            types: {
              Authorization: [{ name: "owner", type: "address" }],
            },
          },
        });
      })
  );

  it.effect("normalizes borrow signed and broadcast submissions", () =>
    Effect.gen(function* () {
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
        const result = yield* runToCompletion(
          new BorrowTransactionWorkflowInput({
            action,
            walletScope: borrowWalletScope,
          }),
          makeCapabilities({
            borrow: {
              getAction: () => Effect.succeed(confirmed(action)),
              submitTransaction: submit,
            },
            initialWalletState: makeConnectedWalletState(borrowWalletScope),
            wallet: {
              signTransaction,
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
    })
  );

  it.effect("polls on schedule and interrupts polling with its scope", () =>
    Effect.gen(function* () {
      let checks = 0;
      const firstCheck = yield* Deferred.make<void>();
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

      yield* Effect.gen(function* () {
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
      }).pipe(Effect.provide(TestClock.layer()));

      expect(checks).toBe(1);
    })
  );

  it.effect("completes a live classic transaction when the API skips it", () =>
    Effect.gen(function* () {
      const getClassicStatus = vi.fn(() =>
        Effect.succeed({ explorerUrl: null, status: "SKIPPED" as const })
      );

      const result = yield* runToCompletion(
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
    })
  );

  it.effect(
    "uses the classic confirmation interval and exhausts its attempt limit",
    () =>
      Effect.gen(function* () {
        let checks = 0;
        const firstCheck = yield* Deferred.make<void>();
        const failed = yield* Effect.scoped(
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
        );

        expect(checks).toBe(75);
        expect(failed).toMatchObject({
          _tag: "ConfirmationFailed",
          error: { _tag: "TransactionConfirmationError" },
        });
      })
  );

  it.effect("processes multiple borrow transactions in one batch", () =>
    Effect.gen(function* () {
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
      const result = yield* runToCompletion(
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
          initialWalletState: makeConnectedWalletState(borrowWalletScope),
        })
      );

      expect(result.finalState.context.batches).toHaveLength(1);
      expect(result.finalState.context.submissions).toHaveLength(2);
      expect(
        result.finalState.context.batches[0]?.transactions.every(
          ({ meta }) => meta.done
        )
      ).toBe(true);
    })
  );

  it.effect(
    "never signs a batch transaction the first poll reports finished",
    () =>
      Effect.gen(function* () {
        for (const remoteStatus of ["CONFIRMED", "SKIPPED"] as const) {
          const first = borrowAction({
            transactions: [
              borrowTransaction("borrow-1"),
              borrowTransaction("borrow-2"),
            ],
          });
          const polled = borrowAction({
            status: "PROCESSING",
            transactions: [
              borrowTransaction("borrow-1", { status: "CONFIRMED" }),
              borrowTransaction("borrow-2", { status: remoteStatus }),
            ],
          });
          const signTransaction = vi.fn(() =>
            Effect.succeed({ broadcasted: false, signedTx: signedPayload })
          );
          const submit = vi.fn(() =>
            Effect.succeed({
              link: "https://explorer.test/borrow",
              status: "BROADCASTED" as const,
              transactionHash,
            })
          );
          const result = yield* runToCompletion(
            new BorrowTransactionWorkflowInput({
              action: first,
              walletScope: borrowWalletScope,
            }),
            makeCapabilities({
              borrow: {
                getAction: () => Effect.succeed(polled),
                submitTransaction: submit,
              },
              initialWalletState: makeConnectedWalletState(borrowWalletScope),
              wallet: { signTransaction },
            })
          );
          const [, second] =
            result.finalState.context.batches[0]?.transactions ?? [];

          expect(signTransaction).toHaveBeenCalledTimes(1);
          expect(submit).toHaveBeenCalledTimes(1);
          expect(submit).toHaveBeenCalledWith(
            expect.objectContaining({ transactionId: "borrow-1" })
          );
          expect(second?.meta).toMatchObject({
            done: true,
            signedTx: null,
            submissionIndex: null,
          });
          expect(
            second?.source._tag === "Borrow" && second.source.transaction.status
          ).toBe(remoteStatus);
        }
      })
  );

  it.effect(
    "stops signing when the first poll reports the borrow action succeeded",
    () =>
      Effect.gen(function* () {
        const first = borrowAction({
          transactions: [
            borrowTransaction("borrow-1"),
            borrowTransaction("borrow-2"),
          ],
        });
        const succeeded = borrowAction({
          status: "SUCCESS",
          transactions: [
            borrowTransaction("borrow-1", { status: "CONFIRMED" }),
            borrowTransaction("borrow-2"),
          ],
        });
        const signTransaction = vi.fn(
          () =>
            Effect.succeed({
              broadcasted: true,
              signedTx: transactionHash,
            }) as never
        );
        const getAction = vi.fn(() => Effect.succeed(succeeded));
        const result = yield* runToCompletion(
          new BorrowTransactionWorkflowInput({
            action: first,
            walletScope: borrowWalletScope,
          }),
          makeCapabilities({
            borrow: { getAction },
            initialWalletState: makeConnectedWalletState(borrowWalletScope),
            wallet: { signTransaction },
          })
        );
        const { context } = result.finalState;
        const [reconciled] = context.batches[0]?.transactions ?? [];

        expect(signTransaction).toHaveBeenCalledTimes(1);
        expect(getAction).toHaveBeenCalledTimes(1);
        expect(context.domain).toEqual({ _tag: "Borrow", action: succeeded });
        expect(reconciled?.source).toEqual({
          _tag: "Borrow",
          transaction: succeeded.transactions[0],
        });
        expect(reconciled?.meta).toMatchObject({
          broadcasted: true,
          done: true,
          signedTx: transactionHash,
          submissionIndex: 0,
        });
        expect(context.submissions[0]).toMatchObject({
          hash: transactionHash,
          signedPayload: null,
        });
      })
  );

  it.effect(
    "preserves history and event order across borrow transaction batches",
    () =>
      Effect.gen(function* () {
        const first = borrowAction({
          hasNextStep: true,
          totalSteps: 2,
          transactions: [borrowTransaction("borrow-1")],
        });
        const firstConfirmed = borrowAction({
          hasNextStep: true,
          totalSteps: 2,
          transactions: [
            borrowTransaction("borrow-1", { status: "CONFIRMED" }),
          ],
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
          transactions: [
            borrowTransaction("borrow-2", { status: "CONFIRMED" }),
          ],
        });
        let checks = 0;
        const result = yield* runToCompletion(
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
            initialWalletState: makeConnectedWalletState(borrowWalletScope),
          })
        );

        expect(result.finalState.context.batches.map(({ id }) => id)).toEqual([
          "borrow-step-1",
          "borrow-step-2",
        ]);
        expect(result.finalState.context.submissions).toHaveLength(2);
      })
  );

  it.effect(
    "reconciles an ambiguous failed borrow advancement before retrying",
    () =>
      Effect.gen(function* () {
        const first = borrowAction({ hasNextStep: true, totalSteps: 2 });
        const firstConfirmed = borrowAction({
          hasNextStep: true,
          totalSteps: 2,
          transactions: [
            borrowTransaction("borrow-1", { status: "CONFIRMED" }),
          ],
        });
        const second = borrowAction({
          currentStep: 2,
          id: first.id,
          status: "SUCCESS",
          totalSteps: 2,
          transactions: [],
        });
        let statusChecks = 0;
        const step = vi.fn(() =>
          Effect.fail(
            new ApiRequestError({
              cause: new Error("response lost"),
              failure: { _tag: "Unreachable" },
              operation: "stepAction",
            })
          )
        );

        yield* Effect.scoped(
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
                initialWalletState: makeConnectedWalletState(borrowWalletScope),
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
        );

        expect(step).toHaveBeenCalledTimes(1);
      })
  );

  it.effect(
    "uses a reconciled next batch without repeating an ambiguous borrow step",
    () =>
      Effect.gen(function* () {
        const first = borrowAction({ hasNextStep: true, totalSteps: 2 });
        const firstConfirmed = borrowAction({
          hasNextStep: true,
          totalSteps: 2,
          transactions: [
            borrowTransaction("borrow-1", { status: "CONFIRMED" }),
          ],
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
          transactions: [
            borrowTransaction("borrow-2", { status: "CONFIRMED" }),
          ],
        });
        let statusChecks = 0;
        const step = vi.fn(() =>
          Effect.fail(
            new ApiRequestError({
              cause: new Error("response lost"),
              failure: { _tag: "Unreachable" },
              operation: "stepAction",
            })
          )
        );

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const machine = yield* makeWorkflowFromService({
              capabilities: makeCapabilities({
                borrow: {
                  getAction: () => {
                    statusChecks += 1;
                    if (statusChecks === 1)
                      return Effect.succeed(firstConfirmed);
                    if (statusChecks === 2) return Effect.succeed(second);
                    return Effect.succeed(secondCompleted);
                  },
                  stepAction: step,
                },
                initialWalletState: makeConnectedWalletState(borrowWalletScope),
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
        );

        expect(step).toHaveBeenCalledTimes(1);
        expect(result.context.batches.map(({ id }) => id)).toEqual([
          "borrow-step-1",
          "borrow-step-2",
        ]);
      })
  );
});

describe("transaction workflow leave guard", () => {
  it.effect(
    "is leave-guarded while a signature is in flight, until its Scope closes",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const key = new ClassicTransactionWorkflowInput({
            actionMeta,
            transactions: [classicTransaction("leave-guard")],
            walletScope: classicWalletScope,
            yieldId,
          });
          const kit = yield* makeTransactionWorkflowTestKit(
            makeCapabilities({
              wallet: { signTransaction: () => Effect.never },
            })
          );
          const services = yield* Layer.build(kit.layer);
          const leaveGuarded = yield* TransactionWorkflowService.use(
            (workflows) => Effect.succeed(workflows.leaveGuarded)
          ).pipe(Effect.provide(services));
          const current = Stream.runHead(leaveGuarded).pipe(
            Effect.map(Option.getOrThrow)
          );

          expect(yield* current).toBe(false);

          const workflowScope = yield* Scope.make();
          yield* TransactionWorkflowService.use(({ make }) => make(key)).pipe(
            Effect.provide(services),
            Effect.provideService(Scope.Scope, workflowScope)
          );
          yield* leaveGuarded.pipe(Stream.filter(Boolean), Stream.runHead);

          yield* Scope.close(workflowScope, Exit.void);

          expect(yield* current).toBe(false);
        })
      )
  );
});

describe("held broadcast hash registration", () => {
  const hashRequest = HttpClientRequest.post(
    "https://borrow.test/v1/transactions/borrow-1/submit"
  );
  const transientFailure = new ApiRequestError({
    cause: new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({ request: hashRequest }),
    }),
    failure: { _tag: "Unreachable" },
    operation: "borrow-transaction-submit",
  });
  const rejectedFailure = new ApiRequestError({
    cause: new HttpClientError.HttpClientError({
      reason: new HttpClientError.StatusCodeError({
        request: hashRequest,
        response: HttpClientResponse.fromWeb(
          hashRequest,
          new Response(null, { status: 400 })
        ),
      }),
    }),
    failure: { _tag: "ErrorStatus", body: null, status: 400 },
    operation: "borrow-transaction-submit",
  });
  const acknowledged = {
    link: "https://explorer.test/borrow",
    status: "BROADCASTED" as const,
    transactionHash,
  };
  const hashSubmission = {
    command: { transactionHash },
    transactionId: "borrow-1",
  };

  type BorrowSubmit = BorrowOperations["Service"]["submitTransaction"];

  /**
   * Scripts one outcome per sent request; the last outcome repeats. Operations
   * send on every execution, so a retried Effect counts as a new request.
   */
  const scriptedSubmit = (
    outcomes: ReadonlyArray<Effect.Effect<typeof acknowledged, ApiRequestError>>
  ) => {
    const sent: Array<unknown> = [];
    const submit: BorrowSubmit = (request) =>
      Effect.suspend(() => {
        sent.push(request);
        return (
          outcomes[Math.min(sent.length, outcomes.length) - 1] ??
          Effect.die("no scripted submission outcome")
        );
      });
    return { sent, submit } as const;
  };

  const isSubmissionFailed = (state: TransactionWorkflowState) =>
    state._tag === "SubmissionFailed";

  /**
   * Runs a workflow in its own Execution Scope on a service built in its own
   * runtime Scope, then leaves once `leaveAfter` completes — by default, once
   * submission has failed.
   */
  const leaveWorkflow = Effect.fn("test.leaveWorkflow")(function* ({
    capabilities,
    key,
    leaveAfter,
  }: {
    readonly capabilities: TransactionWorkflowTestKitOptions;
    readonly key:
      | ClassicTransactionWorkflowInput
      | BorrowTransactionWorkflowInput;
    readonly leaveAfter?: Effect.Effect<void>;
  }) {
    const kit = yield* makeTransactionWorkflowTestKit(capabilities);
    const runtimeScope = yield* Scope.make();
    const services = yield* Layer.buildWithScope(kit.layer, runtimeScope);
    const workflowScope = yield* Scope.make();
    const machine = yield* TransactionWorkflowService.use(({ make }) =>
      make(key)
    ).pipe(
      Effect.provide(services),
      Effect.provideService(Scope.Scope, workflowScope)
    );
    if (leaveAfter) {
      yield* leaveAfter;
    } else {
      yield* Fiber.join(yield* waitForState(machine, isSubmissionFailed));
    }
    yield* Scope.close(workflowScope, Exit.void);
    yield* Effect.yieldNow;

    return { closeRuntime: Scope.close(runtimeScope, Exit.void) } as const;
  });

  const broadcastingWallet = {
    signTransaction: () =>
      Effect.succeed({ broadcasted: true, signedTx: transactionHash }),
  } satisfies TestWalletBehaviorOptions;

  /**
   * A wallet still answering when the user leaves: it announces the request,
   * then answers only once the test releases it, as a host wallet that keeps
   * signing after the Transaction Flow closed.
   */
  const answerLater = Effect.fn("test.answerLater")(function* () {
    const requested = yield* Deferred.make<void>();
    const answer = yield* Deferred.make<
      WalletBroadcastResult | WalletSignedPayloadResult
    >();
    const signTransaction = vi.fn(() =>
      Deferred.succeed(requested, undefined).pipe(
        Effect.andThen(Deferred.await(answer))
      )
    );
    return { answer, requested, signTransaction } as const;
  });

  const leaveBorrowWorkflow = ({
    leaveAfter,
    submitTransaction,
  }: {
    readonly leaveAfter?: Effect.Effect<void>;
    readonly submitTransaction: BorrowSubmit;
  }) =>
    leaveWorkflow({
      capabilities: makeCapabilities({
        borrow: {
          submitTransaction,
          submitTransactionInBackground: submitTransaction,
        },
        initialWalletState: makeConnectedWalletState(borrowWalletScope),
        wallet: broadcastingWallet,
      }),
      key: new BorrowTransactionWorkflowInput({
        action: borrowAction(),
        walletScope: borrowWalletScope,
      }),
      ...(leaveAfter ? { leaveAfter } : {}),
    });

  it.effect(
    "keeps registering a held hash after leaving until the API acknowledges it",
    () =>
      Effect.gen(function* () {
        const { sent, submit } = scriptedSubmit([
          Effect.fail(transientFailure),
          Effect.fail(transientFailure),
          Effect.fail(transientFailure),
          Effect.succeed(acknowledged),
        ]);
        yield* leaveBorrowWorkflow({
          submitTransaction: submit,
        });
        expect(sent).toHaveLength(2);

        yield* TestClock.adjust("1 second");
        expect(sent).toHaveLength(3);
        yield* TestClock.adjust("2 seconds");
        expect(sent).toHaveLength(4);
        yield* TestClock.adjust("1 minute");

        expect(sent).toEqual(Array(4).fill(hashSubmission));
      }).pipe(Effect.provide(TestClock.layer()))
  );

  it.effect("gives up on a held hash after five attempts", () =>
    Effect.gen(function* () {
      const { sent, submit } = scriptedSubmit([Effect.fail(transientFailure)]);
      yield* leaveBorrowWorkflow({
        submitTransaction: submit,
      });
      yield* TestClock.adjust("10 minutes");

      expect(sent).toHaveLength(1 + 5);
    }).pipe(Effect.provide(TestClock.layer()))
  );

  it.effect("stops registering a held hash the API rejects", () =>
    Effect.gen(function* () {
      const { sent, submit } = scriptedSubmit([
        Effect.fail(transientFailure),
        Effect.fail(rejectedFailure),
        Effect.succeed(acknowledged),
      ]);
      yield* leaveBorrowWorkflow({
        submitTransaction: submit,
      });
      yield* TestClock.adjust("10 minutes");

      expect(sent).toHaveLength(2);
    }).pipe(Effect.provide(TestClock.layer()))
  );

  it.effect("stops registering a held hash when the runtime closes", () =>
    Effect.gen(function* () {
      const { sent, submit } = scriptedSubmit([Effect.fail(transientFailure)]);
      const { closeRuntime } = yield* leaveBorrowWorkflow({
        submitTransaction: submit,
      });
      expect(sent).toHaveLength(2);

      yield* closeRuntime;
      yield* TestClock.adjust("10 minutes");

      expect(sent).toHaveLength(2);
    }).pipe(Effect.provide(TestClock.layer()))
  );

  it.effect(
    "registers a held hash in the background when leaving during its submission",
    () =>
      Effect.gen(function* () {
        const submissionSent = yield* Deferred.make<void>();
        const { sent, submit } = scriptedSubmit([
          Deferred.succeed(submissionSent, undefined).pipe(
            Effect.andThen(Effect.never)
          ),
          Effect.succeed(acknowledged),
        ]);
        yield* leaveBorrowWorkflow({
          leaveAfter: Deferred.await(submissionSent),
          submitTransaction: submit,
        });

        expect(sent).toEqual([hashSubmission, hashSubmission]);
      })
  );

  it.effect(
    "registers a held hash when leaving after the wallet broadcast, before submission",
    () =>
      Effect.gen(function* () {
        const reportingSignature = yield* Deferred.make<void>();
        const { sent, submit } = scriptedSubmit([Effect.succeed(acknowledged)]);
        yield* leaveWorkflow({
          capabilities: {
            ...makeCapabilities({
              borrow: {
                submitTransaction: submit,
                submitTransactionInBackground: submit,
              },
              initialWalletState: makeConnectedWalletState(borrowWalletScope),
              wallet: broadcastingWallet,
            }),
            // The wallet has broadcast; the workflow is still reporting it.
            tracking: {
              trackEvent: (event) =>
                event === "txSigned"
                  ? Deferred.succeed(reportingSignature, undefined).pipe(
                      Effect.andThen(Effect.never)
                    )
                  : Effect.void,
            },
          },
          key: new BorrowTransactionWorkflowInput({
            action: borrowAction(),
            walletScope: borrowWalletScope,
          }),
          leaveAfter: Deferred.await(reportingSignature),
        });

        expect(sent).toEqual([hashSubmission]);
      })
  );

  it.effect(
    "registers a held hash without presenting the API's Rich Error",
    () =>
      Effect.gen(function* () {
        const submit = vi.fn(() =>
          Effect.fail(
            BorrowApiError(
              "TransactionsControllerSubmitTransactionV1400",
              { message: "Transaction hash was rejected" },
              HttpClientResponse.fromWeb(
                hashRequest,
                new Response(null, { status: 400 })
              )
            )
          )
        );
        const present = vi.fn(() => Effect.void);
        const operations = makeBorrowOperations(
          {
            read: {},
            write: { TransactionsControllerSubmitTransactionV1: submit },
          } as never,
          true,
          { present } as never
        );
        yield* leaveWorkflow({
          capabilities: makeCapabilities({
            borrow: operations,
            initialWalletState: makeConnectedWalletState(borrowWalletScope),
            wallet: broadcastingWallet,
          }),
          key: new BorrowTransactionWorkflowInput({
            action: borrowAction(),
            walletScope: borrowWalletScope,
          }),
        });

        expect(submit).toHaveBeenCalledTimes(2);
        // Only the in-flow submission, made while the user was there, presents.
        expect(present).toHaveBeenCalledTimes(1);
      })
  );

  it.effect(
    "registers a held Classic hash through the Yield transaction API",
    () =>
      Effect.gen(function* () {
        const sent: Array<unknown> = [];
        const submitHash: YieldOperations["Service"]["submitTransactionHash"] =
          (request) =>
            Effect.suspend(() => {
              sent.push(request);
              return sent.length === 1
                ? Effect.fail(transientFailure)
                : Effect.succeed({
                    explorerUrl: null,
                    hash: transactionHash,
                    status: "BROADCASTED",
                  } as never);
            });
        yield* leaveWorkflow({
          capabilities: makeCapabilities({
            wallet: broadcastingWallet,
            yieldOperations: {
              submitTransactionHash: submitHash,
              submitTransactionHashInBackground: submitHash,
            },
          }),
          key: new ClassicTransactionWorkflowInput({
            actionMeta,
            transactions: [classicTransaction("classic-held")],
            walletScope: classicWalletScope,
            yieldId,
          }),
        });

        const classicHash = {
          payload: { hash: transactionHash },
          transactionId: "classic-held",
        };
        expect(sent).toEqual([classicHash, classicHash]);
      })
  );

  it.effect(
    "registers a Classic hash the wallet broadcasts after the user left mid-signing",
    () =>
      Effect.gen(function* () {
        const wallet = yield* answerLater();
        const registered = yield* Deferred.make<void>();
        const submitHash = vi.fn(() =>
          Deferred.succeed(registered, undefined).pipe(
            Effect.as({
              explorerUrl: null,
              hash: transactionHash,
              status: "BROADCASTED",
            } as never)
          )
        );
        yield* leaveWorkflow({
          capabilities: makeCapabilities({
            wallet: { signTransaction: wallet.signTransaction },
            yieldOperations: {
              submitTransactionHash: submitHash,
              submitTransactionHashInBackground: submitHash,
            },
          }),
          key: new ClassicTransactionWorkflowInput({
            actionMeta,
            transactions: [classicTransaction("classic-late")],
            walletScope: classicWalletScope,
            yieldId,
          }),
          leaveAfter: Deferred.await(wallet.requested),
        });
        expect(submitHash).not.toHaveBeenCalled();

        yield* Deferred.succeed(wallet.answer, {
          broadcasted: true,
          signedTx: transactionHash,
        });
        yield* Deferred.await(registered);

        expect(submitHash).toHaveBeenCalledExactlyOnceWith({
          payload: { hash: transactionHash },
          transactionId: "classic-late",
        });
      })
  );

  it.effect(
    "registers a Borrow hash the wallet broadcasts after the user left mid-signing",
    () =>
      Effect.gen(function* () {
        const wallet = yield* answerLater();
        const registered = yield* Deferred.make<void>();
        const submit = vi.fn(() =>
          Deferred.succeed(registered, undefined).pipe(Effect.as(acknowledged))
        );
        yield* leaveWorkflow({
          capabilities: makeCapabilities({
            borrow: {
              submitTransaction: submit,
              submitTransactionInBackground: submit,
            },
            initialWalletState: makeConnectedWalletState(borrowWalletScope),
            wallet: { signTransaction: wallet.signTransaction },
          }),
          key: new BorrowTransactionWorkflowInput({
            action: borrowAction(),
            walletScope: borrowWalletScope,
          }),
          leaveAfter: Deferred.await(wallet.requested),
        });
        expect(submit).not.toHaveBeenCalled();

        yield* Deferred.succeed(wallet.answer, {
          broadcasted: true,
          signedTx: transactionHash,
        });
        yield* Deferred.await(registered);

        expect(submit).toHaveBeenCalledExactlyOnceWith(hashSubmission);
      })
  );

  it.effect(
    "drops a payload the wallet only signed after the user left mid-signing",
    () =>
      Effect.gen(function* () {
        const wallet = yield* answerLater();
        const submitSigned = vi.fn(() =>
          Effect.die("unexpected signed payload submission")
        );
        const submitHash = vi.fn(() =>
          Effect.die("unexpected hash submission")
        );
        yield* leaveWorkflow({
          capabilities: makeCapabilities({
            wallet: { signTransaction: wallet.signTransaction },
            yieldOperations: {
              submitSignedTransaction: submitSigned,
              submitTransactionHash: submitHash,
              submitTransactionHashInBackground: submitHash,
            },
          }),
          key: new ClassicTransactionWorkflowInput({
            actionMeta,
            transactions: [classicTransaction("classic-late-signed")],
            walletScope: classicWalletScope,
            yieldId,
          }),
          leaveAfter: Deferred.await(wallet.requested),
        });

        yield* Deferred.succeed(wallet.answer, {
          broadcasted: false,
          signedTx: signedPayload,
        });
        yield* TestClock.adjust("10 minutes");

        expect(submitSigned).not.toHaveBeenCalled();
        expect(submitHash).not.toHaveBeenCalled();
      }).pipe(Effect.provide(TestClock.layer()))
  );

  it.effect(
    "does not resubmit an unbroadcast signed payload after leaving",
    () =>
      Effect.gen(function* () {
        const submitSigned = vi.fn(() => Effect.fail(transientFailure));
        const submitHash = vi.fn(() =>
          Effect.die("unexpected hash submission")
        );
        yield* leaveWorkflow({
          capabilities: makeCapabilities({
            yieldOperations: {
              submitSignedTransaction: submitSigned,
              submitTransactionHash: submitHash,
              submitTransactionHashInBackground: submitHash,
            },
          }),
          key: new ClassicTransactionWorkflowInput({
            actionMeta,
            transactions: [classicTransaction("classic-unbroadcast")],
            walletScope: classicWalletScope,
            yieldId,
          }),
        });
        yield* TestClock.adjust("10 minutes");

        expect(submitSigned).toHaveBeenCalledTimes(1);
        expect(submitHash).not.toHaveBeenCalled();
      }).pipe(Effect.provide(TestClock.layer()))
  );
});
