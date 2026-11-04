import { describe, expect, it, vi } from "@effect/vitest";
import { Cause, Effect, Layer, Option, Schema } from "effect";
import { Atom, AtomRegistry } from "effect/reactivity";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import type { YieldAction } from "../../../src/domain/action/models";
import { ActivityActionsPage } from "../../../src/domain/activity/models";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  ActivityExplicitIntent,
  ActivitySelectionKey,
  activityDetailsViewAtom,
} from "../../../src/features/activity/state/details";
import {
  ActivityActionsKey,
  ActivityFilterOptionsKey,
  activityActionsPullAtom,
  activityFilterOptionsAtom,
} from "../../../src/features/activity/state/page-resources";
import { yieldOpportunityResourceAtom } from "../../../src/resources/yield-opportunity/yield-opportunity";
import {
  BorrowResourceSource,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import { toPresentable } from "../../../src/shared/effect/async-result";
import { getPullResultItems } from "../../../src/shared/effect/pagination";
import {
  yieldApiActionDtoFixture,
  yieldApiActionFixture,
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
} from "../../fixtures";
import { unconfiguredBorrowResourceSourceLayer } from "../../utils/services/borrow-resource-source";

const address = Schema.decodeSync(
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
      borrowEnabled: true,
      filter: "stake" as const,
      scope: new WalletScopeKey({ address, network }),
    };

    expect(new ActivityActionsKey(fields)).toEqual(
      new ActivityActionsKey({ ...fields })
    );
  });

  it.effect("omits a malformed action while retaining valid siblings", () =>
    Effect.gen(function* () {
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
      const page = yield* Schema.decodeEffect(ActivityActionsPage)({
        items: [valid, malformed],
        limit: 50,
        offset: 0,
        total: 2,
      });

      expect(page.items?.map((item) => item.id)).toEqual(["valid-action"]);
      expect(page.total).toBe(2);
    })
  );

  it.effect(
    "accepts EVM unsigned transactions serialized as JSON strings",
    () =>
      Effect.gen(function* () {
        const unsignedTransaction = JSON.stringify({
          from: "0xcaA141ece9fEE66D15f0257F5c6C48E26784345C",
          gasLimit: "0x027f4b",
          to: "0xa6e768fEf2D1aF36c0cfdb276422E7881a83e951",
          data: "0x8759c2340000000000000000000000000000000000000000000000000000000000000002",
          nonce: 92,
          type: 2,
          maxFeePerGas: "0x11e1a300",
          maxPriorityFeePerGas: "0x054e0840",
          chainId: 1,
        });
        const page = yield* Schema.decodeEffect(ActivityActionsPage)({
          items: [
            yieldApiActionDtoFixture({
              id: "json-serialized-unsigned-transaction",
              transactions: [
                {
                  ...yieldApiActionDtoFixture().transactions[0]!,
                  unsignedTransaction,
                },
              ],
            }),
          ],
          limit: 50,
          offset: 0,
          total: 1,
        });

        expect(page.items?.map((item) => item.id)).toEqual([
          "json-serialized-unsigned-transaction",
        ]);
        expect(page.items?.[0]?.transactions[0]?.unsignedTransaction).toBe(
          unsignedTransaction
        );
      })
  );

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
              getProvider: () => Effect.succeedNone,
              listActivity,
            } as never)
          ).pipe(Layer.merge(unconfiguredBorrowResourceSourceLayer))
        ),
      ],
    });
    const resource = activityActionsPullAtom(
      new ActivityActionsKey({
        borrowEnabled: false,
        filter: "all",
        scope: walletScope,
      })
    );
    const unmount = registry.mount(resource);

    await vi.waitFor(() =>
      expect(getActivityActions(registry.get(resource))).toHaveLength(50)
    );
    expect(AsyncResult.getOrThrow(registry.get(resource)).done).toBe(false);
    expect(listActivity).toHaveBeenCalledOnce();
    expect(listActivity.mock.calls[0]?.[0]).toMatchObject({
      statuses: ["FAILED", "SUCCESS", "WAITING_FOR_NEXT"],
    });

    registry.set(resource, undefined);

    await vi.waitFor(() =>
      expect(getActivityActions(registry.get(resource))).toHaveLength(51)
    );
    expect(AsyncResult.getOrThrow(registry.get(resource)).done).toBe(true);
    expect(listActivity).toHaveBeenCalledTimes(2);
    expect(getOpportunity).toHaveBeenCalledOnce();
    expect(
      getActivityActions(registry.get(resource)).every(
        (action) =>
          action._tag === "yield" && action.yieldData?.id === yieldModel.id
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
          items: [
            yieldApiValidatorFixture(
              request.address === undefined ? {} : { address: request.address }
            ),
          ],
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
          ).pipe(Layer.merge(unconfiguredBorrowResourceSourceLayer))
        ),
      ],
    });
    const resource = activityActionsPullAtom(
      new ActivityActionsKey({
        borrowEnabled: false,
        filter: "all",
        scope: walletScope,
      })
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
              getOpportunity: () =>
                Effect.fail(new Cause.UnknownError("unavailable")),
              listActivity,
            } as never)
          ).pipe(Layer.merge(unconfiguredBorrowResourceSourceLayer))
        ),
      ],
    });
    const resource = activityActionsPullAtom(
      new ActivityActionsKey({
        borrowEnabled: false,
        filter: "all",
        scope: walletScope,
      })
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
              getOpportunity: () => Effect.succeed(yieldModel),
              getProvider: () => Effect.succeedNone,
              listActivity,
            } as never)
          ).pipe(Layer.merge(unconfiguredBorrowResourceSourceLayer))
        ),
      ],
    });
    const resource = activityActionsPullAtom(
      new ActivityActionsKey({
        borrowEnabled: false,
        filter: "all",
        scope: walletScope,
      })
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

const makeEnrichmentRegistry = (source: Record<string, unknown>) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(
          YieldResourceSource,
          YieldResourceSource.of({
            getProvider: () => Effect.succeedNone,
            ...source,
          } as never)
        ).pipe(Layer.merge(unconfiguredBorrowResourceSourceLayer))
      ),
    ],
  });

