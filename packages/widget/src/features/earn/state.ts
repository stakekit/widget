import { Effect, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import { WidgetDomainEvents } from "../../services/events/widget-domain-events";
import { resetEarnEntryIntentForOwnerAtom } from "./state/earn-selection/state/atoms";

export const earnEntryIntentEventProjectionAtom = appRuntime
  .atom((context) =>
    Stream.unwrap(
      WidgetDomainEvents.use((domainEvents) =>
        Effect.succeed(
          domainEvents.events.pipe(
            Stream.filter(
              (event) => event._tag === "TransactionWorkflowStarted"
            ),
            Stream.mapEffect((event) =>
              Effect.yieldNow.pipe(
                Effect.andThen(
                  Effect.sync(() =>
                    context.set(resetEarnEntryIntentForOwnerAtom, event.owner)
                  )
                ),
                Effect.catchCause((cause) =>
                  Effect.logError("Earn Entry Intent projection failed.", cause)
                )
              )
            )
          )
        )
      )
    )
  )
  .pipe(Atom.withLabel("earnEntryIntentEventProjectionAtom"));

export { useEarnYieldSelection } from "./react/use-earn-facades";
export { pendingActionDeepLinkViewAtom } from "./state/pending-action-deep-link";
