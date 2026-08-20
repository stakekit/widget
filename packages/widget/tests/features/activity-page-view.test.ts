import { Cause, Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import type { ActivityActionItem } from "../../src/features/activity/model/activity-action";
import {
  projectActivityPageView,
  resolveActivityPageFilter,
  resolveActivityPageWalletStatus,
} from "../../src/features/activity/state/page";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";

type ActivityPageProjectionInput = Parameters<
  typeof projectActivityPageView
>[0];
type ActivityActionsResult = ActivityPageProjectionInput["actionsResult"];
type ActivityFilterOptionsResult =
  ActivityPageProjectionInput["filterOptionsResult"];
type AsyncValue<Result> =
  Result extends AsyncResult.AsyncResult<infer Value, unknown> ? Value : never;
type ActivityActionsValue = AsyncValue<ActivityActionsResult>;
type ActivityFilterOptionsValue = AsyncValue<ActivityFilterOptionsResult>;

const walletScope = new WalletScopeKey({
  address: Schema.decodeUnknownSync(
    Schema.NonEmptyString.pipe(Schema.brand("WalletAddress"))
  )("0x0000000000000000000000000000000000000001"),
  network: "ethereum",
});

const makeActionItem = (id: string): ActivityActionItem => {
  const yieldModel = yieldApiYieldFixture();

  return {
    actionData: yieldApiActionFixture({ id, yieldId: yieldModel.id }),
    validatorsData: [],
    walletScope,
    yieldData: yieldModel,
  };
};

const makeUnavailableActionItem = (id: string): ActivityActionItem => ({
  actionData: yieldApiActionFixture({ id, type: "VOTE" }),
  validatorsData: [],
  walletScope,
  yieldData: null,
});

const makeActionsResult = ({
  actions = [],
  done = true,
  total = actions.length,
  waiting = false,
}: {
  readonly actions?: Array<ActivityActionItem>;
  readonly done?: boolean;
  readonly total?: number;
  readonly waiting?: boolean;
} = {}): ActivityActionsResult => {
  const value: ActivityActionsValue = {
    done,
    items: [
      {
        actions,
        hasNextPage: !done,
        total,
      },
    ],
  };

  return AsyncResult.success(value, { waiting });
};

const filterOptions: ActivityFilterOptionsResult = AsyncResult.success([
  { count: 2, filter: "all" },
  { count: 2, filter: "defi" },
]);

const failedActionsResult = (): ActivityActionsResult =>
  AsyncResult.failure<ActivityActionsValue>(Cause.fail(undefined as never));

const failedFilterOptionsResult = (): ActivityFilterOptionsResult =>
  AsyncResult.failure<ActivityFilterOptionsValue>(
    Cause.fail(undefined as never)
  );

describe("Activity page projection", () => {
  it("makes connectivity authoritative over resource state", () => {
    const actionsFailure = failedActionsResult();
    const filtersFailure = failedFilterOptionsResult();

    expect(
      projectActivityPageView({
        actionsResult: actionsFailure,
        filterOptionsResult: filtersFailure,
        selectedFilter: "all",
        walletStatus: "connect-wallet",
      })
    ).toEqual({ status: "connect-wallet" });
    expect(
      projectActivityPageView({
        actionsResult: actionsFailure,
        filterOptionsResult: filtersFailure,
        selectedFilter: "all",
        walletStatus: "connecting",
      })
    ).toEqual({ status: "connecting" });
  });

  it("distinguishes initial, failed, and globally empty history", () => {
    const noFilters: ActivityFilterOptionsResult = AsyncResult.success([]);

    expect(
      projectActivityPageView({
        actionsResult: AsyncResult.initial(true),
        filterOptionsResult: noFilters,
        selectedFilter: "all",
        walletStatus: "connected",
      })
    ).toEqual({ status: "loading" });
    expect(
      projectActivityPageView({
        actionsResult: failedActionsResult(),
        filterOptionsResult: noFilters,
        selectedFilter: "all",
        walletStatus: "connected",
      })
    ).toEqual({ status: "failed" });
    expect(
      projectActivityPageView({
        actionsResult: makeActionsResult(),
        filterOptionsResult: noFilters,
        selectedFilter: "all",
        walletStatus: "connected",
      })
    ).toEqual({ status: "empty" });
  });

  it("waits for filter options before declaring global activity empty", () => {
    expect(
      projectActivityPageView({
        actionsResult: makeActionsResult(),
        filterOptionsResult: AsyncResult.initial(true),
        selectedFilter: "all",
        walletStatus: "connected",
      })
    ).toEqual({ status: "loading" });
    expect(
      projectActivityPageView({
        actionsResult: makeActionsResult(),
        filterOptionsResult: AsyncResult.success([], { waiting: true }),
        selectedFilter: "all",
        walletStatus: "connected",
      })
    ).toEqual({ status: "loading" });
  });

  it("keeps empty activity ready when filter options fail", () => {
    expect(
      projectActivityPageView({
        actionsResult: makeActionsResult(),
        filterOptionsResult: failedFilterOptionsResult(),
        selectedFilter: "all",
        walletStatus: "connected",
      })
    ).toMatchObject({
      actions: [],
      filterOptions: [],
      status: "ready",
    });
  });

  it("keeps an empty waiting history in loading", () => {
    expect(
      projectActivityPageView({
        actionsResult: makeActionsResult({ waiting: true }),
        filterOptionsResult: AsyncResult.success([]),
        selectedFilter: "all",
        walletStatus: "connected",
      })
    ).toEqual({ status: "loading" });
  });

  it("keeps an empty filtered result ready for its controls", () => {
    expect(
      projectActivityPageView({
        actionsResult: makeActionsResult(),
        filterOptionsResult: filterOptions,
        selectedFilter: "defi",
        walletStatus: "connected",
      })
    ).toMatchObject({
      actions: [],
      filterOptions: filterOptions.value,
      selectedFilter: "defi",
      status: "ready",
    });
  });

  it("flattens batches and projects counts and pagination", () => {
    const first = makeActionItem("first");
    const second = makeActionItem("second");
    const actionsValue: ActivityActionsValue = {
      done: false,
      items: [
        {
          actions: [first],
          hasNextPage: true,
          total: 3,
        },
        {
          actions: [second],
          hasNextPage: true,
          total: 3,
        },
      ],
    };
    const actionsResult: ActivityActionsResult =
      AsyncResult.success(actionsValue);

    expect(
      projectActivityPageView({
        actionsResult,
        filterOptionsResult: filterOptions,
        selectedFilter: "all",
        walletStatus: "connected",
      })
    ).toMatchObject({
      actions: [first, second],
      pagination: { status: "idle" },
      showingCount: 2,
      status: "ready",
      total: 3,
    });
  });

  it("keeps activity actions without a readable token", () => {
    const visible = makeActionItem("visible");
    const hidden = makeUnavailableActionItem("hidden");

    expect(
      projectActivityPageView({
        actionsResult: makeActionsResult({
          actions: [visible, hidden],
          total: 2,
        }),
        filterOptionsResult: filterOptions,
        selectedFilter: "all",
        walletStatus: "connected",
      })
    ).toMatchObject({
      actions: [visible, hidden],
      showingCount: 2,
      total: 2,
      status: "ready",
    });
  });

  it("projects loading and failed next pages without dropping stale actions", () => {
    const action = makeActionItem("retained");
    const previous = makeActionsResult({
      actions: [action],
      done: false,
      total: 2,
    });
    const failedNextPage = AsyncResult.failureWithPrevious(
      Cause.fail(undefined as never),
      { previous: Option.some(previous) }
    );

    expect(
      projectActivityPageView({
        actionsResult: AsyncResult.waiting(previous),
        filterOptionsResult: filterOptions,
        selectedFilter: "all",
        walletStatus: "connected",
      })
    ).toMatchObject({
      actions: [action],
      pagination: { status: "loading-more" },
      status: "ready",
    });
    expect(
      projectActivityPageView({
        actionsResult: failedNextPage,
        filterOptionsResult: filterOptions,
        selectedFilter: "all",
        walletStatus: "connected",
      })
    ).toMatchObject({
      actions: [action],
      pagination: { status: "load-more-failed" },
      status: "ready",
    });
  });

  it("degrades a failed filter-options resource without hiding activity", () => {
    const action = makeActionItem("visible");

    expect(
      projectActivityPageView({
        actionsResult: makeActionsResult({ actions: [action] }),
        filterOptionsResult: failedFilterOptionsResult(),
        selectedFilter: "all",
        walletStatus: "connected",
      })
    ).toMatchObject({
      actions: [action],
      filterOptions: [],
      status: "ready",
    });
  });
});

describe("Activity page inputs", () => {
  it("preserves a selection until settled options prove it unavailable", () => {
    expect(
      resolveActivityPageFilter({
        filterOptionsResult: AsyncResult.initial(true),
        selectedFilter: "defi",
      })
    ).toBe("defi");
    expect(
      resolveActivityPageFilter({
        filterOptionsResult: failedFilterOptionsResult(),
        selectedFilter: "defi",
      })
    ).toBe("defi");
    expect(
      resolveActivityPageFilter({
        filterOptionsResult: AsyncResult.success([{ count: 1, filter: "all" }]),
        selectedFilter: "defi",
      })
    ).toBe("all");
    expect(
      resolveActivityPageFilter({
        filterOptionsResult: filterOptions,
        selectedFilter: "defi",
      })
    ).toBe("defi");
  });

  it("distinguishes wallet bootstrap from a settled disconnect", () => {
    expect(
      resolveActivityPageWalletStatus({
        configResult: AsyncResult.initial(true),
        connectionStatus: "disconnected",
      })
    ).toBe("connecting");
    expect(
      resolveActivityPageWalletStatus({
        configResult: AsyncResult.success({} as never),
        connectionStatus: "connecting",
      })
    ).toBe("connecting");
    expect(
      resolveActivityPageWalletStatus({
        configResult: AsyncResult.success({} as never),
        connectionStatus: "disconnected",
      })
    ).toBe("connect-wallet");
    expect(
      resolveActivityPageWalletStatus({
        configResult: AsyncResult.success({} as never),
        connectionStatus: "connected",
      })
    ).toBe("connected");
  });
});
