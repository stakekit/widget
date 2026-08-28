import { Data, Array as EArray, Effect, Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { getActionValidatorAddresses } from "../../../domain/action/rules";
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
  ValidatorByAddressKey,
  validatorByAddressAtom,
} from "../../../resources/validator-directory/index";
import { enrichedYieldOpportunityResourceAtom } from "../../../resources/yield-opportunity/index";
import { presentationClockAtom } from "../../../shared/effect/presentation-clock";
import {
  currentYieldActionContinuationIdAtom,
  startYieldActionContinuationAtom,
} from "../../classic-transaction-flow/index";
import {
  YieldSummaryKey,
  type YieldSummaryProvider,
  yieldSummaryAtom,
} from "../../yield-summary/index";
import type { ActivityActionItem } from "../model/activity-action";
import { activityPageViewAtom } from "./page";

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

        const yieldData = yield* context
          .result(enrichedYieldOpportunityResourceAtom.local(action.yieldId))
          .pipe(Effect.catchCause(() => Effect.succeed(null)));
        if (
          !isActivityActionOwnedByScope({
            action,
            scope: key.scope,
            yieldData,
          })
        ) {
          return null;
        }
        const validators = yield* Effect.forEach(
          getActionValidatorAddresses(action) ?? [],
          (address) =>
            context
              .result(
                validatorByAddressAtom.local(
                  new ValidatorByAddressKey({
                    address,
                    yieldId: action.yieldId,
                  })
                )
              )
              .pipe(Effect.catchCause(() => Effect.succeed(null))),
          { concurrency: 5 }
        );
        const validatorsData = EArray.flatMap(validators, (validator) =>
          validator ? [validator] : []
        );

        return {
          actionData: action,
          validatorsData,
          walletScope: key.scope,
          yieldData,
        } satisfies ActivityActionItem;
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
      readonly item: ActivityActionItem;
      readonly status: "ready";
    };

export const resolveDefaultSelectedActionId = (
  view: Atom.Type<typeof activityPageViewAtom>
): ActionId | "loading" | null => {
  if (view.status !== "ready") {
    if (view.status === "empty") return null;
    return "loading";
  }
  if (view.refreshStatus !== "fresh") return "loading";
  return view.actions[0]?.actionData.id ?? null;
};

/** URL intent wins; Default waits for a fresh feed and takes the first row. */
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

  const actionId = Schema.decodeUnknownOption(ActionId)(actionIdParam).pipe(
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
  result: Atom.Type<ReturnType<typeof activityActionDetailsAtom>>
): ActivitySelectedActionView => {
  if (
    AsyncResult.isInitial(result) ||
    (result.waiting && Option.isNone(AsyncResult.value(result)))
  ) {
    return { status: "loading" };
  }
  if (AsyncResult.isFailure(result)) {
    return { status: "failed" };
  }
  if (!result.value) {
    return { status: "unavailable" };
  }
  return { item: result.value, status: "ready" };
};

const resolveSelectedActionId = (
  key: ActivitySelectionKey,
  get: <A>(atom: Atom.Atom<A>) => A
): ActionId | "loading" | null =>
  resolveActivitySelection(key.intent, get(activityPageViewAtom));

const activitySelectedActionAtom = Atom.family((key: ActivitySelectionKey) =>
  Atom.make((context): ActivitySelectedActionView => {
    const actionId = resolveSelectedActionId(key, context);

    if (actionId === "loading") return { status: "loading" };
    if (actionId === null) return { status: "unavailable" };

    return projectDetailsResult(
      context(
        activityActionDetailsAtom(
          new ActivityDetailsKey({ actionId, scope: key.scope })
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
      readonly continuationReady: boolean;
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
      const action = item.actionData;
      const providersDetails =
        context(
          yieldSummaryAtom(
            new YieldSummaryKey({
              selectedProviderYieldId: null,
              validators: item.validatorsData,
              yield: item.yieldData,
            })
          )
        ).providers ?? [];
      const continuationActionId = context(
        currentYieldActionContinuationIdAtom
      );
      const matchingSession = continuationActionId === action.id;
      const presentationTime = context(presentationClockAtom);
      const selectedYield = item.yieldData;
      const canContinue =
        presentationTime !== null &&
        selectedYield !== null &&
        isContinuableYieldAction(action, presentationTime.now);

      return {
        canContinue: key.surface === "review" && canContinue,
        continuationReady: matchingSession,
        item,
        providersDetails,
        status: "ready",
      };
    }).pipe(Atom.withLabel("activityDetailsViewAtom"))
);

export const activityActionContinuationMountAtom = Atom.family(
  (key: ActivitySelectionKey) =>
    Atom.make((context) => {
      if (key.surface !== "review") return;

      const view = context(activityDetailsViewAtom(key));
      if (view.status !== "ready") return;
      if (!view.canContinue || view.continuationReady) return;

      const item = view.item;
      const selectedYield = item.yieldData;
      if (selectedYield === null) return;

      context.set(startYieldActionContinuationAtom, {
        action: item.actionData,
        providersDetails: view.providersDetails,
        selectedValidators: item.validatorsData,
        selectedYield,
        walletScope: item.walletScope,
      });
    }).pipe(Atom.withLabel("activityActionContinuationMountAtom"))
);

export const retryActivityActionRouteAtom = retryActivitySelectedActionAtom;
