import { describe, expect, it } from "@effect/vitest";
import {
  type Duration,
  Effect,
  Exit,
  Layer,
  Option,
  Schema,
  Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { TestClock } from "effect/testing";
import { transactionWorkflowResourceEventProjection } from "../../src/app/runtime/transaction-workflow-event-projection";
import { Action } from "../../src/domain/borrow/execution/action";
import { Transaction } from "../../src/domain/borrow/execution/transaction";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import {
  WalletScopeKey,
  walletScopeOwnerKey,
} from "../../src/domain/wallet/wallet-scope";
import type { BorrowOperations } from "../../src/services/api/operations";
import {
  type WidgetDomainEvent,
  WidgetDomainEvents,
} from "../../src/services/events/widget-domain-events";
import {
  ActivityInvalidationKey,
  SingleYieldBalancesInvalidationKey,
  WalletBalancesInvalidationKey,
  YieldPositionsInvalidationKey,
} from "../../src/services/resource-invalidation";
import {
  BorrowTransactionWorkflowInput,
  type TransactionWorkflowState,
} from "../../src/services/transaction-workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../src/services/transaction-workflow/transaction-workflow-service";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
  type WalletState,
} from "../../src/services/wallet/wallet-state";
import { makeConnectedWalletState } from "../fixtures/wallet-state";
import { makeTestWallet } from "../utils/services/wallet-service";
import { makeTransactionWorkflowTestKit } from "../utils/transaction-workflow-test-kit";

const owner = walletScopeOwnerKey(
  new WalletScopeKey({
    address: Schema.decodeSync(WalletAddress)(
      "0x0000000000000000000000000000000000000001"
    ),
    network: "ethereum",
  })
);

const connectedWalletState: WalletState = {
  connection: {
    additionalAddresses: null,
    address: owner.address,
    chain: {} as never,
    connector: {} as never,
    connectorChains: [],
    isLedgerLive: false,
    isLedgerLiveAccountPlaceholder: false,
    ledgerAccounts: [],
    network: owner.network,
    status: "connected",
  } satisfies NormalizedWalletState,
  ledger: disconnectedLedgerConnectorState,
};

const disconnectedWalletState: WalletState = {
  connection: disconnectedNormalizedWalletState,
  ledger: disconnectedLedgerConnectorState,
};

type WorkflowKind = Extract<
  WidgetDomainEvent,
  { readonly _tag: "TransactionWorkflowEnded" }
>["workflowKind"];

const makeProjectionHarness = Effect.fn("makeProjectionHarness")(function* (
  initialWalletState: WalletState
) {
  const eventRef = yield* SubscriptionRef.make<WidgetDomainEvent>({
    _tag: "TransactionWorkflowStarted",
    owner,
  });
  const invalidationRef = yield* SubscriptionRef.make<
    ReadonlyArray<ReadonlyArray<unknown>>
  >([]);
  const wallet = yield* makeTestWallet({ initialState: initialWalletState });
  const reactivity = yield* Reactivity.make;
  const recordingReactivity = Reactivity.Reactivity.of({
    ...reactivity,
    invalidate: (keys) => {
      if (!Array.isArray(keys)) {
        return Effect.die(
          "makeProjectionHarness: expected array invalidation keys"
        );
      }
      return SubscriptionRef.update(invalidationRef, (current) => [
        ...current,
        keys,
      ]);
    },
  });
  const events = WidgetDomainEvents.of({
    events: SubscriptionRef.changes(eventRef),
    publish: () =>
      Effect.die("makeProjectionHarness: unexpected domain event publish"),
  });
  const dependencies = Layer.mergeAll(
    wallet.layer,
    Layer.succeed(WidgetDomainEvents, events),
    Layer.succeed(Reactivity.Reactivity, recordingReactivity)
  );

  yield* transactionWorkflowResourceEventProjection.pipe(
    Stream.runDrain,
    Effect.provide(dependencies),
    Effect.forkScoped({ startImmediately: true })
  );

  const awaitInvalidationCount = Effect.fn(
    "makeProjectionHarness.awaitInvalidationCount"
  )(function* (count: number) {
    const current = yield* SubscriptionRef.get(invalidationRef);
    if (current.length >= count) {
      return;
    }
    yield* SubscriptionRef.changes(invalidationRef).pipe(
      Stream.filter((invalidations) => invalidations.length >= count),
      Stream.take(1),
      Stream.runDrain
    );
  });

  return {
    advanceTime: (duration: Duration.Input) =>
      TestClock.adjust(duration).pipe(Effect.andThen(Effect.yieldNow)),
    awaitInvalidationCount,
    endWorkflow: (workflowKind: WorkflowKind) =>
      SubscriptionRef.set(eventRef, {
        _tag: "TransactionWorkflowEnded",
        owner,
        workflowKind,
      }),
    invalidations: SubscriptionRef.get(invalidationRef),
    setWalletState: (state: WalletState) =>
      wallet.setState(state).pipe(Effect.andThen(Effect.yieldNow)),
  } as const;
});

