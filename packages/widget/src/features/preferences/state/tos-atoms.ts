import { Effect, Stream } from "effect";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { WidgetPersistence } from "../../../services/persistence/widget-persistence";

export const tosAcknowledgementAtom = appRuntime.atom(
  WidgetPersistence.use((persistence) =>
    Effect.succeed(persistence.tosAcknowledgement.states)
  ).pipe(Stream.unwrap)
);

export const acknowledgeTosAtom = appRuntime.fn(() =>
  WidgetPersistence.use((persistence) => persistence.acknowledgeTos)
);
