import { Effect, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { isBorrowNetwork } from "../../domain/borrow/network";
import {
  type WidgetDomainEvent,
  WidgetDomainEvents,
} from "../../services/events/widget-domain-events";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import { appRuntime } from "./app-runtime";

type TransactionWorkflowEnded = Extract<
  WidgetDomainEvent,
  { readonly _tag: "TransactionWorkflowEnded" }
>;

export const getTransactionWorkflowEndedInvalidationKeys = (
  event: TransactionWorkflowEnded
): ReadonlyArray<unknown> => {
  const owner = event.owner;
  if (event.workflowKind === "Classic") {
    return [
      ...resourceInvalidationKeys.walletBalances(owner),
      ...resourceInvalidationKeys.yieldPositions(owner),
      ...resourceInvalidationKeys.singleYieldBalances(owner.address),
      ...resourceInvalidationKeys.activity(owner),
    ];
  }

  return [
    ...resourceInvalidationKeys.walletBalances(owner),
    ...(isBorrowNetwork(owner.network)
      ? [
          ...resourceInvalidationKeys.borrowPositions(owner),
          ...resourceInvalidationKeys.borrowMarkets(owner.network),
        ]
      : []),
  ];
};

export const transactionWorkflowResourceEventProjection = Stream.unwrap(
  Effect.gen(function* () {
    const domainEvents = yield* WidgetDomainEvents;
    const reactivity = yield* Reactivity.Reactivity;

    return domainEvents.events.pipe(
      Stream.filter(
        (event): event is TransactionWorkflowEnded =>
          event._tag === "TransactionWorkflowEnded"
      ),
      Stream.mapEffect((event) =>
        Effect.yieldNow.pipe(
          Effect.andThen(
            reactivity.withBatch(
              reactivity.invalidate(
                getTransactionWorkflowEndedInvalidationKeys(event)
              )
            )
          ),
          Effect.catchCause((cause) =>
            Effect.logError(
              "Transaction Workflow resource projection failed.",
              cause
            )
          )
        )
      )
    );
  })
);

export const transactionWorkflowResourceEventProjectionAtom = appRuntime
  .atom(transactionWorkflowResourceEventProjection)
  .pipe(Atom.withLabel("transactionWorkflowResourceEventProjectionAtom"));
