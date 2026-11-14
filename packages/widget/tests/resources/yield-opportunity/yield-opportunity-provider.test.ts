import { Cause, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, it, vi } from "vitest";

import { YieldId } from "../../../src/domain/identity/identifiers";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../src/resources/yield-opportunity/provider";
import {
  YieldProviderError,
  yieldProviderAtom,
} from "../../../src/resources/yield-provider/yield-provider";
import { appRuntime } from "../../../src/runtime/app-runtime";
import {
  ApiRequestError,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import { yieldApiProviderFixture, yieldApiYieldFixture } from "../../fixtures";

const yieldModel = yieldApiYieldFixture();
const yieldId = Schema.decodeSync(YieldId)(yieldModel.id);

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
  it("keeps the enriched opportunity when the provider list fails", () => {
    const requestError = new ApiRequestError({
      cause: new Error("providers unavailable"),
      failure: { _tag: "Unreachable" },
      operation: "yield-providers",
    });
    const getOpportunity = vi.fn(() => Effect.succeed(yieldModel));
    const listProviders = vi.fn(() => Effect.fail(requestError));
    const source = YieldResourceSource.of({
      getOpportunity,
      listProviders,
    } as never);
    const registry = makeRegistry(source);

    const enriched = registry.get(
      yieldOpportunityAtom(new YieldOpportunityKey({ yieldId }))
    );
    const provider = registry.get(yieldProviderAtom(yieldModel.providerId));

    const opportunity = AsyncResult.getOrThrow(enriched);
    expect(opportunity).toMatchObject({ id: yieldId });
    expect(opportunity).not.toHaveProperty("provider");
    expect(AsyncResult.isFailure(provider)).toBe(true);
    if (!AsyncResult.isFailure(provider)) throw new Error("Expected failure");
    expect(
      Option.getOrThrow(Cause.findErrorOption(provider.cause))
    ).toBeInstanceOf(YieldProviderError);
  });

  it("models a provider the list lacks without failing the base opportunity", () => {
    const getOpportunity = vi.fn(() => Effect.succeed(yieldModel));
    const listProviders = vi.fn(() =>
      Effect.succeed({
        items: [yieldApiProviderFixture({ id: "other" })],
        limit: 100,
        offset: 0,
        total: 1,
      })
    );
    const registry = makeRegistry(
      YieldResourceSource.of({ getOpportunity, listProviders } as never)
    );

    const enriched = registry.get(
      yieldOpportunityAtom(new YieldOpportunityKey({ yieldId }))
    );
    const provider = registry.get(yieldProviderAtom(yieldModel.providerId));

    expect(AsyncResult.getOrThrow(enriched)).not.toHaveProperty("provider");
    expect(Option.isNone(AsyncResult.getOrThrow(provider))).toBe(true);
  });
});
