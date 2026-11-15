import { describe, expect, it, vi } from "@effect/vitest";
import { Cause, Effect, Layer, Option } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";

import { ProviderId, YieldId } from "../../../src/domain/identity/identifiers";
import {
  enrichedYieldDirectoryResourceAtom,
  YieldDirectoryError,
  YieldDirectoryKey,
  yieldDirectoryResourceAtom,
} from "../../../src/resources/yield-directory/yield-directory";
import { appRuntime } from "../../../src/runtime/app-runtime";
import type { YieldDirectoryRequest } from "../../../src/services/api/resource-sources";
import {
  ApiRequestError,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import { yieldApiProviderFixture, yieldApiYieldFixture } from "../../fixtures";

const makeYield = (id: string, type: "lending" | "staking" = "staking") => {
  const base = yieldApiYieldFixture({ id });
  return {
    ...base,
    mechanics: { ...base.mechanics, type },
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

describe("Yield Directory resource", () => {
  it("normalizes equivalent filters and chunks explicit Yield IDs", () => {
    const yields = Array.from({ length: 101 }, (_, index) =>
      makeYield(`yield-${index}`)
    );
    const yieldsById = new Map(
      yields.map((yieldModel) => [yieldModel.id, yieldModel])
    );
    const listYields = vi.fn((request: YieldDirectoryRequest) => {
      const requested = (request.yieldIds ?? []).flatMap((yieldId) => {
        const yieldModel = yieldsById.get(yieldId);
        return yieldModel ? [yieldModel] : [];
      });

      return Effect.succeed({
        items: requested.slice(request.offset, request.offset + request.limit),
        limit: request.limit,
        offset: request.offset,
        total: requested.length,
      });
    });
    const registry = makeRegistry(
      YieldResourceSource.of({ listYields } as never)
    );
    const first = new YieldDirectoryKey({
      network: "ethereum",
      types: ["staking", "staking"],
      yieldIds: yields.map(({ id }) => id),
    });
    const equivalent = new YieldDirectoryKey({
      network: "ethereum",
      types: ["staking"],
      yieldIds: [...yields.map(({ id }) => id), yields[0]!.id].reverse(),
    });

    expect(
      AsyncResult.getOrThrow(registry.get(yieldDirectoryResourceAtom(first)))
        .items
    ).toHaveLength(101);
    expect(
      AsyncResult.getOrThrow(
        registry.get(yieldDirectoryResourceAtom(equivalent))
      ).items
    ).toHaveLength(101);
    expect(listYields).toHaveBeenCalledTimes(6);
    expect(listYields.mock.calls.map(([request]) => request.offset)).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
    expect(
      listYields.mock.calls.map(([request]) => request.yieldIds?.length)
    ).toEqual([20, 20, 20, 20, 20, 1]);
  });

  it("loads yields by token using standard pagination without yieldIds in request", () => {
    const yields = Array.from({ length: 150 }, (_, index) =>
      makeYield(`yield-${index}`)
    );
    const listYields = vi.fn((request: YieldDirectoryRequest) => {
      expect(request.yieldIds).toBeUndefined();
      expect(request.token).toBe("ETH");
      expect(request.network).toBe("ethereum");

      return Effect.succeed({
        items: yields.slice(request.offset, request.offset + request.limit),
        limit: request.limit,
        offset: request.offset,
        total: yields.length,
      });
    });
    const registry = makeRegistry(
      YieldResourceSource.of({ listYields } as never)
    );
    const missingId = YieldId.make("yield-999");
    const key = new YieldDirectoryKey({
      network: "ethereum",
      token: "ETH",
      yieldIds: [yields[0]!.id, yields[149]!.id, missingId],
    });

    const result = AsyncResult.getOrThrow(
      registry.get(yieldDirectoryResourceAtom(key))
    );

    expect(result.items).toHaveLength(150);
    expect(result.missingYieldIds).toEqual([missingId]);
    expect(listYields).toHaveBeenCalledTimes(2);
    expect(listYields.mock.calls.map(([request]) => request.offset)).toEqual([
      0, 100,
    ]);
  });

  it("skips empty ID sets and distinguishes explicit directories", () => {
    const listYields = vi.fn((request: YieldDirectoryRequest) =>
      Effect.succeed({
        items: [],
        limit: request.limit,
        offset: request.offset,
        total: 0,
      })
    );
    const registry = makeRegistry(
      YieldResourceSource.of({ listYields } as never)
    );

    registry.get(
      yieldDirectoryResourceAtom(new YieldDirectoryKey({ yieldIds: [] }))
    );
    registry.get(
      yieldDirectoryResourceAtom(
        new YieldDirectoryKey({
          yieldIds: [makeYield("yield-a").id, makeYield("yield-a").id],
        })
      )
    );
    registry.get(
      yieldDirectoryResourceAtom(
        new YieldDirectoryKey({ yieldIds: [makeYield("yield-a").id] })
      )
    );
    registry.get(
      yieldDirectoryResourceAtom(
        new YieldDirectoryKey({ yieldIds: [makeYield("yield-b").id] })
      )
    );

    expect(listYields).toHaveBeenCalledTimes(2);
    expect(listYields.mock.calls.map(([request]) => request.yieldIds)).toEqual([
      ["yield-a"],
      ["yield-b"],
    ]);
  });

  it("enriches Yields of several providers from one provider list request", () => {
    const yields = ["aave", "lido", "morpho"].map((providerId) => ({
      ...makeYield(`yield-${providerId}`),
      providerId: ProviderId.make(providerId),
    }));
    const listYields = vi.fn((request: YieldDirectoryRequest) =>
      Effect.succeed({
        items: yields,
        limit: request.limit,
        offset: request.offset,
        total: yields.length,
      })
    );
    const listProviders = vi.fn(
      (request: { readonly limit: number; readonly offset: number }) =>
        Effect.succeed({
          items: ["aave", "lido", "morpho"].map((id) =>
            yieldApiProviderFixture({ id, name: `Provider ${id}` })
          ),
          limit: request.limit,
          offset: request.offset,
          total: 3,
        })
    );
    const registry = makeRegistry(
      YieldResourceSource.of({ listProviders, listYields } as never)
    );

    const enriched = AsyncResult.getOrThrow(
      registry.get(
        enrichedYieldDirectoryResourceAtom(
          new YieldDirectoryKey({ yieldIds: yields.map(({ id }) => id) })
        )
      )
    );

    expect(
      enriched.items.map((yieldModel) => yieldModel.provider?.name)
    ).toEqual(["Provider aave", "Provider lido", "Provider morpho"]);
    expect(enriched.missingProviderIds).toEqual([]);
    expect(enriched.providerFailure).toBeNull();
    expect(listProviders).toHaveBeenCalledOnce();
  });

  it("keeps Yields without a provider when the provider list fails", () => {
    const present = makeYield("yield-present");
    const missingId = makeYield("yield-missing").id;
    const listYields = vi.fn((request: YieldDirectoryRequest) =>
      Effect.succeed({
        items: [present],
        limit: request.limit,
        offset: request.offset,
        total: 1,
      })
    );
    const requestError = new ApiRequestError({
      cause: new Error("providers unavailable"),
      failure: { _tag: "Unreachable" },
      operation: "yield-providers",
    });
    const registry = makeRegistry(
      YieldResourceSource.of({
        listProviders: () => Effect.fail(requestError),
        listYields,
      } as never)
    );
    const result = AsyncResult.getOrThrow(
      registry.get(
        enrichedYieldDirectoryResourceAtom(
          new YieldDirectoryKey({ yieldIds: [present.id, missingId] })
        )
      )
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).not.toHaveProperty("provider");
    expect(result.missingYieldIds).toEqual([missingId]);
    expect(result.missingProviderIds).toEqual([]);
    expect(result.providerFailure?.cause).toBe(requestError);
  });

  it("reports providers the provider list lacks as missing", () => {
    const present = makeYield("yield-present");
    const registry = makeRegistry(
      YieldResourceSource.of({
        listProviders: (request: {
          readonly limit: number;
          readonly offset: number;
        }) =>
          Effect.succeed({
            items: [yieldApiProviderFixture({ id: "other" })],
            limit: request.limit,
            offset: request.offset,
            total: 1,
          }),
        listYields: (request: YieldDirectoryRequest) =>
          Effect.succeed({
            items: [present],
            limit: request.limit,
            offset: request.offset,
            total: 1,
          }),
      } as never)
    );
    const result = AsyncResult.getOrThrow(
      registry.get(
        enrichedYieldDirectoryResourceAtom(
          new YieldDirectoryKey({ yieldIds: [present.id] })
        )
      )
    );

    expect(result.items[0]).not.toHaveProperty("provider");
    expect(result.missingProviderIds).toEqual(["stakekit"]);
    expect(result.providerFailure).toBeNull();
  });

  it("asks again with backoff, then publishes typed failures and retries the exact directory", async () => {
    vi.useFakeTimers();
    try {
      let offline = true;
      const requestError = new ApiRequestError({
        cause: new Error("offline"),
        failure: { _tag: "Unreachable" },
        operation: "yield-directory",
      });
      const listYields = vi.fn((request: YieldDirectoryRequest) =>
        offline
          ? Effect.fail(requestError)
          : Effect.succeed({
              items: [],
              limit: request.limit,
              offset: request.offset,
              total: 0,
            })
      );
      const registry = makeRegistry(
        YieldResourceSource.of({ listYields } as never)
      );
      const key = new YieldDirectoryKey({
        network: "ethereum",
        yieldIds: [makeYield("yield-retry").id],
      });
      const resource = yieldDirectoryResourceAtom(key);
      const unsubscribe = registry.subscribe(resource, () => undefined);

      // An unreachable API is asked again 1 s and then 2 s later.
      expect(AsyncResult.isFailure(registry.get(resource))).toBe(false);
      await vi.advanceTimersByTimeAsync(3_000);
      expect(listYields).toHaveBeenCalledTimes(3);

      const failed = registry.get(resource);
      expect(AsyncResult.isFailure(failed)).toBe(true);
      if (!AsyncResult.isFailure(failed)) throw new Error("Expected failure");
      expect(
        Option.getOrThrow(Cause.findErrorOption(failed.cause))
      ).toBeInstanceOf(YieldDirectoryError);

      offline = false;
      registry.refresh(resource);

      expect(AsyncResult.getOrThrow(registry.get(resource))).toEqual({
        items: [],
        missingYieldIds: ["yield-retry"],
      });
      expect(listYields).toHaveBeenCalledTimes(4);
      unsubscribe();
    } finally {
      vi.useRealTimers();
    }
  });
});
