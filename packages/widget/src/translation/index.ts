import { useQuery } from "@tanstack/react-query";
import { setDefaultOptions } from "date-fns";
import { enUS as dateFnsEN, fr as dateFnsFR } from "date-fns/locale";
import { createInstance } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { EitherAsync } from "purify-ts";
import { initReactI18next, useTranslation } from "react-i18next";
import { localResources } from "./resources";

export const i18nInstance: ReturnType<typeof createInstance> = createInstance();

i18nInstance
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    resources: localResources,
    supportedLngs: Object.keys(localResources),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    detection: { order: ["navigator", "localStorage"] },
  })
  .then(() => {
    setDefaultOptions({
      locale: i18nInstance.language === "fr" ? dateFnsFR : dateFnsEN,
    });
  });

i18nInstance.on("languageChanged", (lng) => {
  setDefaultOptions({ locale: lng === "fr" ? dateFnsFR : dateFnsEN });
});

i18nInstance.services.formatter?.add("lowercase", (value, _, __) =>
  value.toLowerCase()
);

export const useLoadErrorTranslations = () => {
  const { i18n } = useTranslation();

  const [lng] = i18n.language.split("-");

  return useQuery({
    queryKey: ["error-translations", lng],
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    queryFn: async () =>
      (
        await EitherAsync(async () => {
          const response = await fetch(
            `https://i18n.stakek.it/locales/${lng}/errors.json`
          );

          if (!response.ok) {
            throw new Error("Could not load error translations");
          }

          return response.json() as Promise<Record<string, unknown>>;
        }).ifRight((errors) =>
          i18n.addResourceBundle(i18n.language, "translation", {
            errors,
          })
        )
      ).unsafeCoerce(),
  });
};
