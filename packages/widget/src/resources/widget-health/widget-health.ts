import { Data, Duration, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../domain/schema/api-errors";
import { YieldResourceSource } from "../../services/api/yield-resource-source";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { makePresentableResource } from "../resource-failure-presentation";

export class WidgetHealthError extends Data.TaggedError("WidgetHealthError")<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

const healthRequestAtom = appRuntime
  .atom(() =>
    YieldResourceSource.use((source) => source.getHealth()).pipe(
      Effect.mapError((cause) => new WidgetHealthError({ cause }))
    )
  )
  .pipe(
    withApiResourcePolicy({
      idleTTL: Duration.minutes(5),
      staleTime: Duration.seconds(30),
      revalidateOnMount: true,
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

export const underMaintenanceAtom = Atom.make((get) => {
  const result = get(widgetHealthResourceAtom.local);
  const health = result.pipe(AsyncResult.value, Option.getOrUndefined);

  return (
    AsyncResult.isFailure(result) ||
    (health !== undefined && health.status !== "OK")
  );
}).pipe(Atom.withLabel("underMaintenanceAtom"));