const pagedActivity =
  (actions: ReadonlyArray<YieldAction>) =>
  ({ limit, offset }: { readonly limit: number; readonly offset: number }) =>
    Effect.succeed({
      items: actions.slice(offset, offset + limit),
      limit,
      offset,
      total: actions.length,
    });

const validatorPage = (request: {
  readonly address?: string;
  readonly limit: number;
  readonly offset: number;
}) => ({
  items: [
    yieldApiValidatorFixture(
      request.address === undefined ? {} : { address: request.address }
    ),
  ],
  limit: request.limit,
  offset: request.offset,
  total: 1,
});

describe("activity enrichment per loaded page", () => {
  it("keeps enriched rows on screen while a new page enriches unseen facts", async () => {
    const seenYield = yieldApiYieldFixture({
      id: "activity-seen-yield",
      providerId: "activity-seen-provider",
    });
    const unseenYield = yieldApiYieldFixture({
      id: "activity-unseen-yield",
      providerId: "activity-unseen-provider",
    });
    const actions = [
      ...Array.from({ length: 50 }, (_, index) =>
        yieldApiActionFixture({
          id: `seen-action-${index}`,
          rawArguments: { validatorAddress: "seen-validator" },
          yieldId: seenYield.id,
        })
      ),
      yieldApiActionFixture({
        id: "unseen-action",
        rawArguments: { validatorAddress: "unseen-validator" },
        yieldId: unseenYield.id,
      }),
    ];
    let releaseUnseen: () => void = () => undefined;
    const unseenGate = new Promise<void>((resolve) => {
      releaseUnseen = resolve;
    });
    const getOpportunity = vi.fn((yieldId: string) =>
      yieldId === unseenYield.id
        ? Effect.promise(() => unseenGate).pipe(Effect.as(unseenYield))
        : Effect.succeed(seenYield)
    );
    const listValidators = vi.fn(
      (request: Parameters<typeof validatorPage>[0]) =>
        request.address === "unseen-validator"
          ? Effect.promise(() => unseenGate).pipe(
              Effect.as(validatorPage(request))
            )
          : Effect.succeed(validatorPage(request))
    );
    const listActivity = vi.fn(pagedActivity(actions));
    const registry = makeEnrichmentRegistry({
      getOpportunity,
      listActivity,
      listValidators,
    });
    const resource = activityActionsPullAtom(
      new ActivityActionsKey({
        borrowEnabled: false,
        filter: "all",
        scope: walletScope,
      })
    );
    const unmount = registry.mount(resource);

    await vi.waitFor(() =>
      expect(getActivityActions(registry.get(resource))).toHaveLength(50)
    );
    const firstPage = getActivityActions(registry.get(resource));
    const presentedRowCounts: Array<number | "not-ready"> = [];
    const unsubscribe = registry.subscribe(resource, (result) => {
      presentedRowCounts.push(
        toPresentable(result)._tag === "Ready"
          ? getActivityActions(result).length
          : "not-ready"
      );
    });

    registry.set(resource, undefined);

    await vi.waitFor(() =>
      expect(getOpportunity).toHaveBeenCalledWith(unseenYield.id)
    );
    expect(toPresentable(registry.get(resource))).toMatchObject({
      _tag: "Ready",
      refreshing: true,
    });
    expect(getActivityActions(registry.get(resource))).toEqual(firstPage);

    releaseUnseen();

    await vi.waitFor(() =>
      expect(getActivityActions(registry.get(resource))).toHaveLength(51)
    );
    expect(getActivityActions(registry.get(resource)).slice(0, 50)).toEqual(
      firstPage
    );
    expect(getActivityActions(registry.get(resource))[50]).toMatchObject({
      validatorsData: [{ address: "unseen-validator" }],
      yieldData: { id: unseenYield.id },
    });
    expect(firstPage[0]).toMatchObject({
      validatorsData: [{ address: "seen-validator" }],
      yieldData: { id: seenYield.id },
    });
    expect(presentedRowCounts.length).toBeGreaterThan(0);
    expect(
      presentedRowCounts.every((count) => count !== "not-ready" && count >= 50)
    ).toBe(true);
    expect(
      getOpportunity.mock.calls.filter(([yieldId]) => yieldId === seenYield.id)
    ).toHaveLength(1);
    expect(
      listValidators.mock.calls.filter(
        ([request]) => request.address === "seen-validator"
      )
    ).toHaveLength(1);

    unsubscribe();
    unmount();
    registry.dispose();
  });

  it("propagates an enrichment defect instead of absorbing it", async () => {
    const yieldModel = yieldApiYieldFixture();
    const registry = makeEnrichmentRegistry({
      getOpportunity: () => Effect.die(new Error("enrichment defect")),
      listActivity: pagedActivity([
        yieldApiActionFixture({ id: "action-a", yieldId: yieldModel.id }),
      ]),
    });
    const resource = activityActionsPullAtom(
      new ActivityActionsKey({
        borrowEnabled: false,
        filter: "all",
        scope: walletScope,
      })
    );
    const unmount = registry.mount(resource);

    await vi.waitFor(() => {
      const result = registry.get(resource);
      expect(AsyncResult.isFailure(result) && Cause.hasDies(result.cause)).toBe(
        true
      );
    });

    unmount();
    registry.dispose();
  });

  it("enriches Activity details with the same join as the list", async () => {
    const yieldModel = yieldApiYieldFixture();
    const action = yieldApiActionFixture({
      address,
      id: "shared-join-action",
      rawArguments: { validatorAddress: "shared-validator" },
      yieldId: yieldModel.id,
    });
    const registry = makeEnrichmentRegistry({
      getActivityAction: () => Effect.succeedSome(action),
      getOpportunity: () => Effect.succeed(yieldModel),
      listActivity: pagedActivity([action]),
      listValidators: (request: Parameters<typeof validatorPage>[0]) =>
        Effect.succeed(validatorPage(request)),
    });
    const resource = activityActionsPullAtom(
      new ActivityActionsKey({
        borrowEnabled: false,
        filter: "all",
        scope: walletScope,
      })
    );
    const details = activityDetailsViewAtom(
      new ActivitySelectionKey({
        intent: new ActivityExplicitIntent({ actionId: action.id }),
        scope: walletScope,
        surface: "execution",
      })
    );
    const unmountList = registry.mount(resource);
    const unmountDetails = registry.mount(details);

    await vi.waitFor(() =>
      expect(getActivityActions(registry.get(resource))).toHaveLength(1)
    );
    await vi.waitFor(() => expect(registry.get(details).status).toBe("ready"));
    const detailsView = registry.get(details);
    const [listRow] = getActivityActions(registry.get(resource));

    expect(listRow).toMatchObject({
      validatorsData: [{ address: "shared-validator" }],
      yieldData: { id: yieldModel.id },
    });
    expect(detailsView.status === "ready" && detailsView.item).toEqual(listRow);

    unmountDetails();
    unmountList();
    registry.dispose();
  });

  it("recovers details continuation after the Yield Resource recovers", async () => {
    const yieldModel = yieldApiYieldFixture();
    // The fixture's far-future createdAt keeps the continuation window open.
    const action = yieldApiActionFixture({
      address,
      id: "recovering-yield-action",
      status: "WAITING_FOR_NEXT",
      yieldId: yieldModel.id,
    });
    let yieldAvailable = false;
    const registry = makeEnrichmentRegistry({
      getActivityAction: () => Effect.succeedSome(action),
      getOpportunity: () =>
        yieldAvailable
          ? Effect.succeed(yieldModel)
          : Effect.fail(new Cause.UnknownError("unavailable")),
      listValidators: (request: Parameters<typeof validatorPage>[0]) =>
        Effect.succeed(validatorPage(request)),
    });
    const details = activityDetailsViewAtom(
      new ActivitySelectionKey({
        intent: new ActivityExplicitIntent({ actionId: action.id }),
        scope: walletScope,
        surface: "review",
      })
    );
    const unmount = registry.mount(details);

    await vi.waitFor(() =>
      expect(registry.get(details)).toMatchObject({
        canContinue: false,
        item: { yieldData: null },
        status: "ready",
      })
    );

    yieldAvailable = true;
    registry.refresh(yieldOpportunityResourceAtom.local(yieldModel.id));

    await vi.waitFor(() =>
      expect(registry.get(details)).toMatchObject({
        canContinue: true,
        item: { yieldData: { id: yieldModel.id } },
        status: "ready",
      })
    );

    unmount();
    registry.dispose();
  });
});

