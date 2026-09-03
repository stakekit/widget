import { describe, expect, it } from "@effect/vitest";
import {
  type Duration,
  Effect,
  Layer,
  Schema,
  Stream,
  SubscriptionRef,
} from "effect";
import { TestClock } from "effect/testing";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
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
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
  type WalletState,
} from "../../src/services/wallet/wallet-state";
import { makeTestWallet } from "../utils/services/wallet-service";

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
      )
  );
});
