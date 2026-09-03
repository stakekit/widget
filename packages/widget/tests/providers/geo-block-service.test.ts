import { describe, expect, it } from "@effect/vitest";
import { Effect, Option, Stream } from "effect";
import { GeoBlockService } from "../../src/services/geoblocking";

const readGeneration = (response?: {
  readonly data: unknown;
  readonly status?: number;
}) =>
  Effect.gen(function* () {
    const geoBlock = yield* GeoBlockService;

    if (response) {
      yield* geoBlock.observeResponse(response);
    }

    return yield* geoBlock.states.pipe(
      Stream.runHead,
      Effect.map(Option.getOrThrow)
    );
  }).pipe(Effect.provide(GeoBlockService.layer));

describe("GeoBlockService", () => {
  it.effect(
    "is sticky within one service generation and fresh in the next",
    () =>
      Effect.gen(function* () {
        const blocked = yield* readGeneration({
          data: {
            countryCode: "CA",
            regionCode: "CA-ON",
            tags: ["staking"],
            type: "GEO_LOCATION",
          },
          status: 403,
        });
        const fresh = yield* readGeneration();

        expect(blocked).toEqual({
          countryCode: "CA",
          regionCode: "CA-ON",
          tags: new Set(["staking"]),
        });
        expect(fresh).toBe(false);
      })
  );

  it.effect("ignores successful and unrelated failure responses", () =>
    Effect.gen(function* () {
      expect(
        yield* readGeneration({
          data: { type: "GEO_LOCATION" },
          status: 200,
        })
      ).toBe(false);
      expect(
        yield* readGeneration({ data: { type: "OTHER" }, status: 403 })
      ).toBe(false);
    })
  );
});
