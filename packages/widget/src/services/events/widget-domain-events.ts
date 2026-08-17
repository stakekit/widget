import { Context, Effect, Layer, PubSub, Stream } from "effect";
import type { WalletScopeOwnerKey } from "../wallet/wallet-scope";

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

type TransactionWorkflowStarted = Extract<
  WidgetDomainEvent,
  { readonly _tag: "TransactionWorkflowStarted" }
>;

/**
 * Projects `TransactionWorkflowStarted` onto feature state.
 *
 * Workflow construction publishes while its scoped Atom is being acquired,
 * which happens during a React render. `project` therefore runs on a later turn
 * so it cannot write to the Atom registry mid-render, which React reports as
 * updating one component while rendering another and which remounts the very
 * scope that published the event.
 */
export const projectTransactionWorkflowStarted = (
  project: (event: TransactionWorkflowStarted) => Effect.Effect<void>,
  failureMessage: string
) =>
  Stream.unwrap(
    WidgetDomainEvents.use((domainEvents) =>
      Effect.succeed(
        domainEvents.events.pipe(
          Stream.filter(
            (event): event is TransactionWorkflowStarted =>
              event._tag === "TransactionWorkflowStarted"
          ),
          Stream.mapEffect((event) =>
            Effect.yieldNow.pipe(
              Effect.andThen(project(event)),
              Effect.catchCause((cause) =>
                Effect.logError(failureMessage, cause)
              )
            )
          )
        )
      )
    )
  );
