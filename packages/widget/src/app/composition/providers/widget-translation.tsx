import { useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { PropsWithChildren } from "react";
import { I18nextProvider } from "react-i18next";
import { WidgetTranslation } from "../../../services/translation/widget-translation";
import { appRuntime } from "../../runtime/app-runtime";

const widgetTranslationAtom = appRuntime
  .atom(
    WidgetTranslation.use((translation) => Effect.succeed(translation.i18n))
  )
  .pipe(Atom.keepAlive, Atom.withLabel("widgetTranslationAtom"));

export const WidgetTranslationProvider = ({ children }: PropsWithChildren) => {
  const translation = useAtomValue(widgetTranslationAtom);
  if (!AsyncResult.isSuccess(translation)) return null;

  return <I18nextProvider i18n={translation.value}>{children}</I18nextProvider>;
};
