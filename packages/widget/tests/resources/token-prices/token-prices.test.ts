import { Effect, Layer } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, it, vi } from "vitest";

import { type PriceRequest, Prices } from "../../../src/domain/finance/prices";
import {
  TokenPricesKey,
  tokenPricesResourceAtom,
} from "../../../src/resources/token-prices/token-prices";
import { appRuntime } from "../../../src/runtime/app-runtime";
import { LegacyResourceSource } from "../../../src/services/api/resource-sources";
import { yieldApiYieldFixture } from "../../fixtures";

const token = yieldApiYieldFixture().token;
const otherToken = { ...token, network: "base" as const };

const makeRegistry = (source: LegacyResourceSource["Service"]) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(LegacyResourceSource, source)
      ),
    ],
  });

describe("Token Prices resource", () => {
  it("shares semantically equivalent price requests with deterministic tokens", () => {
    const getPrices = vi.fn((_request: PriceRequest) =>
      Effect.succeed(new Prices(new Map()))
    );
    const registry = makeRegistry(
      LegacyResourceSource.of({ getPrices } as never)
    );
    const first = new TokenPricesKey({
      currency: "USD",
      tokenList: [token, otherToken, token],
    });
    const equivalent = new TokenPricesKey({
      currency: "USD",
      tokenList: [otherToken, token],
    });

    registry.get(tokenPricesResourceAtom(first));
    registry.get(tokenPricesResourceAtom(equivalent));

    expect(getPrices).toHaveBeenCalledOnce();
    expect(getPrices.mock.calls[0]?.[0].tokenList).toEqual(
      first.request.tokenList
    );
  });

  it("returns empty prices without backend work", () => {
    const getPrices = vi.fn(() => Effect.die("unused"));
    const registry = makeRegistry(
      LegacyResourceSource.of({ getPrices } as never)
    );

    const prices = AsyncResult.getOrThrow(
      registry.get(
        tokenPricesResourceAtom(
          new TokenPricesKey({ currency: "USD", tokenList: [] })
        )
      )
    );

    expect(prices.value.size).toBe(0);
    expect(getPrices).not.toHaveBeenCalled();
  });
});
