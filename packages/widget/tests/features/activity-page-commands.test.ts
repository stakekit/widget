import { Effect, Layer, Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import { activityFilterAtom } from "../../src/features/activity/state/filter";
import {
  activityPageViewAtom,
  loadMoreActivityAtom,
  retryActivityPageAtom,
  setActivityPageFilterAtom,
} from "../../src/features/activity/state/page";
import {
  ActivityFilterOptionsKey,
  activityActionsPullAtom,
  activityFilterOptionsAtom,
  loadMoreActivityActionsAtom,
} from "../../src/features/activity/state/read-models/activity-feed";
import { ActivityActionsKey } from "../../src/features/activity/state/read-models/activity-request";
import {
  walletConfigResultAtom,
  walletConnectionStateAtom,
  walletScopeAtom,
} from "../../src/features/wallet/index";
import { YieldResourceSource } from "../../src/services/api/resource-sources";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";

const address = Schema.decodeUnknownSync(
  Schema.NonEmptyString.pipe(Schema.brand("WalletAddress"))
)("0x0000000000000000000000000000000000000001");
const walletScope = new WalletScopeKey({
  address,
  network: "ethereum",
});
const connectedWallet = {
  additionalAddresses: null,
  address,
  chain: {} as never,
  connector: {} as never,
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum" as const,
  status: "connected" as const,
};
const filterOptionsAtom = activityFilterOptionsAtom(
  new ActivityFilterOptionsKey({ scope: walletScope })
);

type ListActivity = YieldResourceSource["Service"]["listActivity"];

const makeRegistry = (listActivity: ListActivity) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(
          YieldResourceSource,
          YieldResourceSource.of({
            getOpportunity: () => Effect.succeed(yieldApiYieldFixture()),
            getProvider: () => Effect.succeed(Option.none()),
            listActivity,
          } as never)
        )
      ),
      Atom.initialValue(filterOptionsAtom, AsyncResult.success([])),
      Atom.initialValue(
        walletConfigResultAtom,
        AsyncResult.success({} as never)
      ),
      Atom.initialValue(walletConnectionStateAtom, connectedWallet),
      Atom.initialValue(walletScopeAtom, walletScope),
    ],
  });

describe("Activity page commands", () => {
  it("updates the selected filter through a command Atom", () => {
    const registry = AtomRegistry.make();

    try {
      expect(registry.get(activityFilterAtom)).toBe("all");

      registry.set(setActivityPageFilterAtom, "defi");

      expect(registry.get(activityFilterAtom)).toBe("defi");
    } finally {
      registry.dispose();
    }
  });

  it("discards the selected filter when its observing surface is released", async () => {
    const registry = AtomRegistry.make();
    const unmount = registry.mount(activityFilterAtom);

    registry.set(setActivityPageFilterAtom, "defi");
    expect(registry.get(activityFilterAtom)).toBe("defi");

    unmount();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(registry.get(activityFilterAtom)).toBe("all");
    registry.dispose();
  });

  it("loads the next page only through the current ready page resource", async () => {
    const yieldModel = yieldApiYieldFixture();
    const actions = Array.from({ length: 51 }, (_, index) =>
      yieldApiActionFixture({
        id: `activity-${index}`,
        yieldId: yieldModel.id,
      })
    );
    const nextPage = { shouldFail: true };
    const listActivity = vi.fn<ListActivity>((request) => {
      const limit = request.limit ?? 50;
      const offset = request.offset ?? 0;
      if (offset > 0 && nextPage.shouldFail) {
        return Effect.fail({} as never);
      }

      return Effect.succeed({
        items: actions.slice(offset, offset + limit),
        limit,
        offset,
        total: actions.length,
      });
    });
    const registry = makeRegistry(listActivity);
    const unmount = registry.mount(activityPageViewAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(activityPageViewAtom)).toMatchObject({
          pagination: { status: "idle" },
          showingCount: 50,
          status: "ready",
        })
      );

      registry.set(loadMoreActivityAtom, undefined);

      await vi.waitFor(() =>
        expect(registry.get(activityPageViewAtom)).toMatchObject({
          pagination: { status: "load-more-failed" },
          showingCount: 50,
          status: "ready",
        })
      );

      nextPage.shouldFail = false;
      registry.set(loadMoreActivityAtom, undefined);

      await vi.waitFor(() =>
        expect(registry.get(activityPageViewAtom)).toMatchObject({
          pagination: { status: "complete" },
          showingCount: 51,
          status: "ready",
        })
      );
      expect(
        listActivity.mock.calls.filter(
          ([request]) => request.limit === 50 && request.offset === 50
        )
      ).toHaveLength(2);
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("refreshes failed history and filter options from the page retry", async () => {
    const yieldModel = yieldApiYieldFixture();
    const action = yieldApiActionFixture({ yieldId: yieldModel.id });
    const history = { shouldFail: true };
    const listActivity = vi.fn<ListActivity>((request) => {
      const limit = request.limit ?? 50;
      const offset = request.offset ?? 0;

      if (limit === 1) {
        return Effect.succeed({
          items: [],
          limit,
          offset,
          total: 0,
        });
      }
      if (history.shouldFail) return Effect.fail({} as never);

      return Effect.succeed({
        items: [action],
        limit,
        offset,
        total: 1,
      });
    });
    const registry = makeRegistry(listActivity);
    const unmount = registry.mount(activityPageViewAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(activityPageViewAtom)).toEqual({
          status: "failed",
        })
      );

      history.shouldFail = false;
      registry.set(retryActivityPageAtom, undefined);

      await vi.waitFor(() =>
        expect(registry.get(activityPageViewAtom)).toMatchObject({
          actions: [{ actionData: { id: action.id } }],
          status: "ready",
        })
      );
      expect(
        listActivity.mock.calls.some(([request]) => request.limit === 1)
      ).toBe(true);
    } finally {
      unmount();
      registry.dispose();
    }
  });
});

