import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { PriceResponse } from "../../src/domain/schema/health-price-models";
import { getTokenPriceInUSD } from "../../src/domain/types/price";
import { formatUsd } from "../../src/shared/lib/formatters";

describe("token USD prices", () => {
  it("formats a native-token amount from the API price key", () => {
    const token = {
      network: "ethereum",
      symbol: "ETH",
    };
    const prices = Schema.decodeUnknownSync(PriceResponse)({
      "ethereum-undefined": { price: 1619.22, price_24_h: 0 },
    });

    const amountInUsd = getTokenPriceInUSD({
      amount: "0.0012",
      baseToken: null,
      pricePerShare: null,
      prices,
      token,
    });

    expect(formatUsd(amountInUsd)).toBe("$1.94");
  });
});
