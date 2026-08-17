import { Duration, Effect, Layer } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import type { EarnYield } from "../../src/domain/earn/models";
import { yieldValidatorsAtom } from "../../src/features/earn/state/earn-selection/catalog/catalog";
import {
  YieldValidatorsKey,
  YieldValidatorsPullKey,
} from "../../src/features/earn/state/earn-selection/catalog/keys";
import {
  earnValidatorSelectionViewAtom,
  selectEarnValidatorAtom,
  setEarnValidatorSearchAtom,
} from "../../src/features/earn/state/runtime";
import { LegacyResourceSource } from "../../src/services/api/legacy-resource-source";
import {
  type ValidatorDirectoryRequest,
  YieldResourceSource,
} from "../../src/services/api/yield-resource-source";
import { getPullResultItems } from "../../src/shared/effect/pagination";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../fixtures";
import { applicationRuntimeInitInitialValue } from "../utils/widget-config";

const yieldId = yieldApiYieldFixture().id;

const VALIDATOR_SEARCH_DEBOUNCE_MS = 300;
const SLOW_SEARCH_RESPONSE_MS = 1000;

const validatorSelectionYield = (): typeof EarnYield.Type => {
  const base = yieldApiYieldFixture();

  return {
    ...base,
    mechanics: { ...base.mechanics, requiresValidatorSelection: true },
  };
};