describe("Activity actions resource commands", () => {
  it("retries the failed offset after multiple successful pages", async () => {
    const yieldModel = yieldApiYieldFixture();
    const actions = Array.from({ length: 101 }, (_, index) =>
      yieldApiActionFixture({
        id: `activity-${index}`,
        yieldId: yieldModel.id,
      })
    );
    const nextPage = { shouldFail: true };
    const listActivity = vi.fn<ListActivity>((request) => {
      const limit = request.limit ?? 50;
      const offset = request.offset ?? 0;
      if (offset === 100 && nextPage.shouldFail) {
        return Effect.fail({} as never);
      }

      return Effect.succeed({
        items: actions.slice(offset, offset + limit),
        limit,
        offset,
        total: actions.length,
      });
    });
    const key = new ActivityActionsKey({
      filter: "all",
      scope: walletScope,
    });
    const actionsAtom = activityActionsPullAtom(key);
    const loadMoreAtom = loadMoreActivityActionsAtom(key);
    const registry = makeRegistry(listActivity);
    const unmountActions = registry.mount(actionsAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(actionsAtom)).toMatchObject({
          _tag: "Success",
          value: { done: false },
        })
      );

      registry.set(loadMoreAtom, undefined);

      await vi.waitFor(() =>
        expect(registry.get(actionsAtom)).toMatchObject({
          _tag: "Success",
          value: {
            done: false,
            items: [
              { actions: expect.any(Array) },
              { actions: expect.any(Array) },
            ],
          },
        })
      );

      registry.set(loadMoreAtom, undefined);

      await vi.waitFor(() =>
        expect(registry.get(actionsAtom)).toMatchObject({
          _tag: "Failure",
        })
      );

      nextPage.shouldFail = false;
      registry.set(loadMoreAtom, undefined);

      await vi.waitFor(() =>
        expect(registry.get(actionsAtom)).toMatchObject({
          _tag: "Success",
          value: {
            done: true,
            items: [
              { actions: expect.any(Array) },
              { actions: expect.any(Array) },
              { actions: expect.any(Array) },
            ],
          },
        })
      );
      expect(
        listActivity.mock.calls.filter(
          ([request]) => request.limit === 50 && request.offset === 100
        )
      ).toHaveLength(2);
    } finally {
      unmountActions();
      registry.dispose();
    }
  });
});
