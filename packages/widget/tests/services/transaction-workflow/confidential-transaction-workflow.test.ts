import { describe, expect, it } from "@effect/vitest";
import {
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  Ref,
  Schema,
  Scope,
  Stream,
} from "effect";
import { TestClock } from "effect/testing";
import {
  type DirectTransaction,
  makeErc20Approval,
} from "../../../src/domain/action/direct-transaction";
import type { ActionTransaction } from "../../../src/domain/action/models";
import {
  ConfidentialHandle,
  zeroEncryptedBalance,
} from "../../../src/domain/earn/confidential";
import { EarnPosition } from "../../../src/domain/earn/models";
import {
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import type { ActionPreviewRequest } from "../../../src/services/api/operations";
import { InputValidationError } from "../../../src/services/api/resource-sources";
import {
  EvmBroadcastRejectedError,
  EvmRpcError,
} from "../../../src/services/evm-rpc/evm-rpc";
import {
  ConfidentialTransactionWorkflowInput,
  type DirectTransactionLedger,
  makeDirectTransactionLedger,
  type TransactionWorkflowState,
} from "../../../src/services/transaction-workflow/transaction-workflow-model";
import {
  type TransactionWorkflowHandle,
  TransactionWorkflowService,
} from "../../../src/services/transaction-workflow/transaction-workflow-service";
import { WalletRequestCancelledError } from "../../../src/services/wallet/wallet-errors";
import {
  type ConfidentialPreparation,
  ConfidentialPreparationError,
} from "../../../src/services/zama/zama-service";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldBalanceFixture,
} from "../../fixtures";
import { makeConnectedWalletState } from "../../fixtures/wallet-state";
import {
  makeTransactionWorkflowTestKit,
  type TransactionWorkflowTestKitOptions,
} from "../../utils/transaction-workflow-test-kit";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const yieldId = Schema.decodeSync(YieldId)("ethereum-sepolia-zama-vault");
const walletScope = new WalletScopeKey({ address, network: "ethereum" });

const command = {
  action: "WITHDRAW",
  address,
  passthrough: "unwrap",
  yieldId,
} as const;
const decryptedCommand = {
  ...command,
  arguments: { decryptedAmount: "7000000", decryptionProof: "0xproof" },
};

const preparation: ConfidentialPreparation = {
  _tag: "Decrypt",
  chainId: 11155111,
  command,
  handle: Schema.decodeSync(ConfidentialHandle)(`0x${"ab".repeat(32)}`),
};

const deposit = (overrides: Partial<ActionTransaction> = {}) =>
  yieldApiTransactionFixture({
    id: "deposit",
    network: "ethereum",
    status: "CREATED",
    stepIndex: 0,
    unsignedTransaction: "unsigned-payload",
    ...overrides,
  });

const preparedAction = (transactions = [deposit()]) =>
  yieldApiActionFixture({ address, transactions, yieldId });

const wrap: DirectTransaction = {
  approval: null,
  chainId: 11155111,
  data: "0xea598cb0",
  id: "conversion-wrap",
  network: "ethereum",
  to: "0x00000000000000000000000000000000000000c0",
  type: "WRAP",
};

const approval = {
  amount: 5n,
  chainId: 11155111,
  network: "ethereum",
  owner: address as `0x${string}`,
  spender: wrap.to,
  token: "0x00000000000000000000000000000000000000a0",
} as const;
const approve = makeErc20Approval({
  ...approval,
  id: "conversion-approval",
  type: "APPROVAL",
});
const reset = makeErc20Approval({
  ...approval,
  id: "conversion-approval",
  type: "RESET_APPROVAL",
});

const makeInput = ({
  conversion = [],
  ledger = makeDirectTransactionLedger(),
}: {
  readonly conversion?: ReadonlyArray<DirectTransaction>;
  readonly ledger?: DirectTransactionLedger;
} = {}) =>
  new ConfidentialTransactionWorkflowInput({
    conversion,
    inputToken: undefined,
    ledger,
    preparation,
    providersDetails: [],
    walletScope,
    yieldId,
  });

