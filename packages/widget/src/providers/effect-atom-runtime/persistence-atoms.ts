import { Effect } from "effect";
import {
  type TosAccepted,
  WidgetPersistence,
  widgetStorageDefaults,
} from "./persistence";
import { widgetAtomRuntime } from "./widget-runtime";

export const tosAcceptedAtom = widgetAtomRuntime.atom(
  WidgetPersistence.use((persistence) => persistence.getTosAccepted),
  { initialValue: widgetStorageDefaults.tosAccepted }
);

export const setTosAcceptedAtom = widgetAtomRuntime.fn(
  (value: TosAccepted, get) =>
    WidgetPersistence.use((persistence) =>
      persistence.setTosAccepted(value)
    ).pipe(Effect.tap(() => Effect.sync(() => get.refresh(tosAcceptedAtom))))
);
