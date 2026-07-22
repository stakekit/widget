import { Cause, Deferred, Effect, Layer, Option } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { ApiRequestError } from "../../src/domain/schema/api-errors";
import { availableYieldCategoriesAtom } from "../../src/features/earn/state/atoms-state/catalog/atoms";
import { AvailableYieldCategoriesKey } from "../../src/features/earn/state/atoms-state/catalog/keys";
import {
  enrichedYieldDirectoryResourceAtom,
  YieldDirectoryError,
  YieldDirectoryKey,
  yieldDirectoryResourceAtom,
} from "../../src/resources/yield-directory/yield-directory";
import {
  type YieldDirectoryRequest,
  YieldResourceSource,
} from "../../src/services/api/yield-resource-source";
import { API_MAX_PAGE_SIZE } from "../../src/shared/effect/pagination";
import { yieldApiProviderFixture, yieldApiYieldFixture } from "../fixtures";

const makeYield = (id: string, type: "lending" | "staking" = "staking") => {
  const base = yieldApiYieldFixture({ id });
  return yieldApiYieldFixture({
    id,
    mechanics: { ...base.mechanics, type },
  });
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
    expect(listYields).toHaveBeenCalledTimes(2);
    expect(listYields.mock.calls.map(([request]) => request.offset)).toEqual([
      0, 0,
    ]);
    expect(
      listYields.mock.calls.map(([request]) => request.yieldIds?.length)
    ).toEqual([100, 1]);
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

  it("issues one max-size Yield request per category", () => {
    const listYields = vi.fn((request: YieldDirectoryRequest) => {
      const items = request.types?.includes("staking")
        ? [makeYield("stake")]
        : request.types?.includes("lending")
          ? [makeYield("defi", "lending")]
          : [];

      return Effect.succeed({
        items,
        limit: request.limit,
        offset: request.offset,
        total: items.length,
      });
    });
    const registry = makeRegistry(
      YieldResourceSource.of({ listYields } as never)
    );
    const categories = registry.get(
      availableYieldCategoriesAtom(
        new AvailableYieldCategoriesKey({
          categoryOrder: ["stake", "defi", "rwa"],
          network: "ethereum",
        })
      )
    );

    expect(AsyncResult.getOrThrow(categories)).toEqual(["stake", "defi"]);
    expect(listYields).toHaveBeenCalledTimes(3);
    expect(
      listYields.mock.calls.map(([request]) => ({
        limit: request.limit,
        network: request.network,
        offset: request.offset,
      }))
    ).toEqual([
      { limit: API_MAX_PAGE_SIZE, network: "ethereum", offset: 0 },
      { limit: API_MAX_PAGE_SIZE, network: "ethereum", offset: 0 },
      { limit: API_MAX_PAGE_SIZE, network: "ethereum", offset: 0 },
    ]);
    expect(
      listYields.mock.calls.every(
        ([request]) => request.types !== undefined && request.types.length > 0
      )
    ).toBe(true);
  });

  it("deduplicates provider enrichment through the provider resource", () => {
    const yields = [makeYield("yield-a"), makeYield("yield-b")];
    const listYields = vi.fn((request: YieldDirectoryRequest) =>
      Effect.succeed({
        items: yields,
        limit: request.limit,
        offset: request.offset,
        total: yields.length,
      })
    );
    const getProvider = vi.fn(() =>
      Effect.succeed(Option.some(yieldApiProviderFixture()))
    );
    const registry = makeRegistry(
      YieldResourceSource.of({ getProvider, listYields } as never)
    );

    const enriched = registry.get(
      enrichedYieldDirectoryResourceAtom(
        new YieldDirectoryKey({ yieldIds: yields.map(({ id }) => id) })
      )
    );

    expect(AsyncResult.getOrThrow(enriched).items).toHaveLength(2);
    expect(AsyncResult.getOrThrow(enriched).missingProviderIds).toEqual([]);
    expect(AsyncResult.getOrThrow(enriched).providerFailures).toEqual([]);
    expect(getProvider).toHaveBeenCalledOnce();
  });

  it("reports missing Yield identities separately from provider failures", () => {
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
    const registry = makeRegistry(
      YieldResourceSource.of({
        getProvider: () =>
          Effect.fail(
            new ApiRequestError({
              cause: new Error("provider unavailable"),
              operation: "yield-provider",
            })
          ),
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
    expect(result.providerFailures).toHaveLength(1);
    expect(result.providerFailures[0]?.providerId).toBe(present.providerId);
  });

  it("reports confirmed missing provider identities", () => {
    const present = makeYield("yield-present");
    const registry = makeRegistry(
      YieldResourceSource.of({
        getProvider: () => Effect.succeedNone,
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

    expect(result.missingProviderIds).toEqual([present.providerId]);
    expect(result.providerFailures).toEqual([]);
  });

  it("publishes typed failures and retries the exact directory", () => {
    let offline = true;
    const requestError = new ApiRequestError({
      cause: new Error("offline"),
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
    const failed = registry.get(resource);

    expect(AsyncResult.isFailure(failed)).toBe(true);
    if (!AsyncResult.isFailure(failed)) throw new Error("Expected failure");
    expect(
      Option.getOrThrow(Cause.findErrorOption(failed.cause))
    ).toBeInstanceOf(YieldDirectoryError);

    const attemptsBeforeRetry = listYields.mock.calls.length;
    offline = false;
    registry.refresh(resource);

    expect(AsyncResult.getOrThrow(registry.get(resource))).toEqual({
      items: [],
      missingYieldIds: ["yield-retry"],
    });
    expect(listYields).toHaveBeenCalledTimes(attemptsBeforeRetry + 1);
  });

  it("does not publish an interrupted stale response after refresh", async () => {
    const first = await Effect.runPromise(
      Deferred.make<ReturnType<typeof makeYield>[]>()
    );
    const second = await Effect.runPromise(
      Deferred.make<ReturnType<typeof makeYield>[]>()
    );
    let request = 0;
    const listYields = vi.fn((input: YieldDirectoryRequest) => {
      request += 1;
      return Deferred.await(request === 1 ? first : second).pipe(
        Effect.map((items) => ({
          items,
          limit: input.limit,
          offset: input.offset,
          total: items.length,
        }))
      );
    });
    const registry = makeRegistry(
      YieldResourceSource.of({ listYields } as never)
    );
    const freshYield = makeYield("fresh");
    const staleYield = makeYield("stale");
    const key = new YieldDirectoryKey({
      network: "ethereum",
      yieldIds: [freshYield.id, staleYield.id],
    });
    const resource = yieldDirectoryResourceAtom(key);
    const unmount = registry.mount(resource);

    await vi.waitFor(() => expect(listYields).toHaveBeenCalledOnce());
    registry.refresh(resource);
    await vi.waitFor(() => expect(listYields).toHaveBeenCalledTimes(2));

    await Effect.runPromise(Deferred.succeed(second, [freshYield]));
    await vi.waitFor(() =>
      expect(AsyncResult.getOrThrow(registry.get(resource)).items[0]?.id).toBe(
        "fresh"
      )
    );
    await Effect.runPromise(Deferred.succeed(first, [staleYield]));
    expect(AsyncResult.getOrThrow(registry.get(resource)).items[0]?.id).toBe(
      "fresh"
    );

    unmount();
    registry.dispose();
  });
});
