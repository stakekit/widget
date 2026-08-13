import { Cause, Effect, Layer, Option } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import {
  preferredValidatorsResourceAtom,
  ValidatorByAddressKey,
  ValidatorsError,
  ValidatorsKey,
  validatorByAddressAtom,
  validatorsPullAtom,
} from "../../src/resources/validator-directory/validator-directory";
import { ApiRequestError } from "../../src/services/api/api-errors";
import {
  type ValidatorDirectoryRequest,
  YieldResourceSource,
} from "../../src/services/api/yield-resource-source";
import { getPullResultItems } from "../../src/shared/effect/pagination";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../fixtures";

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

  it("resolves an address with one bounded request", () => {
    const requested = makeValidator("validator-address");
    const listValidators = vi.fn((request: ValidatorDirectoryRequest) =>
      Effect.succeed({
        items: [requested],
        limit: request.limit,
        offset: request.offset,
        total: 200,
      })
    );
    const registry = makeRegistry(listValidators as never);

    expect(
      AsyncResult.getOrThrow(
        registry.get(
          validatorByAddressAtom(
            new ValidatorByAddressKey({
              address: requested.address as never,
              yieldId,
            })
          )
        )
      ).address
    ).toBe(requested.address);
    expect(listValidators).toHaveBeenCalledOnce();
    expect(listValidators.mock.calls[0]?.[0]).toMatchObject({
      address: requested.address,
      offset: 0,
    });
  });

  it("publishes a typed failure and refreshes the exact discovery", () => {
    let offline = true;
    const requestError = new ApiRequestError({
      cause: new Error("offline"),
      operation: "validator-directory",
    });
    const listValidators = vi.fn((request: ValidatorDirectoryRequest) =>
      offline
        ? Effect.fail(requestError)
        : Effect.succeed({
            items: [],
            limit: request.limit,
            offset: request.offset,
            total: 0,
          })
    );
    const registry = makeRegistry(listValidators);
    const resource = validatorsPullAtom(new ValidatorsKey({ yieldId }));
    const failed = registry.get(resource);

    expect(AsyncResult.isFailure(failed)).toBe(true);
    if (!AsyncResult.isFailure(failed)) throw new Error("Expected failure");
    expect(
      Option.getOrThrow(Cause.findErrorOption(failed.cause))
    ).toBeInstanceOf(ValidatorsError);

    const attemptsBeforeRetry = listValidators.mock.calls.length;
    offline = false;
    registry.refresh(resource);
    expect(getValidators(registry.get(resource))).toEqual([]);
    expect(listValidators).toHaveBeenCalledTimes(attemptsBeforeRetry + 1);
  });
});
