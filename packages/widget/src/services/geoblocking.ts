import {
  Context,
  Effect,
  Layer,
  Option,
  Schema,
  Stream,
  SubscriptionRef,
} from "effect";

type GeoBlockState =
  | false
  | {
      readonly countryCode: string;
      readonly regionCode?: string;
      readonly tags: Set<string>;
    };

const GeoLocationError = Schema.StructWithRest(
  Schema.Struct({
    type: Schema.Literal("GEO_LOCATION"),
    countryCode: Schema.optionalKey(Schema.String),
    regionCode: Schema.optionalKey(Schema.String),
    tags: Schema.optionalKey(Schema.Array(Schema.String)),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)]
);

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
>()("stakekit/widget/services/GeoBlockService") {
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
          const geoLocationError = Schema.decodeUnknownOption(GeoLocationError)(
            data
          ).pipe(Option.getOrNull);
          if (status !== 403 || !geoLocationError) return;

          yield* SubscriptionRef.set(state, {
            countryCode: geoLocationError.countryCode ?? "",
            regionCode: geoLocationError.regionCode ?? "",
            tags: new Set(geoLocationError.tags ?? []),
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
