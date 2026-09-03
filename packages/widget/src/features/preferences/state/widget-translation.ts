import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { WidgetTranslation } from "../../../services/translation/widget-translation";

export const widgetTranslationAtom = appRuntime
  .atom(
    WidgetTranslation.use((translation) => Effect.succeed(translation.i18n))
  )
  .pipe(Atom.keepAlive, Atom.withLabel("widgetTranslationAtom"));
