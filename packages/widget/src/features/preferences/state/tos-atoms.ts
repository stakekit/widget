import { Effect } from "effect";
import { appRuntime } from "../../../app/runtime";
import {
  type TosAccepted,
  WidgetPersistence,
  widgetStorageDefaults,
} from "../../../services/persistence/widget-persistence";

export const tosAcceptedAtom = appRuntime.atom(
  WidgetPersistence.use((persistence) => persistence.getTosAccepted),
  { initialValue: widgetStorageDefaults.tosAccepted }
);

export const setTosAcceptedAtom = appRuntime.fn((value: TosAccepted, get) =>
  WidgetPersistence.use((persistence) =>
    persistence.setTosAccepted(value)
  ).pipe(Effect.tap(() => Effect.sync(() => get.refresh(tosAcceptedAtom))))
);
