import { Duration, Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { widgetConfigAtom } from "../../../runtime/widget-config";
import { toPresentable } from "../../../shared/effect/async-result";
import {
  walletConfigResultAtom,
  walletConnectionStateAtom,
  walletScopeAtom,
} from "../../wallet/index";
import { getActivitySettlement } from "../model/activity-action-list-item";
import { type ActivityFilter, getActivityFeedFilter } from "../model/filters";
import {
  type ActivityPageView,
  getVisibleFilterOptions,
  needsNextOtherPage,
  projectActivityPageView,
  resolveActivityPageFilter,
  resolveActivityPageWalletStatus,
} from "../model/page-view";
import {
  ActivityActionsKey,
  ActivityFilterOptionsKey,
  activityActionsPullAtom,
  activityFilterAtom,
  activityFilterOptionsAtom,
  loadMoreActivityActionsAtom,
} from "./page-resources";

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
