import type { PropsWithChildren } from "react";
import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import utilaTranslations from "../../translation/English/utila-variant.json";
import { useWidgetConfig } from "./use-widget-config";

export const WidgetConfigEffects = ({ children }: PropsWithChildren) => {
  const { i18n } = useTranslation();
  const customTranslations = useWidgetConfig("customTranslations");
  const language = useWidgetConfig("language");
  const variant = useWidgetConfig("variant");

  useLayoutEffect(() => {
    if (language) {
      void i18n.changeLanguage(language);
    }
  }, [i18n, language]);

  useLayoutEffect(() => {
    if (variant === "utila") {
      i18n.addResourceBundle(
        "en",
        "translation",
        utilaTranslations,
        true,
        true
      );
    }

    if (customTranslations) {
      Object.entries(customTranslations).forEach(([language, value]) => {
        i18n.addResourceBundle(
          language,
          "translation",
          value.translation,
          true,
          true
        );
      });
    }
  }, [customTranslations, i18n, variant]);

  return children;
};
