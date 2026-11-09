import { Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import type { NormalizedWalletState } from "../../../services/wallet/wallet-state";
import {
  type Presentable,
  toPresentable,
} from "../../../shared/effect/async-result";
import type { ActivityActionItem } from "./activity-action";
import {
  type ActivityFilter,
  type ActivityFilterOption,
  isUncategorizedActivityAction,
} from "./filters";

export type ActivityPageWalletStatus =
  | "connect-wallet"
  | "connected"
  | "connecting";

/** One loaded page of the Activity feed, its actions enriched. */
export type ActivityActionsBatch = {
  readonly actions: ReadonlyArray<ActivityActionItem>;
  readonly hasNextPage: boolean;
  readonly total: number;
};

type ActivityActionsValue = {
  readonly done: boolean;
  readonly items: ReadonlyArray<ActivityActionsBatch>;
};

/** The feed's pages as its pull resource reports them. */
export type ActivityActionsResult<E> = AsyncResult.AsyncResult<
  ActivityActionsValue,
  E
>;

export type ActivityFilterOptionsResult<E> = AsyncResult.AsyncResult<
  ReadonlyArray<ActivityFilterOption>,
  E
>;

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

export const resolveActivityPageWalletStatus = <A, E>({
  configResult,
  connectionStatus,
}: {
  readonly configResult: AsyncResult.AsyncResult<A, E>;
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

export const resolveActivityPageFilter = <E>({
  filterOptionsResult,
  selectedFilter,
}: {
  readonly filterOptionsResult: ActivityFilterOptionsResult<E>;
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

export const getVisibleFilterOptions = <E>(
  options: Presentable<ReadonlyArray<ActivityFilterOption>, E>
): Array<ActivityFilterOption> =>
  options._tag === "Ready" ? [...options.value] : [];

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
export const needsNextOtherPage = <E, F>({
  actionsResult,
  filterOptionsResult,
  selectedFilter,
}: {
  readonly actionsResult: ActivityActionsResult<E>;
  readonly filterOptionsResult: ActivityFilterOptionsResult<F>;
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

export const projectActivityPageView = <E, F>({
  actionsResult,
  filterOptionsResult,
  selectedFilter,
  walletStatus,
}: {
  readonly actionsResult: ActivityActionsResult<E>;
  readonly filterOptionsResult: ActivityFilterOptionsResult<F>;
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
