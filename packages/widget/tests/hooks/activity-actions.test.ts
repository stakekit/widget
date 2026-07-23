import { Effect, Layer, Option, Schema } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { ActivityActionsPage } from "../../src/domain/schema/activity-models";
import { activityActionsPullAtom } from "../../src/features/activity/resources/activity-actions";
import { ActivityActionsKey } from "../../src/features/activity/resources/activity-requests";
import { YieldResourceSource } from "../../src/services/api/yield-resource-source";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { getPullResultItems } from "../../src/shared/effect/pagination";
import {
  yieldApiActionDtoFixture,
  yieldApiActionFixture,
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
} from "../fixtures";

const address = Schema.decodeUnknownSync(
  Schema.NonEmptyString.pipe(Schema.brand("WalletAddress"))
)("0x0000000000000000000000000000000000000001");
const network = "ethereum" as const;
const walletScope = new WalletScopeKey({ address, network });
const getActivityActions = (
  result: Atom.Type<ReturnType<typeof activityActionsPullAtom>>
) => getPullResultItems(result).flatMap((batch) => batch.actions);

describe("activity action atom boundary", () => {
  it("constructs value-equal activity resource keys", () => {
    const fields = {
      filter: "stake" as const,
      scope: new WalletScopeKey({ address, network }),
    };

    expect(new ActivityActionsKey(fields)).toEqual(
      new ActivityActionsKey({ ...fields })
    );
  });

  it("omits a malformed action while retaining valid siblings", async () => {
    const valid = yieldApiActionDtoFixture({ id: "valid-action" });
    const malformed: Record<string, unknown> = {
      ...yieldApiActionDtoFixture({ id: "invalid-action" }),
      transactions: [
        {
          ...yieldApiActionDtoFixture().transactions[0]!,
          network: "not-a-network",
        },
      ],
    };
    const page = await Effect.runPromise(
      Schema.decodeUnknownEffect(ActivityActionsPage)({
        items: [valid, malformed],
        limit: 50,
        offset: 0,
        total: 2,
      })
    );

    expect(page.items?.map((item) => item.id)).toEqual(["valid-action"]);
    expect(page.total).toBe(2);
  });

  it("loads activity presentation one semantic page at a time", async () => {
    const yieldModel = yieldApiYieldFixture();
    const getOpportunity = vi.fn(() => Effect.succeed(yieldModel));
    const actions = Array.from({ length: 51 }, (_, index) =>
      yieldApiActionFixture({
        id: `action-${index}`,
        yieldId: yieldModel.id,
      })
    );
    const listActivity = vi.fn(
      ({
        limit,
        offset,
      }: {
        readonly limit: number;
        readonly offset: number;
      }) =>
        Effect.succeed({
          items: actions.slice(offset, offset + limit),
          limit,
          offset,
          total: actions.length,
        })
    );
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(
            YieldResourceSource,
            YieldResourceSource.of({
              getOpportunity,
              getProvider: () => Effect.succeed(Option.none()),
              listActivity,
            } as never)
          )
        ),
      ],
    });
    const resource = activityActionsPullAtom(
      new ActivityActionsKey({ filter: "all", scope: walletScope })
    );
    const unmount = registry.mount(resource);

    await vi.waitFor(() =>
      expect(getActivityActions(registry.get(resource))).toHaveLength(50)
    );
    expect(AsyncResult.getOrThrow(registry.get(resource)).done).toBe(false);
    expect(listActivity).toHaveBeenCalledOnce();

    registry.set(resource, undefined);

    await vi.waitFor(() =>
      expect(getActivityActions(registry.get(resource))).toHaveLength(51)
    );
    expect(AsyncResult.getOrThrow(registry.get(resource)).done).toBe(true);
    expect(listActivity).toHaveBeenCalledTimes(2);
    expect(getOpportunity).toHaveBeenCalledOnce();
    expect(
      getActivityActions(registry.get(resource)).every(
        (action) => action.yieldData?.id === yieldModel.id
      )
    ).toBe(true);

    unmount();
    registry.dispose();
  });

  it("bounds and deduplicates concurrent enrichment requests", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const tracked = <A>(value: A) =>
      Effect.acquireUseRelease(
        Effect.sync(() => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
        }),
        () => Effect.sleep("20 millis").pipe(Effect.as(value)),
        () =>
          Effect.sync(() => {
            inFlight -= 1;
          })
      );
    const yields = Array.from({ length: 8 }, (_, index) =>
      yieldApiYieldFixture({
        id: `activity-yield-${index}`,
        providerId: `activity-provider-${index}`,
      })
    );
    const actions = yields.flatMap((yieldModel, index) =>
      [0, 1].map((duplicate) =>
        yieldApiActionFixture({
          id: `action-${index}-${duplicate}`,
          rawArguments: { validatorAddress: `validator-${index}` },
          yieldId: yieldModel.id,
        })
      )
    );
    const yieldsById = new Map(
      yields.map((yieldModel) => [yieldModel.id, yieldModel])
    );
    const getOpportunity = vi.fn((yieldId: (typeof yields)[number]["id"]) =>
      tracked(yieldsById.get(yieldId)!)
    );
    const getProvider = vi.fn(() => tracked(Option.none()));
    const listValidators = vi.fn(
      (request: {
        readonly address?: string;
        readonly limit: number;
        readonly offset: number;
      }) =>
        tracked({
          items: [yieldApiValidatorFixture({ address: request.address })],
          limit: request.limit,
          offset: request.offset,
          total: 1,
        })
    );
    const listActivity = vi.fn(() =>
      Effect.succeed({
        items: actions,
        limit: 50,
        offset: 0,
        total: actions.length,
      })
    );
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(
            YieldResourceSource,
            YieldResourceSource.of({
              getOpportunity,
              getProvider,
              listActivity,
              listValidators,
            } as never)
          )
        ),
      ],
    });
    const resource = activityActionsPullAtom(
      new ActivityActionsKey({ filter: "all", scope: walletScope })
    );
    const unmount = registry.mount(resource);

    await vi.waitFor(() =>
      expect(getActivityActions(registry.get(resource))).toHaveLength(
        actions.length
      )
    );

    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(5);
    expect(getOpportunity).toHaveBeenCalledTimes(yields.length);
    expect(getProvider).toHaveBeenCalledTimes(yields.length);
    expect(listValidators).toHaveBeenCalledTimes(yields.length);

    unmount();
    registry.dispose();
  });

  it("keeps activity usable when per-yield enrichment fails", async () => {
    const yieldModel = yieldApiYieldFixture();
    const listActivity = vi.fn(() =>
      Effect.succeed({
        items: [
          yieldApiActionFixture({ id: "action-a", yieldId: yieldModel.id }),
        ],
        limit: 50,
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
              getOpportunity: () => Effect.fail(new Error("unavailable")),
              listActivity,
            } as never)
          )
        ),
      ],
    });
    const resource = activityActionsPullAtom(
      new ActivityActionsKey({ filter: "all", scope: walletScope })
    );
    const unmount = registry.mount(resource);

    await vi.waitFor(() =>
      expect(getActivityActions(registry.get(resource))).toMatchObject([
        { actionData: { id: "action-a" }, yieldData: null },
      ])
    );

    unmount();
    registry.dispose();
  });

  it("manual refresh republishes data from the shared history authority", async () => {
    const yieldModel = yieldApiYieldFixture();
    let actionId = "action-before-refresh";
    const listActivity = vi.fn(
      ({
        limit,
        offset,
      }: {
        readonly limit: number;
        readonly offset: number;
      }) =>
        Effect.succeed({
          items: [
            yieldApiActionFixture({ id: actionId, yieldId: yieldModel.id }),
          ],
          limit,
          offset,
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
              getProvider: () => Effect.succeed(Option.none()),
              listActivity,
              listYields: (request: { readonly limit: number }) =>
                Effect.succeed({
                  items: [yieldModel],
                  limit: request.limit,
                  offset: 0,
                  total: 1,
                }),
            } as never)
          )
        ),
      ],
    });
    const resource = activityActionsPullAtom(
      new ActivityActionsKey({ filter: "all", scope: walletScope })
    );
    const unmount = registry.mount(resource);

    await vi.waitFor(() =>
      expect(getActivityActions(registry.get(resource))[0]?.actionData.id).toBe(
        "action-before-refresh"
      )
    );

    actionId = "action-after-refresh";
    registry.refresh(resource);

    await vi.waitFor(() =>
      expect(getActivityActions(registry.get(resource))[0]?.actionData.id).toBe(
        "action-after-refresh"
      )
    );
    expect(listActivity).toHaveBeenCalledTimes(2);

    unmount();
    registry.dispose();
  });
});
