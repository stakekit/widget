import { useAtomValue } from "@effect/atom-react";
import { Data, Duration, Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { ErrorTranslationsSource } from "../../translation/error-translations-source";
import { appRuntime } from "../runtime/app-runtime";

class ErrorTranslationsKey extends Data.Class<{
  readonly language: string;
}> {}

const errorTranslationsAtom = Atom.family((key: ErrorTranslationsKey) =>
  appRuntime
    .atom(ErrorTranslationsSource.use((source) => source.load(key.language)))
    .pipe(
      withApiResourcePolicy({
        idleTTL: Duration.infinity,
        staleTime: Duration.infinity,
        revalidateOnMount: false,
      })
    )
);

export const useLoadErrorTranslations = () => {
  const { i18n } = useTranslation();
  const language = EArray.head(i18n.language.split("-")).pipe(
    Option.getOrElse(() => i18n.language)
  );
  const result = useAtomValue(
    errorTranslationsAtom(new ErrorTranslationsKey({ language }))
  );
  const errors = result.pipe(AsyncResult.value, Option.getOrUndefined);

  useEffect(() => {
    if (!errors) return;
    i18n.addResourceBundle(i18n.language, "translation", { errors });
  }, [errors, i18n]);

  return result;
};