const borrowWalletScope = new WalletScopeKey({
  address: owner.address,
  network: owner.network,
});

const borrowTransaction = (
  id: string,
  status: Transaction["status"] = "WAITING_FOR_SIGNATURE"
) =>
  Schema.decodeSync(Transaction)({
    address: owner.address,
    chainId: "1",
    id,
    network: "ethereum",
    signablePayload: JSON.stringify({
      data: "0xabcdef",
      from: owner.address,
      gasLimit: "21000",
      to: "0x0000000000000000000000000000000000000002",
      value: "0",
    }),
    signingFormat: "EVM_TRANSACTION",
    status,
    type: id === "supply" ? "SUPPLY" : "BORROW",
  });

const supplyAndBorrowAction = ({
  status,
  transactions,
}: {
  readonly status: string;
  readonly transactions: ReadonlyArray<Transaction>;
}) =>
  Schema.decodeUnknownSync(Action)({
    address: owner.address,
    action: "supplyAndBorrow",
    createdAt: "2026-07-10T12:00:00.000Z",
    currentStep: 1,
    hasNextStep: false,
    id: "supply-and-borrow-1",
    integrationId: "aave-borrow",
    rawArguments: { amount: "1", amountRaw: "1000000", marketId: "market-1" },
    status,
    totalSteps: 1,
    transactions: transactions.map((transaction) =>
      Schema.encodeSync(Transaction)(transaction)
    ),
  });

const borrowResourceKeyTags = [
  "WalletBalancesInvalidationKey",
  "BorrowPositionsInvalidationKey",
  "BorrowMarketsInvalidationKey",
  "ActivityInvalidationKey",
];

/**
 * Runs a real Borrow Transaction Workflow next to the projection and returns
 * what was invalidated once the workflow reaches `settledTag`, while its scope
 * is still open (the success page lives in that scope).
 */
const invalidationsBeforeTeardown = Effect.fn("invalidationsBeforeTeardown")(
  function* ({
    expectedInvalidations,
    getAction,
    settledTag,
  }: {
    readonly expectedInvalidations: number;
    readonly getAction: BorrowOperations["Service"]["getAction"];
    readonly settledTag: TransactionWorkflowState["_tag"];
  }) {
    const invalidationRef = yield* SubscriptionRef.make<
      ReadonlyArray<ReadonlyArray<string>>
    >([]);
    const reactivity = yield* Reactivity.make;
    const recordingReactivity = Reactivity.Reactivity.of({
      ...reactivity,
      invalidate: (keys) => {
        if (!Array.isArray(keys)) {
          return Effect.die(
            "invalidationsBeforeTeardown: expected array invalidation keys"
          );
        }
        const tags = keys.map((key: unknown) =>
          typeof key === "object" && key !== null && "_tag" in key
            ? String(key._tag)
            : String(key)
        );
        return SubscriptionRef.update(invalidationRef, (current) => [
          ...current,
          tags,
        ]);
      },
    });
    const kit = yield* makeTransactionWorkflowTestKit({
      borrow: {
        getAction,
        submitTransaction: () =>
          Effect.succeed({
            link: "https://explorer.test/borrow",
            status: "BROADCASTED",
            transactionHash:
              "0x1111111111111111111111111111111111111111111111111111111111111111",
          }),
      },
      initialWalletState: makeConnectedWalletState(borrowWalletScope),
      wallet: {
        signTransaction: () =>
          Effect.succeed({ broadcasted: false, signedTx: "0xsigned" }),
      },
    });

    yield* transactionWorkflowResourceEventProjection.pipe(
      Stream.runDrain,
      Effect.provide(
        Layer.merge(
          kit.layer,
          Layer.succeed(Reactivity.Reactivity, recordingReactivity)
        )
      ),
      Effect.forkScoped({ startImmediately: true })
    );
    yield* Effect.yieldNow;

    const workflowScope = yield* Scope.make();
    const workflow = yield* TransactionWorkflowService.use(({ make }) =>
      make(
        new BorrowTransactionWorkflowInput({
          action: supplyAndBorrowAction({
            status: "CREATED",
            transactions: [
              borrowTransaction("supply"),
              borrowTransaction("borrow"),
            ],
          }),
          walletScope: borrowWalletScope,
        })
      )
    ).pipe(
      Effect.provide(kit.layer),
      Effect.provideService(Scope.Scope, workflowScope)
    );

    const settled = yield* workflow.states.pipe(
      Stream.filter((state) => state._tag === settledTag),
      Stream.runHead,
      Effect.timeoutOption("2 seconds"),
      Effect.map(Option.flatten),
      Effect.map(Option.map((state) => state._tag)),
      Effect.map(Option.getOrNull)
    );
    yield* SubscriptionRef.changes(invalidationRef).pipe(
      Stream.filter(
        (invalidations) => invalidations.length >= expectedInvalidations
      ),
      Stream.take(1),
      Stream.runDrain,
      Effect.timeoutOption("1 second")
    );

    const invalidations = yield* SubscriptionRef.get(invalidationRef);
    yield* Scope.close(workflowScope, Exit.void);

    return { invalidations, settled };
  }
);

