import { Context, Effect, Layer, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientResponse,
} from "effect/unstable/http";

const ErrorTranslations = Schema.Record(Schema.String, Schema.Unknown);
type ErrorTranslations = typeof ErrorTranslations.Type;

class ErrorTranslationsLoadError extends Schema.TaggedErrorClass<ErrorTranslationsLoadError>()(
  "ErrorTranslationsLoadError",
  {
    cause: Schema.Defect(),
    language: Schema.String,
  }
) {}

const makeErrorTranslationsSource = Effect.gen(function* () {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);

  const load = Effect.fn("ErrorTranslationsSource.load")(function* (
    language: string
  ) {
    return yield* client
      .get(
        `https://i18n.stakek.it/locales/${encodeURIComponent(language)}/errors.json`
      )
      .pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(ErrorTranslations)),
        Effect.mapError(
          (cause) => new ErrorTranslationsLoadError({ cause, language })
        )
      );
  });

  return ErrorTranslationsSource.of({ load });
});

export class ErrorTranslationsSource extends Context.Service<
  ErrorTranslationsSource,
  {
    readonly load: (
      language: string
    ) => Effect.Effect<ErrorTranslations, ErrorTranslationsLoadError>;
  }
>()("stakekit/widget/translation/ErrorTranslationsSource") {
  static readonly layer = Layer.effect(
    ErrorTranslationsSource,
    makeErrorTranslationsSource
  ).pipe(Layer.provide(FetchHttpClient.layer));
}
