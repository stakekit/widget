import { Effect, Layer, Option } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, it, vi } from "vitest";

import {
  preferredValidatorsResourceAtom,
  ValidatorsAtAddressesKey,
  ValidatorsAtAddressKey,
  ValidatorsKey,
  validatorsAtAddressAtom,
  validatorsAtAddressesAtom,
  validatorsPullAtom,
} from "../../../src/resources/validator-directory/validator-directory";
import { appRuntime } from "../../../src/runtime/app-runtime";
import {
  ApiRequestError,
  type ValidatorDirectoryRequest,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import { getPullResultItems } from "../../../src/shared/effect/pagination";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../../fixtures";

const yieldId = yieldApiYieldFixture().id;
const makeValidator = (address: string) => {
  const validator = yieldApiValidatorFixture({ address });
  return { ...validator, key: address as never };
};

const makeRegistry = (
  listValidators: YieldResourceSource["Service"]["listValidators"]
) =>
  AtomRegistry.make({
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

const getValidators = (
  result: Atom.Type<ReturnType<typeof validatorsPullAtom>>
) => getPullResultItems(result).flatMap((page) => page.items);

describe("Validator resources", () => {
  it("shares normalized discovery and loads one page per Pull", async () => {
    const validators = Array.from({ length: 101 }, (_, index) =>
      makeValidator(`validator-${index}`)
    );
    const listValidators = vi.fn((request: ValidatorDirectoryRequest) =>
      Effect.succeed({
        items: validators.slice(request.offset, request.offset + request.limit),
        limit: request.limit,
        offset: request.offset,
        total: validators.length,
      })
    );
    const registry = makeRegistry(listValidators as never);
    const first = new ValidatorsKey({
      search: " ",
      status: "active",
      yieldId,
    });
    const equivalent = new ValidatorsKey({
      status: "active",
      yieldId,
    });
    const firstPull = validatorsPullAtom(first);
    const equivalentPull = validatorsPullAtom(equivalent);
    const unmount = registry.mount(firstPull);

    await vi.waitFor(() =>
      expect(getValidators(registry.get(firstPull))).toHaveLength(100)
    );
    expect(AsyncResult.getOrThrow(registry.get(firstPull)).done).toBe(false);
    expect(firstPull).toBe(equivalentPull);
    expect(listValidators).toHaveBeenCalledOnce();

    registry.set(firstPull, undefined);

    await vi.waitFor(() =>
      expect(getValidators(registry.get(firstPull))).toHaveLength(101)
    );
    expect(AsyncResult.getOrThrow(registry.get(firstPull)).done).toBe(true);
    expect(listValidators).toHaveBeenCalledTimes(2);

    unmount();
    registry.dispose();
  });

  it("advances name and address search branches independently", async () => {
    const byName = makeValidator("name-match");
    const byAddress = [makeValidator("address-0"), makeValidator("address-1")];
    const listValidators = vi.fn((request: ValidatorDirectoryRequest) => {
      if (request.name) {
        return Effect.succeed({
          items: [byName],
          limit: 1,
          offset: request.offset,
          total: 1,
        });
      }

      return Effect.succeed({
        items: [byAddress[request.offset]!],
        limit: 1,
        offset: request.offset,
        total: 2,
      });
    });
    const registry = makeRegistry(listValidators as never);
    const pull = validatorsPullAtom(
      new ValidatorsKey({ search: "needle", status: "active", yieldId })
    );
    const unmount = registry.mount(pull);

    await vi.waitFor(() =>
      expect(
        getValidators(registry.get(pull)).map((validator) => validator.address)
      ).toEqual(["name-match", "address-0"])
    );

    registry.set(pull, undefined);

    await vi.waitFor(() =>
      expect(
        getValidators(registry.get(pull)).map((validator) => validator.address)
      ).toEqual(["name-match", "address-0", "address-1"])
    );
    expect(
      listValidators.mock.calls.map(([request]) => ({
        address: request.address,
        name: request.name,
        offset: request.offset,
      }))
    ).toEqual([
      { address: undefined, name: "needle", offset: 0 },
      { address: "needle", name: undefined, offset: 0 },
      { address: "needle", name: undefined, offset: 1 },
    ]);

    unmount();
    registry.dispose();
  });

  it("does not skip a page containing only duplicate validators", async () => {
    const first = makeValidator("validator-a");
    const second = makeValidator("validator-b");
    const listValidators = vi.fn((request: ValidatorDirectoryRequest) =>
      Effect.succeed({
        items: [request.offset < 2 ? first : second],
        limit: 1,
        offset: request.offset,
        total: 3,
      })
    );
    const registry = makeRegistry(listValidators as never);
    const pull = validatorsPullAtom(new ValidatorsKey({ yieldId }));
    const unmount = registry.mount(pull);

    await vi.waitFor(() =>
      expect(getValidators(registry.get(pull))).toEqual([first])
    );
    expect(listValidators).toHaveBeenCalledOnce();

    registry.set(pull, undefined);

    await vi.waitFor(() => expect(listValidators).toHaveBeenCalledTimes(2));
    expect(getValidators(registry.get(pull))).toEqual([first]);

    registry.set(pull, undefined);

    await vi.waitFor(() =>
      expect(getValidators(registry.get(pull))).toEqual([first, second])
    );
    expect(listValidators).toHaveBeenCalledTimes(3);
    expect(
      listValidators.mock.calls.map(([request]) => request.offset)
    ).toEqual([0, 1, 2]);

    unmount();
    registry.dispose();
  });

  it("retains the first page after a later failure and refreshes from page one", async () => {
    const first = makeValidator("validator-a");
    let failSecondPage = true;
    const listValidators = vi.fn((request: ValidatorDirectoryRequest) =>
      request.offset > 0 && failSecondPage
        ? Effect.fail(
            new ApiRequestError({
              cause: new Error("offline"),
              failure: { _tag: "Unreachable" },
              operation: "validator-directory",
            })
          )
        : Effect.succeed({
            items: [first],
            limit: 1,
            offset: request.offset,
            total: 2,
          })
    );
    const registry = makeRegistry(listValidators as never);
    const pull = validatorsPullAtom(new ValidatorsKey({ yieldId }));
    const unmount = registry.mount(pull);

    await vi.waitFor(() =>
      expect(getValidators(registry.get(pull))).toEqual([first])
    );
    registry.set(pull, undefined);
    await vi.waitFor(() =>
      expect(AsyncResult.isFailure(registry.get(pull))).toBe(true)
    );
    expect(
      registry
        .get(pull)
        .pipe(AsyncResult.value, Option.getOrThrow)
        .items.flatMap((page) => page.items)
    ).toEqual([first]);

    failSecondPage = false;
    registry.refresh(pull);

    await vi.waitFor(() =>
      expect(AsyncResult.isSuccess(registry.get(pull))).toBe(true)
    );
    expect(
      listValidators.mock.calls.map(([request]) => request.offset)
    ).toEqual([0, 1, 0]);

    unmount();
    registry.dispose();
  });

  it("loads the complete preferred set explicitly", () => {
    const validators = Array.from({ length: 101 }, (_, index) =>
      makeValidator(`preferred-${index}`)
    );
    const listValidators = vi.fn((request: ValidatorDirectoryRequest) =>
      Effect.succeed({
        items: validators.slice(request.offset, request.offset + request.limit),
        limit: request.limit,
        offset: request.offset,
        total: validators.length,
      })
    );
    const registry = makeRegistry(listValidators as never);

    expect(
      AsyncResult.getOrThrow(
        registry.get(preferredValidatorsResourceAtom(yieldId))
      )
    ).toHaveLength(101);
    expect(listValidators).toHaveBeenCalledTimes(2);
    expect(
      listValidators.mock.calls.every(
        ([request]) => request.preferred === true && request.status === "active"
      )
    ).toBe(true);
  });

  const resolveAddress = (
    listValidators: (
      request: ValidatorDirectoryRequest
    ) => Effect.Effect<unknown>,
    address: string,
    status: "active" | null
  ) =>
    AsyncResult.getOrThrow(
      makeRegistry(listValidators as never).get(
        validatorsAtAddressAtom(
          new ValidatorsAtAddressKey({
            address: address as never,
            status,
            yieldId,
          })
        )
      )
    ).map((validator) => validator.key);

  it("resolves every validator at an address, one per subnet, by its exact address", () => {
    const listValidators = vi.fn((request: ValidatorDirectoryRequest) =>
      Effect.succeed({
        items: [
          { ...makeValidator("validator-address"), key: "subnet-1" },
          { ...makeValidator("validator-address"), key: "subnet-2" },
        ],
        limit: request.limit,
        offset: request.offset,
        total: 2,
      })
    );

    expect(
      resolveAddress(listValidators, "validator-address", "active")
    ).toEqual(["subnet-1", "subnet-2"]);
    expect(listValidators).toHaveBeenCalledOnce();
    expect(listValidators.mock.calls[0]?.[0]).toMatchObject({
      addresses: ["validator-address"],
      offset: 0,
      status: "active",
    });
    expect(listValidators.mock.calls[0]?.[0]).not.toHaveProperty("address");
  });

  it("resolves no validator when the directory lists none at the address", () => {
    const listValidators = vi.fn((request: ValidatorDirectoryRequest) =>
      Effect.succeed({
        items: [],
        limit: request.limit,
        offset: request.offset,
        total: 0,
      })
    );

    expect(resolveAddress(listValidators, "validator-address", null)).toEqual(
      []
    );
    expect(listValidators.mock.calls[0]?.[0]).not.toHaveProperty("status");
  });

  it("resolves every page of the validators at several addresses", () => {
    // Two addresses with 75 subnets each: more rows than one page holds.
    const listed = ["validator-a", "validator-b"].flatMap((address) =>
      Array.from({ length: 75 }, (_, subnet) => ({
        ...makeValidator(address),
        key: `${address}-${subnet}`,
      }))
    );
    const listValidators = vi.fn((request: ValidatorDirectoryRequest) =>
      Effect.succeed({
        items: listed.slice(request.offset, request.offset + request.limit),
        limit: request.limit,
        offset: request.offset,
        total: listed.length,
      })
    );

    const keys = AsyncResult.getOrThrow(
      makeRegistry(listValidators as never).get(
        validatorsAtAddressesAtom(
          new ValidatorsAtAddressesKey({
            addresses: ["validator-b" as never, "validator-a" as never],
            status: "active",
            yieldId,
          })
        )
      )
    ).map((validator) => validator.key);

    expect(keys).toHaveLength(150);
    expect(keys).toContain("validator-a-0");
    expect(keys).toContain("validator-b-74");
    expect(
      listValidators.mock.calls.map(([request]) => request.offset)
    ).toEqual([0, 100]);
    expect(listValidators.mock.calls[0]?.[0]).toMatchObject({
      addresses: ["validator-a", "validator-b"],
    });
  });

  it("matches hex validator addresses case-insensitively and other encodings exactly", () => {
    const resolve = (listed: string, requested: string) =>
      resolveAddress(
        vi.fn(() =>
          Effect.succeed({
            items: [makeValidator(listed)],
            limit: 1,
            offset: 0,
            total: 1,
          })
        ),
        requested,
        null
      );

    expect(resolve("0xAbCd", "0xaBcD")).toEqual(["0xAbCd"]);
    expect(resolve("cosmosvaloper1AbCd", "cosmosvaloper1aBcD")).toEqual([]);
  });
});
