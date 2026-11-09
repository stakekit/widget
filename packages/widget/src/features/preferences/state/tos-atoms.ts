import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { appRuntime } from "../../../runtime/app-runtime";
import { WidgetPersistence } from "../../../services/persistence/widget-persistence";

export const tosAcknowledgementAtom = appRuntime.atom(
  WidgetPersistence.use((persistence) =>
    Effect.succeed(persistence.tosAcknowledgement.states)
  ).pipe(Stream.unwrap)
);

export const acknowledgeTosAtom = appRuntime.fn(() =>
  WidgetPersistence.use((persistence) => persistence.acknowledgeTos)
);

/** The persisted acknowledgement once it is read; undefined until then. */
export const tosAcknowledgementStateAtom = Atom.make((get) =>
  get(tosAcknowledgementAtom).pipe(AsyncResult.value, Option.getOrUndefined)
).pipe(Atom.withLabel("tosAcknowledgementStateAtom"));
