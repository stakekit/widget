import { useAtomValue } from "@effect/atom-react";
import {
  Data,
  Duration,
  Array as EArray,
  Effect,
  Option,
  Schema,
} from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { createInstance } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { useEffect } from "react";
import { initReactI18next, useTranslation } from "react-i18next";
import { withApiResourcePolicy } from "../shared/effect/api-resource";
import { localResources } from "./resources";

export const i18nInstance: ReturnType<typeof createInstance> = createInstance();

const ErrorTranslations = Schema.Record(Schema.String, Schema.Unknown);

class ErrorTranslationsKey extends Data.Class<{
  readonly language: string;
}> {}

const errorTranslationsAtom = Atom.family((key: ErrorTranslationsKey) =>
  Atom.make(
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(
          `https://i18n.stakek.it/locales/${key.language}/errors.json`
        );

        if (!response.ok) {
          throw new Error("Could not load error translations");
        }

        return response.json() as Promise<unknown>;
      },
      catch: (cause) => cause,
    }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(ErrorTranslations)))
  ).pipe(
    withApiResourcePolicy({
      idleTTL: Duration.infinity,
      staleTime: Duration.infinity,
      revalidateOnMount: false,
    })
  )
);

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

export const useLoadErrorTranslations = () => {
  const { i18n } = useTranslation();

  const lng = EArray.head(i18n.language.split("-")).pipe(
    Option.getOrElse(() => i18n.language)
  );

  const result = useAtomValue(
    errorTranslationsAtom(new ErrorTranslationsKey({ language: lng }))
  );
  const errors = result.pipe(AsyncResult.value, Option.getOrUndefined);

  useEffect(() => {
    if (!errors) return;
    i18n.addResourceBundle(i18n.language, "translation", { errors });
  }, [errors, i18n]);

  return result;
};
