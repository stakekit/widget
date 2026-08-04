import {
  Deferred,
  Effect,
  Layer,
  Schema,
  Stream,
  SubscriptionRef,
} from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { describe, expect, it } from "vitest";
import { transactionWorkflowResourceEventProjection } from "../../src/app/runtime/transaction-workflow-event-projection";
import { WalletAddress } from "../../src/domain/schema/identifiers";
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
  WalletScopeKey,
  walletScopeOwnerKey,
} from "../../src/services/wallet/domain/scope";

const owner = walletScopeOwnerKey(
  new WalletScopeKey({
    address: Schema.decodeSync(WalletAddress)(
      "0x0000000000000000000000000000000000000001"
    ),
    network: "ethereum",
  })
);

describe("Transaction Workflow resource event projection", () => {
  it("invalidates Classic resources only after the owner workflow ends", async () => {
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
            Layer.succeed(Reactivity.Reactivity, reactivity)
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
});
