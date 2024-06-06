import { useQuery } from "@tanstack/react-query";
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { withRequestErrorRetry } from "../common/utils";
import { useApiClient } from "../providers/api/api-client-provider";
import translationEN from "./English/translations.json";

export const localResources = {
  en: { translation: translationEN },
} as const;

i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    resources: localResources,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

i18n.services.formatter?.add("lowercase", (value, _, __) =>
  value.toLowerCase()
);

export const useLoadErrorTranslations = () => {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: ["error-translations"],
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    queryFn: () =>
      withRequestErrorRetry({
        fn: () =>
          apiClient.get<Record<string, unknown>>(
            "https://i18n.stakek.it/locales/en/errors.json"
          ),
      }).ifRight((res) =>
        i18n.addResourceBundle("en", "translation", { errors: res.data })
      ),
  });
};
