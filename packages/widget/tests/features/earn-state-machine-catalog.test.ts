import { Effect, Layer, Option } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import { widgetConfigAtom } from "../../src/app/config/settings";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { ApiRequestError } from "../../src/domain/schema/api-errors";
import {
  availableYieldCategoriesAtom,
  earnYieldCatalogAtom,
  yieldValidatorsAtom,
} from "../../src/features/earn/state/atoms-state/catalog/atoms";
import {
  AvailableYieldCategoriesKey,
  YieldCatalogKey,
  YieldValidatorsKey,
} from "../../src/features/earn/state/atoms-state/catalog/keys";
import {
  MultiYieldsKey,
  visibleMultiYieldsAtom,
} from "../../src/features/yield-summary/state/multi-yields";
import { YieldResourceSource } from "../../src/services/api/yield-resource-source";
import {
  yieldApiProviderFixture,
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
} from "../fixtures";

describe("Earn state machine catalog", () => {
  it("refreshes the responsible authoritative source through the catalog projection", () => {
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
            YieldResourceSource.of({ listYields } as never)
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

    expect(AsyncResult.getOrThrow(registry.get(resource))).toEqual([
      yieldModel,
    ]);
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
    expect(registry.get(validators.rememberValidatorsAtom).size).toBe(0);
  });
});
