import { Effect } from "effect";
import * as Schema from "effect/Schema";
import { HttpClient } from "effect/unstable/http";
import { describe, expect, it } from "vitest";
import * as LegacyClient from "../../src/generated/api/legacy";
import * as LegacySchema from "../../src/generated/api/legacy-schema";
import * as YieldClient from "../../src/generated/api/yield";
import * as YieldSchema from "../../src/generated/api/yield-schema";

const httpClient = HttpClient.make(() =>
  Effect.die("generated operation must not execute")
);

describe("generated Legacy API", () => {
  it("exposes runtime DTO schemas", () => {
    expect(Schema.isSchema(LegacySchema.HealthStatusDto)).toBe(true);
    expect(Schema.isSchema(LegacySchema.PriceResponseDto)).toBe(true);
    expect(Schema.isSchema(LegacySchema.TokenDto)).toBe(true);
    expect(Schema.isSchema(LegacySchema.YieldDto)).toBe(true);
    expect("make" in LegacySchema).toBe(false);
  });

  it("exposes typed Effect client operations separately from schemas", () => {
    const client = LegacyClient.make(httpClient);

    expect(client).toEqual(
      expect.objectContaining({
        TokenControllerGetTokenPrices: expect.any(Function),
        YieldControllerGetMyNetworks: expect.any(Function),
      })
    );
    expect(
      Effect.isEffect(client.YieldControllerGetMyNetworks(undefined))
    ).toBe(true);
  });
});

describe("generated Yield API", () => {
  it("exposes runtime DTO schemas", () => {
    expect(Schema.isSchema(YieldSchema.ActionDto)).toBe(true);
    expect(Schema.isSchema(YieldSchema.HealthStatusDto)).toBe(true);
    expect(Schema.isSchema(YieldSchema.TokenDto)).toBe(true);
    expect(Schema.isSchema(YieldSchema.ValidatorDto)).toBe(true);
    expect(Schema.isSchema(YieldSchema.YieldDto)).toBe(true);
    expect("make" in YieldSchema).toBe(false);
  });

  it("exposes typed Effect client operations separately from schemas", () => {
    const client = YieldClient.make(httpClient);

    expect(client).toEqual(
      expect.objectContaining({
        YieldsControllerGetYield: expect.any(Function),
        YieldsControllerGetYields: expect.any(Function),
      })
    );
    expect(Effect.isEffect(client.YieldsControllerGetYields(undefined))).toBe(
      true
    );
  });
});
