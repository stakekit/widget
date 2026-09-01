import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { exactDecimal } from "../../src/domain/finance/exact";
import {
  HealthStatus,
  PriceRequest,
  PriceResponse,
} from "../../src/domain/health/models";
import { Token } from "../../src/domain/token/token";

describe("health and price application schemas", () => {
  it("strictly decodes health responses", () => {
    const health = Schema.decodeSync(HealthStatus)({
      status: "OK",
      timestamp: "2026-07-10T12:00:00.000Z",
    });

    expect(health.status).toBe("OK");
    expect(() =>
      Schema.decodeUnknownSync(HealthStatus)({
        status: "DEGRADED",
        timestamp: "not-a-date",
      })
    ).toThrow();
  });

  it("decodes application price commands from the generated wire shape", () => {
    const request = Schema.decodeSync(PriceRequest)({
      currency: "USD",
      tokenList: [
        {
          address: "0xToken",
          decimals: 18,
          name: "Ethereum",
          network: "ethereum",
          symbol: "ETH",
        },
      ],
    });

    expect(request.tokenList[0]?.address).toBe("0xToken");
  });

  it.effect(
    "omits malformed top-level price entries while retaining valid siblings",
    () =>
      Effect.gen(function* () {
        const prices = yield* Schema.decodeEffect(PriceResponse)({
          "ethereum-": { price: 3000, price_24_h: 2900 },
          "cosmos-": { price: "invalid", price_24_h: 5 },
          "solana-": { price: 150 },
        });

        expect(prices.value.get("ethereum-")).toEqual({
          price: exactDecimal(3000),
          price24H: exactDecimal(2900),
        });
        expect(prices.value.has("cosmos-")).toBe(false);
        expect(prices.value.get("solana-")).toEqual({
          price: exactDecimal(150),
          price24H: undefined,
        });
      })
  );

  it.effect(
    "looks up legacy price keys without conflating them with Token identity",
    () =>
      Effect.gen(function* () {
        const prices = yield* Schema.decodeEffect(PriceResponse)({
          "ethereum-": { price: 3000 },
          "ethereum-0xabcd": { price: 1 },
        });
        const native = yield* Schema.decodeEffect(Token)({
          decimals: 18,
          name: "Ether",
          network: "ethereum",
          symbol: "ETH",
        });
        const addressed = yield* Schema.decodeEffect(Token)({
          address: "0xAbCd",
          decimals: 6,
          name: "USD Coin",
          network: "ethereum",
          symbol: "USDC",
        });

        expect(prices.getByToken(native)?.price).toEqual(exactDecimal(3000));
        expect(prices.getByToken(addressed)?.price).toEqual(exactDecimal(1));
      })
  );
});
