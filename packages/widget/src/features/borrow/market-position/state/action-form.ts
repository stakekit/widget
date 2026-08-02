import { Data, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../../app/config/settings";
import { appRuntime } from "../../../../app/runtime/app-runtime";
import { BorrowFeatureDisabled } from "../../../../domain/borrow/availability";
import type { MarketId } from "../../../../domain/borrow/ids";
import type { BorrowNetwork } from "../../../../domain/borrow/network";
import type { WalletScopeKey } from "../../../../services/wallet/domain/scope";
import {
  borrowTransactionFlowOutcomeAtom,
  startBorrowTransactionFlowAtom,
} from "../../../borrow-transaction-flow/state";
import { tokenBalancesScanAtom } from "../../../portfolio/state";
import { walletScopeAtom } from "../../../wallet/state";
import {
  type BorrowFlowOutcomeCursor,
  initialBorrowFlowOutcomeCursor,
  resolveMarketPositionOutcomeReceipt,
} from "../../model/flow-outcome";
import { currentBorrowPositionsAtom } from "../../positions/state/positions";
import {
  applyBorrowRepayFormAction,
  applyBorrowWithdrawFormAction,
  type BorrowCollateralToggleFormView,
  type BorrowRepayFormAction,
  type BorrowRepayFormIntent,
  type BorrowRepayFormView,
  type BorrowWithdrawFormAction,
  type BorrowWithdrawFormIntent,
  type BorrowWithdrawFormView,
  makeDefaultBorrowRepayFormIntent,
  makeDefaultBorrowWithdrawFormIntent,
  resolveBorrowCollateralToggleFormView,
  resolveBorrowRepayFormView,
  resolveBorrowWithdrawFormView,
} from "../model/action-form";
import {
  type BorrowPositionAction,
  getBorrowPositionActionDescriptors,
} from "../model/details";

class BorrowPositionActionRouteKey extends Data.Class<{
  readonly actionId: string;
  readonly marketId: MarketId;
  readonly network: BorrowNetwork;
}> {}

export const makeBorrowPositionActionRouteKey = (
  action: BorrowPositionAction
) =>
  new BorrowPositionActionRouteKey({
    actionId: action.id,
    marketId: action.pendingContext.position.market.id,
    network: action.pendingContext.position.market.network,
  });

class BorrowPositionActionFormKey extends Data.Class<{
  readonly actionId: string;
  readonly marketId: MarketId;
  readonly network: BorrowNetwork;
  readonly owner: string;
}> {}

const makeFormKey = (
  key: BorrowPositionActionRouteKey,
  scope: WalletScopeKey
) =>
  new BorrowPositionActionFormKey({
    ...key,
    owner: scope.address.toLowerCase(),
  });

type BorrowPositionActionAttempt =
  | { readonly _tag: "Uninitialized" }
  | {
      readonly _tag: "Repay";
      readonly intent: BorrowRepayFormIntent;
    }
  | {
      readonly _tag: "Withdraw";
      readonly intent: BorrowWithdrawFormIntent;
    }
  | { readonly _tag: "CollateralToggle" };

type BorrowPositionActionAttemptAction =
  | {
      readonly _tag: "Start";
      readonly actionType:
        | "repay"
        | "withdraw"
        | "disableCollateral"
        | "enableCollateral";
    }
  | { readonly _tag: "Repay"; readonly action: BorrowRepayFormAction }
  | { readonly _tag: "Withdraw"; readonly action: BorrowWithdrawFormAction };

const initializeBorrowPositionActionAttempt = (
  actionType: Extract<
    BorrowPositionActionAttemptAction,
    { readonly _tag: "Start" }
  >["actionType"]
): BorrowPositionActionAttempt => {
  switch (actionType) {
    case "repay":
      return {
        _tag: "Repay",
        intent: makeDefaultBorrowRepayFormIntent(),
      };
    case "withdraw":
      return {
        _tag: "Withdraw",
        intent: makeDefaultBorrowWithdrawFormIntent(),
      };
    case "disableCollateral":
    case "enableCollateral":
      return { _tag: "CollateralToggle" };
  }
};

type PositionActionAttemptStore = Readonly<{
  readonly cursor: BorrowFlowOutcomeCursor;
  readonly attempt: BorrowPositionActionAttempt;
}>;

const getPositionOutcomeReceipt = (context: Atom.AtomContext) =>
  context.get(borrowTransactionFlowOutcomeAtom).pipe(
    Option.map((outcome) => ({
      entry: outcome.entry,
      epoch: outcome.epoch,
      phase: outcome._tag,
    })),
    Option.getOrNull
  );

const borrowPositionActionAttemptAtom = Atom.family(
  (key: BorrowPositionActionFormKey) => {
    const initial: PositionActionAttemptStore = {
      cursor: initialBorrowFlowOutcomeCursor,
      attempt: { _tag: "Uninitialized" },
    };
    const storeAtom = Atom.writable<
      PositionActionAttemptStore,
      BorrowPositionActionAttemptAction
    >(
      (context) => {
        const previous = context
          .self<PositionActionAttemptStore>()
          .pipe(Option.getOrElse(() => initial));
        const resolved = resolveMarketPositionOutcomeReceipt({
          cursor: previous.cursor,
          marketId: key.marketId,
          receipt: getPositionOutcomeReceipt(context),
        });
        return {
          cursor: resolved.cursor,
          attempt: resolved.reset
            ? ({ _tag: "Uninitialized" } as const)
            : previous.attempt,
        };
      },
      (context, action) => {
        const previous = context.get(storeAtom);
        switch (action._tag) {
          case "Start": {
            context.setSelf({
              cursor: previous.cursor,
              attempt: initializeBorrowPositionActionAttempt(action.actionType),
            });
            return;
          }
          case "Repay": {
            const intent =
              previous.attempt._tag === "Repay"
                ? previous.attempt.intent
                : makeDefaultBorrowRepayFormIntent();
            context.setSelf({
              cursor: previous.cursor,
              attempt: {
                _tag: "Repay",
                intent: applyBorrowRepayFormAction({
                  action: action.action,
                  intent,
                }),
              },
            });
            return;
          }
          case "Withdraw": {
            const intent =
              previous.attempt._tag === "Withdraw"
                ? previous.attempt.intent
                : makeDefaultBorrowWithdrawFormIntent();
            context.setSelf({
              cursor: previous.cursor,
              attempt: {
                _tag: "Withdraw",
                intent: applyBorrowWithdrawFormAction({
                  action: action.action,
                  intent,
                }),
              },
            });
            return;
          }
        }
      }
    );

    return Atom.writable<
      BorrowPositionActionAttempt,
      BorrowPositionActionAttemptAction
    >(
      (context) => context.get(storeAtom).attempt,
      (context, action) => context.set(storeAtom, action)
    );
  }
);

type ReadAtom = <A>(atom: Atom.Atom<A>) => A;

const getCurrentPositionAction = (
  get: ReadAtom,
  key: BorrowPositionActionRouteKey
) => {
  const scope = get(walletScopeAtom);
  if (!scope || scope.network !== key.network) {
    return null;
  }

  const positions = get(currentBorrowPositionsAtom).pipe(
    AsyncResult.value,
    Option.getOrElse(() => [])
  );
  const position =
    positions.find((candidate) => candidate.id === key.marketId) ?? null;
  if (!position) {
    return null;
  }

  const action =
    getBorrowPositionActionDescriptors(position).find(
      (candidate) => candidate.id === key.actionId
    ) ?? null;
  if (!action) {
    return null;
  }

  return {
    action,
    formKey: makeFormKey(key, scope),
    scope,
  };
};

export const borrowRepayFormAtom = Atom.family(
  (key: BorrowPositionActionRouteKey) =>
    Atom.writable<BorrowRepayFormView | null, BorrowRepayFormAction>(
      (context) => {
        const current = getCurrentPositionAction(context, key);
        if (current?.action.pendingContext.type !== "repay") {
          return null;
        }

        const balancesResult = context.get(tokenBalancesScanAtom).result;
        const tokenBalances = balancesResult.pipe(
          AsyncResult.value,
          Option.getOrElse(() => null)
        );

        const attempt = context.get(
          borrowPositionActionAttemptAtom(current.formKey)
        );
        return resolveBorrowRepayFormView({
          address: current.scope.address,
          context: current.action.pendingContext,
          intent:
            attempt._tag === "Repay"
              ? attempt.intent
              : makeDefaultBorrowRepayFormIntent(),
          tokenBalances,
        });
      },
      (context, action) => {
        const current = getCurrentPositionAction(
          (atom) => context.get(atom),
          key
        );
        if (current?.action.pendingContext.type === "repay") {
          context.set(borrowPositionActionAttemptAtom(current.formKey), {
            _tag: "Repay",
            action,
          });
        }
      }
    ).pipe(Atom.withLabel("borrowRepayFormAtom"))
);

export const borrowWithdrawFormAtom = Atom.family(
  (key: BorrowPositionActionRouteKey) =>
    Atom.writable<BorrowWithdrawFormView | null, BorrowWithdrawFormAction>(
      (context) => {
        const current = getCurrentPositionAction(context, key);
        if (current?.action.pendingContext.type !== "withdraw") {
          return null;
        }

        const attempt = context.get(
          borrowPositionActionAttemptAtom(current.formKey)
        );
        return resolveBorrowWithdrawFormView({
          address: current.scope.address,
          context: current.action.pendingContext,
          intent:
            attempt._tag === "Withdraw"
              ? attempt.intent
              : makeDefaultBorrowWithdrawFormIntent(),
        });
      },
      (context, action) => {
        const current = getCurrentPositionAction(
          (atom) => context.get(atom),
          key
        );
        if (current?.action.pendingContext.type === "withdraw") {
          context.set(borrowPositionActionAttemptAtom(current.formKey), {
            _tag: "Withdraw",
            action,
          });
        }
      }
    ).pipe(Atom.withLabel("borrowWithdrawFormAtom"))
);

export const borrowCollateralToggleFormAtom = Atom.family(
  (key: BorrowPositionActionRouteKey) =>
    Atom.make<BorrowCollateralToggleFormView | null>((get) => {
      const current = getCurrentPositionAction(get, key);
      if (
        !current ||
        (current.action.pendingContext.type !== "disableCollateral" &&
          current.action.pendingContext.type !== "enableCollateral")
      ) {
        return null;
      }

      return resolveBorrowCollateralToggleFormView({
        address: current.scope.address,
        context: current.action.pendingContext,
      });
    }).pipe(Atom.withLabel("borrowCollateralToggleFormAtom"))
);

const getCurrentPreparation = (
  context: Atom.FnContext,
  key: BorrowPositionActionRouteKey
) => {
  const current = getCurrentPositionAction(context, key);
  if (!current) {
    return null;
  }

  switch (current.action.pendingContext.type) {
    case "repay":
      return context(borrowRepayFormAtom(key))?.preparation ?? null;
    case "withdraw":
      return context(borrowWithdrawFormAtom(key))?.preparation ?? null;
    case "disableCollateral":
    case "enableCollateral":
      return context(borrowCollateralToggleFormAtom(key))?.preparation ?? null;
  }
};

export const startBorrowPositionActionReviewAtom = appRuntime
  .fn((key: BorrowPositionActionRouteKey, context) =>
    Effect.gen(function* () {
      if (!context(widgetConfigAtom).borrowEnabled) {
        return yield* new BorrowFeatureDisabled({
          message: "Borrow is disabled by Widget configuration.",
        });
      }

      const preparation = getCurrentPreparation(context, key);
      const scope = context(walletScopeAtom);
      if (preparation?._tag !== "Ready" || !scope) {
        return { _tag: "Unavailable" } as const;
      }

      const entry = {
        _tag: "MarketPosition" as const,
        marketId: preparation.review.command.args.marketId,
      };
      return yield* context.setResult(startBorrowTransactionFlowAtom, {
        ...preparation.review,
        entry,
      });
    })
  )
  .pipe(Atom.withLabel("startBorrowPositionActionReviewAtom"));

/**
 * Opens a position action from the actions list: the staged semantic identity
 * starts with clean intent, while preparation resolves the current Position.
 */
export const stageBorrowPositionActionAtom = Atom.fnSync(
  (action: BorrowPositionAction, context) => {
    if (!context(widgetConfigAtom).borrowEnabled) {
      return new BorrowFeatureDisabled({
        message: "Borrow is disabled by Widget configuration.",
      });
    }

    const scope = context(walletScopeAtom);
    if (!scope) {
      return null;
    }

    const key = makeBorrowPositionActionRouteKey(action);
    context.set(borrowPositionActionAttemptAtom(makeFormKey(key, scope)), {
      _tag: "Start",
      actionType: action.pendingContext.type,
    });
  }
).pipe(Atom.withLabel("stageBorrowPositionActionAtom"));