const capabilities = ({
  evmRpc,
  signTransaction = () =>
    Effect.succeed({ broadcasted: false, signedTx: "0x02aa" }),
  yieldOperations,
  zama = { decryptCommand: () => Effect.succeed(decryptedCommand) },
}: Pick<
  TransactionWorkflowTestKitOptions,
  "evmRpc" | "yieldOperations" | "zama"
> & {
  readonly signTransaction?: NonNullable<
    NonNullable<TransactionWorkflowTestKitOptions["wallet"]>["signTransaction"]
  >;
}): TransactionWorkflowTestKitOptions => ({
  ...(evmRpc ? { evmRpc } : {}),
  initialWalletState: makeConnectedWalletState(walletScope),
  wallet: { signTransaction },
  yieldOperations: {
    getTransactionStatus: () =>
      Effect.succeed({ explorerUrl: null, status: "CONFIRMED" } as never),
    previewAction: () => Effect.succeed(preparedAction()),
    submitSignedTransaction: () =>
      Effect.succeed({
        explorerUrl: null,
        hash: null,
        status: "BROADCASTED",
      } as never),
    ...yieldOperations,
  },
  zama,
});

const startWorkflow = (
  options: TransactionWorkflowTestKitOptions,
  input = makeInput()
) =>
  makeTransactionWorkflowTestKit(options).pipe(
    // Built in the caller's Scope: the service outlives the workflow, as the
    // Application Runtime Generation does.
    Effect.flatMap((kit) => Layer.build(kit.layer)),
    Effect.flatMap((services) =>
      TransactionWorkflowService.use(({ make }) => make(input)).pipe(
        Effect.provide(services)
      )
    )
  );

const awaitState = (
  workflow: TransactionWorkflowHandle,
  predicate: (state: TransactionWorkflowState) => boolean
) =>
  workflow.states.pipe(
    Stream.filter(predicate),
    Stream.runHead,
    Effect.map(Option.getOrThrow)
  );

const failPreparation = (retryable: boolean) =>
  Effect.fail(
    new ConfidentialPreparationError({
      cause: null,
      message: "Zama encrypt failed.",
      retryable,
    })
  );

