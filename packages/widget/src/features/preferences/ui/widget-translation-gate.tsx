import { useAtomValue } from "@effect/atom-react";
import type { PropsWithChildren } from "react";
import { I18nextProvider } from "react-i18next";

import { widgetI18nAtom } from "../state/widget-translation";

/**
 * Forwards the Application Runtime `WidgetTranslation` instance into React.
 * Renders nothing until the service is ready so `useTranslation` never binds to
 * a missing default instance.
 */
export const WidgetTranslationGate = ({ children }: PropsWithChildren) => {
  const i18n = useAtomValue(widgetI18nAtom);
  if (!i18n) return null;

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
};
