import { Cause, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { ApiRequestError } from "../../src/domain/schema/api-errors";
import { RewardsAddresses } from "../../src/domain/schema/dashboard-models";
import {
  type PriceRequest,
  Prices,
} from "../../src/domain/schema/health-price-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  RewardSummariesError,
  RewardSummariesKey,
  rewardSummariesResourceAtom,
} from "../../src/resources/reward-summaries/reward-summaries";
import {
  TokenPricesKey,
  tokenPricesResourceAtom,
} from "../../src/resources/token-prices/token-prices";
import { LegacyResourceSource } from "../../src/services/api/legacy-resource-source";
import { yieldApiYieldFixture } from "../fixtures";

const yieldModel = yieldApiYieldFixture();
const secondYield = yieldApiYieldFixture({ id: "second-yield" });
const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const addresses = Schema.decodeSync(RewardsAddresses)({ address });
const token = yieldModel.token;
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

describe("price and reward summary resources", () => {
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

  it("canonicalizes reward IDs and represents missing summaries explicitly", () => {
    const getRewardsSummaries = vi.fn(() =>
      Effect.succeed({ [yieldModel.id]: { rewards: {}, token } } as never)
    );
    const registry = makeRegistry(
      LegacyResourceSource.of({ getRewardsSummaries } as never)
    );
    const key = new RewardSummariesKey({
      addresses,
      yieldIds: [secondYield.id, yieldModel.id, yieldModel.id],
    });

    const summaries = AsyncResult.getOrThrow(
      registry.get(rewardSummariesResourceAtom(key))
    );
    registry.get(
      rewardSummariesResourceAtom(
        new RewardSummariesKey({
          addresses,
          yieldIds: [yieldModel.id, secondYield.id],
        })
      )
    );

    expect(getRewardsSummaries).toHaveBeenCalledOnce();
    expect(Object.keys(summaries)).toEqual([yieldModel.id, secondYield.id]);
    expect(summaries[secondYield.id]).toBeNull();
  });

  it("publishes typed reward failure and retries bounded work", () => {
    let offline = true;
    const requestError = new ApiRequestError({
      cause: new Error("offline"),
      operation: "yield-rewards-summary",
    });
    const getRewardsSummaries = vi.fn(() =>
      offline ? Effect.fail(requestError) : Effect.succeed({})
    );
    const registry = makeRegistry(
      LegacyResourceSource.of({ getRewardsSummaries } as never)
    );
    const key = new RewardSummariesKey({
      addresses,
      yieldIds: [yieldModel.id],
    });
    const resource = rewardSummariesResourceAtom(key);
    const failed = registry.get(resource);

    expect(AsyncResult.isFailure(failed)).toBe(true);
    if (!AsyncResult.isFailure(failed)) throw new Error("Expected failure");
    expect(
      Option.getOrThrow(Cause.findErrorOption(failed.cause))
    ).toBeInstanceOf(RewardSummariesError);

    const attemptsBeforeRetry = getRewardsSummaries.mock.calls.length;
    offline = false;
    registry.refresh(resource);
    expect(
      AsyncResult.getOrThrow(registry.get(resource))[yieldModel.id]
    ).toBeNull();
    expect(getRewardsSummaries).toHaveBeenCalledTimes(attemptsBeforeRetry + 1);
  });
});
