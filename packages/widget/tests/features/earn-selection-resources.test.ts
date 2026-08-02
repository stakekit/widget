import { Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { describe, expect, it, vi } from "vitest";
import { widgetConfigAtom } from "../../src/app/config/settings";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { ApiRequestError } from "../../src/domain/schema/api-errors";
import { TokenBalancesResponse } from "../../src/domain/schema/financial-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  availableYieldCategoriesAtom,
  earnYieldCatalogAtom,
  mergedTokenOptionsAtom,
  yieldValidatorsAtom,
} from "../../src/features/earn/state/earn-selection/resources/atoms";
import {
  AvailableYieldCategoriesKey,
  TokenOptionsKey,
  YieldCatalogKey,
  YieldValidatorsKey,
} from "../../src/features/earn/state/earn-selection/resources/keys";
import {
  MultiYieldsKey,
  visibleMultiYieldsAtom,
} from "../../src/features/yield-summary/state/multi-yields";
import { LegacyResourceSource } from "../../src/services/api/legacy-resource-source";
import { YieldResourceSource } from "../../src/services/api/yield-resource-source";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import {
  yieldApiProviderFixture,
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
} from "../fixtures";

describe("Earn Selection resources", () => {
  it("uses balances only to enrich canonical tokens with amounts", async () => {
    const canonicalYield = yieldApiYieldFixture();
    const balanceOnlyYield = yieldApiYieldFixture({
      id: "ethereum-usdc-staking",
      token: {
        ...canonicalYield.token,
        address: "0x1111111111111111111111111111111111111111",
        name: "USD Coin",
        symbol: "USDC",
      },
    });
    const balanceOnlyYieldId = balanceOnlyYield.id;
    const listYields = vi.fn(() => Effect.die("unexpected Yield directory"));
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.mergeAll(
            Reactivity.layer,
            Layer.succeed(
              LegacyResourceSource,
              LegacyResourceSource.of({
                scanTokenBalances: () =>
                  Effect.succeed(
                    Schema.decodeUnknownSync(TokenBalancesResponse)([
                      {
                        amount: "10",
                        availableYields: [
                          canonicalYield.id,
                          balanceOnlyYieldId,
                        ],
                        token: canonicalYield.token,
                      },
                      {
                        amount: "20",
                        availableYields: [balanceOnlyYieldId],
                        token: balanceOnlyYield.token,
                      },
                    ])
                  ),
              } as never)
            ),
            Layer.succeed(
              YieldResourceSource,
              YieldResourceSource.of({
                listYieldTokens: () =>
                  Effect.succeed({
                    items: [
                      {
                        availableYields: [canonicalYield.id],
                        token: canonicalYield.token,
                      },
                    ],
                    limit: 100,
                    offset: 0,
                    total: 1,
                  }),
                listYields,
              } as never)
            )
          ) as never
        ),
      ],
    });
    const scope = new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)(
        "0x9999999999999999999999999999999999999999"
      ),
      network: "ethereum",
    });
    const resource = mergedTokenOptionsAtom(
      new TokenOptionsKey({
        category: "stake",
        initToken: null,
        initTokenNetwork: null,
        initYieldId: null,
        scope,
        tokensForEnabledYieldsOnly: false,
      })
    );
    const unmount = registry.mount(resource);

    await vi.waitFor(() =>
      expect(AsyncResult.getOrThrow(registry.get(resource))).toEqual([
        {
          amount: "10",
          availableYields: [canonicalYield.id],
          source: "balance",
          token: canonicalYield.token,
        },
      ])
    );
    expect(listYields).not.toHaveBeenCalled();

    unmount();
    registry.dispose();
  });

  it("falls back to canonical tokens when the balance scan fails", async () => {
    const canonicalYield = yieldApiYieldFixture();
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.mergeAll(
            Reactivity.layer,
            Layer.succeed(
              LegacyResourceSource,
              LegacyResourceSource.of({
                scanTokenBalances: () =>
                  Effect.fail(
                    new ApiRequestError({
                      cause: new Error("offline"),
                      operation: "token-balances-scan",
                    })
                  ),
              } as never)
            ),
            Layer.succeed(
              YieldResourceSource,
              YieldResourceSource.of({
                listYieldTokens: () =>
                  Effect.succeed({
                    items: [
                      {
                        availableYields: [canonicalYield.id],
                        token: canonicalYield.token,
                      },
                    ],
                    limit: 100,
                    offset: 0,
                    total: 1,
                  }),
              } as never)
            )
          ) as never
        ),
      ],
    });
    const scope = new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)(
        "0x9999999999999999999999999999999999999999"
      ),
      network: "ethereum",
    });
    const resource = mergedTokenOptionsAtom(
      new TokenOptionsKey({
        category: "stake",
        initToken: null,
        initTokenNetwork: null,
        initYieldId: null,
        scope,
        tokensForEnabledYieldsOnly: false,
      })
    );
    const unmount = registry.mount(resource);

    await vi.waitFor(() =>
      expect(AsyncResult.getOrThrow(registry.get(resource))).toEqual([
        {
          amount: "0",
          availableYields: [canonicalYield.id],
          source: "default",
          token: canonicalYield.token,
        },
      ])
    );

    unmount();
    registry.dispose();
  });

  it("refreshes the responsible authoritative source through the catalog projection", async () => {
    const yieldModel = yieldApiYieldFixture();
    let offline = true;
    const listYields = vi.fn(() =>
      offline
        ? Effect.fail(
            new ApiRequestError({
              cause: new Error("offline"),
              operation: "yield-directory",
            })
          )
        : Effect.succeed({
            items: [yieldModel],
            limit: 100,
            offset: 0,
            total: 1,
          })
    );
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(
            YieldResourceSource,
            YieldResourceSource.of({
              getProvider: () => Effect.succeedNone,
              listYields,
            } as never)
          )
        ),
      ],
    });
    const resource = earnYieldCatalogAtom(
      new YieldCatalogKey({
        category: null,
        network: yieldModel.token.network,
        yieldIds: [yieldModel.id],
      })
    );

    expect(AsyncResult.isFailure(registry.get(resource))).toBe(true);
    const attemptsBeforeRetry = listYields.mock.calls.length;
    offline = false;
    registry.refresh(resource);

    await vi.waitFor(() =>
      expect(AsyncResult.getOrThrow(registry.get(resource))).toEqual([
        yieldModel,
      ])
    );
    expect(listYields).toHaveBeenCalledTimes(attemptsBeforeRetry + 1);
  });

  it("keeps API-scoped yields visible to provider selection", () => {
    const yieldModel = yieldApiYieldFixture({ id: "avax-native-staking" });
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(YieldResourceSource, {
            getProvider: () =>
              Effect.succeed(Option.some(yieldApiProviderFixture())),
            listYields: () =>
              Effect.succeed({
                items: [yieldModel],
                limit: 100,
                offset: 0,
                total: 1,
              }),
          } as never)
        ),
      ],
    });
    const result = registry.get(
      visibleMultiYieldsAtom(new MultiYieldsKey({ yieldIds: [yieldModel.id] }))
    );

    expect(AsyncResult.getOrThrow(result)?.map(({ id }) => id)).toEqual([
      yieldModel.id,
    ]);
  });

  it("keeps a category available when its enter-enabled yield has zero reward", () => {
    const yieldModel = yieldApiYieldFixture({
      rewardRate: { components: [], rateType: "APY", total: 0 },
    });
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(YieldResourceSource, {
            listYields: () =>
              Effect.succeed({
                items: [yieldModel],
                limit: 100,
                offset: 0,
                total: 1,
              }),
          } as never)
        ),
      ],
    });
    const result = registry.get(
      availableYieldCategoriesAtom(
        new AvailableYieldCategoriesKey({
          categoryOrder: ["stake"],
          network: "ethereum",
        })
      )
    );

    expect(AsyncResult.getOrThrow(result)).toEqual(["stake"]);
  });

  it("exposes required validator initial acquisition state", () => {
    const yieldModel = yieldApiYieldFixture();
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(YieldResourceSource, {
            listValidators: () => Effect.never,
          } as never)
        ),
      ],
    });
    const validators = yieldValidatorsAtom(
      new YieldValidatorsKey({ selectedYieldId: yieldModel.id })
    );
    const result = registry.get(validators.initialValidatorsResultAtom);

    expect(AsyncResult.isWaiting(result)).toBe(true);
    expect(AsyncResult.value(result)).toEqual(Option.none());
  });

  it("applies validator configuration before selection and readiness", () => {
    const yieldModel = yieldApiYieldFixture();
    const allowed = {
      ...yieldApiValidatorFixture({ address: "0xallowed" }),
      key: "0xallowed" as never,
    };
    const blocked = {
      ...yieldApiValidatorFixture({ address: "0xblocked" }),
      key: "0xblocked" as never,
    };
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(
            YieldResourceSource,
            YieldResourceSource.of({
              listValidators: () =>
                Effect.succeed({
                  items: [blocked, allowed],
                  limit: 100,
                  offset: 0,
                  total: 2,
                }),
            } as never)
          )
        ),
      ],
    });
    registry.set(widgetConfigAtom, {
      ...registry.get(widgetConfigAtom),
      validatorsConfig: {
        ethereum: { blocked: [blocked.address] },
      },
    });
    const validators = yieldValidatorsAtom(
      new YieldValidatorsKey({
        network: yieldModel.token.network,
        selectedYieldId: yieldModel.id,
      })
    );

    const initial = AsyncResult.getOrThrow(
      registry.get(validators.initialValidatorsResultAtom)
    );

    expect(initial.map((validator) => validator.address)).toEqual([
      allowed.address,
    ]);
  });
});
