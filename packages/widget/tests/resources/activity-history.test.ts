import { Cause, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import {
  ActivityHistoryError,
  ActivityHistoryKey,
  activityCountResourceAtom,
  activityHistoryPullAtom,
} from "../../src/resources/activity-history/activity-history";
import {
  ApiRequestError,
  YieldResourceSource,
} from "../../src/services/api/resource-sources";
import { WalletScopeKey } from "../../src/services/wallet/wallet-scope";
import { getPullResultItems } from "../../src/shared/effect/pagination";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";

const scope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x0000000000000000000000000000000000000001"
  ),
  network: "ethereum",
});
const yieldId = yieldApiYieldFixture().id;
const makeKey = () =>
  new ActivityHistoryKey({
    scope,
    statuses: ["SUCCESS", "FAILED", "SUCCESS"],
  });
const makeRegistry = (listActivity: ReturnType<typeof vi.fn>) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(
          YieldResourceSource,
          YieldResourceSource.of({ listActivity } as never)
        )
      ),
    ],
  });

describe("Activity History resource", () => {
  it("shares normalized requests and loads one semantic batch per Pull", async () => {
    const listActivity = vi.fn((request: { readonly offset: number }) =>
      Effect.succeed({
        items: [
          yieldApiActionFixture({
            id: request.offset === 0 ? "action-a" : "action-b",
            yieldId,
          }),
        ],
        limit: 1,
        offset: request.offset,
        total: 2,
      })
    );
    const registry = makeRegistry(listActivity);
    const firstPull = activityHistoryPullAtom(makeKey());
    const equivalentPull = activityHistoryPullAtom(makeKey());
    const unmount = registry.mount(firstPull);

    await vi.waitFor(() =>
      expect(getPullResultItems(registry.get(firstPull))).toMatchObject([
        { actions: [{ id: "action-a" }], total: 2 },
      ])
    );
    expect(AsyncResult.getOrThrow(registry.get(firstPull)).done).toBe(false);
    expect(firstPull).toBe(equivalentPull);
    expect(listActivity).toHaveBeenCalledOnce();

    registry.set(firstPull, undefined);

    await vi.waitFor(() =>
      expect(getPullResultItems(registry.get(firstPull))).toMatchObject([
        { actions: [{ id: "action-a" }], total: 2 },
        { actions: [{ id: "action-b" }], total: 2 },
      ])
    );
    expect(AsyncResult.getOrThrow(registry.get(firstPull)).done).toBe(true);
    expect(listActivity).toHaveBeenCalledTimes(2);
    expect(listActivity.mock.calls.map(([request]) => request.offset)).toEqual([
      0, 1,
    ]);

    unmount();
    registry.dispose();
  });

  it("shares history when only unused additional addresses differ", () => {
    const listActivity = vi.fn((request: { readonly offset: number }) =>
      Effect.succeed({
        items: [],
        limit: 50,
        offset: request.offset,
        total: 0,
      })
    );
    const registry = makeRegistry(listActivity);
    const scopeWithAdditionalAddress = new WalletScopeKey({
      additionalAddresses: { binanceBeaconAddress: "bnb-address" },
      address: scope.address,
      network: scope.network,
    });
    const first = makeKey();
    const second = new ActivityHistoryKey({
      scope: scopeWithAdditionalAddress,
      statuses: ["FAILED", "SUCCESS"],
    });

    expect(second).toEqual(first);
    expect(
      getPullResultItems(registry.get(activityHistoryPullAtom(first)))
    ).toMatchObject([{ actions: [], total: 0 }]);
    expect(
      getPullResultItems(registry.get(activityHistoryPullAtom(second)))
    ).toMatchObject([{ actions: [], total: 0 }]);
    expect(listActivity).toHaveBeenCalledOnce();
  });

  it("loads a bounded count without collecting history", () => {
    const listActivity = vi.fn((request: { readonly limit: number }) =>
      Effect.succeed({
        items: [yieldApiActionFixture({ id: "ignored", yieldId })],
        limit: request.limit,
        offset: 0,
        total: 123,
      })
    );
    const registry = makeRegistry(listActivity);

    expect(
      AsyncResult.getOrThrow(registry.get(activityCountResourceAtom(makeKey())))
    ).toBe(123);
    expect(listActivity).toHaveBeenCalledOnce();
    expect(listActivity.mock.calls[0]?.[0]).toMatchObject({
      limit: 1,
      offset: 0,
    });
  });

  it("retains the first page after a later failure and refreshes from page one", async () => {
    let failSecondPage = true;
    const firstAction = yieldApiActionFixture({
      id: "action-a",
      yieldId,
    });
    const listActivity = vi.fn((request: { readonly offset: number }) =>
      request.offset > 0 && failSecondPage
        ? Effect.fail(
            new ApiRequestError({
              cause: new Error("offline"),
              operation: "activity-history",
            })
          )
        : Effect.succeed({
            items: [firstAction],
            limit: 1,
            offset: request.offset,
            total: 2,
          })
    );
    const registry = makeRegistry(listActivity);
    const pull = activityHistoryPullAtom(makeKey());
    const unmount = registry.mount(pull);

    await vi.waitFor(() =>
      expect(getPullResultItems(registry.get(pull))).toMatchObject([
        { actions: [{ id: "action-a" }], total: 2 },
      ])
    );
    registry.set(pull, undefined);
    await vi.waitFor(() =>
      expect(AsyncResult.isFailure(registry.get(pull))).toBe(true)
    );
    expect(
      registry.get(pull).pipe(AsyncResult.value, Option.getOrThrow).items
    ).toMatchObject([{ actions: [{ id: "action-a" }], total: 2 }]);

    failSecondPage = false;
    registry.refresh(pull);

    await vi.waitFor(() =>
      expect(AsyncResult.isSuccess(registry.get(pull))).toBe(true)
    );
    expect(listActivity.mock.calls.map(([request]) => request.offset)).toEqual([
      0, 1, 0,
    ]);

    unmount();
    registry.dispose();
  });

  it("publishes typed failures and retries the exact history", () => {
    let offline = true;
    const requestError = new ApiRequestError({
      cause: new Error("offline"),
      operation: "activity-history",
    });
    const listActivity = vi.fn((request: { readonly offset: number }) =>
      offline
        ? Effect.fail(requestError)
        : Effect.succeed({
            items: [],
            limit: 50,
            offset: request.offset,
            total: 0,
          })
    );
    const registry = makeRegistry(listActivity);
    const key = makeKey();
    const resource = activityHistoryPullAtom(key);
    const failed = registry.get(resource);

    expect(AsyncResult.isFailure(failed)).toBe(true);
    if (!AsyncResult.isFailure(failed)) throw new Error("Expected failure");
    expect(
      Option.getOrThrow(Cause.findErrorOption(failed.cause))
    ).toBeInstanceOf(ActivityHistoryError);

    const attemptsBeforeRetry = listActivity.mock.calls.length;
    offline = false;
    registry.refresh(resource);
    expect(getPullResultItems(registry.get(resource))).toMatchObject([
      { actions: [], total: 0 },
    ]);
    expect(listActivity).toHaveBeenCalledTimes(attemptsBeforeRetry + 1);
  });
});
