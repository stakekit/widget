import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";

import { appRuntime } from "../../../../runtime/app-runtime";
import { projectTransactionWorkflowStarted } from "../../../../services/events/widget-domain-events";
import { clearBorrowEntryAmountsForOwnerAtom } from "./borrow-entry";

/** Clears an owner's Borrow Entry amounts once its workflow starts. */
export const borrowEntryIntentEventProjectionAtom = appRuntime
  .atom((context) =>
    projectTransactionWorkflowStarted(
      (event) =>
        Effect.sync(() =>
          context.set(clearBorrowEntryAmountsForOwnerAtom, event.owner)
        ),
      "Borrow Entry Intent projection failed."
    )
  )
  .pipe(Atom.withLabel("borrowEntryIntentEventProjectionAtom"));