describe("Transaction Workflow resource event projection", () => {
  it.effect("immediately invalidates Classic resources for a stale owner", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const projection = yield* makeProjectionHarness(
          disconnectedWalletState
        );

        yield* projection.endWorkflow("Classic");
        yield* projection.awaitInvalidationCount(1);

        expect(yield* projection.invalidations).toEqual([
          [
            new WalletBalancesInvalidationKey({ scope: owner }),
            new YieldPositionsInvalidationKey({ scope: owner }),
            new SingleYieldBalancesInvalidationKey({ address: owner.address }),
            new ActivityInvalidationKey({ scope: owner }),
          ],
        ]);
      })
    )
  );

  it.effect(
    "reconciles Classic balances and positions four more times at ten-second intervals",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const projection = yield* makeProjectionHarness(connectedWalletState);

          yield* projection.endWorkflow("Classic");
          yield* projection.awaitInvalidationCount(1);

          expect(yield* projection.invalidations).toEqual([
            [
              new WalletBalancesInvalidationKey({ scope: owner }),
              new YieldPositionsInvalidationKey({ scope: owner }),
              new SingleYieldBalancesInvalidationKey({
                address: owner.address,
              }),
              new ActivityInvalidationKey({ scope: owner }),
            ],
          ]);

          yield* projection.advanceTime("9999 millis");
          expect(yield* projection.invalidations).toHaveLength(1);

          yield* projection.advanceTime("1 millis");
          yield* projection.awaitInvalidationCount(2);

          yield* Effect.forEach(
            [3, 4, 5],
            (count) =>
              projection
                .advanceTime("10 seconds")
                .pipe(Effect.andThen(projection.awaitInvalidationCount(count))),
            { discard: true }
          );
          expect(yield* projection.invalidations).toEqual([
            [
              new WalletBalancesInvalidationKey({ scope: owner }),
              new YieldPositionsInvalidationKey({ scope: owner }),
              new SingleYieldBalancesInvalidationKey({
                address: owner.address,
              }),
              new ActivityInvalidationKey({ scope: owner }),
            ],
            ...Array.from({ length: 4 }, () => [
              new WalletBalancesInvalidationKey({ scope: owner }),
              new YieldPositionsInvalidationKey({ scope: owner }),
              new SingleYieldBalancesInvalidationKey({
                address: owner.address,
              }),
            ]),
          ]);
        })
      )
  );

  it.effect(
    "replaces the active reconciliation when another eligible workflow ends",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const projection = yield* makeProjectionHarness(connectedWalletState);

          yield* projection.endWorkflow("Classic");
          yield* projection.awaitInvalidationCount(1);

          yield* projection.advanceTime("5 seconds");
          yield* projection.endWorkflow("Classic");
          yield* projection.awaitInvalidationCount(2);

          yield* projection.advanceTime("5 seconds");
          expect(yield* projection.invalidations).toHaveLength(2);

          yield* projection.advanceTime("5 seconds");
          yield* projection.awaitInvalidationCount(3);

          yield* Effect.forEach(
            [4, 5, 6],
            (count) =>
              projection
                .advanceTime("10 seconds")
                .pipe(Effect.andThen(projection.awaitInvalidationCount(count))),
            { discard: true }
          );
          expect(yield* projection.invalidations).toHaveLength(6);
        })
      )
  );

  it.effect(
    "cancels reconciliation when the Wallet Scope Owner disconnects",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const projection = yield* makeProjectionHarness(connectedWalletState);

          yield* projection.endWorkflow("Classic");
          yield* projection.awaitInvalidationCount(1);

          yield* projection.advanceTime("5 seconds");
          yield* projection.setWalletState(disconnectedWalletState);
          yield* projection.advanceTime("40 seconds");

          expect(yield* projection.invalidations).toHaveLength(1);
        })
      )
  );

  it.effect(
    "reconciles Borrow balances and positions without repeating Borrow markets",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const projection = yield* makeProjectionHarness(connectedWalletState);

          yield* projection.endWorkflow("Borrow");
          yield* projection.awaitInvalidationCount(1);
          yield* Effect.forEach(
            [2, 3, 4, 5],
            (count) =>
              projection
                .advanceTime("10 seconds")
                .pipe(Effect.andThen(projection.awaitInvalidationCount(count))),
            { discard: true }
          );

          expect(
            (yield* projection.invalidations).map((keys) =>
              keys.map((key) => (key as { readonly _tag: string })._tag)
            )
          ).toEqual([
            borrowResourceKeyTags,
            ...Array.from({ length: 4 }, () => [
              "WalletBalancesInvalidationKey",
              "BorrowPositionsInvalidationKey",
            ]),
          ]);
        })
      )
  );

  it.live(
    "refreshes Borrow resources as each transaction confirms and when the action completes, before the workflow is left",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          let checks = 0;
          const result = yield* invalidationsBeforeTeardown({
            expectedInvalidations: 3,
            getAction: () => {
              checks += 1;
              return Effect.succeed(
                checks === 1
                  ? supplyAndBorrowAction({
                      status: "PROCESSING",
                      transactions: [
                        borrowTransaction("supply", "CONFIRMED"),
                        borrowTransaction("borrow"),
                      ],
                    })
                  : supplyAndBorrowAction({
                      status: "SUCCESS",
                      transactions: [
                        borrowTransaction("supply", "CONFIRMED"),
                        borrowTransaction("borrow", "CONFIRMED"),
                      ],
                    })
              );
            },
            settledTag: "Completed",
          });

          expect(result).toEqual({
            invalidations: [
              borrowResourceKeyTags,
              borrowResourceKeyTags,
              borrowResourceKeyTags,
            ],
            settled: "Completed",
          });
        })
      )
  );

  it.live(
    "refreshes Borrow resources when the action fails after its supply confirmed, before the workflow is left",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          let checks = 0;
          const result = yield* invalidationsBeforeTeardown({
            expectedInvalidations: 2,
            getAction: () => {
              checks += 1;
              return Effect.succeed(
                supplyAndBorrowAction({
                  status: "PROCESSING",
                  transactions: [
                    borrowTransaction("supply", "CONFIRMED"),
                    borrowTransaction(
                      "borrow",
                      checks === 1 ? "WAITING_FOR_SIGNATURE" : "FAILED"
                    ),
                  ],
                })
              );
            },
            settledTag: "ConfirmationFailed",
          });

          expect(result).toEqual({
            invalidations: [borrowResourceKeyTags, borrowResourceKeyTags],
            settled: "ConfirmationFailed",
          });
        })
      )
  );

  it.live(
    "refreshes Borrow resources when the first status check reports a failed action whose supply confirmed",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const result = yield* invalidationsBeforeTeardown({
            expectedInvalidations: 1,
            getAction: () =>
              Effect.succeed(
                supplyAndBorrowAction({
                  status: "FAILED",
                  transactions: [
                    borrowTransaction("supply", "CONFIRMED"),
                    borrowTransaction("borrow", "FAILED"),
                  ],
                })
              ),
            settledTag: "ConfirmationFailed",
          });

          expect(result).toEqual({
            invalidations: [borrowResourceKeyTags],
            settled: "ConfirmationFailed",
          });
        })
      )
  );
});