describe("confidential transaction workflow", () => {
  it.effect(
    "previews the prepared request, then signs the action it created",
    () =>
      Effect.gen(function* () {
        const previews: Array<ActionPreviewRequest> = [];
        const workflow = yield* startWorkflow(
          capabilities({
            yieldOperations: {
              previewAction: (previewed) =>
                Effect.sync(() => previews.push(previewed)).pipe(
                  Effect.as(preparedAction())
                ),
            },
          })
        );

        const completed = yield* awaitState(
          workflow,
          (state) => state._tag === "Completed"
        );

        expect(previews).toEqual([
          { command: decryptedCommand, intent: "manage" },
        ]);
        expect(completed.context.preparation).toEqual({
          done: true,
          step: "decrypt",
        });
        expect(
          completed.context.batches.flatMap((batch) =>
            batch.transactions.map(({ meta, source }) => [
              source.transaction.id,
              meta.done,
            ])
          )
        ).toEqual([["deposit", true]]);
      }).pipe(Effect.scoped)
  );

  it.effect("retries a preparation that failed transiently", () =>
    Effect.gen(function* () {
      let attempts = 0;
      const workflow = yield* startWorkflow(
        capabilities({
          yieldOperations: {
            previewAction: () => Effect.succeed(preparedAction()),
          },
          zama: {
            decryptCommand: () =>
              ++attempts === 1
                ? failPreparation(true)
                : Effect.succeed(decryptedCommand),
          },
        })
      );

      const failed = yield* awaitState(
        workflow,
        (state) => state._tag === "PrepareFailed"
      );
      yield* workflow.dispatch({ _tag: "Retry" });
      yield* awaitState(workflow, (state) => state._tag === "Completed");

      expect(failed._tag === "PrepareFailed" && failed.error.retryable).toBe(
        true
      );
      expect(attempts).toBe(2);
    }).pipe(Effect.scoped)
  );

  it.effect("does not retry a preparation the API rejected as invalid", () =>
    Effect.gen(function* () {
      let previews = 0;
      const workflow = yield* startWorkflow(
        capabilities({
          yieldOperations: {
            previewAction: () =>
              Effect.sync(() => ++previews).pipe(
                Effect.andThen(
                  Effect.fail(
                    new InputValidationError({
                      cause: null,
                      issue: "amount is required",
                      operation: "action-enter-preview",
                    })
                  )
                )
              ),
          },
        })
      );

      const failed = yield* awaitState(
        workflow,
        (state) => state._tag === "PrepareFailed"
      );
      yield* workflow.dispatch({ _tag: "Retry" });
      yield* Effect.yieldNow;

      expect(failed._tag === "PrepareFailed" && failed.error.retryable).toBe(
        false
      );
      expect(previews).toBe(1);
    }).pipe(Effect.scoped)
  );

  it.effect("rejects a prepared action for another wallet", () =>
    Effect.gen(function* () {
      const workflow = yield* startWorkflow(
        capabilities({
          yieldOperations: {
            previewAction: () =>
              Effect.succeed(
                yieldApiActionFixture({
                  address: "0x0000000000000000000000000000000000000009",
                  transactions: [deposit()],
                  yieldId,
                })
              ),
          },
        })
      );

      const failed = yield* awaitState(
        workflow,
        (state) => state._tag === "PrepareFailed"
      );

      expect(failed._tag === "PrepareFailed" && failed.error.retryable).toBe(
        false
      );
    }).pipe(Effect.scoped)
  );

  it.effect(
    "wraps through the RPC after preparing, then runs the action, recording the wrap",
    () =>
      Effect.gen(function* () {
        const signed: Array<string> = [];
        const broadcasts: Array<string> = [];
        const awaited: Array<string> = [];
        const ledger = makeDirectTransactionLedger();
        const workflow = yield* startWorkflow(
          capabilities({
            evmRpc: {
              awaitOutcome: ({ hash }) =>
                Effect.sync(() => awaited.push(hash)).pipe(
                  Effect.as("Confirmed" as const)
                ),
              broadcast: ({ hash }) =>
                Effect.sync(() => {
                  broadcasts.push(hash);
                }),
              prepare: () => Effect.succeed("unsigned-wrap"),
            },
            signTransaction: (input) =>
              Effect.sync(() => signed.push(input.txMeta.txId)).pipe(
                Effect.as({ broadcasted: false, signedTx: "0x02aa" })
              ),
          }),
          makeInput({ conversion: [wrap], ledger })
        );

        yield* awaitState(workflow, (state) => state._tag === "Completed");

        expect(signed).toEqual(["conversion-wrap", "deposit"]);
        expect(broadcasts).toHaveLength(1);
        expect(awaited).toEqual(broadcasts);
        expect(yield* Ref.get(ledger)).toEqual(
          new Map([
            [
              "conversion-wrap",
              { _tag: "Confirmed", hash: awaited[0], transaction: wrap },
            ],
          ])
        );
      }).pipe(Effect.scoped)
  );

  it.effect(
    "resumes a wrap still confirming when its workflow ended, instead of signing it again",
    () =>
      Effect.gen(function* () {
        const signed: Array<string> = [];
        const waiting = yield* Deferred.make<void>();
        const ledger = makeDirectTransactionLedger();
        const kit = yield* makeTransactionWorkflowTestKit(
          capabilities({
            evmRpc: {
              // The first workflow ends while it waits for the receipt.
              awaitOutcome: () =>
                Deferred.isDone(waiting).pipe(
                  Effect.flatMap((resumed) =>
                    resumed
                      ? Effect.succeed("Confirmed" as const)
                      : Deferred.succeed(waiting, undefined).pipe(
                          Effect.andThen(Effect.never)
                        )
                  )
                ),
              broadcast: () => Effect.void,
              prepare: () => Effect.succeed("unsigned-wrap"),
            },
            signTransaction: (input) =>
              Effect.sync(() => signed.push(input.txMeta.txId)).pipe(
                Effect.as({ broadcasted: false, signedTx: "0x02aa" })
              ),
          })
        );
        const run = Effect.fnUntraced(function* <A, E>(
          until: (workflow: TransactionWorkflowHandle) => Effect.Effect<A, E>
        ) {
          const scope = yield* Scope.make();
          const services = yield* Layer.buildWithScope(kit.layer, scope);
          const workflow = yield* TransactionWorkflowService.use(({ make }) =>
            make(makeInput({ conversion: [wrap], ledger }))
          ).pipe(Effect.provide(services), Scope.provide(scope));
          yield* until(workflow);
          yield* Scope.close(scope, Exit.void);
        });

        yield* run(() => Deferred.await(waiting));
        const held = yield* Ref.get(ledger);
        yield* run((workflow) =>
          awaitState(workflow, (state) => state._tag === "Completed")
        );

        expect(held.get("conversion-wrap")?._tag).toBe("Sent");
        expect(signed).toEqual(["conversion-wrap", "deposit"]);
      }).pipe(Effect.scoped)
  );

  it.effect("skips a wrap its Ledger already confirmed", () =>
    Effect.gen(function* () {
      const signed: Array<string> = [];
      const ledger = makeDirectTransactionLedger();
      yield* Ref.set(
        ledger,
        new Map([
          [
            "conversion-wrap",
            { _tag: "Confirmed", hash: "0x01", transaction: wrap },
          ],
        ])
      );
      const workflow = yield* startWorkflow(
        capabilities({
          signTransaction: (input) =>
            Effect.sync(() => signed.push(input.txMeta.txId)).pipe(
              Effect.as({ broadcasted: false, signedTx: "0x02aa" })
            ),
        }),
        makeInput({ conversion: [wrap], ledger })
      );

      const completed = yield* awaitState(
        workflow,
        (state) => state._tag === "Completed"
      );

      expect(signed).toEqual(["deposit"]);
      expect(
        completed.context.batches[0]?.transactions.map(({ meta }) => meta.done)
      ).toEqual([true, true]);
    }).pipe(Effect.scoped)
  );

  it.effect("signs a reverted wrap again on Retry", () =>
    Effect.gen(function* () {
      const signed: Array<string> = [];
      let receipts = 0;
      const ledger = makeDirectTransactionLedger();
      const workflow = yield* startWorkflow(
        capabilities({
          evmRpc: {
            awaitOutcome: () =>
              Effect.succeed(++receipts === 1 ? "Reverted" : "Confirmed"),
            broadcast: () => Effect.void,
            prepare: () => Effect.succeed("unsigned-wrap"),
          },
          signTransaction: (input) =>
            Effect.sync(() => signed.push(input.txMeta.txId)).pipe(
              Effect.as({ broadcasted: false, signedTx: "0x02aa" })
            ),
        }),
        makeInput({ conversion: [wrap], ledger })
      );

      yield* awaitState(
        workflow,
        (state) => state._tag === "ConfirmationFailed"
      );
      const afterRevert = yield* Ref.get(ledger);
      yield* workflow.dispatch({ _tag: "Retry" });
      yield* awaitState(workflow, (state) => state._tag === "Completed");

      expect(afterRevert.size).toBe(0);
      expect(signed).toEqual(["conversion-wrap", "conversion-wrap", "deposit"]);
    }).pipe(Effect.scoped)
  );

  it.effect(
    "waits on the same wrap again when its receipt could not be read",
    () =>
      Effect.gen(function* () {
        const signed: Array<string> = [];
        let receipts = 0;
        const workflow = yield* startWorkflow(
          capabilities({
            evmRpc: {
              awaitOutcome: () =>
                ++receipts === 1
                  ? Effect.fail(
                      new EvmRpcError({
                        cause: null,
                        operation: "wait-receipt",
                      })
                    )
                  : Effect.succeed("Confirmed" as const),
              broadcast: () => Effect.void,
              prepare: () => Effect.succeed("unsigned-wrap"),
            },
            signTransaction: (input) =>
              Effect.sync(() => signed.push(input.txMeta.txId)).pipe(
                Effect.as({ broadcasted: false, signedTx: "0x02aa" })
              ),
          }),
          makeInput({ conversion: [wrap] })
        );

        yield* awaitState(
          workflow,
          (state) => state._tag === "ConfirmationFailed"
        );
        yield* workflow.dispatch({ _tag: "Retry" });
        yield* workflow.dispatch({ _tag: "Retry" });
        yield* awaitState(workflow, (state) => state._tag === "Completed");

        expect(receipts).toBe(2);
        expect(signed).toEqual(["conversion-wrap", "deposit"]);
      }).pipe(Effect.scoped)
  );

  it.effect(
    "records and confirms a wrap the wallet broadcast itself without rebroadcasting it",
    () =>
      Effect.gen(function* () {
        const ledger = makeDirectTransactionLedger();
        const awaited: Array<string> = [];
        const workflow = yield* startWorkflow(
          capabilities({
            evmRpc: {
              awaitOutcome: ({ hash }) =>
                Effect.sync(() => awaited.push(hash)).pipe(
                  Effect.as("Confirmed" as const)
                ),
              broadcast: () => Effect.die("rebroadcast a wallet broadcast"),
              prepare: () => Effect.succeed("unsigned-wrap"),
            },
            signTransaction: (input) =>
              Effect.succeed(
                input.txMeta.txId === "conversion-wrap"
                  ? { broadcasted: true, signedTx: "0xwallethash" }
                  : { broadcasted: false, signedTx: "0x02aa" }
              ),
          }),
          makeInput({ conversion: [wrap], ledger })
        );

        yield* awaitState(workflow, (state) => state._tag === "Completed");

        expect(awaited).toEqual(["0xwallethash"]);
        expect((yield* Ref.get(ledger)).get("conversion-wrap")).toEqual({
          _tag: "Confirmed",
          hash: "0xwallethash",
          transaction: wrap,
        });
      }).pipe(Effect.scoped)
  );

  it.effect("signs a wrap the node refused again on Retry", () =>
    Effect.gen(function* () {
      const signed: Array<string> = [];
      let broadcasts = 0;
      const ledger = makeDirectTransactionLedger();
      const workflow = yield* startWorkflow(
        capabilities({
          evmRpc: {
            awaitOutcome: () => Effect.succeed("Confirmed" as const),
            broadcast: () =>
              ++broadcasts === 1
                ? Effect.fail(new EvmBroadcastRejectedError({ cause: null }))
                : Effect.void,
            prepare: () => Effect.succeed("unsigned-wrap"),
          },
          signTransaction: (input) =>
            Effect.sync(() => signed.push(input.txMeta.txId)).pipe(
              Effect.as({ broadcasted: false, signedTx: "0x02aa" })
            ),
        }),
        makeInput({ conversion: [wrap], ledger })
      );

      yield* awaitState(workflow, (state) => state._tag === "SubmissionFailed");
      const afterRefusal = yield* Ref.get(ledger);
      yield* workflow.dispatch({ _tag: "Retry" });
      yield* awaitState(workflow, (state) => state._tag === "Completed");

      expect(afterRefusal.size).toBe(0);
      expect(signed).toEqual(["conversion-wrap", "conversion-wrap", "deposit"]);
    }).pipe(Effect.scoped)
  );

  it.effect(
    "keeps a wrap whose broadcast may have reached the node, and sends it again on Retry",
    () =>
      Effect.gen(function* () {
        const signed: Array<string> = [];
        const broadcast: Array<string> = [];
        const ledger = makeDirectTransactionLedger();
        const workflow = yield* startWorkflow(
          capabilities({
            evmRpc: {
              awaitOutcome: () => Effect.succeed("Confirmed" as const),
              broadcast: ({ signedTx }) =>
                Effect.suspend(() =>
                  broadcast.push(signedTx) === 1
                    ? Effect.fail(
                        new EvmRpcError({
                          cause: null,
                          operation: "broadcast",
                        })
                      )
                    : Effect.void
                ),
              prepare: () => Effect.succeed("unsigned-wrap"),
            },
            signTransaction: (input) =>
              Effect.sync(() => signed.push(input.txMeta.txId)).pipe(
                Effect.as({ broadcasted: false, signedTx: "0x02aa" })
              ),
          }),
          makeInput({ conversion: [wrap], ledger })
        );

        yield* awaitState(
          workflow,
          (state) => state._tag === "SubmissionFailed"
        );
        const held = yield* Ref.get(ledger);
        yield* workflow.dispatch({ _tag: "Retry" });
        yield* awaitState(workflow, (state) => state._tag === "Completed");

        expect(held.get("conversion-wrap")?._tag).toBe("Sent");
        expect(broadcast).toEqual(["0x02aa", "0x02aa"]);
        expect(signed).toEqual(["conversion-wrap", "deposit"]);
      }).pipe(Effect.scoped)
  );

  it.effect("signs a cancelled wrap once when Retry is sent twice", () =>
    Effect.gen(function* () {
      const signed: Array<string> = [];
      const workflow = yield* startWorkflow(
        capabilities({
          evmRpc: {
            awaitOutcome: () => Effect.succeed("Confirmed" as const),
            broadcast: () => Effect.void,
            prepare: () => Effect.succeed("unsigned-wrap"),
          },
          signTransaction: (input) =>
            Effect.suspend(() =>
              signed.push(input.txMeta.txId) === 1
                ? Effect.fail(
                    new WalletRequestCancelledError({
                      operation: "transaction",
                    })
                  )
                : Effect.succeed({ broadcasted: false, signedTx: "0x02aa" })
            ),
        }),
        makeInput({ conversion: [wrap] })
      );

      const cancelled = yield* awaitState(
        workflow,
        (state) => state._tag === "SignFailed"
      );
      yield* workflow.dispatch({ _tag: "Retry" });
      yield* workflow.dispatch({ _tag: "Retry" });
      yield* awaitState(workflow, (state) => state._tag === "Completed");

      expect(
        cancelled._tag === "SignFailed" && cancelled.error.reason._tag
      ).toBe("WalletRequestCancelled");
      expect(signed).toEqual(["conversion-wrap", "conversion-wrap", "deposit"]);
    }).pipe(Effect.scoped)
  );

  it.effect(
    "asks the wallet once for two Retries when it is declined again",
    () =>
      Effect.gen(function* () {
        const signed: Array<string> = [];
        const workflow = yield* startWorkflow(
          capabilities({
            evmRpc: {
              awaitOutcome: () => Effect.succeed("Confirmed" as const),
              broadcast: () => Effect.void,
              prepare: () => Effect.succeed("unsigned-wrap"),
            },
            signTransaction: (input) =>
              Effect.suspend(() => {
                signed.push(input.txMeta.txId);
                return Effect.fail(
                  new WalletRequestCancelledError({ operation: "transaction" })
                );
              }),
          }),
          makeInput({ conversion: [wrap] })
        );

        const first = yield* awaitState(
          workflow,
          (state) => state._tag === "SignFailed"
        );
        yield* workflow.dispatch({ _tag: "Retry" });
        yield* workflow.dispatch({ _tag: "Retry" });
        yield* awaitState(
          workflow,
          (state) => state._tag === "SignFailed" && state !== first
        );
        yield* Effect.repeat(Effect.yieldNow, { times: 20 });

        expect(signed).toEqual(["conversion-wrap", "conversion-wrap"]);
      }).pipe(Effect.scoped)
  );

  /** Runs `conversion` against an allowance that changes only as approvals land. */
  const convertWithAllowance = (
    conversion: ReadonlyArray<DirectTransaction>,
    initial: bigint,
    ledger = makeDirectTransactionLedger()
  ) =>
    Effect.gen(function* () {
      const signed: Array<string> = [];
      let allowance = initial;
      const workflow = yield* startWorkflow(
        capabilities({
          evmRpc: {
            awaitOutcome: () => Effect.succeed("Confirmed" as const),
            broadcast: () => Effect.void,
            prepare: () => Effect.succeed("unsigned-direct"),
            readAllowance: () => Effect.sync(() => allowance),
          },
          signTransaction: (input) =>
            Effect.sync(() => {
              signed.push(input.txMeta.txId);
              if (input.txMeta.txId.endsWith("-reset")) allowance = 0n;
              else if (input.txMeta.txId.includes("approval")) {
                allowance = approval.amount;
              }
              return { broadcasted: false, signedTx: "0x02aa" };
            }),
        }),
        makeInput({ conversion, ledger })
      );
      yield* awaitState(workflow, (state) => state._tag === "Completed");
      return signed;
    }).pipe(Effect.scoped);

  it.effect(
    "approves again when an approval that confirmed earlier no longer covers the amount",
    () =>
      Effect.gen(function* () {
        const ledger = makeDirectTransactionLedger();
        yield* Ref.set(
          ledger,
          new Map([
            [
              approve.id,
              { _tag: "Confirmed", hash: "0x01", transaction: approve },
            ],
          ])
        );

        expect(
          yield* convertWithAllowance([approve, wrap], 0n, ledger)
        ).toEqual(["conversion-approval", "conversion-wrap", "deposit"]);
      })
  );

  it.effect(
    "keeps a confirmed approval done once the wrap that spent it was sent",
    () =>
      Effect.gen(function* () {
        const ledger = makeDirectTransactionLedger();
        yield* Ref.set(
          ledger,
          new Map([
            [
              approve.id,
              { _tag: "Confirmed", hash: "0x01", transaction: approve },
            ],
            [wrap.id, { _tag: "Sent", hash: "0x02", transaction: wrap }],
          ])
        );

        // The wrap spent the allowance, so it reads zero again.
        expect(
          yield* convertWithAllowance([approve, wrap], 0n, ledger)
        ).toEqual(["deposit"]);
      })
  );

  it.effect(
    "confirms a reset an approval added before signing instead of resetting again",
    () =>
      Effect.gen(function* () {
        // The approval added this reset on an earlier confirm; it is still
        // pending, so the allowance stays short until it lands.
        const ledger = makeDirectTransactionLedger();
        yield* Ref.set(
          ledger,
          new Map([
            [reset.id, { _tag: "Sent", hash: "0x01", transaction: reset }],
          ])
        );
        const signed: Array<string> = [];
        const awaited: Array<string> = [];
        let allowance = 1n;
        const workflow = yield* startWorkflow(
          capabilities({
            evmRpc: {
              awaitOutcome: ({ hash }) =>
                Effect.sync(() => {
                  awaited.push(hash);
                  if (hash === "0x01") allowance = 0n;
                  return "Confirmed" as const;
                }),
              broadcast: () => Effect.void,
              prepare: () => Effect.succeed("unsigned-direct"),
              readAllowance: () => Effect.sync(() => allowance),
            },
            signTransaction: (input) =>
              Effect.sync(() => {
                signed.push(input.txMeta.txId);
                return { broadcasted: false, signedTx: "0x02aa" };
              }),
          }),
          // Planned upfront this time: the same reset as the one sent.
          makeInput({ conversion: [reset, approve, wrap], ledger })
        );

        yield* awaitState(workflow, (state) => state._tag === "Completed");

        expect(awaited[0]).toBe("0x01");
        expect(signed).toEqual([
          "conversion-approval",
          "conversion-wrap",
          "deposit",
        ]);
      }).pipe(Effect.scoped)
  );

  it.effect("skips approving once the allowance covers the amount", () =>
    Effect.gen(function* () {
      expect(
        yield* convertWithAllowance([reset, approve, wrap], approval.amount)
      ).toEqual(["conversion-wrap", "deposit"]);
    })
  );

  it.effect("skips the reset when no allowance is left to clear", () =>
    Effect.gen(function* () {
      expect(yield* convertWithAllowance([reset, approve, wrap], 0n)).toEqual([
        "conversion-approval",
        "conversion-wrap",
        "deposit",
      ]);
    })
  );

  it.effect(
    "resets an allowance that appeared after the plan was made before approving",
    () =>
      Effect.gen(function* () {
        expect(yield* convertWithAllowance([approve, wrap], 1n)).toEqual([
          "conversion-approval-reset",
          "conversion-approval",
          "conversion-wrap",
          "deposit",
        ]);
      })
  );

  it.effect(
    "reads the allowance again on Retry when it could not be read",
    () =>
      Effect.gen(function* () {
        let reads = 0;
        const workflow = yield* startWorkflow(
          capabilities({
            evmRpc: {
              awaitOutcome: () => Effect.succeed("Confirmed" as const),
              broadcast: () => Effect.void,
              prepare: () => Effect.succeed("unsigned-direct"),
              readAllowance: () =>
                ++reads === 1
                  ? Effect.fail(
                      new EvmRpcError({
                        cause: null,
                        operation: "read-allowance",
                      })
                    )
                  : Effect.succeed(0n),
            },
          }),
          makeInput({ conversion: [approve, wrap] })
        );

        yield* awaitState(workflow, (state) => state._tag === "SignFailed");
        yield* workflow.dispatch({ _tag: "Retry" });
        yield* awaitState(workflow, (state) => state._tag === "Completed");

        expect(reads).toBe(2);
      }).pipe(Effect.scoped)
  );

  describe("instant exit", () => {
    const requestId = Schema.decodeSync(ConfidentialHandle)(
      `0x${"ab".repeat(32)}`
    );
    const exitCommand = { address, arguments: {}, yieldId } as const;
    const instantInput = new ConfidentialTransactionWorkflowInput({
      conversion: [],
      finalizeUnwrap: { chainId: 11155111 },
      inputToken: undefined,
      ledger: makeDirectTransactionLedger(),
      preparation: {
        _tag: "Encrypt",
        amount: 7n,
        assetAddress: null,
        balance: null,
        command: exitCommand,
        conversion: null,
        instant: true,
        intent: "exit",
        requiresPermitSigner: false,
        yieldDto: {} as never,
      },
      providersDetails: [],
      walletScope,
      yieldId,
    });
    const step = (id: string, type: ActionTransaction["type"], index: number) =>
      yieldApiTransactionFixture({
        id,
        network: "ethereum",
        status: "CREATED",
        stepIndex: index,
        type,
        unsignedTransaction: "unsigned-payload",
      });
    const withdrawable = (shareAmountRaw: string) =>
      Schema.decodeSync(EarnPosition)({
        balances: [
          yieldBalanceFixture({
            amount: "",
            amountRaw: "",
            isEncrypted: true,
            pendingActions: [
              {
                intent: "manage",
                passthrough: `withdraw-${shareAmountRaw}`,
                type: "WITHDRAW",
              },
            ],
            shareAmountRaw,
            type: "withdrawable",
          }),
        ].map(zeroEncryptedBalance),
        yieldId,
      });

    it.effect(
      "finalizes the unwrap it requested in the same workflow: decrypts it, then withdraws and redeems",
      () =>
        Effect.gen(function* () {
          const previews: Array<ActionPreviewRequest> = [];
          const decrypted: Array<ConfidentialPreparation> = [];
          const read: Array<unknown> = [];
          const workflow = yield* startWorkflow(
            capabilities({
              yieldOperations: {
                getYieldBalances: () =>
                  Effect.succeed(withdrawable(`0x${"cd".repeat(32)}`)).pipe(
                    Effect.map((older) => ({
                      ...older,
                      balances: [
                        ...older.balances,
                        ...withdrawable(requestId).balances,
                      ],
                    }))
                  ),
                previewAction: (request) =>
                  Effect.sync(() => previews.push(request)).pipe(
                    Effect.as(
                      request.intent === "exit"
                        ? preparedAction([step("unwrap", "UNWRAP", 0)])
                        : preparedAction([
                            step("withdraw", "WITHDRAW", 0),
                            step("redeem", "REDEEM", 1),
                          ])
                    )
                  ),
                submitSignedTransaction: ({ transactionId }) =>
                  Effect.succeed({
                    explorerUrl: null,
                    hash: `0x${transactionId}`,
                    status: "BROADCASTED",
                  } as never),
              },
              zama: {
                decryptCommand: (preparation) =>
                  Effect.sync(() => decrypted.push(preparation)).pipe(
                    Effect.as(preparation.command)
                  ),
                encryptCommand: ({ command }) => Effect.succeed(command),
                readUnwrapRequest: (input) =>
                  Effect.sync(() => read.push(input)).pipe(
                    Effect.as(requestId)
                  ),
              },
            }),
            instantInput
          );

          const completed = yield* awaitState(
            workflow,
            (state) => state._tag === "Completed"
          );

          expect(read).toEqual([
            { chainId: 11155111, hash: "0xunwrap", owner: address },
          ]);
          expect(decrypted).toEqual([
            {
              _tag: "Decrypt",
              chainId: 11155111,
              command: {
                action: "WITHDRAW",
                address,
                arguments: {},
                passthrough: `withdraw-${requestId}`,
                yieldId,
              },
              handle: requestId,
            },
          ]);
          expect(previews.map(({ intent }) => intent)).toEqual([
            "exit",
            "manage",
          ]);
          expect(
            completed.context.batches.flatMap((batch) =>
              batch.transactions.map(({ meta, source }) => [
                source.transaction.id,
                meta.done,
              ])
            )
          ).toEqual([
            ["unwrap", true],
            ["withdraw", true],
            ["redeem", true],
          ]);
          expect(completed.context.finalize).toEqual({
            done: true,
            position: 1,
          });
        }).pipe(Effect.scoped)
    );

    it.effect(
      "waits until the API lists the unwrap it requested before finalizing it",
      () =>
        Effect.gen(function* () {
          let reads = 0;
          const workflow = yield* startWorkflow(
            capabilities({
              yieldOperations: {
                getYieldBalances: () =>
                  Effect.sync(() => ++reads).pipe(
                    Effect.map((count) =>
                      count < 3
                        ? withdrawable(`0x${"cd".repeat(32)}`)
                        : withdrawable(requestId)
                    )
                  ),
                previewAction: (request) =>
                  Effect.succeed(
                    request.intent === "exit"
                      ? preparedAction([step("unwrap", "UNWRAP", 0)])
                      : preparedAction([step("withdraw", "WITHDRAW", 0)])
                  ),
                submitSignedTransaction: ({ transactionId }) =>
                  Effect.succeed({
                    explorerUrl: null,
                    hash: `0x${transactionId}`,
                    status: "BROADCASTED",
                  } as never),
              },
              zama: {
                decryptCommand: ({ command }) => Effect.succeed(command),
                encryptCommand: ({ command }) => Effect.succeed(command),
                readUnwrapRequest: () => Effect.succeed(requestId),
              },
            }),
            instantInput
          );

          const completion = yield* awaitState(
            workflow,
            (state) => state._tag === "Completed"
          ).pipe(Effect.forkScoped);
          yield* TestClock.adjust("1 minute");
          yield* Fiber.join(completion);

          expect(reads).toBe(3);
        }).pipe(Effect.scoped)
    );
  });
});
