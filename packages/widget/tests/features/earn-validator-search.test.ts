import { Effect, Layer } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { yieldValidatorsAtom } from "../../src/features/earn/state/atoms-state/catalog/atoms";
import {
  YieldValidatorsKey,
  YieldValidatorsPullKey,
} from "../../src/features/earn/state/atoms-state/catalog/keys";
import {
  type ValidatorDirectoryRequest,
  YieldResourceSource,
} from "../../src/services/api/yield-resource-source";
import { getPullResultItems } from "../../src/shared/effect/pagination";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../fixtures";

const yieldId = yieldApiYieldFixture().id;

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
    const unmountLoaded = registry.mount(validators.loadedValidatorsAtom);
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

    registry.set(validators.loadedValidatorsAtom, [byAddress as never]);
    expect(
      [...registry.get(validators.loadedValidatorsAtom).values()].map(
        (validator) => validator.address
      )
    ).toContain("address-match");

    unmount();
    unmountLoaded();
  });
});
