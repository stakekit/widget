import { Data, Duration, Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { YieldResourceSource } from "../../services/api/resource-sources";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { toPresentable } from "../../shared/effect/async-result";
import { makePresentableResource } from "../resource-failure-presentation";

export class WidgetHealthError extends Data.TaggedError("WidgetHealthError")<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

const healthRequestAtom = appRuntime
  .atom(() =>
    YieldResourceSource.use((source) => source.getHealth).pipe(
      Effect.mapError((cause) => new WidgetHealthError({ cause }))
    )
  )
  .pipe(
    withApiResourcePolicy({
      staleTime: Duration.seconds(30),
    }),
    Atom.withLabel("healthRequestAtom")
  );

const widgetHealthCanonicalAtom = healthRequestAtom.pipe(
  Atom.withRefresh(Duration.seconds(30)),
  Atom.withLabel("widgetHealthResourceAtom")
);

export const widgetHealthResourceAtom = makePresentableResource(
  widgetHealthCanonicalAtom
);

/**
 * Maintenance follows the last known health: a failed poll after a healthy
 * one is a transient fact about the refetch, not an outage. A check that has
 * never succeeded fails closed, including while it retries.
 */
export const underMaintenanceAtom = Atom.make((get) => {
  const result = get(widgetHealthResourceAtom.local);
  const health = toPresentable(result);

  return health._tag === "Ready"
    ? health.value.status !== "OK"
    : AsyncResult.isFailure(result);
}).pipe(Atom.withLabel("underMaintenanceAtom"));
