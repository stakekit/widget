import { Context, Effect, Layer, Stream, SubscriptionRef } from "effect";
import type { GeolocationError } from "../../domain/schema/legacy-models";
import { GeolocationErrorType } from "../../domain/types/errors";

type GeoBlockState =
  | false
  | {
      readonly countryCode: string;
      readonly regionCode?: string;
      readonly tags: Set<string>;
    };

const isGeoLocationError = (data: unknown): data is GeolocationError =>
  typeof data === "object" &&
  data !== null &&
  "type" in data &&
  data.type === GeolocationErrorType.GEO_LOCATION;

type GeoBlockServiceContract = {
  readonly observeResponse: (input: {
    readonly data: unknown;
    readonly status?: number;
  }) => Effect.Effect<void>;
  readonly states: Stream.Stream<GeoBlockState>;
};

export class GeoBlockService extends Context.Service<
  GeoBlockService,
  GeoBlockServiceContract
>()("stakekit/widget/services/api/GeoBlockService") {
  static readonly layer = Layer.effect(
    GeoBlockService,
    Effect.gen(function* () {
      const state = yield* SubscriptionRef.make<GeoBlockState>(false);
      const observeResponse = Effect.fn("GeoBlockService.observeResponse")(
        function* ({
          data,
          status,
        }: {
          readonly data: unknown;
          readonly status?: number;
        }) {
          if (status !== 403 || !isGeoLocationError(data)) return;

          yield* SubscriptionRef.set(state, {
            countryCode: data.countryCode ?? "",
            regionCode: (data.regionCode as unknown as string) ?? "",
            tags: new Set(data.tags ?? []),
          });
        }
      );

      return GeoBlockService.of({
        observeResponse,
        states: SubscriptionRef.changes(state).pipe(Stream.changes),
      });
    })
  );
}
