import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";

import { appRuntime } from "../../runtime/app-runtime";
import type {
  ActionSimulationRequest,
  ApiRequestError,
  InputValidationError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { YieldResourceSource } from "../../services/api/resource-sources";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

/** An enter or exit of one yield, address and amount, to estimate. */
export class ActionSimulationKey extends Data.TaggedClass(
  "ActionSimulationKey"
)<{
  readonly request: ActionSimulationRequest;
}> {}

class ActionSimulationError extends Data.TaggedError("ActionSimulationError")<{
  readonly cause: ApiRequestError | InputValidationError | ResponseDecodeError;
}> {}

/** How long an amount must stay unchanged before it is simulated. */
const actionSimulationDebounce = Duration.millis(400);

/**
 * Each typed amount is its own key. A simulation waits for the amount to
 * settle and, without an idle lifetime, ends the moment nothing reads its
 * key: typing on interrupts the wait or the request of the amount it
 * replaces, so a stale estimate never lands.
 */
const actionSimulationCanonicalAtom = Atom.family((key: ActionSimulationKey) =>
  appRuntime
    .atom(() =>
      Effect.sleep(actionSimulationDebounce).pipe(
        Effect.andThen(
          YieldResourceSource.use((source) =>
            source.simulateAction(key.request)
          )
        ),
        Effect.mapError((cause) => new ActionSimulationError({ cause }))
      )
    )
    .pipe(Atom.withLabel("actionSimulationResourceAtom"))
);

/**
 * The estimate is a hint beside the amount, so its consumers read `local`:
 * a failure shows nothing rather than a Rich Error.
 */
export const actionSimulationResourceAtom = makePresentableResourceFamily(
  actionSimulationCanonicalAtom
);
