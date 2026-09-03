import { Effect, Layer, Option } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { availableYieldCategoriesAtom } from "../../src/features/earn/state/earn-selection/catalog/catalog";
import { AvailableYieldCategoriesKey } from "../../src/features/earn/state/earn-selection/catalog/keys";
import {
  EarnTokenCatalogKey,
  earnTokenCatalogResourceAtom,
} from "../../src/resources/earn-token-catalog/earn-token-catalog";
import type { EarnTokenCatalogRequest } from "../../src/services/api/resource-sources";
import {
  ApiRequestError,
  LegacyResourceSource,
} from "../../src/services/api/resource-sources";
import { yieldApiYieldFixture } from "../fixtures";

const yieldModel = yieldApiYieldFixture();
const tokenOption = {
  availableYields: [yieldModel.id],
  token: yieldModel.token,
};

const makeRegistry = (
  getTokenOptions: (
    request: EarnTokenCatalogRequest
  ) => Effect.Effect<ReadonlyArray<typeof tokenOption>, ApiRequestError>
) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(
          Reactivity.layer,
          Layer.succeed(
            LegacyResourceSource,
            LegacyResourceSource.of({ getTokenOptions } as never)
          )
        ) as never
      ),
    ],
  });

describe("Earn Token Catalog", () => {
  it("encapsulates enterability and category-to-yield-type filters", () => {
    const getTokenOptions = vi.fn(() => Effect.succeed([tokenOption]));
    const registry = makeRegistry(getTokenOptions);
    const result = registry.get(
      earnTokenCatalogResourceAtom(
        new EarnTokenCatalogKey({
          category: "stake",
          network: "ethereum",
        })
      )
    );

    expect(AsyncResult.getOrThrow(result)).toEqual([tokenOption]);
    expect(getTokenOptions).toHaveBeenCalledWith({
      enter: true,
      network: "ethereum",
      yieldTypes: ["staking", "restaking", "liquid_staking"],
    });
  });

  it("omits failed dashboard categories when another category is usable", () => {
    const getTokenOptions = vi.fn((request: EarnTokenCatalogRequest) => {
      if (request.yieldTypes?.includes("staking")) {
        return Effect.fail(
          new ApiRequestError({
            cause: new Error("offline"),
            operation: "legacy-token-options",
          })
        );
      }
      return Effect.succeed(
        request.yieldTypes?.includes("lending") ? [tokenOption] : []
      );
    });
    const registry = makeRegistry(getTokenOptions);
    const result = registry.get(
      availableYieldCategoriesAtom(
        new AvailableYieldCategoriesKey({
          categoryOrder: ["stake", "defi", "rwa"],
          network: "ethereum",
        })
      )
    );

    expect(AsyncResult.getOrThrow(result)).toEqual(["defi"]);
    expect(
      new Set(
        getTokenOptions.mock.calls.map(([request]) =>
          request.yieldTypes?.join(",")
        )
      ).size
    ).toBe(3);
  });

  it("waits for every dashboard category's first result before selecting", async () => {
    const getTokenOptions = vi.fn((request: EarnTokenCatalogRequest) => {
      const result = request.yieldTypes?.includes("lending")
        ? [tokenOption]
        : [];
      return request.yieldTypes?.includes("lending")
        ? Effect.succeed(result)
        : Effect.sleep("100 millis").pipe(Effect.as(result));
    });
    const registry = makeRegistry(getTokenOptions);
    const atom = availableYieldCategoriesAtom(
      new AvailableYieldCategoriesKey({
        categoryOrder: ["stake", "defi", "rwa"],
        network: "ethereum",
      })
    );
    const unmount = registry.mount(atom);

    try {
      expect(AsyncResult.isInitial(registry.get(atom))).toBe(true);
      await vi.waitFor(() =>
        expect(AsyncResult.getOrThrow(registry.get(atom))).toEqual(["defi"])
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("distinguishes all-empty catalogs from no usable data after failure", () => {
    const emptyRegistry = makeRegistry(() => Effect.succeed([]));
    const key = new AvailableYieldCategoriesKey({
      categoryOrder: ["stake", "defi"],
      network: "ethereum",
    });
    expect(
      AsyncResult.getOrThrow(
        emptyRegistry.get(availableYieldCategoriesAtom(key))
      )
    ).toEqual([]);

    const failedRegistry = makeRegistry(() =>
      Effect.fail(
        new ApiRequestError({
          cause: new Error("offline"),
          operation: "legacy-token-options",
        })
      )
    );
    const failed = failedRegistry.get(availableYieldCategoriesAtom(key));
    expect(AsyncResult.isFailure(failed)).toBe(true);
    expect(AsyncResult.value(failed)).toEqual(Option.none());
  });
});
