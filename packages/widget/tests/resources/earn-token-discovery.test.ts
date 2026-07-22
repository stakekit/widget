import { Cause, Effect, Layer, Option } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { ApiRequestError } from "../../src/domain/schema/api-errors";
import { legacyTokenOptionsResourceAtom } from "../../src/resources/legacy-token-options/legacy-token-options";
import {
  YieldTokensError,
  YieldTokensKey,
  yieldTokensPullAtom,
} from "../../src/resources/yield-token-directory/yield-token-directory";
import { LegacyResourceSource } from "../../src/services/api/legacy-resource-source";
import {
  YieldResourceSource,
  type YieldTokenDirectoryRequest,
} from "../../src/services/api/yield-resource-source";
import { yieldApiYieldFixture } from "../fixtures";

const yieldModel = yieldApiYieldFixture();
const tokenOption = {
  availableYields: [yieldModel.id],
  token: yieldModel.token,
};

const makeRegistry = ({
  legacy,
  yieldSource,
}: {
  readonly legacy?: LegacyResourceSource["Service"];
  readonly yieldSource?: YieldResourceSource["Service"];
}) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        (legacy
          ? Layer.succeed(LegacyResourceSource, legacy)
          : Layer.succeed(YieldResourceSource, yieldSource!)) as never
      ),
    ],
  });

