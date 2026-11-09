import { Data, Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";

import {
  isActivityActionOwnedByScope,
  isContinuableYieldAction,
} from "../../../domain/activity/action-capabilities";
import type { ActionId as BorrowActionId } from "../../../domain/borrow/ids";
import type { ActionId } from "../../../domain/identity/identifiers";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";
import {
  ActivityActionKey,
  activityActionResourceAtom,
  BorrowActivityActionKey,
  borrowActivityActionResourceAtom,
} from "../../../resources/activity-history/activity-history";
import { appRuntime } from "../../../runtime/app-runtime";
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
import type { ActivityActionItem } from "../model/activity-action";
import {
  projectBorrowActivityItem,
  projectYieldActivityItem,
} from "../model/activity-enrichment";
import {
  type ActivitySelectionIntent,
  findActivityActionInFeed,
  resolveActivitySelection,
} from "../model/selection";
import {
  ActivityEnrichmentKey,
  loadActivityEnrichmentFacts,
} from "./enrichment";
import { activityPageViewAtom } from "./page";

class ActivityDetailsKey extends Data.Class<{
  readonly actionId: ActionId;
  readonly scope: WalletScopeKey;
}> {}

class BorrowActivityDetailsKey extends Data.Class<{
  readonly actionId: BorrowActionId;
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
        const facts = yield* loadActivityEnrichmentFacts(
          new ActivityEnrichmentKey([{ _tag: "yield", action }]),
          (resource) => context.result(resource)
        );
        const item = projectYieldActivityItem(action, key.scope, facts);

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

const borrowActivityActionDetailsAtom = Atom.family(
  (key: BorrowActivityDetailsKey) =>
    appRuntime
      .atom((context) =>
        Effect.gen(function* () {
          const entry = yield* context.result(
            borrowActivityActionResourceAtom.local(
              new BorrowActivityActionKey({
                actionId: key.actionId,
                scope: key.scope,
              })
            )
          );
          if (!entry) return null;

          // Ownership is settled by the Resource; facts only name its tokens.
          const facts = yield* loadActivityEnrichmentFacts(
            new ActivityEnrichmentKey([entry]),
            (resource) => context.result(resource)
          );
          return projectBorrowActivityItem(entry, key.scope, facts);
        })
      )
      .pipe(Atom.withLabel("borrowActivityActionDetailsAtom"))
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

const retryBorrowActivityActionDetailsAtom = Atom.family(
  (key: BorrowActivityDetailsKey) =>
    Atom.fnSync(
      (_input: undefined, context) => {
        context.refresh(borrowActivityActionDetailsAtom(key));
        context.refresh(
          borrowActivityActionResourceAtom.local(
            new BorrowActivityActionKey({
              actionId: key.actionId,
              scope: key.scope,
            })
          )
        );
      },
      { initialValue: undefined }
    ).pipe(Atom.withLabel("retryBorrowActivityActionDetailsAtom"))
);

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
      readonly item: ActivityActionItem;
      readonly status: "ready";
    };

const projectDetailsResult = (
  details: Presentable<ActivityActionItem | null, unknown>
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

const activitySelectedActionAtom = Atom.family((key: ActivitySelectionKey) =>
  Atom.make((context): ActivitySelectedActionView => {
    const view = context(activityPageViewAtom);
    const target = resolveActivitySelection(key.intent, view);

    if (target === "loading") return { status: "loading" };
    if (target === null) return { status: "unavailable" };

    const fromFeed = findActivityActionInFeed(target, view);
    if (fromFeed) {
      return { item: fromFeed, status: "ready" };
    }

    if (target.source === "borrow") {
      return projectDetailsResult(
        toPresentable(
          context(
            borrowActivityActionDetailsAtom(
              new BorrowActivityDetailsKey({
                actionId: target.actionId,
                scope: key.scope,
              })
            )
          )
        )
      );
    }
    return projectDetailsResult(
      toPresentable(
        context(
          activityActionDetailsAtom(
            new ActivityDetailsKey({
              actionId: target.actionId,
              scope: key.scope,
            })
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
        const target = resolveActivitySelection(
          key.intent,
          context(activityPageViewAtom)
        );
        if (target === null || target === "loading") return;

        if (target.source === "borrow") {
          context.set(
            retryBorrowActivityActionDetailsAtom(
              new BorrowActivityDetailsKey({
                actionId: target.actionId,
                scope: key.scope,
              })
            ),
            undefined
          );
          return;
        }
        context.set(
          retryActivityActionDetailsAtom(
            new ActivityDetailsKey({
              actionId: target.actionId,
              scope: key.scope,
            })
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
      readonly item: ActivityActionItem;
      readonly providersDetails: ReadonlyArray<YieldSummaryProvider>;
      readonly status: "ready";
    };

export const activityDetailsViewAtom = Atom.family(
  (key: ActivitySelectionKey) =>
    Atom.make((context): ActivityDetailsView => {
      const selected = context(activitySelectedActionAtom(key));
      if (selected.status !== "ready") return selected;

      const item = selected.item;
      // Borrow rows name their provider themselves and never continue.
      if (item._tag === "borrow") {
        return {
          canContinue: false,
          item,
          providersDetails: [],
          status: "ready",
        };
      }

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
      const canContinue =
        presentationTime !== null &&
        item.yieldData !== null &&
        isContinuableYieldAction(item.actionData, presentationTime.now);

      return {
        canContinue: key.surface === "review" && canContinue,
        item,
        providersDetails,
        status: "ready",
      };
    }).pipe(Atom.withLabel("activityDetailsViewAtom"))
);

export const retryActivityActionRouteAtom = retryActivitySelectedActionAtom;
