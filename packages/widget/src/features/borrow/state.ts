import { Effect, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import {
  type WidgetDomainEvent,
  WidgetDomainEvents,
} from "../../services/events/widget-domain-events";
import { resetBorrowEntryIntentForOwnerAtom } from "./borrow-entry/state/borrow-entry";
import { resetBorrowMarketPositionIntentForOwnerAtom } from "./market-position/state/action-form";

type TransactionWorkflowStarted = Extract<
  WidgetDomainEvent,
  { readonly _tag: "TransactionWorkflowStarted" }
>;

const projectTransactionWorkflowStarted = (
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
            project(event).pipe(
              Effect.catchCause((cause) =>
                Effect.logError(failureMessage, cause)
              )
            )
          )
        )
      )
    )
  );

export const borrowEntryIntentEventProjectionAtom = appRuntime
  .atom((context) =>
    projectTransactionWorkflowStarted(
      (event) =>
        Effect.sync(() =>
          context.set(resetBorrowEntryIntentForOwnerAtom, event.owner)
        ),
      "Borrow Entry Intent projection failed."
    )
  )
  .pipe(Atom.withLabel("borrowEntryIntentEventProjectionAtom"));

export const borrowMarketPositionIntentEventProjectionAtom = appRuntime
  .atom((context) =>
    projectTransactionWorkflowStarted(
      (event) =>
        Effect.sync(() =>
          context.set(resetBorrowMarketPositionIntentForOwnerAtom, event.owner)
        ),
      "Borrow Market Position Entry Intent projection failed."
    )
  )
  .pipe(Atom.withLabel("borrowMarketPositionIntentEventProjectionAtom"));
