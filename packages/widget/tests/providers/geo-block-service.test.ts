import { Effect, Option, Stream } from "effect";
import { describe, expect, it } from "vitest";
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
  it("is sticky within one service generation and fresh in the next", async () => {
    const blocked = await Effect.runPromise(
      readGeneration({
        data: {
          countryCode: "CA",
          regionCode: "CA-ON",
          tags: ["staking"],
          type: "GEO_LOCATION",
        },
        status: 403,
      })
    );
    const fresh = await Effect.runPromise(readGeneration());

    expect(blocked).toEqual({
      countryCode: "CA",
      regionCode: "CA-ON",
      tags: new Set(["staking"]),
    });
    expect(fresh).toBe(false);
  });

  it("ignores successful and unrelated failure responses", async () => {
    await expect(
      Effect.runPromise(
        readGeneration({
          data: { type: "GEO_LOCATION" },
          status: 200,
        })
      )
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(
        readGeneration({ data: { type: "OTHER" }, status: 403 })
      )
    ).resolves.toBe(false);
  });
});
