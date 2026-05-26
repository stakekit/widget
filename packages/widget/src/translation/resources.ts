import translationEN from "./English/translations.json";
import translationFR from "./French/translations.json";

export const localResources = {
  en: { translation: translationEN },
  fr: { translation: translationFR },
} as const;

export type Languages = keyof typeof localResources;
