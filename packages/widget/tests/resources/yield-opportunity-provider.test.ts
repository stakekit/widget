import { Cause, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { ApiRequestError } from "../../src/domain/schema/api-errors";
import { YieldId } from "../../src/domain/schema/identifiers";
import { initYieldAtom } from "../../src/features/earn/state/earn-selection/resources/atoms";
import { InitYieldKey } from "../../src/features/earn/state/earn-selection/resources/keys";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../src/resources/yield-opportunity/provider";
import {
  YieldOpportunityError,
  yieldOpportunityResourceAtom,
} from "../../src/resources/yield-opportunity/yield-opportunity";
import {
  YieldProviderError,
  yieldProviderResourceAtom,
} from "../../src/resources/yield-provider/yield-provider";
import { YieldResourceSource } from "../../src/services/api/yield-resource-source";
import { yieldApiYieldFixture } from "../fixtures";

const yieldModel = yieldApiYieldFixture();
const yieldId = Schema.decodeSync(YieldId)(yieldModel.id);

const makeSource = () => {
  const getOpportunity = vi.fn(() => Effect.succeed(yieldModel));
  const getProvider = vi.fn(() =>
    Effect.succeed(
      Option.some({
        id: yieldModel.providerId,
        name: "Provider",
      } as never)
    )
  );

  return {
    getOpportunity,
    getProvider,
    source: YieldResourceSource.of({ getOpportunity, getProvider } as never),
  };
};

const makeRegistry = (source: YieldResourceSource["Service"]) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(YieldResourceSource, source)
      ),
    ],
  });

describe("Yield opportunity and provider resources", () => {
  it("shares one opportunity between ordinary and initialization projections", () => {
    const { getOpportunity, getProvider, source } = makeSource();
    const registry = makeRegistry(source);

    const ordinary = registry.get(
      yieldOpportunityAtom(new YieldOpportunityKey({ yieldId }))
    );
    const initial = registry.get(initYieldAtom(new InitYieldKey({ yieldId })));

    expect(AsyncResult.getOrThrow(ordinary)?.id).toBe(yieldId);
    expect(AsyncResult.getOrThrow(initial)?.id).toBe(yieldId);
    expect(getOpportunity).toHaveBeenCalledOnce();
    expect(getProvider).toHaveBeenCalledOnce();
  });

  it("shares equivalent direct opportunity and provider requests", () => {
    const { getOpportunity, getProvider, source } = makeSource();
    const registry = makeRegistry(source);

    registry.get(yieldOpportunityResourceAtom(yieldId));
    registry.get(yieldOpportunityResourceAtom(yieldId));
    registry.get(yieldProviderResourceAtom(yieldModel.providerId));
    registry.get(yieldProviderResourceAtom(yieldModel.providerId));

    expect(getOpportunity).toHaveBeenCalledOnce();
    expect(getProvider).toHaveBeenCalledOnce();
  });

  it("keeps provider failure typed in the enriched opportunity", () => {
    const requestError = new ApiRequestError({
      cause: new Error("missing provider"),
      operation: "yield-provider",
    });
    const getOpportunity = vi.fn(() => Effect.succeed(yieldModel));
    const getProvider = vi.fn(() => Effect.fail(requestError));
    const source = YieldResourceSource.of({
      getOpportunity,
      getProvider,
    } as never);
    const registry = makeRegistry(source);

    const enriched = registry.get(
      yieldOpportunityAtom(new YieldOpportunityKey({ yieldId }))
    );
    const provider = registry.get(
      yieldProviderResourceAtom(yieldModel.providerId)
    );

    expect(AsyncResult.isFailure(enriched)).toBe(true);
    if (!AsyncResult.isFailure(enriched)) throw new Error("Expected failure");
    expect(
      Option.getOrThrow(Cause.findErrorOption(enriched.cause))
    ).toBeInstanceOf(YieldProviderError);
    expect(AsyncResult.isFailure(provider)).toBe(true);
    if (!AsyncResult.isFailure(provider)) throw new Error("Expected failure");
    expect(
      Option.getOrThrow(Cause.findErrorOption(provider.cause))
    ).toBeInstanceOf(YieldProviderError);
  });

  it("models a confirmed missing provider without failing the base opportunity", () => {
    const getOpportunity = vi.fn(() => Effect.succeed(yieldModel));
    const getProvider = vi.fn(() => Effect.succeedNone);
    const registry = makeRegistry(
      YieldResourceSource.of({ getOpportunity, getProvider } as never)
    );

    const enriched = registry.get(
      yieldOpportunityAtom(new YieldOpportunityKey({ yieldId }))
    );
    const provider = registry.get(
      yieldProviderResourceAtom(yieldModel.providerId)
    );

    expect(AsyncResult.getOrThrow(enriched)).not.toHaveProperty("provider");
    expect(Option.isNone(AsyncResult.getOrThrow(provider))).toBe(true);
  });

  it("recovers an opportunity after explicit retry", () => {
    let offline = true;
    const requestError = new ApiRequestError({
      cause: new Error("offline"),
      operation: "yield-opportunity",
    });
    const getOpportunity = vi.fn(() =>
      offline ? Effect.fail(requestError) : Effect.succeed(yieldModel)
    );
    const registry = makeRegistry(
      YieldResourceSource.of({ getOpportunity } as never)
    );
    const resource = yieldOpportunityResourceAtom(yieldId);
    const failed = registry.get(resource);

    expect(AsyncResult.isFailure(failed)).toBe(true);
    if (!AsyncResult.isFailure(failed)) throw new Error("Expected failure");
    expect(
      Option.getOrThrow(Cause.findErrorOption(failed.cause))
    ).toBeInstanceOf(YieldOpportunityError);

    const attemptsBeforeRetry = getOpportunity.mock.calls.length;
    offline = false;
    registry.refresh(resource);

    expect(AsyncResult.getOrThrow(registry.get(resource)).id).toBe(yieldId);
    expect(getOpportunity).toHaveBeenCalledTimes(attemptsBeforeRetry + 1);
  });
});
