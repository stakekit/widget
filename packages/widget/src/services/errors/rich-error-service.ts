import { Context, Effect, Layer, Stream, SubscriptionRef } from "effect";
import { WidgetConfigService } from "../config/widget-config";
import type { RichError } from "./rich-error";

type PresentableRequestError = object & {
  readonly richError: RichError | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isRichError = (error: unknown): error is RichError =>
  isRecord(error) &&
  "message" in error &&
  typeof error.message === "string" &&
  error.type !== "GEO_LOCATION";

export class RichErrorService extends Context.Service<RichErrorService>()(
  "stakekit/widget/RichErrorService",
  {
    make: Effect.gen(function* () {
      const widgetConfig = yield* WidgetConfigService;
      const api = yield* widgetConfig.current;
      const current = yield* SubscriptionRef.make<RichError | null>(null);
      const presentedRequestErrors = new WeakSet<PresentableRequestError>();
      const allowedUrls = [api.baseUrl, api.borrowApiUrl, api.yieldsApiUrl];

      const publishResponse = ({
        data,
        url,
      }: {
        readonly data: unknown;
        readonly url?: string;
      }) => {
        if (
          !isRichError(data) ||
          !url ||
          url.includes("gas-estimate") ||
          !allowedUrls.some((allowedUrl) => url.startsWith(allowedUrl))
        ) {
          return Effect.void;
        }

        return SubscriptionRef.set(current, data);
      };

      const presentRequestError = (error: PresentableRequestError) =>
        Effect.suspend(() => {
          if (!error.richError || presentedRequestErrors.has(error)) {
            return Effect.void;
          }

          presentedRequestErrors.add(error);
          return SubscriptionRef.set(current, error.richError);
        });

      return {
        changes: Stream.changes(SubscriptionRef.changes(current)),
        current,
        presentRequestError,
        publishResponse,
        reset: SubscriptionRef.set(current, null),
      } as const;
    }),
  }
) {
  static readonly layer = Layer.effect(RichErrorService, RichErrorService.make);
}
