import { Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { NormalizedWalletState } from "../../../services/wallet/domain/state";
import { getPullResultItems } from "../../../shared/effect/pagination";
import {
  walletConfigResultAtom,
  walletConnectionStateAtom,
  walletScopeAtom,
} from "../../wallet/state";
import type { ActivityActionItem } from "../model/activity-action";
import { getActivityActionTokenSymbol } from "../model/activity-action-list-item";
import type { ActivityFilter, ActivityFilterOption } from "../model/filters";
import {
  ActivityFilterOptionsKey,
  activityActionsPullAtom,
  activityFilterOptionsAtom,
  loadMoreActivityActionsAtom,
} from "../resources/activity-actions";
import { ActivityActionsKey } from "../resources/activity-requests";
import { activityFilterAtom } from "./filter";

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
  if (
    AsyncResult.isInitial(configResult) ||
    configResult.waiting ||
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
  if (
    selectedFilter === "all" ||
    filterOptionsResult.waiting ||
    !AsyncResult.isSuccess(filterOptionsResult)
  ) {
    return selectedFilter;
  }

  return filterOptionsResult.value.some(
    (option) => option.filter === selectedFilter
  )
    ? selectedFilter
    : "all";
};

const getVisibleFilterOptions = (
  result: ActivityFilterOptionsResult
): Array<ActivityFilterOption> => {
  if (AsyncResult.isFailure(result)) return [];

  return result.pipe(
    AsyncResult.value,
    Option.map((options) => [...options]),
    Option.getOrElse((): Array<ActivityFilterOption> => [])
  );
};

const projectPagination = ({
  actionsResult,
  hasActions,
  hasNextPage,
}: {
  readonly actionsResult: ActivityActionsResult;
  readonly hasActions: boolean;
  readonly hasNextPage: boolean;
}): ActivityPagePagination => {
  if (actionsResult.waiting && hasActions) {
    return { status: "loading-more" };
  }

  if (AsyncResult.isFailure(actionsResult) && hasActions && hasNextPage) {
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

  const batches = getPullResultItems(actionsResult);
  const actions = EArray.filter(
    EArray.flatMap(batches, (batch) => batch.actions),
    (action) => getActivityActionTokenSymbol(action) !== null
  );

  if (
    (AsyncResult.isInitial(actionsResult) || actionsResult.waiting) &&
    actions.length === 0
  ) {
    return { status: "loading" };
  }

  if (AsyncResult.isFailure(actionsResult) && actions.length === 0) {
    return { status: "failed" };
  }

  const filterOptions = getVisibleFilterOptions(filterOptionsResult);
  const hasReadyContent =
    actions.length > 0 || filterOptions.length > 0 || selectedFilter !== "all";

  if (
    !hasReadyContent &&
    (filterOptionsResult.waiting || AsyncResult.isInitial(filterOptionsResult))
  ) {
    return { status: "loading" };
  }

  if (
    !hasReadyContent &&
    AsyncResult.isSuccess(filterOptionsResult) &&
    !filterOptionsResult.waiting
  ) {
    return { status: "empty" };
  }

  const resultValue = actionsResult.pipe(
    AsyncResult.value,
    Option.getOrUndefined
  );
  const hasNextPage = resultValue?.done === false;
  const total =
    resultValue?.done === true
      ? actions.length
      : (batches.at(-1)?.total ?? actions.length);

  return {
    actions,
    filterOptions,
    pagination: projectPagination({
      actionsResult,
      hasActions: actions.length > 0,
      hasNextPage,
    }),
    selectedFilter,
    showingCount: actions.length,
    status: "ready",
    total,
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
  const filterOptions = activityFilterOptionsAtom(
    new ActivityFilterOptionsKey({ scope })
  );
  const filterOptionsResult = context(filterOptions);
  const selectedFilter = resolveActivityPageFilter({
    filterOptionsResult,
    selectedFilter: context(activityFilterAtom),
  });
  const actionsKey = new ActivityActionsKey({ filter: selectedFilter, scope });
  const actions = activityActionsPullAtom(actionsKey);

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
