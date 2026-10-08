import { Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { YieldId } from "../../src/domain/identity/identifiers";
import { Token } from "../../src/domain/token/token";
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

  it("adds the display-only yields closed to deposits that the project offers", () => {
    const usdc = Schema.decodeSync(Token)({
      ...yieldModel.token,
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      name: "USD Coin",
      symbol: "USDC",
    });
    const usdt = Schema.decodeSync(Token)({
      ...usdc,
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      symbol: "USDT",
    });
    const enterableUsdcYield = YieldId.make("ethereum-usdc-enterable-rwa");
    const displayOnlyYield = YieldId.make("ethereum-usdc-midas-mglobal-vault");
    const getTokenOptions = vi.fn<Parameters<typeof makeRegistry>[0]>();
    vi.when(getTokenOptions, { onUnmatched: "throw" })
      .calledWith({
        enter: true,
        network: "ethereum",
        yieldTypes: ["real_world_asset"],
      })
      .thenReturn(
        Effect.succeed([{ availableYields: [enterableUsdcYield], token: usdc }])
      )
      .calledWith({ network: "ethereum", yieldTypes: ["real_world_asset"] })
      .thenReturn(
        Effect.succeed([
          {
            availableYields: [
              enterableUsdcYield,
              displayOnlyYield,
              YieldId.make("ethereum-usdc-closed-rwa"),
            ],
            token: usdc,
          },
          {
            availableYields: [YieldId.make("ethereum-usdt-closed-rwa")],
            token: usdt,
          },
        ])
      );
    const registry = makeRegistry(getTokenOptions);

    const result = registry.get(
      earnTokenCatalogResourceAtom(
        new EarnTokenCatalogKey({ category: "rwa", network: "ethereum" })
      )
    );

    expect(AsyncResult.getOrThrow(result)).toEqual([
      { availableYields: [enterableUsdcYield, displayOnlyYield], token: usdc },
    ]);
  });

  it("lists a token whose only offered yield is a display-only yield", () => {
    const usdg = Schema.decodeSync(Token)({
      ...yieldModel.token,
      address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
      name: "Global Dollar",
      network: "robinhood",
      symbol: "USDG",
    });
    const displayOnlyYield = YieldId.make("robinhood-usdg-midas-mglo-vault");
    const getTokenOptions = vi.fn((request: EarnTokenCatalogRequest) =>
      Effect.succeed(
        request.enter
          ? []
          : [{ availableYields: [displayOnlyYield], token: usdg }]
      )
    );
    const registry = makeRegistry(getTokenOptions);

    const result = registry.get(
      earnTokenCatalogResourceAtom(
        new EarnTokenCatalogKey({ category: null, network: null })
      )
    );

    expect(AsyncResult.getOrThrow(result)).toEqual([
      { availableYields: [displayOnlyYield], token: usdg },
    ]);
  });

  it("keeps enterable yields when the display-only request fails", () => {
    const getTokenOptions = vi.fn((request: EarnTokenCatalogRequest) =>
      request.enter
        ? Effect.succeed([tokenOption])
        : Effect.fail(
            new ApiRequestError({
              cause: new Error("offline"),
              operation: "legacy-token-options",
            })
          )
    );
    const registry = makeRegistry(getTokenOptions);

    const result = registry.get(
      earnTokenCatalogResourceAtom(
        new EarnTokenCatalogKey({ category: "rwa", network: "ethereum" })
      )
    );

    expect(AsyncResult.getOrThrow(result)).toEqual([tokenOption]);
    expect(getTokenOptions).toHaveBeenCalledWith({
      network: "ethereum",
      yieldTypes: ["real_world_asset"],
    });
  });

  it("omits failed dashboard categories when another category is usable", () => {
    const ethereumYieldRequest = (yieldTypes: ReadonlyArray<string>) =>
      expect.objectContaining({
        enter: true,
        network: "ethereum",
        yieldTypes,
      });

    const getTokenOptions = vi.fn<Parameters<typeof makeRegistry>[0]>();
    vi.when(getTokenOptions, { onUnmatched: "throw" })
      .calledWith(
        ethereumYieldRequest(["staking", "restaking", "liquid_staking"])
      )
      .thenReturn(
        Effect.fail(
          new ApiRequestError({
            cause: new Error("offline"),
            operation: "legacy-token-options",
          })
        )
      )
      .calledWith(
        ethereumYieldRequest([
          "lending",
          "vault",
          "fixed_yield",
          "concentrated_liquidity_pool",
          "liquidity_pool",
        ])
      )
      .thenReturn(Effect.succeed([tokenOption]))
      .calledWith(ethereumYieldRequest(["real_world_asset"]))
      .thenReturn(Effect.succeed([]))
      .calledWith({ network: "ethereum", yieldTypes: ["real_world_asset"] })
      .thenReturn(Effect.succeed([]));
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
