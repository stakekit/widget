import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  HealthStatus,
  PriceRequest,
  PriceResponse,
} from "../../src/domain/schema/health-price-models";

describe("health and price application schemas", () => {
  it("strictly decodes health responses", () => {
    const health = Schema.decodeUnknownSync(HealthStatus)({
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
    const request = Schema.decodeUnknownSync(PriceRequest)({
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

  it("omits malformed top-level price entries while retaining valid siblings", async () => {
    const prices = await Effect.runPromise(
      Schema.decodeUnknownEffect(PriceResponse)({
        "ethereum-": { price: 3000, price_24_h: 2900 },
        "cosmos-": { price: "invalid", price_24_h: 5 },
        "solana-": { price: 150 },
      })
    );

    expect(prices.value.get("ethereum-")).toEqual({
      price: 3000,
      price24H: 2900,
    });
    expect(prices.value.has("cosmos-")).toBe(false);
    expect(prices.value.get("solana-")).toEqual({
      price: 150,
      price24H: undefined,
    });
  });
});
