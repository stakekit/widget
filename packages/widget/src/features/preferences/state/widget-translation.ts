import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { appRuntime } from "../../../runtime/app-runtime";
import { WidgetTranslation } from "../../../services/translation/widget-translation";

const widgetTranslationAtom = appRuntime
  .atom(
    WidgetTranslation.use((translation) => Effect.succeed(translation.i18n))
  )
  .pipe(Atom.keepAlive, Atom.withLabel("widgetTranslationAtom"));

/** The i18next instance once the service is ready; null until then. */
export const widgetI18nAtom = Atom.make((get) => {
  const translation = get(widgetTranslationAtom);
  return AsyncResult.isSuccess(translation) ? translation.value : null;
}).pipe(Atom.withLabel("widgetI18nAtom"));
