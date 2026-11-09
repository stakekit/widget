import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";

import { appRuntime } from "../../../../runtime/app-runtime";
import { projectTransactionWorkflowStarted } from "../../../../services/events/widget-domain-events";
import { resetBorrowMarketPositionIntentForOwnerAtom } from "./action-form";

/** Resets an owner's Market Position intent once its workflow starts. */
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