describe("Activity filter options", () => {
  const readFilterOptions = (borrowEnabled: boolean) => {
    const listActivity = vi.fn(
      (request: { readonly yieldTypes?: ReadonlyArray<string> }) =>
        Effect.succeed({
          items: [],
          limit: 1,
          offset: 0,
          total:
            request.yieldTypes === undefined ||
            request.yieldTypes.includes("staking")
              ? 3
              : 0,
        })
    );
    const listActions = vi.fn(() =>
      Effect.succeed({ items: [], limit: 1, offset: 0, total: 2 })
    );
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.mergeAll(
            Layer.succeed(
              YieldResourceSource,
              YieldResourceSource.of({ listActivity } as never)
            ),
            Layer.succeed(
              BorrowResourceSource,
              BorrowResourceSource.of({ listActions } as never)
            )
          )
        ),
      ],
    });
    const options = AsyncResult.getOrThrow(
      registry.get(
        activityFilterOptionsAtom(
          new ActivityFilterOptionsKey({ borrowEnabled, scope: walletScope })
        )
      )
    );
    registry.dispose();

    return { listActions, options };
  };

  it("lists a Borrow filter with its network-filtered count when Borrow is enabled", () => {
    const { options } = readFilterOptions(true);

    expect(options[0]).toEqual({ count: 5, filter: "all" });
    expect(options.at(-1)).toEqual({ count: 2, filter: "borrow" });
  });

  it("neither lists nor counts Borrow when Borrow is disabled", () => {
    const { listActions, options } = readFilterOptions(false);

    expect(options).not.toContainEqual(
      expect.objectContaining({ filter: "borrow" })
    );
    expect(listActions).not.toHaveBeenCalled();
  });
});
