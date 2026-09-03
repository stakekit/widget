import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { PropsWithChildren } from "react";
import { I18nextProvider } from "react-i18next";
import { widgetTranslationAtom } from "../state/widget-translation";

/**
 * Forwards the Application Runtime `WidgetTranslation` instance into React.
 * Renders nothing until the service is ready so `useTranslation` never binds to
 * a missing default instance.
 */
export const WidgetTranslationGate = ({ children }: PropsWithChildren) => {
  const translation = useAtomValue(widgetTranslationAtom);
  if (!AsyncResult.isSuccess(translation)) return null;

  return <I18nextProvider i18n={translation.value}>{children}</I18nextProvider>;
};
