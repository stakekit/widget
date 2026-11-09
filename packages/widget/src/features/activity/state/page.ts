import { Duration, Array as EArray, Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { widgetConfigAtom } from "../../../runtime/widget-config";
import type { NormalizedWalletState } from "../../../services/wallet/wallet-state";
import {
  type Presentable,
  toPresentable,
} from "../../../shared/effect/async-result";
import {
  walletConfigResultAtom,
  walletConnectionStateAtom,
  walletScopeAtom,
} from "../../wallet/index";
import type { ActivityActionItem } from "../model/activity-action";
import { getActivitySettlement } from "../model/activity-action-list-item";
import {
  type ActivityFilter,
  type ActivityFilterOption,
  getActivityFeedFilter,
  isUncategorizedActivityAction,
} from "../model/filters";
import {
  ActivityActionsKey,
  ActivityFilterOptionsKey,
  activityActionsPullAtom,
  activityFilterAtom,
  activityFilterOptionsAtom,
  loadMoreActivityActionsAtom,
} from "./page-resources";

type ActivityPageWalletStatus = "connect-wallet" | "connected" | "connecting";

export type ActivityPagePagination =
  | { readonly status: "complete" }
  | { readonly status: "idle" }
  | { readonly status: "loading-more" }
  | { readonly status: "load-more-failed" };

type ActivityPageReadyView = {
  readonly actions: Array<ActivityActionItem>;
  readonly filterOptions: Array<ActivityFilterOption>;
  readonly pagination: ActivityPagePagination;
  readonly selectedFilter: ActivityFilter;
  readonly showingCount: number;
  readonly status: "ready";
  readonly total: number;
};

export type ActivityPageView =
  | { readonly status: "connect-wallet" }
  | { readonly status: "connecting" }
  | { readonly status: "empty" }
  | { readonly status: "failed" }
  | { readonly status: "loading" }
  | ActivityPageReadyView;

export const hasActivityActions = (view: ActivityPageView): boolean =>
  view.status === "ready" && view.actions.length > 0;

type ActivityActionsResult = Atom.Type<
  ReturnType<typeof activityActionsPullAtom>
>;

type ActivityFilterOptionsResult = Atom.Type<
  ReturnType<typeof activityFilterOptionsAtom>
>;

export const resolveActivityPageWalletStatus = ({
  configResult,
  connectionStatus,
}: {
  readonly configResult: Atom.Type<typeof walletConfigResultAtom>;
  readonly connectionStatus: NormalizedWalletState["status"];
}): ActivityPageWalletStatus => {
  const config = toPresentable(configResult);
  if (
    config._tag === "Loading" ||
    (config._tag === "Ready" && config.refreshing) ||
    connectionStatus === "connecting"
  ) {
    return "connecting";
  }

  return connectionStatus === "connected" ? "connected" : "connect-wallet";
};

export const resolveActivityPageFilter = ({
  filterOptionsResult,
  selectedFilter,
}: {
  readonly filterOptionsResult: ActivityFilterOptionsResult;
  readonly selectedFilter: ActivityFilter;
}): ActivityFilter => {
  const options = toPresentable(filterOptionsResult);
  if (
    selectedFilter === "all" ||
    options._tag !== "Ready" ||
    options.refreshing ||
    Option.isSome(options.refreshFailure)
  ) {
    return selectedFilter;
  }

  return options.value.some((option) => option.filter === selectedFilter)
    ? selectedFilter
    : "all";
};

const getVisibleFilterOptions = (
  options: Presentable<ReadonlyArray<ActivityFilterOption>, unknown>
): Array<ActivityFilterOption> =>
  options._tag === "Ready" ? [...options.value] : [];

type ActivityActionsValue = Extract<
  ActivityActionsResult,
  { readonly _tag: "Success" }
>["value"];

/**
 * The actions a filter shows from its feed, whether the feed holds them all,
 * and how many there are. Other picks the uncategorized actions out of the
 * All feed and has them all only once the feed has no more pages: a yield
 * that failed to load reads as uncategorized here though the API counts it in
 * a category, so reaching Other's count does not mean none are left.
 */
const selectFilterActions = ({
  feed: { done, items: batches },
  filterOptions,
  selectedFilter,
}: {
  readonly feed: ActivityActionsValue;
  readonly filterOptions: ReadonlyArray<ActivityFilterOption>;
  readonly selectedFilter: ActivityFilter;
}): {
  readonly actions: Array<ActivityActionItem>;
  readonly complete: boolean;
  readonly total: number;
} => {
  const feedActions = EArray.flatMap(batches, (batch) => batch.actions);

  if (selectedFilter !== "other") {
    return {
      actions: feedActions,
      complete: done,
      total: done
        ? feedActions.length
        : (batches.at(-1)?.total ?? feedActions.length),
    };
  }

  const actions = feedActions.filter(isUncategorizedActivityAction);
  const otherCount =
    filterOptions.find((option) => option.filter === "other")?.count ?? 0;

  return {
    actions,
    complete: done,
    total: done ? actions.length : Math.max(otherCount, actions.length),
  };
};

/**
 * Whether the Other filter needs the All feed's next page: it has not found
 * all its actions yet, and no page is loading or failed to load.
 */
export const needsNextOtherPage = ({
  actionsResult,
  filterOptionsResult,
  selectedFilter,
}: {
  readonly actionsResult: ActivityActionsResult;
  readonly filterOptionsResult: ActivityFilterOptionsResult;
  readonly selectedFilter: ActivityFilter;
}): boolean =>
  selectedFilter === "other" &&
  AsyncResult.isSuccess(actionsResult) &&
  !actionsResult.waiting &&
  !selectFilterActions({
    feed: actionsResult.value,
    filterOptions: getVisibleFilterOptions(toPresentable(filterOptionsResult)),
    selectedFilter,
  }).complete;

const projectPagination = ({
  hasActions,
  hasNextPage,
  refreshFailed,
  refreshing,
}: {
  readonly hasActions: boolean;
  readonly hasNextPage: boolean;
  readonly refreshFailed: boolean;
  readonly refreshing: boolean;
}): ActivityPagePagination => {
  if (refreshing && hasActions) {
    return { status: "loading-more" };
  }

  if (refreshFailed && hasActions && hasNextPage) {
    return { status: "load-more-failed" };
  }

  return hasNextPage ? { status: "idle" } : { status: "complete" };
};

export const projectActivityPageView = ({
  actionsResult,
  filterOptionsResult,
  selectedFilter,
  walletStatus,
}: {
  readonly actionsResult: ActivityActionsResult;
  readonly filterOptionsResult: ActivityFilterOptionsResult;
  readonly selectedFilter: ActivityFilter;
  readonly walletStatus: ActivityPageWalletStatus;
}): ActivityPageView => {
  if (walletStatus === "connect-wallet") {
    return { status: "connect-wallet" };
  }

  if (walletStatus === "connecting") {
    return { status: "connecting" };
  }

  const history = toPresentable(actionsResult);
  if (history._tag === "Loading") return { status: "loading" };
  if (history._tag === "Failed") return { status: "failed" };

  const filterOptionsView = toPresentable(filterOptionsResult);
  const filterOptions = getVisibleFilterOptions(filterOptionsView);
  const { actions, complete, total } = selectFilterActions({
    feed: history.value,
    filterOptions,
    selectedFilter,
  });
  const refreshFailed = Option.isSome(history.refreshFailure);
  // Other loads the All feed's pages on its own until it has all its actions.
  const refreshing =
    history.refreshing ||
    (selectedFilter === "other" && !complete && !refreshFailed);

  if (actions.length === 0 && refreshing) {
    return { status: "loading" };
  }

  if (actions.length === 0 && refreshFailed) {
    return { status: "failed" };
  }

  const hasReadyContent =
    actions.length > 0 || filterOptions.length > 0 || selectedFilter !== "all";

  if (!hasReadyContent && filterOptionsView._tag !== "Failed") {
    if (filterOptionsView._tag === "Loading" || filterOptionsView.refreshing) {
      return { status: "loading" };
    }
    if (Option.isNone(filterOptionsView.refreshFailure)) {
      return { status: "empty" };
    }
  }

  return {
    actions,
    filterOptions,
    pagination: projectPagination({
      hasActions: actions.length > 0,
      hasNextPage: !complete,
      refreshFailed,
      refreshing,
    }),
    selectedFilter,
    showingCount: actions.length,
    status: "ready",
    total,
  };
};

// The API records a batch's settlement on the provider's schedule. Only the
// feed the Activity page shows polls, and only while a confidential request in
// it still awaits one; prefetched and other filters' feeds do not. A refresh
// reloads the feed from its first page, so polling stops once the user has
// loaded older pages rather than discarding them every minute.
const settlementRefreshInterval = Duration.minutes(1);

/**
 * Refreshes a feed a minute after it settles on a request still awaiting its
 * settlement. Without an idle lifetime it ends the moment the page stops
 * reading its feed, and each refresh restarts the wait.
 */
const settlementRefreshAtom = Atom.family((key: ActivityActionsKey) =>
  Atom.make((get) => {
    const actions = activityActionsPullAtom(key);
    const actionsResult = get(actions);
    const awaitingSettlement =
      !actionsResult.waiting &&
      Option.exists(
        AsyncResult.value(actionsResult),
        ({ items }) =>
          items.length === 1 &&
          items.some((batch) =>
            batch.actions.some(
              (item) =>
                item._tag === "yield" &&
                getActivitySettlement(item)?._tag === "Awaiting"
            )
          )
      );
    return awaitingSettlement
      ? Effect.sleep(settlementRefreshInterval).pipe(
          Effect.andThen(Effect.sync(() => get.refresh(actions)))
        )
      : Effect.void;
  }).pipe(Atom.withLabel("activitySettlementRefreshAtom"))
);

// Other finds its actions in the All feed, which the API cannot filter for
// them, so it loads the feed's next page until it has found them all. The
// load waits a turn: an atom cannot write while it is being read.
const otherPagesLoaderAtom = Atom.make((get) => {
  const resources = resolveActivityPageResources(get);
  return needsNextOtherPage({
    actionsResult: get(resources.actions),
    filterOptionsResult: resources.filterOptionsResult,
    selectedFilter: resources.selectedFilter,
  })
    ? Effect.yieldNow.pipe(
        Effect.andThen(
          Effect.sync(() =>
            get.set(
              loadMoreActivityActionsAtom(resources.actionsKey),
              undefined
            )
          )
        )
      )
    : Effect.void;
}).pipe(Atom.withLabel("activityOtherPagesLoaderAtom"));

export const activityPageViewAtom = Atom.make((context) => {
  const walletStatus = resolveActivityPageWalletStatus({
    configResult: context(walletConfigResultAtom),
    connectionStatus: context(walletConnectionStateAtom).status,
  });

  if (walletStatus !== "connected") {
    return { status: walletStatus } satisfies ActivityPageView;
  }

  const resources = resolveActivityPageResources(context);
  // Reading the upkeep keeps it running while the page shows this feed.
  context(settlementRefreshAtom(resources.actionsKey));
  context(otherPagesLoaderAtom);

  return projectActivityPageView({
    actionsResult: context(resources.actions),
    filterOptionsResult: resources.filterOptionsResult,
    selectedFilter: resources.selectedFilter,
    walletStatus,
  });
}).pipe(Atom.withLabel("activityPageViewAtom"));

function resolveActivityPageResources(context: Atom.FnContext) {
  const scope = context(walletScopeAtom);
  const { borrowEnabled } = context(widgetConfigAtom);
  const filterOptions = activityFilterOptionsAtom(
    new ActivityFilterOptionsKey({ borrowEnabled, scope })
  );
  const filterOptionsResult = context(filterOptions);
  const selectedFilter = resolveActivityPageFilter({
    filterOptionsResult,
    selectedFilter: context(activityFilterAtom),
  });
  const actionsKey = new ActivityActionsKey({
    borrowEnabled,
    filter: getActivityFeedFilter(selectedFilter),
    scope,
  });
  const actions = activityActionsPullAtom(actionsKey);

  for (const option of getVisibleFilterOptions(
    toPresentable(filterOptionsResult)
  )) {
    context(
      activityActionsPullAtom(
        new ActivityActionsKey({
          borrowEnabled,
          filter: getActivityFeedFilter(option.filter),
          scope,
        })
      )
    );
  }

  return {
    actions,
    actionsKey,
    filterOptions,
    filterOptionsResult,
    selectedFilter,
  } as const;
}

export const setActivityPageFilterAtom = Atom.fnSync(
  (filter: ActivityFilter, context) => {
    context.set(activityFilterAtom, filter);
  },
  { initialValue: undefined }
).pipe(Atom.withLabel("setActivityPageFilterAtom"));

export const loadMoreActivityAtom = Atom.fnSync(
  (_input: undefined, context) => {
    const view = context(activityPageViewAtom);
    if (
      view.status !== "ready" ||
      (view.pagination.status !== "idle" &&
        view.pagination.status !== "load-more-failed")
    ) {
      return;
    }

    const resources = resolveActivityPageResources(context);
    context.set(loadMoreActivityActionsAtom(resources.actionsKey), undefined);
  },
  { initialValue: undefined }
).pipe(Atom.withLabel("loadMoreActivityAtom"));

export const retryActivityPageAtom = Atom.fnSync(
  (_input: undefined, context) => {
    if (context(activityPageViewAtom).status !== "failed") return;

    const resources = resolveActivityPageResources(context);
    context.refresh(resources.actions);
    context.refresh(resources.filterOptions);
  },
  { initialValue: undefined }
).pipe(Atom.withLabel("retryActivityPageAtom"));
