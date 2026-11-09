import { Data, Option, Schema } from "effect";

import { ActionId as BorrowActionId } from "../../../domain/borrow/ids";
import { ActionId } from "../../../domain/identity/identifiers";
import {
  type ActivityActionItem,
  type ActivitySelectionTarget,
  getActivitySelectionTarget,
  isActivitySelectionTarget,
} from "./activity-action";
import type { ActivityPageView } from "./page-view";

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

export class BorrowActivityExplicitIntent extends Data.TaggedClass(
  "explicitBorrow"
)<{
  readonly actionId: BorrowActionId;
}> {}

export type ActivitySelectionIntent =
  | ActivityDefaultIntent
  | ActivityExplicitIntent
  | BorrowActivityExplicitIntent;

/** Default selects the first row of the feed, Yield or Borrow. */
export const resolveDefaultSelection = (
  view: ActivityPageView
): ActivitySelectionTarget | "loading" | null => {
  if (view.status !== "ready") {
    if (view.status === "empty") return null;
    return "loading";
  }
  const first = view.actions[0];
  return first ? getActivitySelectionTarget(first) : null;
};

/**
 * URL intent wins; Default takes the first row of the feed on screen, so a
 * background refetch never blanks the selection.
 */
export const resolveActivitySelection = (
  intent: ActivitySelectionIntent,
  view: ActivityPageView
): ActivitySelectionTarget | "loading" | null => {
  switch (intent._tag) {
    case "explicit":
      return { actionId: intent.actionId, source: "yield" };
    case "explicitBorrow":
      return { actionId: intent.actionId, source: "borrow" };
    case "default":
      return resolveDefaultSelection(view);
  }
};

export type ActivityRouteIntentParse =
  | { readonly intent: ActivitySelectionIntent; readonly status: "ok" }
  | { readonly status: "invalid" }
  | { readonly status: "missing" };

/**
 * Decode route params into selection intent. Missing is only Default on
 * Dashboard; `source` is the route the param came from.
 */
export const parseActivityRouteIntent = ({
  actionIdParam,
  allowDefault,
  source,
}: {
  readonly actionIdParam: string | undefined;
  readonly allowDefault: boolean;
  readonly source: ActivitySelectionTarget["source"];
}): ActivityRouteIntentParse => {
  if (actionIdParam === undefined || actionIdParam === "") {
    return allowDefault
      ? { intent: new ActivityDefaultIntent(), status: "ok" }
      : { status: "missing" };
  }

  if (source === "borrow") {
    const actionId = Schema.decodeOption(BorrowActionId)(actionIdParam).pipe(
      Option.getOrNull
    );
    return actionId
      ? { intent: new BorrowActivityExplicitIntent({ actionId }), status: "ok" }
      : { status: "invalid" };
  }

  const actionId = Schema.decodeOption(ActionId)(actionIdParam).pipe(
    Option.getOrNull
  );
  return actionId
    ? { intent: new ActivityExplicitIntent({ actionId }), status: "ok" }
    : { status: "invalid" };
};

/** Highlighted feed row; loading defaults show nothing selected yet. */
export const resolveActivityHighlightAction = (
  intent: ActivitySelectionIntent | null,
  view: ActivityPageView
): ActivitySelectionTarget | null => {
  if (intent === null) return null;
  const resolved = resolveActivitySelection(intent, view);
  return resolved === "loading" ? null : resolved;
};

/** Explicit action ids clear the route; default selection stays empty. */
export const resolveUnavailableActivitySelection = (
  intent: ActivitySelectionIntent
): "clear-route" | "empty" =>
  intent._tag === "default" ? "empty" : "clear-route";

/** Prefer the enriched feed row so selection does not wait on GET-by-id. */
export const findActivityActionInFeed = (
  target: ActivitySelectionTarget,
  view: ActivityPageView
): ActivityActionItem | null => {
  if (view.status !== "ready") return null;
  return (
    view.actions.find((item) => isActivitySelectionTarget(item, target)) ?? null
  );
};
