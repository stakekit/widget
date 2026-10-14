import { Data, Effect, Option, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import {
  isActivityActionOwnedByScope,
  isContinuableYieldAction,
} from "../../../domain/activity/action-capabilities";
import { ActionId } from "../../../domain/identity/identifiers";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";
import {
  ActivityActionKey,
  activityActionResourceAtom,
} from "../../../resources/activity-history/index";
import {
  type Presentable,
  toPresentable,
} from "../../../shared/effect/async-result";
import { presentationClockAtom } from "../../../shared/effect/presentation-clock";
import {
  YieldSummaryKey,
  type YieldSummaryProvider,
  yieldSummaryAtom,
} from "../../yield-summary/index";
import type {
  ActivityActionItem,
  YieldActivityItem,
} from "../model/activity-action";
import { projectYieldActivityItem } from "../model/activity-enrichment";
import {
  ActivityEnrichmentKey,
  loadActivityEnrichmentFacts,
} from "./enrichment";
import { type ActivityPageView, activityPageViewAtom } from "./page";

class ActivityDetailsKey extends Data.Class<{
  readonly actionId: ActionId;
  readonly scope: WalletScopeKey;
}> {}

const activityActionDetailsAtom = Atom.family((key: ActivityDetailsKey) =>
  appRuntime
    .atom((context) =>
      Effect.gen(function* () {
        const action = yield* context.result(
          activityActionResourceAtom.local(
            new ActivityActionKey({
              actionId: key.actionId,
              scope: key.scope,
            })
          )
        );
        if (!action) return null;

        // Details tracks its Resources so a recovered Yield or validator
        // re-projects the row (ADR 0003); the feed takes them once per page.
        const item = projectYieldActivityItem(
          action,
          key.scope,
          yield* loadActivityEnrichmentFacts(
            new ActivityEnrichmentKey([{ _tag: "yield", action }]),
            (resource) => context.result(resource)
          )
        );

        return isActivityActionOwnedByScope({
          action,
          scope: key.scope,
          yieldData: item.yieldData,
        })
          ? item
          : null;
      })
    )
    .pipe(Atom.withLabel("activityActionDetailsAtom"))
);

const retryActivityActionDetailsAtom = Atom.family((key: ActivityDetailsKey) =>
  Atom.fnSync(
    (_input: undefined, context) => {
      context.refresh(activityActionDetailsAtom(key));
      context.refresh(
        activityActionResourceAtom.local(
          new ActivityActionKey({
            actionId: key.actionId,
            scope: key.scope,
          })
        )
      );
    },
    { initialValue: undefined }
  ).pipe(Atom.withLabel("retryActivityActionDetailsAtom"))
);

export class ActivityDefaultIntent extends Data.TaggedClass("default")<{
  readonly _Intent: "default";
}> {
  constructor() {
    super({ _Intent: "default" });
  }
}

export class ActivityExplicitIntent extends Data.TaggedClass("explicit")<{
  readonly actionId: ActionId;
}> {}

export type ActivitySelectionIntent =
  | ActivityDefaultIntent
  | ActivityExplicitIntent;

export class ActivitySelectionKey extends Data.Class<{
  readonly intent: ActivitySelectionIntent;
  readonly scope: WalletScopeKey;
  readonly surface: "execution" | "review";
}> {}

type ActivitySelectedActionView =
  | { readonly status: "loading" }
  | { readonly status: "unavailable" }
  | { readonly status: "failed" }
  | {
      readonly item: YieldActivityItem;
      readonly status: "ready";
    };

/** Borrow rows have no details, so Default selects the first Yield row. */
export const resolveDefaultSelectedActionId = (
  view: Atom.Type<typeof activityPageViewAtom>
): ActionId | "loading" | null => {
  if (view.status !== "ready") {
    if (view.status === "empty") return null;
    return "loading";
  }
  return (
    view.actions.find(
      (item): item is YieldActivityItem => item._tag === "yield"
    )?.actionData.id ?? null
  );
};

/**
 * URL intent wins; Default takes the first row of the feed on screen, so a
 * background refetch never blanks the selection.
 */
export const resolveActivitySelection = (
  intent: ActivitySelectionIntent,
  view: Atom.Type<typeof activityPageViewAtom>
): ActionId | "loading" | null => {
  if (intent._tag === "explicit") return intent.actionId;
  return resolveDefaultSelectedActionId(view);
};

export type ActivityRouteIntentParse =
  | { readonly intent: ActivitySelectionIntent; readonly status: "ok" }
  | { readonly status: "invalid" }
  | { readonly status: "missing" };

/** Decode route params into selection intent. Missing is only Default on Dashboard. */
export const parseActivityRouteIntent = ({
  actionIdParam,
  allowDefault,
}: {
  readonly actionIdParam: string | undefined;
  readonly allowDefault: boolean;
}): ActivityRouteIntentParse => {
  if (actionIdParam === undefined || actionIdParam === "") {
    return allowDefault
      ? { intent: new ActivityDefaultIntent(), status: "ok" }
      : { status: "missing" };
  }

  const actionId = Schema.decodeOption(ActionId)(actionIdParam).pipe(
    Option.getOrNull
  );
  if (!actionId) return { status: "invalid" };

  return {
    intent: new ActivityExplicitIntent({ actionId }),
    status: "ok",
  };
};

/** Highlight id for the feed; loading defaults show nothing selected yet. */
export const resolveActivityHighlightActionId = (
  intent: ActivitySelectionIntent | null,
  view: Atom.Type<typeof activityPageViewAtom>
): ActionId | null => {
  if (intent === null) return null;
  const resolved = resolveActivitySelection(intent, view);
  return resolved === "loading" ? null : resolved;
};

/** Explicit action ids clear the route; default selection stays empty. */
export const resolveUnavailableActivitySelection = (
  intent: ActivitySelectionIntent
): "clear-route" | "empty" =>
  intent._tag === "default" ? "empty" : "clear-route";

const projectDetailsResult = (
  details: Presentable<YieldActivityItem | null, unknown>
): ActivitySelectedActionView => {
  switch (details._tag) {
    case "Loading":
      return { status: "loading" };
    case "Failed":
      return { status: "failed" };
    case "Ready":
      return details.value
        ? { item: details.value, status: "ready" }
        : { status: "unavailable" };
  }
};

/** Prefer the enriched feed row so selection does not wait on GET-by-id. */
export const findActivityActionInFeed = (
  actionId: string,
  view: ActivityPageView
): ActivityActionItem | null => {
  if (view.status !== "ready") return null;
  return view.actions.find((item) => item.actionData.id === actionId) ?? null;
};

const resolveSelectedActionId = (
  key: ActivitySelectionKey,
  get: <A>(atom: Atom.Atom<A>) => A
): ActionId | "loading" | null =>
  resolveActivitySelection(key.intent, get(activityPageViewAtom));

const activitySelectedActionAtom = Atom.family((key: ActivitySelectionKey) =>
  Atom.make((context): ActivitySelectedActionView => {
    const view = context(activityPageViewAtom);
    const actionId = resolveActivitySelection(key.intent, view);

    if (actionId === "loading") return { status: "loading" };
    if (actionId === null) return { status: "unavailable" };

    const fromFeed = findActivityActionInFeed(actionId, view);
    // Borrow ids never reach the Yield GET-by-id endpoint.
    if (fromFeed?._tag === "borrow") return { status: "unavailable" };
    if (fromFeed) {
      return { item: fromFeed, status: "ready" };
    }

    return projectDetailsResult(
      toPresentable(
        context(
          activityActionDetailsAtom(
            new ActivityDetailsKey({ actionId, scope: key.scope })
          )
        )
      )
    );
  }).pipe(Atom.withLabel("activitySelectedActionAtom"))
);

const retryActivitySelectedActionAtom = Atom.family(
  (key: ActivitySelectionKey) =>
    Atom.fnSync(
      (_input: undefined, context) => {
        const actionId = resolveSelectedActionId(key, context);
        if (actionId === null || actionId === "loading") return;

        context.set(
          retryActivityActionDetailsAtom(
            new ActivityDetailsKey({ actionId, scope: key.scope })
          ),
          undefined
        );
      },
      { initialValue: undefined }
    ).pipe(Atom.withLabel("retryActivitySelectedActionAtom"))
);

type ActivityDetailsView =
  | { readonly status: "loading" }
  | { readonly status: "unavailable" }
  | { readonly status: "failed" }
  | {
      readonly canContinue: boolean;
      readonly item: YieldActivityItem;
      readonly providersDetails: ReadonlyArray<YieldSummaryProvider>;
      readonly status: "ready";
    };

export const activityDetailsViewAtom = Atom.family(
  (key: ActivitySelectionKey) =>
    Atom.make((context): ActivityDetailsView => {
      const selected = context(activitySelectedActionAtom(key));
      if (selected.status !== "ready") return selected;

      const item = selected.item;
      const action = item.actionData;
      const providersDetails =
        context(
          yieldSummaryAtom(
            new YieldSummaryKey({
              validators: item.validatorsData,
              yield: item.yieldData,
            })
          )
        ).providers ?? [];
      const presentationTime = context(presentationClockAtom);
      const selectedYield = item.yieldData;
      const canContinue =
        presentationTime !== null &&
        selectedYield !== null &&
        isContinuableYieldAction(action, presentationTime.now);

      return {
        canContinue: key.surface === "review" && canContinue,
        item,
        providersDetails,
        status: "ready",
      };
    }).pipe(Atom.withLabel("activityDetailsViewAtom"))
);

export const retryActivityActionRouteAtom = retryActivitySelectedActionAtom;
