import { Cause, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { type PriceRequest, Prices } from "../../src/domain/health/models";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { richErrorAtom } from "../../src/features/widget-shell/react/use-rich-errors";
import {
  TokenPricesKey,
  tokenPricesResourceAtom,
} from "../../src/resources/token-prices/token-prices";
import {
  YieldRewardsSummaryError,
  YieldRewardsSummaryKey,
  yieldRewardsSummaryResourceAtom,
} from "../../src/resources/yield-rewards-summary/yield-rewards-summary";
import {
  ApiRequestError,
  LegacyResourceSource,
  YieldResourceSource,
} from "../../src/services/api/resource-sources";
import { WidgetConfigService } from "../../src/services/config/widget-config";
import { RichErrorService } from "../../src/services/errors/rich-error-service";
import { yieldApiYieldFixture } from "../fixtures";

const yieldModel = yieldApiYieldFixture();
const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
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

const makeYieldRegistry = (source: YieldResourceSource["Service"]) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(
          Layer.succeed(YieldResourceSource, source),
          RichErrorService.layer.pipe(
            Layer.provide(
              WidgetConfigService.layer({
                apiKey: "test-api-key",
                baseUrl: "https://api.example.com",
                variant: "default",
              })
            )
          )
        )
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

  it("reads one summary per wallet and Yield, an untracked Yield as none", () => {
    const getRewardsSummary = vi.fn(() => Effect.succeedNone);
    const registry = makeYieldRegistry(
      YieldResourceSource.of({ getRewardsSummary } as never)
    );
    const key = () =>
      new YieldRewardsSummaryKey({ address, yieldId: yieldModel.id });

    const summary = AsyncResult.getOrThrow(
      registry.get(yieldRewardsSummaryResourceAtom(key()))
    );
    registry.get(yieldRewardsSummaryResourceAtom(key()));

    expect(getRewardsSummary).toHaveBeenCalledOnce();
    expect(getRewardsSummary).toHaveBeenCalledWith({
      address,
      yieldId: yieldModel.id,
    });
    expect(Option.isNone(summary)).toBe(true);
  });

  it("keeps a rewards summary failure typed and silent where the page reads it, and retries it", async () => {
    let offline = true;
    const requestError = new ApiRequestError({
      cause: new Error("offline"),
      failure: { _tag: "Unreachable" },
      operation: "yield-rewards-summary",
    });
    const getRewardsSummary = vi.fn(() =>
      offline ? Effect.fail(requestError) : Effect.succeedNone
    );
    const registry = makeYieldRegistry(
      YieldResourceSource.of({ getRewardsSummary } as never)
    );
    // The position page reads it locally: a failure hides the figure.
    const resource = yieldRewardsSummaryResourceAtom.local(
      new YieldRewardsSummaryKey({ address, yieldId: yieldModel.id })
    );
    const unmount = registry.mount(resource);
    const failed = registry.get(resource);
    await Promise.resolve();
    expect(AsyncResult.getOrThrow(registry.get(richErrorAtom))).toBeNull();

    expect(AsyncResult.isFailure(failed)).toBe(true);
    if (!AsyncResult.isFailure(failed)) throw new Error("Expected failure");
    expect(
      Option.getOrThrow(Cause.findErrorOption(failed.cause))
    ).toBeInstanceOf(YieldRewardsSummaryError);

    const attemptsBeforeRetry = getRewardsSummary.mock.calls.length;
    offline = false;
    registry.refresh(resource);
    expect(Option.isNone(AsyncResult.getOrThrow(registry.get(resource)))).toBe(
      true
    );
    expect(getRewardsSummary).toHaveBeenCalledTimes(attemptsBeforeRetry + 1);
    unmount();
  });
});
