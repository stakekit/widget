import { createInstance } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
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
  .then(() => undefined);

i18nInstance.services.formatter?.add("lowercase", (value, _, __) =>
  value.toLowerCase()
);