describe("Earn token discovery resources", () => {
  it("shares normalized Yield filters and loads one page per Pull", async () => {
    const items = Array.from({ length: 101 }, () => tokenOption);
    const listYieldTokens = vi.fn((request: YieldTokenDirectoryRequest) =>
      Effect.succeed({
        items: items.slice(request.offset, request.offset + 60),
        limit: 60,
        offset: request.offset,
        total: items.length,
      })
    );
    const registry = makeRegistry({
      yieldSource: YieldResourceSource.of({ listYieldTokens } as never),
    });
    const first = new YieldTokensKey({
      networks: ["ethereum", "ethereum"],
      yieldTypes: ["staking", "staking"],
    });
    const equivalent = new YieldTokensKey({
      networks: ["ethereum"],
      yieldTypes: ["staking"],
    });
    const firstPull = yieldTokensPullAtom(first);
    const equivalentPull = yieldTokensPullAtom(equivalent);
    const unmount = registry.mount(firstPull);

    await vi.waitFor(() =>
      expect(
        AsyncResult.getOrThrow(registry.get(firstPull)).items.flatMap(
          (page) => page.items
        )
      ).toHaveLength(60)
    );
    expect(AsyncResult.getOrThrow(registry.get(firstPull)).done).toBe(false);
    expect(firstPull).toBe(equivalentPull);
    expect(listYieldTokens).toHaveBeenCalledOnce();

    registry.set(firstPull, undefined);

    await vi.waitFor(() =>
      expect(
        AsyncResult.getOrThrow(registry.get(firstPull)).items.flatMap(
          (page) => page.items
        )
      ).toHaveLength(101)
    );
    expect(AsyncResult.getOrThrow(registry.get(firstPull)).done).toBe(true);
    expect(listYieldTokens).toHaveBeenCalledTimes(2);
    expect(
      listYieldTokens.mock.calls.map(([request]) => request.offset)
    ).toEqual([0, 60]);

    unmount();
    registry.dispose();
  });

  it("does not skip an empty intermediate page", async () => {
    const listYieldTokens = vi.fn((request: YieldTokenDirectoryRequest) =>
      Effect.succeed({
        items: request.offset === 0 ? [] : [tokenOption],
        limit: 1,
        offset: request.offset,
        total: 2,
      })
    );
    const registry = makeRegistry({
      yieldSource: YieldResourceSource.of({ listYieldTokens } as never),
    });
    const pull = yieldTokensPullAtom(
      new YieldTokensKey({ networks: ["ethereum"] })
    );
    const unmount = registry.mount(pull);

    await vi.waitFor(() => expect(listYieldTokens).toHaveBeenCalledOnce());
    expect(
      AsyncResult.getOrThrow(registry.get(pull)).items.flatMap(
        (page) => page.items
      )
    ).toEqual([]);

    registry.set(pull, undefined);

    await vi.waitFor(() =>
      expect(
        AsyncResult.getOrThrow(registry.get(pull)).items.flatMap(
          (page) => page.items
        )
      ).toEqual([tokenOption])
    );
    expect(listYieldTokens).toHaveBeenCalledTimes(2);

    unmount();
    registry.dispose();
  });

  it("retains the first page after a later failure and refreshes from page one", async () => {
    let failSecondPage = true;
    const listYieldTokens = vi.fn((request: YieldTokenDirectoryRequest) =>
      request.offset > 0 && failSecondPage
        ? Effect.fail(
            new ApiRequestError({
              cause: new Error("offline"),
              operation: "yield-token-directory",
            })
          )
        : Effect.succeed({
            items: [tokenOption],
            limit: 1,
            offset: request.offset,
            total: 2,
          })
    );
    const registry = makeRegistry({
      yieldSource: YieldResourceSource.of({ listYieldTokens } as never),
    });
    const pull = yieldTokensPullAtom(
      new YieldTokensKey({ networks: ["ethereum"] })
    );
    const unmount = registry.mount(pull);

    await vi.waitFor(() =>
      expect(
        AsyncResult.getOrThrow(registry.get(pull)).items.flatMap(
          (page) => page.items
        )
      ).toEqual([tokenOption])
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
    ).toEqual([tokenOption]);

    failSecondPage = false;
    registry.refresh(pull);

    await vi.waitFor(() =>
      expect(AsyncResult.isSuccess(registry.get(pull))).toBe(true)
    );
    expect(
      listYieldTokens.mock.calls.map(([request]) => request.offset)
    ).toEqual([0, 1, 0]);

    unmount();
    registry.dispose();
  });

  it("treats explicit empty filters as an empty fact without I/O", () => {
    const listYieldTokens = vi.fn(() => Effect.die("unused"));
    const registry = makeRegistry({
      yieldSource: YieldResourceSource.of({ listYieldTokens } as never),
    });

    const result = registry.get(
      yieldTokensPullAtom(new YieldTokensKey({ networks: [] }))
    );

    expect(AsyncResult.getOrThrow(result)).toMatchObject({
      done: true,
      items: [{ items: [] }],
    });
    expect(listYieldTokens).not.toHaveBeenCalled();
  });

  it("shares Legacy options by network and separates distinct networks", () => {
    const getTokenOptions = vi.fn(() => Effect.succeed([tokenOption]));
    const registry = makeRegistry({
      legacy: LegacyResourceSource.of({ getTokenOptions } as never),
    });

    registry.get(legacyTokenOptionsResourceAtom("ethereum"));
    registry.get(legacyTokenOptionsResourceAtom("ethereum"));
    registry.get(legacyTokenOptionsResourceAtom("base"));

    expect(getTokenOptions).toHaveBeenCalledTimes(2);
    expect(getTokenOptions.mock.calls).toEqual([["ethereum"], ["base"]]);
  });

  it("publishes typed Yield failures and retries the same filters", () => {
    let offline = true;
    const requestError = new ApiRequestError({
      cause: new Error("offline"),
      operation: "yield-token-directory",
    });
    const listYieldTokens = vi.fn((request: YieldTokenDirectoryRequest) =>
      offline
        ? Effect.fail(requestError)
        : Effect.succeed({
            items: [],
            limit: request.limit,
            offset: request.offset,
            total: 0,
          })
    );
    const registry = makeRegistry({
      yieldSource: YieldResourceSource.of({ listYieldTokens } as never),
    });
    const key = new YieldTokensKey({ networks: ["ethereum"] });
    const resource = yieldTokensPullAtom(key);
    const failed = registry.get(resource);

    expect(AsyncResult.isFailure(failed)).toBe(true);
    if (!AsyncResult.isFailure(failed)) throw new Error("Expected failure");
    expect(
      Option.getOrThrow(Cause.findErrorOption(failed.cause))
    ).toBeInstanceOf(YieldTokensError);

    const attemptsBeforeRetry = listYieldTokens.mock.calls.length;
    offline = false;
    registry.refresh(resource);

    expect(
      AsyncResult.getOrThrow(registry.get(resource)).items.flatMap(
        (page) => page.items
      )
    ).toEqual([]);
    expect(listYieldTokens).toHaveBeenCalledTimes(attemptsBeforeRetry + 1);
  });

  it("retries missing Legacy data through the exact network resource", () => {
    let available = false;
    const getTokenOptions = vi.fn(() =>
      Effect.succeed(available ? [tokenOption] : [])
    );
    const registry = makeRegistry({
      legacy: LegacyResourceSource.of({ getTokenOptions } as never),
    });
    const resource = legacyTokenOptionsResourceAtom("ethereum");

    expect(AsyncResult.getOrThrow(registry.get(resource))).toEqual([]);
    available = true;
    registry.refresh(resource);
    expect(AsyncResult.getOrThrow(registry.get(resource))).toEqual([
      tokenOption,
    ]);
  });
});
