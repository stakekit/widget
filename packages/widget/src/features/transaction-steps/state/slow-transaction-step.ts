import { Duration, Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

/** How long a sent transaction confirms before Steps calls it slow. */
const slowAfter = Duration.seconds(30);

/**
 * Settles with `stepId` once it has been in flight for `slowAfter`. It
 * starts when first read and stops when no longer read, so the wait runs
 * again each time a step is sent.
 */
const slowStepTimerAtom = Atom.family((stepId: string) =>
  Atom.make(Effect.sleep(slowAfter).pipe(Effect.as(stepId))).pipe(
    Atom.withLabel("slowStepTimerAtom")
  )
);

/**
 * The id of the step sent to the network for longer than usual, else null.
 * Keyed by the step in flight (see `getInFlightTransactionStepId`); null
 * while none is, such as while a step waits for its signature.
 */
export const slowTransactionStepAtom = Atom.family(
  (inFlightStepId: string | null) =>
    Atom.make((get) =>
      inFlightStepId === null
        ? null
        : AsyncResult.getOrElse(
            get(slowStepTimerAtom(inFlightStepId)),
            () => null
          )
    ).pipe(Atom.withLabel("slowTransactionStepAtom"))
);
