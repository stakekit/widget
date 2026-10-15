import { Array as EArray, Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
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
import { widgetConfigAtom } from "../../widget-configuration/index";
import type { ActivityActionItem } from "../model/activity-action";
import type { ActivityFilter, ActivityFilterOption } from "../model/filters";
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

export const shouldShowActivityDashboardSplit = (
  view: ActivityPageView
): boolean => view.status === "ready" && view.actions.length > 0;

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

  const { done, items: batches } = history.value;
  const actions = EArray.flatMap(batches, (batch) => batch.actions);

  if (actions.length === 0 && history.refreshing) {
    return { status: "loading" };
  }

  if (actions.length === 0 && Option.isSome(history.refreshFailure)) {
    return { status: "failed" };
  }

  const filterOptionsView = toPresentable(filterOptionsResult);
  const filterOptions = getVisibleFilterOptions(filterOptionsView);
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
      hasNextPage: !done,
      refreshFailed: Option.isSome(history.refreshFailure),
      refreshing: history.refreshing,
    }),
    selectedFilter,
    showingCount: actions.length,
    status: "ready",
    total: done ? actions.length : (batches.at(-1)?.total ?? actions.length),
  };
};

export const activityPageViewAtom = Atom.make((context) => {
  const walletStatus = resolveActivityPageWalletStatus({
    configResult: context(walletConfigResultAtom),
    connectionStatus: context(walletConnectionStateAtom).status,
  });

  if (walletStatus !== "connected") {
    return { status: walletStatus } satisfies ActivityPageView;
  }

  const resources = resolveActivityPageResources(context);

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
    filter: selectedFilter,
    scope,
  });
  const actions = activityActionsPullAtom(actionsKey);

  for (const option of getVisibleFilterOptions(
    toPresentable(filterOptionsResult)
  )) {
    context(
      activityActionsPullAtom(
        new ActivityActionsKey({ borrowEnabled, filter: option.filter, scope })
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
