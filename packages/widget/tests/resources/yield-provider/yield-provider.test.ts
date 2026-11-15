import { describe, expect, it, vi } from "@effect/vitest";
import { Cause, Effect, Option } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";

import type { EarnProvider } from "../../../src/domain/earn/provider";
import { ProviderId } from "../../../src/domain/identity/identifiers";
import {
  YieldProviderError,
  yieldProviderAtom,
} from "../../../src/resources/yield-provider/yield-provider";
import { appRuntime } from "../../../src/runtime/app-runtime";
import type { YieldResourceSource } from "../../../src/services/api/resource-sources";
import { ApiRequestError } from "../../../src/services/api/resource-sources";
import { yieldApiProviderFixture } from "../../fixtures";
import { yieldResourceSourceLayer } from "../../utils/services/resource-sources";

const makeRegistry = (source: Partial<YieldResourceSource["Service"]>) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(appRuntime.layer, yieldResourceSourceLayer(source)),
    ],
  });

const providerList = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    yieldApiProviderFixture({ id: `provider-${index}` })
  );

const listProvidersFrom = (providers: ReadonlyArray<EarnProvider>) =>
  vi.fn((request: { readonly limit: number; readonly offset: number }) =>
    Effect.succeed({
      items: providers.slice(request.offset, request.offset + request.limit),
      limit: request.limit,
      offset: request.offset,
      total: providers.length,
    })
  );

describe("Yield Provider resource", () => {
  it("looks every provider up in one provider list request", () => {
    const listProviders = listProvidersFrom(providerList(3));
    const registry = makeRegistry({ listProviders });

    const first = registry.get(
      yieldProviderAtom(ProviderId.make("provider-0"))
    );
    const last = registry.get(yieldProviderAtom(ProviderId.make("provider-2")));

    expect(Option.getOrThrow(AsyncResult.getOrThrow(first)).id).toBe(
      "provider-0"
    );
    expect(Option.getOrThrow(AsyncResult.getOrThrow(last)).id).toBe(
      "provider-2"
    );
    expect(listProviders.mock.calls).toEqual([[{ limit: 100, offset: 0 }]]);
  });

  it("reads every page of a list longer than one page", () => {
    const listProviders = listProvidersFrom(providerList(150));
    const registry = makeRegistry({ listProviders });

    const provider = registry.get(
      yieldProviderAtom(ProviderId.make("provider-149"))
    );

    expect(Option.getOrThrow(AsyncResult.getOrThrow(provider)).id).toBe(
      "provider-149"
    );
    expect(listProviders.mock.calls).toEqual([
      [{ limit: 100, offset: 0 }],
      [{ limit: 100, offset: 100 }],
    ]);
  });

  it("resolves a provider the list lacks as absent", () => {
    const registry = makeRegistry({
      listProviders: listProvidersFrom(providerList(1)),
    });

    const provider = registry.get(
      yieldProviderAtom(ProviderId.make("unknown-provider"))
    );

    expect(AsyncResult.getOrThrow(provider)).toEqual(Option.none());
  });

  it("fails every lookup with a Yield Provider error when the list fails", () => {
    const requestError = new ApiRequestError({
      cause: new Error("providers unavailable"),
      failure: { _tag: "Unreachable" },
      operation: "yield-providers",
    });
    const registry = makeRegistry({
      listProviders: () => Effect.fail(requestError),
    });

    const provider = registry.get(
      yieldProviderAtom(ProviderId.make("provider-0"))
    );

    if (!AsyncResult.isFailure(provider)) throw new Error("Expected failure");
    const error = Option.getOrThrow(Cause.findErrorOption(provider.cause));
    expect(error).toBeInstanceOf(YieldProviderError);
    expect(error.cause).toBe(requestError);
  });
});
