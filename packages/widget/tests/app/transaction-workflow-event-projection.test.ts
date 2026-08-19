import {
  Deferred,
  Effect,
  Layer,
  Schema,
  Stream,
  SubscriptionRef,
} from "effect";
import { TestClock } from "effect/testing";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { describe, expect, it } from "vitest";
import { transactionWorkflowResourceEventProjection } from "../../src/app/runtime/transaction-workflow-event-projection";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import {
  WalletScopeKey,
  walletScopeOwnerKey,
} from "../../src/domain/wallet/wallet-scope";
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
import { WalletService } from "../../src/services/wallet/wallet-service";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
  type WalletState,
} from "../../src/services/wallet/wallet-state";

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

const makeWallet = (
  state: Effect.Effect<WalletState>,
  states: Stream.Stream<WalletState> = Stream.never
) =>
  WalletService.of({
    state,
    states,
  } as never);

describe("Transaction Workflow resource event projection", () => {
  it("immediately invalidates Classic resources for a stale owner", async () => {
    const eventRef = Effect.runSync(
      SubscriptionRef.make<WidgetDomainEvent>({
        _tag: "TransactionWorkflowStarted",
        owner,
      })
    );
    const invalidated = await Effect.runPromise(
      Deferred.make<ReadonlyArray<unknown>>()
    );
    const reactivity = Reactivity.Reactivity.of({
      invalidate: (keys: ReadonlyArray<unknown>) =>
        Deferred.succeed(invalidated, keys).pipe(Effect.asVoid),
      withBatch: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
    } as never);
    const events = WidgetDomainEvents.of({
      events: SubscriptionRef.changes(eventRef),
      publish: () => Effect.void,
    });

    const keys = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* transactionWorkflowResourceEventProjection.pipe(
            Stream.runDrain,
            Effect.forkScoped({ startImmediately: true })
          );
          yield* SubscriptionRef.set(eventRef, {
            _tag: "TransactionWorkflowEnded",
            owner,
            workflowKind: "Classic",
          });
          return yield* Deferred.await(invalidated);
        })
      ).pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(WidgetDomainEvents, events),
            Layer.succeed(Reactivity.Reactivity, reactivity),
            Layer.succeed(
              WalletService,
              makeWallet(Effect.succeed(disconnectedWalletState))
            )
          )
        )
      )
    );

    expect(keys).toEqual([
      new WalletBalancesInvalidationKey({ scope: owner }),
      new YieldPositionsInvalidationKey({ scope: owner }),
      new SingleYieldBalancesInvalidationKey({ address: owner.address }),
      new ActivityInvalidationKey({ scope: owner }),
    ]);
  });

  it("reconciles Classic balances and positions four more times at ten-second intervals", async () => {
    const eventRef = Effect.runSync(
      SubscriptionRef.make<WidgetDomainEvent>({
        _tag: "TransactionWorkflowStarted",
        owner,
      })
    );
    const firstInvalidation = Effect.runSync(Deferred.make<void>());
    const invalidations: Array<ReadonlyArray<unknown>> = [];
    const reactivity = Reactivity.Reactivity.of({
      invalidate: (keys: ReadonlyArray<unknown>) =>
        Effect.gen(function* () {
          invalidations.push(keys);
          yield* Deferred.succeed(firstInvalidation, undefined);
        }),
      withBatch: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
    } as never);
    const events = WidgetDomainEvents.of({
      events: SubscriptionRef.changes(eventRef),
      publish: () => Effect.void,
    });
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* transactionWorkflowResourceEventProjection.pipe(
            Stream.runDrain,
            Effect.forkScoped({ startImmediately: true })
          );
          yield* SubscriptionRef.set(eventRef, {
            _tag: "TransactionWorkflowEnded",
            owner,
            workflowKind: "Classic",
          });
          yield* Deferred.await(firstInvalidation);

          expect(invalidations).toEqual([
            [
              new WalletBalancesInvalidationKey({ scope: owner }),
              new YieldPositionsInvalidationKey({ scope: owner }),
              new SingleYieldBalancesInvalidationKey({
                address: owner.address,
              }),
              new ActivityInvalidationKey({ scope: owner }),
            ],
          ]);

          yield* TestClock.adjust("9999 millis");
          expect(invalidations).toHaveLength(1);

          yield* TestClock.adjust("1 millis");
          yield* Effect.yieldNow;
          expect(invalidations).toHaveLength(2);

          yield* Effect.forEach(
            [1, 2, 3],
            () =>
              TestClock.adjust("10 seconds").pipe(
                Effect.andThen(Effect.yieldNow)
              ),
            { discard: true }
          );
          expect(invalidations).toEqual([
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
      ).pipe(
        Effect.provide(
          Layer.mergeAll(
            TestClock.layer(),
            Layer.succeed(WidgetDomainEvents, events),
            Layer.succeed(Reactivity.Reactivity, reactivity),
            Layer.succeed(
              WalletService,
              makeWallet(Effect.succeed(connectedWalletState))
            )
          )
        )
      )
    );
  });

  it("replaces the active reconciliation when another eligible workflow ends", async () => {
    const eventRef = Effect.runSync(
      SubscriptionRef.make<WidgetDomainEvent>({
        _tag: "TransactionWorkflowStarted",
        owner,
      })
    );
    const firstInvalidation = Effect.runSync(Deferred.make<void>());
    const secondInvalidation = Effect.runSync(Deferred.make<void>());
    const invalidations: Array<ReadonlyArray<unknown>> = [];
    const reactivity = Reactivity.Reactivity.of({
      invalidate: (keys: ReadonlyArray<unknown>) =>
        Effect.gen(function* () {
          invalidations.push(keys);
          if (invalidations.length === 1) {
            yield* Deferred.succeed(firstInvalidation, undefined);
          }
          if (invalidations.length === 2) {
            yield* Deferred.succeed(secondInvalidation, undefined);
          }
        }),
      withBatch: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
    } as never);
    const events = WidgetDomainEvents.of({
      events: SubscriptionRef.changes(eventRef),
      publish: () => Effect.void,
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* transactionWorkflowResourceEventProjection.pipe(
            Stream.runDrain,
            Effect.forkScoped({ startImmediately: true })
          );
          yield* SubscriptionRef.set(eventRef, {
            _tag: "TransactionWorkflowEnded",
            owner,
            workflowKind: "Classic",
          });
          yield* Deferred.await(firstInvalidation);

          yield* TestClock.adjust("5 seconds");
          yield* SubscriptionRef.set(eventRef, {
            _tag: "TransactionWorkflowEnded",
            owner,
            workflowKind: "Classic",
          });
          yield* Deferred.await(secondInvalidation);

          yield* TestClock.adjust("5 seconds");
          yield* Effect.yieldNow;
          expect(invalidations).toHaveLength(2);

          yield* TestClock.adjust("5 seconds");
          yield* Effect.yieldNow;
          expect(invalidations).toHaveLength(3);

          yield* Effect.forEach(
            [1, 2, 3],
            () =>
              TestClock.adjust("10 seconds").pipe(
                Effect.andThen(Effect.yieldNow)
              ),
            { discard: true }
          );
          expect(invalidations).toHaveLength(6);
        })
      ).pipe(
        Effect.provide(
          Layer.mergeAll(
            TestClock.layer(),
            Layer.succeed(WidgetDomainEvents, events),
            Layer.succeed(Reactivity.Reactivity, reactivity),
            Layer.succeed(
              WalletService,
              makeWallet(Effect.succeed(connectedWalletState))
            )
          )
        )
      )
    );
  });

  it("cancels reconciliation when the Wallet Scope Owner disconnects", async () => {
    const eventRef = Effect.runSync(
      SubscriptionRef.make<WidgetDomainEvent>({
        _tag: "TransactionWorkflowStarted",
        owner,
      })
    );
    const walletStateRef = Effect.runSync(
      SubscriptionRef.make<WalletState>(connectedWalletState)
    );
    const firstInvalidation = Effect.runSync(Deferred.make<void>());
    const invalidations: Array<ReadonlyArray<unknown>> = [];
    const reactivity = Reactivity.Reactivity.of({
      invalidate: (keys: ReadonlyArray<unknown>) =>
        Effect.gen(function* () {
          invalidations.push(keys);
          yield* Deferred.succeed(firstInvalidation, undefined);
        }),
      withBatch: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
    } as never);
    const events = WidgetDomainEvents.of({
      events: SubscriptionRef.changes(eventRef),
      publish: () => Effect.void,
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* transactionWorkflowResourceEventProjection.pipe(
            Stream.runDrain,
            Effect.forkScoped({ startImmediately: true })
          );
          yield* SubscriptionRef.set(eventRef, {
            _tag: "TransactionWorkflowEnded",
            owner,
            workflowKind: "Classic",
          });
          yield* Deferred.await(firstInvalidation);

          yield* TestClock.adjust("5 seconds");
          yield* SubscriptionRef.set(walletStateRef, disconnectedWalletState);
          yield* Effect.yieldNow;
          yield* Effect.forEach(
            [1, 2, 3, 4],
            () =>
              TestClock.adjust("10 seconds").pipe(
                Effect.andThen(Effect.yieldNow)
              ),
            { discard: true }
          );

          expect(invalidations).toHaveLength(1);
        })
      ).pipe(
        Effect.provide(
          Layer.mergeAll(
            TestClock.layer(),
            Layer.succeed(WidgetDomainEvents, events),
            Layer.succeed(Reactivity.Reactivity, reactivity),
            Layer.succeed(
              WalletService,
              makeWallet(
                SubscriptionRef.get(walletStateRef),
                SubscriptionRef.changes(walletStateRef)
              )
            )
          )
        )
      )
    );
  });

  it("reconciles Borrow balances and positions without repeating Borrow markets", async () => {
    const eventRef = Effect.runSync(
      SubscriptionRef.make<WidgetDomainEvent>({
        _tag: "TransactionWorkflowStarted",
        owner,
      })
    );
    const firstInvalidation = Effect.runSync(Deferred.make<void>());
    const invalidations: Array<ReadonlyArray<unknown>> = [];
    const reactivity = Reactivity.Reactivity.of({
      invalidate: (keys: ReadonlyArray<unknown>) =>
        Effect.gen(function* () {
          invalidations.push(keys);
          yield* Deferred.succeed(firstInvalidation, undefined);
        }),
      withBatch: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
    } as never);
    const events = WidgetDomainEvents.of({
      events: SubscriptionRef.changes(eventRef),
      publish: () => Effect.void,
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* transactionWorkflowResourceEventProjection.pipe(
            Stream.runDrain,
            Effect.forkScoped({ startImmediately: true })
          );
          yield* SubscriptionRef.set(eventRef, {
            _tag: "TransactionWorkflowEnded",
            owner,
            workflowKind: "Borrow",
          });
          yield* Deferred.await(firstInvalidation);
          yield* Effect.forEach(
            [1, 2, 3, 4],
            () =>
              TestClock.adjust("10 seconds").pipe(
                Effect.andThen(Effect.yieldNow)
              ),
            { discard: true }
          );

          expect(
            invalidations.map((keys) =>
              keys.map((key) => (key as { readonly _tag: string })._tag)
            )
          ).toEqual([
            [
              "WalletBalancesInvalidationKey",
              "BorrowPositionsInvalidationKey",
              "BorrowMarketsInvalidationKey",
            ],
            ...Array.from({ length: 4 }, () => [
              "WalletBalancesInvalidationKey",
              "BorrowPositionsInvalidationKey",
            ]),
          ]);
        })
      ).pipe(
        Effect.provide(
          Layer.mergeAll(
            TestClock.layer(),
            Layer.succeed(WidgetDomainEvents, events),
            Layer.succeed(Reactivity.Reactivity, reactivity),
            Layer.succeed(
              WalletService,
              makeWallet(Effect.succeed(connectedWalletState))
            )
          )
        )
      )
    );
  });
});
