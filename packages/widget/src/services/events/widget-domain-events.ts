import { Context, Effect, Layer, PubSub, Stream } from "effect";
import type { WalletScopeOwnerKey } from "../wallet/domain/scope";

export type WidgetDomainEvent =
  | Readonly<{
      readonly _tag: "TransactionWorkflowStarted";
      readonly owner: WalletScopeOwnerKey;
    }>
  | Readonly<{
      readonly _tag: "TransactionWorkflowEnded";
      readonly owner: WalletScopeOwnerKey;
      readonly workflowKind: "Borrow" | "Classic";
    }>;

type WidgetDomainEventsApi = Readonly<{
  readonly events: Stream.Stream<WidgetDomainEvent>;
  readonly publish: (event: WidgetDomainEvent) => Effect.Effect<void>;
}>;

export class WidgetDomainEvents extends Context.Service<
  WidgetDomainEvents,
  WidgetDomainEventsApi
>()("stakekit/widget/events/WidgetDomainEvents") {
  static readonly layer = Layer.effect(
    WidgetDomainEvents,
    Effect.gen(function* () {
      const pubsub = yield* PubSub.unbounded<WidgetDomainEvent>();
      yield* Effect.addFinalizer(() => PubSub.shutdown(pubsub));

      const publish = Effect.fn("WidgetDomainEvents.publish")(function* (
        event: WidgetDomainEvent
      ) {
        yield* PubSub.publish(pubsub, event);
      });

      return WidgetDomainEvents.of({
        events: Stream.fromPubSub(pubsub),
        publish,
      });
    })
  );
}
