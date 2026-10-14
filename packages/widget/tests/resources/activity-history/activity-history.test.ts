import { Cause, DateTime, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { BorrowActionsPage } from "../../../src/domain/borrow/responses";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  ActivityActionKey,
  ActivityHistoryError,
  ActivityHistoryKey,
  activityActionResourceAtom,
  activityCountResourceAtom,
  activityHistoryPullAtom,
} from "../../../src/resources/activity-history/activity-history";
import {
  ApiRequestError,
  BorrowResourceSource,
  MissingBorrowApiConfig,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import {
  API_MAX_PAGE_SIZE,
  getPullResultItems,
} from "../../../src/shared/effect/pagination";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../../fixtures";

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

type ListBorrowActions = BorrowResourceSource["Service"]["listActions"];

const borrowNotConfigured: ListBorrowActions = () =>
  Effect.fail(
    new MissingBorrowApiConfig({
      message: "Borrow API URL must be configured before using Borrow.",
    })
  );

const makeRegistry = (
  listActivity: ReturnType<typeof vi.fn>,
  listActions: ListBorrowActions = borrowNotConfigured
) =>
  AtomRegistry.make({
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

const borrowAction = ({
  createdAt,
  id,
  network = "ethereum",
}: {
  readonly createdAt: string;
  readonly id: string;
  readonly network?: string;
}) => ({
  action: "supply",
  address: scope.address,
  createdAt,
  currentStep: 1,
  hasNextStep: false,
  id,
  integrationId: "aave-borrow",
  rawArguments: { amount: "1", marketId: "market-1" },
  status: "SUCCESS",
  totalSteps: 1,
  transactions: [
    {
      address: scope.address,
      chainId: "1",
      id: `${id}-tx`,
      network,
      status: "CONFIRMED",
      type: "SUPPLY",
    },
  ],
});

const borrowPage = (page: {
  readonly items: ReadonlyArray<unknown>;
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
}) => Schema.decodeSync(BorrowActionsPage)(page);

const yieldActionAt = (id: string, createdAt: string) =>
  yieldApiActionFixture({
    createdAt: DateTime.makeUnsafe(createdAt),
    id,
    yieldId,
  });

describe("Activity History resource", () => {
  it("loads an owned Activity action by id", () => {
    const action = yieldApiActionFixture({
      address: scope.address,
      id: "action-a",
      yieldId,
    });
    const getActivityAction = vi.fn(() => Effect.succeedSome(action));
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(
            YieldResourceSource,
            YieldResourceSource.of({ getActivityAction } as never)
          )
        ),
      ],
    });

    expect(
      AsyncResult.getOrThrow(
        registry.get(
          activityActionResourceAtom(
            new ActivityActionKey({ actionId: action.id, scope })
          )
        )
      )
    ).toMatchObject({ id: "action-a" });
    expect(getActivityAction).toHaveBeenCalledWith(action.id);
  });

  it("does not expose an Activity action owned by another wallet", () => {
    const action = yieldApiActionFixture({
      address: "0x0000000000000000000000000000000000000002",
      id: "action-a",
      yieldId,
    });
    const getActivityAction = vi.fn(() => Effect.succeedSome(action));
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(
            YieldResourceSource,
            YieldResourceSource.of({ getActivityAction } as never)
          )
        ),
      ],
    });

    expect(
      AsyncResult.getOrThrow(
        registry.get(
          activityActionResourceAtom(
            new ActivityActionKey({ actionId: action.id, scope })
          )
        )
      )
    ).toBeNull();
  });

  it("shares normalized requests and loads one semantic batch per Pull", async () => {
    const mockActivityPage = (actionId: string, offset: number) =>
      Effect.succeed({
        items: [yieldApiActionFixture({ id: actionId, yieldId })],
        limit: 1,
        offset,
        total: 2,
      });

    const listActivity =
      vi.fn<YieldResourceSource["Service"]["listActivity"]>();
    vi.when(listActivity, { onUnmatched: "throw" })
      .calledWith(expect.objectContaining({ offset: 0 }))
      .thenReturn(mockActivityPage("action-a", 0))
      .calledWith(expect.objectContaining({ offset: 1 }))
      .thenReturn(mockActivityPage("action-b", 1));
    const registry = makeRegistry(listActivity);
    const firstPull = activityHistoryPullAtom(makeKey());
    const equivalentPull = activityHistoryPullAtom(makeKey());
    const unmount = registry.mount(firstPull);

    await vi.waitFor(() =>
      expect(getPullResultItems(registry.get(firstPull))).toMatchObject([
        { actions: [{ _tag: "yield", action: { id: "action-a" } }], total: 2 },
      ])
    );
    expect(AsyncResult.getOrThrow(registry.get(firstPull)).done).toBe(false);
    expect(firstPull).toBe(equivalentPull);
    expect(listActivity).toHaveBeenCalledOnce();

    registry.set(firstPull, undefined);

    await vi.waitFor(() =>
      expect(getPullResultItems(registry.get(firstPull))).toMatchObject([
        { actions: [{ _tag: "yield", action: { id: "action-a" } }], total: 2 },
        { actions: [{ _tag: "yield", action: { id: "action-b" } }], total: 2 },
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
        { actions: [{ _tag: "yield", action: { id: "action-a" } }], total: 2 },
      ])
    );
    registry.set(pull, undefined);
    await vi.waitFor(() =>
      expect(AsyncResult.isFailure(registry.get(pull))).toBe(true)
    );
    expect(
      registry.get(pull).pipe(AsyncResult.value, Option.getOrThrow).items
    ).toMatchObject([
      { actions: [{ _tag: "yield", action: { id: "action-a" } }], total: 2 },
    ]);

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

  // Re-enable the Borrow feed tests when Borrow activity is reconnected.
  it.skip("merges Yield and Borrow actions by date while paging each source independently", async () => {
    const listActivity =
      vi.fn<YieldResourceSource["Service"]["listActivity"]>();
    vi.when(listActivity, { onUnmatched: "throw" })
      .calledWith(expect.objectContaining({ offset: 0 }))
      .thenReturn(
        Effect.succeed({
          items: [yieldActionAt("yield-1", "2026-07-10T10:00:00.000Z")],
          limit: 1,
          offset: 0,
          total: 2,
        })
      )
      .calledWith(expect.objectContaining({ offset: 1 }))
      .thenReturn(
        Effect.succeed({
          items: [yieldActionAt("yield-2", "2026-07-10T08:00:00.000Z")],
          limit: 1,
          offset: 1,
          total: 2,
        })
      );
    const listActions = vi.fn<ListBorrowActions>();
    vi.when(listActions, { onUnmatched: "throw" })
      .calledWith(expect.objectContaining({ offset: 0 }))
      .thenReturn(
        Effect.succeed(
          borrowPage({
            items: [
              borrowAction({
                createdAt: "2026-07-10T09:00:00.000Z",
                id: "borrow-1",
              }),
              borrowAction({
                createdAt: "2026-07-10T09:30:00.000Z",
                id: "borrow-on-base",
                network: "base",
              }),
            ],
            limit: 2,
            offset: 0,
            total: 3,
          })
        )
      )
      .calledWith(expect.objectContaining({ offset: 2 }))
      .thenReturn(
        Effect.succeed(
          borrowPage({
            items: [
              borrowAction({
                createdAt: "2026-07-10T07:00:00.000Z",
                id: "borrow-2",
              }),
            ],
            limit: 2,
            offset: 2,
            total: 3,
          })
        )
      );
    const registry = makeRegistry(listActivity, listActions);
    const pull = activityHistoryPullAtom(makeKey());
    const unmount = registry.mount(pull);

    await vi.waitFor(() =>
      expect(getPullResultItems(registry.get(pull))).toMatchObject([
        { actions: [{ _tag: "yield", action: { id: "yield-1" } }], total: 4 },
      ])
    );
    registry.set(pull, undefined);
    await vi.waitFor(() =>
      expect(getPullResultItems(registry.get(pull))).toHaveLength(2)
    );
    registry.set(pull, undefined);
    await vi.waitFor(() =>
      expect(AsyncResult.getOrThrow(registry.get(pull)).done).toBe(true)
    );

    expect(getPullResultItems(registry.get(pull))).toMatchObject([
      { actions: [{ _tag: "yield", action: { id: "yield-1" } }], total: 4 },
      { actions: [{ _tag: "borrow", action: { id: "borrow-1" } }], total: 4 },
      {
        actions: [
          { _tag: "yield", action: { id: "yield-2" } },
          { _tag: "borrow", action: { id: "borrow-2" } },
        ],
        total: 4,
      },
    ]);
    expect(listActivity.mock.calls.map(([request]) => request.offset)).toEqual([
      0, 1,
    ]);
    // The scoped Borrow count is read first; history then pages on its own.
    expect(listActions.mock.calls.map(([request]) => request)).toEqual([
      expect.objectContaining({ limit: API_MAX_PAGE_SIZE, offset: 0 }),
      expect.objectContaining({ limit: API_MAX_PAGE_SIZE, offset: 2 }),
      expect.objectContaining({
        address: scope.address,
        limit: 50,
        offset: 0,
        statuses: ["FAILED", "SUCCESS"],
      }),
      expect.objectContaining({ limit: 50, offset: 2 }),
    ]);

    unmount();
    registry.dispose();
  });

  it.skip("totals only wallet-network Borrow actions, including those on later pages", () => {
    const listActivity = vi.fn(() =>
      Effect.succeed({
        items: [yieldActionAt("yield-1", "2026-07-10T10:00:00.000Z")],
        limit: 50,
        offset: 0,
        total: 1,
      })
    );
    const listActions: ListBorrowActions = ({ offset }) =>
      Effect.succeed(
        borrowPage(
          offset === 0
            ? {
                items: [
                  borrowAction({
                    createdAt: "2026-07-10T09:00:00.000Z",
                    id: "borrow-1",
                  }),
                  borrowAction({
                    createdAt: "2026-07-10T08:30:00.000Z",
                    id: "borrow-2",
                  }),
                ],
                limit: 2,
                offset: 0,
                total: 3,
              }
            : {
                items: [
                  borrowAction({
                    createdAt: "2026-07-10T08:00:00.000Z",
                    id: "borrow-on-base",
                    network: "base",
                  }),
                ],
                limit: 2,
                offset: 2,
                total: 3,
              }
        )
      );
    const registry = makeRegistry(listActivity, listActions);

    expect(
      getPullResultItems(registry.get(activityHistoryPullAtom(makeKey())))
    ).toMatchObject([
      {
        actions: [
          { _tag: "yield", action: { id: "yield-1" } },
          { _tag: "borrow", action: { id: "borrow-1" } },
          { _tag: "borrow", action: { id: "borrow-2" } },
        ],
        hasNextPage: true,
        total: 3,
      },
    ]);
  });

  it.skip("lists Borrow actions whose unread execution fields are malformed", () => {
    const listActivity = vi.fn(() =>
      Effect.succeed({ items: [], limit: 50, offset: 0, total: 0 })
    );
    const action = borrowAction({
      createdAt: "2026-07-10T09:00:00.000Z",
      id: "borrow-1",
    });
    const listActions: ListBorrowActions = () =>
      Effect.succeed(
        borrowPage({
          items: [
            {
              ...action,
              metadata: { currentLtv: "not-a-decimal" },
              transactions: action.transactions.map((transaction) => ({
                ...transaction,
                chainId: "not-a-chain-id",
                signablePayload: { gasLimit: "not-an-amount" },
              })),
            },
          ],
          limit: 50,
          offset: 0,
          total: 1,
        })
      );
    const registry = makeRegistry(listActivity, listActions);

    expect(
      getPullResultItems(registry.get(activityHistoryPullAtom(makeKey())))
    ).toMatchObject([
      { actions: [{ _tag: "borrow", action: { id: "borrow-1" } }], total: 1 },
    ]);
  });

  it.each([
    ["is not configured", borrowNotConfigured],
    [
      "fails",
      (() =>
        Effect.fail(
          new ApiRequestError({
            cause: new Error("offline"),
            operation: "borrow-actions",
          })
        )) satisfies ListBorrowActions,
    ],
  ] as const)("keeps the Yield feed when Borrow %s", (_, listActions) => {
    const listActivity = vi.fn(() =>
      Effect.succeed({
        items: [yieldActionAt("yield-1", "2026-07-10T10:00:00.000Z")],
        limit: 50,
        offset: 0,
        total: 1,
      })
    );
    const registry = makeRegistry(listActivity, listActions);
    const key = makeKey();
    const result = registry.get(activityHistoryPullAtom(key));

    expect(AsyncResult.getOrThrow(result)).toMatchObject({
      done: true,
      items: [
        { actions: [{ _tag: "yield", action: { id: "yield-1" } }], total: 1 },
      ],
    });
    expect(
      AsyncResult.getOrThrow(registry.get(activityCountResourceAtom(key)))
    ).toBe(1);
  });

  it.skip("counts Borrow actions on the wallet network alongside Yield actions", () => {
    const listActivity = vi.fn(() =>
      Effect.succeed({ items: [], limit: 1, offset: 0, total: 2 })
    );
    const listActions: ListBorrowActions = () =>
      Effect.succeed(
        borrowPage({
          items: [
            borrowAction({
              createdAt: "2026-07-10T09:00:00.000Z",
              id: "borrow-1",
            }),
            borrowAction({
              createdAt: "2026-07-10T09:30:00.000Z",
              id: "borrow-on-base",
              network: "base",
            }),
          ],
          limit: 100,
          offset: 0,
          total: 2,
        })
      );
    const registry = makeRegistry(listActivity, listActions);

    expect(
      AsyncResult.getOrThrow(registry.get(activityCountResourceAtom(makeKey())))
    ).toBe(3);
  });

  it("keeps category feeds Yield-only", () => {
    const listActivity = vi.fn(() =>
      Effect.succeed({ items: [], limit: 50, offset: 0, total: 0 })
    );
    const listActions = vi.fn<ListBorrowActions>();
    const registry = makeRegistry(listActivity, listActions);
    const key = new ActivityHistoryKey({
      scope,
      statuses: ["SUCCESS"],
      yieldTypes: ["staking"],
    });

    expect(
      getPullResultItems(registry.get(activityHistoryPullAtom(key)))
    ).toMatchObject([{ actions: [], total: 0 }]);
    expect(
      AsyncResult.getOrThrow(registry.get(activityCountResourceAtom(key)))
    ).toBe(0);
    expect(listActions).not.toHaveBeenCalled();
  });

  it("does not request Borrow actions while Borrow activity is disconnected", () => {
    const listActivity = vi.fn(() =>
      Effect.succeed({
        items: [yieldActionAt("yield-1", "2026-07-10T10:00:00.000Z")],
        limit: 50,
        offset: 0,
        total: 1,
      })
    );
    const listActions = vi.fn<ListBorrowActions>(() =>
      Effect.succeed(
        borrowPage({
          items: [
            borrowAction({
              createdAt: "2026-07-10T11:00:00.000Z",
              id: "borrow-1",
            }),
          ],
          limit: 50,
          offset: 0,
          total: 1,
        })
      )
    );
    const registry = makeRegistry(listActivity, listActions);
    const key = makeKey();

    expect(
      getPullResultItems(registry.get(activityHistoryPullAtom(key)))
    ).toMatchObject([
      { actions: [{ _tag: "yield", action: { id: "yield-1" } }], total: 1 },
    ]);
    expect(
      AsyncResult.getOrThrow(registry.get(activityCountResourceAtom(key)))
    ).toBe(1);
    expect(listActions).not.toHaveBeenCalled();
  });
});