describe("Earn validator search", () => {
  it("searches name and address independently and merges the results", async () => {
    const search = "needle";
    const byName = {
      ...yieldApiValidatorFixture({ address: "name-match" }),
      key: "name-match" as never,
    };
    const byAddress = {
      ...yieldApiValidatorFixture({ address: "address-match" }),
      key: "address-match" as never,
    };
    const listValidators = vi.fn((request: ValidatorDirectoryRequest) => {
      const getItems = (): Array<typeof byName> => {
        if (request.name === search && request.address === undefined) {
          return [byName];
        }
        if (request.address === search && request.name === undefined) {
          return [byAddress];
        }
        return [];
      };
      const items = getItems();

      return Effect.succeed({
        items,
        limit: request.limit,
        offset: request.offset,
        total: items.length,
      });
    });
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(
            YieldResourceSource,
            YieldResourceSource.of({ listValidators } as never)
          )
        ),
      ],
    });
    const validators = yieldValidatorsAtom(
      new YieldValidatorsKey({ selectedYieldId: yieldId })
    );
    const pull = validators.validatorsPullAtom(
      new YieldValidatorsPullKey({ search })
    );
    const unmount = registry.mount(pull);

    await Effect.runPromise(Effect.yieldNow);
    await expect
      .poll(() => listValidators.mock.calls.length)
      .toBeGreaterThan(0);
    const searchRequests = listValidators.mock.calls
      .map(([request]) => request)
      .filter((request) => request.name || request.address);

    expect(
      searchRequests.map(({ address, name }) => ({ address, name }))
    ).toEqual([
      { address: undefined, name: search },
      { address: search, name: undefined },
    ]);

    expect(
      getPullResultItems(registry.get(pull))
        .flatMap((page) => page.items)
        .map((validator) => validator.address)
    ).toEqual(["name-match", "address-match"]);

    unmount();
  });

  it("debounces the normalized query, rekeys the request, and drops stale results", async () => {
    vi.useFakeTimers();
    const selectedYield = validatorSelectionYield();
    // The stubbed source bypasses decoding, so the derived `key` is supplied
    // here the same way the schema derives it from the address.
    const validator = (address: string, name: string) => ({
      ...yieldApiValidatorFixture({ address, name }),
      key: address as never,
    });
    const catalogValidator = validator(
      "0x1111111111111111111111111111111111111111",
      "Catalog"
    );
    const alphaValidator = validator(
      "0x2222222222222222222222222222222222222222",
      "Alpha"
    );
    const betaValidator = validator(
      "0x3333333333333333333333333333333333333333",
      "Beta"
    );
    const listValidators = vi.fn((request: ValidatorDirectoryRequest) => {
      const page = (items: ReadonlyArray<typeof catalogValidator>) =>
        Effect.succeed({
          items,
          limit: request.limit,
          offset: request.offset,
          total: items.length,
        });
      const query = request.name ?? request.address ?? null;

      if (request.preferred) return page([]);
      if (query === null) return page([catalogValidator]);
      // Only the name branch matches these fixtures. The Alpha response is
      // delayed past the point where the query has moved on to Beta.
      if (query === "Alpha") {
        return Effect.sleep(Duration.millis(SLOW_SEARCH_RESPONSE_MS)).pipe(
          Effect.andThen(page(request.name ? [alphaValidator] : []))
        );
      }
      if (query === "Beta") return page(request.name ? [betaValidator] : []);
      return page([]);
    });
    const listYields = vi.fn(() =>
      Effect.succeed({
        items: [selectedYield],
        limit: 100,
        offset: 0,
        total: 1,
      })
    );
    const getTokenOptions = vi.fn(() =>
      Effect.succeed([
        {
          availableYields: [selectedYield.id],
          token: selectedYield.token,
        },
      ])
    );
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(
          appRuntime.layer,
          Layer.mergeAll(
            Layer.succeed(
              YieldResourceSource,
              YieldResourceSource.of({
                getProvider: () => Effect.succeedNone,
                listValidators,
                listYields,
              } as never)
            ),
            Layer.succeed(
              LegacyResourceSource,
              LegacyResourceSource.of({ getTokenOptions } as never)
            )
          ) as never
        ),
      ],
    });
    const unmount = registry.mount(earnValidatorSelectionViewAtom);
    const searchQueries = () =>
      listValidators.mock.calls
        .map(([request]) => request.name ?? request.address ?? null)
        .filter((query): query is string => query !== null);
    const validatorNames = () =>
      registry
        .get(earnValidatorSelectionViewAtom)
        .data?.map((validator) => validator.name) ?? null;

    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(validatorNames()).toEqual(["Catalog"]);

      registry.set(setEarnValidatorSearchAtom, "  Alpha  ");
      expect(registry.get(earnValidatorSelectionViewAtom)).toMatchObject({
        isDebouncing: true,
        search: "  Alpha  ",
      });

      await vi.advanceTimersByTimeAsync(VALIDATOR_SEARCH_DEBOUNCE_MS - 1);
      expect(registry.get(earnValidatorSelectionViewAtom).isDebouncing).toBe(
        true
      );
      expect(searchQueries()).toEqual([]);

      await vi.advanceTimersByTimeAsync(1);
      expect(registry.get(earnValidatorSelectionViewAtom).isDebouncing).toBe(
        false
      );
      expect(searchQueries()).toEqual(["Alpha", "Alpha"]);

      registry.set(setEarnValidatorSearchAtom, "Beta");
      await vi.advanceTimersByTimeAsync(VALIDATOR_SEARCH_DEBOUNCE_MS);
      expect(searchQueries()).toEqual(["Alpha", "Alpha", "Beta", "Beta"]);
      expect(validatorNames()).toEqual(["Beta"]);

      await vi.advanceTimersByTimeAsync(SLOW_SEARCH_RESPONSE_MS);
      expect(validatorNames()).toEqual(["Beta"]);

      const beta = registry.get(earnValidatorSelectionViewAtom).data?.[0];
      registry.set(selectEarnValidatorAtom, beta!.key);
      await vi.advanceTimersByTimeAsync(0);
      expect([
        ...registry.get(earnValidatorSelectionViewAtom).selected.keys(),
      ]).toEqual([beta!.key]);
      registry.set(setEarnValidatorSearchAtom, "");
      await vi.advanceTimersByTimeAsync(VALIDATOR_SEARCH_DEBOUNCE_MS);

      expect([
        ...registry.get(earnValidatorSelectionViewAtom).selected.keys(),
      ]).toEqual([beta!.key]);
      expect([
        ...registry.get(earnValidatorSelectionViewAtom).selected.values(),
      ]).toEqual([beta]);
      expect(validatorNames()).toEqual(["Catalog"]);
    } finally {
      unmount();
      registry.dispose();
      vi.useRealTimers();
    }
  });
});
