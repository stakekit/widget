import { useQuery } from "@tanstack/react-query";
import { createInstance } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { EitherAsync } from "purify-ts";
import { initReactI18next, useTranslation } from "react-i18next";
import { useApiClient } from "../providers/api/api-client-provider";
import translationEN from "./English/translations.json";
import translationFR from "./French/translations.json";

export const i18nInstance: ReturnType<typeof createInstance> = createInstance();

export const localResources = {
  en: { translation: translationEN },
  fr: { translation: translationFR },
} as const;

export type Languages = keyof typeof localResources;

i18nInstance
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    resources: localResources,
    supportedLngs: Object.keys(localResources),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    detection: { order: ["navigator", "localStorage"] },
  });

i18nInstance.services.formatter?.add("lowercase", (value, _, __) =>
  value.toLowerCase()
);

export const useLoadErrorTranslations = () => {
  const apiClient = useApiClient();

  const { i18n } = useTranslation();

  const [lng] = i18n.language.split("-");

  return useQuery({
    queryKey: ["error-translations", lng],
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    queryFn: async () =>
      (
        await EitherAsync(() =>
          apiClient.get<Record<string, unknown>>(
            `https://i18n.stakek.it/locales/${lng}/errors.json`
          )
        ).ifRight((res) =>
          i18n.addResourceBundle(i18n.language, "translation", {
            errors: res.data,
          })
        )
      ).unsafeCoerce(),
  });
};
