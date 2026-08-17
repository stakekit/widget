import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import { projectTransactionWorkflowStarted } from "../../services/events/widget-domain-events";
import { resetBorrowEntryIntentForOwnerAtom } from "./borrow-entry/state/borrow-entry";
import { resetBorrowMarketPositionIntentForOwnerAtom } from "./market-position/state/action-form";

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
