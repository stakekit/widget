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
import { borrowActionFormAtom } from "./action";

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

type PositionIntentStore<A> = Readonly<{
  readonly cursor: BorrowFlowOutcomeCursor;
  readonly intent: A;
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

const borrowRepayIntentAtom = Atom.family(
  (key: BorrowPositionActionFormKey) => {
    const initial: PositionIntentStore<BorrowRepayFormIntent> = {
      cursor: initialBorrowFlowOutcomeCursor,
      intent: makeDefaultBorrowRepayFormIntent(),
    };
    const storeAtom = Atom.writable<
      PositionIntentStore<BorrowRepayFormIntent>,
      BorrowRepayFormAction
    >(
      (context) => {
        const previous = context
          .self<PositionIntentStore<BorrowRepayFormIntent>>()
          .pipe(Option.getOrElse(() => initial));
        const resolved = resolveMarketPositionOutcomeReceipt({
          cursor: previous.cursor,
          marketId: key.marketId,
          receipt: getPositionOutcomeReceipt(context),
        });
        return {
          cursor: resolved.cursor,
          intent: resolved.reset
            ? makeDefaultBorrowRepayFormIntent()
            : previous.intent,
        };
      },
      (context, action) => {
        const previous = context.get(storeAtom);
        context.setSelf({
          cursor: previous.cursor,
          intent: applyBorrowRepayFormAction({
            action,
            intent: previous.intent,
          }),
        });
      }
    );

    return Atom.writable<BorrowRepayFormIntent, BorrowRepayFormAction>(
      (context) => context.get(storeAtom).intent,
      (context, action) => context.set(storeAtom, action)
    );
  }
);

const borrowWithdrawIntentAtom = Atom.family(
  (key: BorrowPositionActionFormKey) => {
    const initial: PositionIntentStore<BorrowWithdrawFormIntent> = {
      cursor: initialBorrowFlowOutcomeCursor,
      intent: makeDefaultBorrowWithdrawFormIntent(),
    };
    const storeAtom = Atom.writable<
      PositionIntentStore<BorrowWithdrawFormIntent>,
      BorrowWithdrawFormAction
    >(
      (context) => {
        const previous = context
          .self<PositionIntentStore<BorrowWithdrawFormIntent>>()
          .pipe(Option.getOrElse(() => initial));
        const resolved = resolveMarketPositionOutcomeReceipt({
          cursor: previous.cursor,
          marketId: key.marketId,
          receipt: getPositionOutcomeReceipt(context),
        });
        return {
          cursor: resolved.cursor,
          intent: resolved.reset
            ? makeDefaultBorrowWithdrawFormIntent()
            : previous.intent,
        };
      },
      (context, action) => {
        const previous = context.get(storeAtom);
        context.setSelf({
          cursor: previous.cursor,
          intent: applyBorrowWithdrawFormAction({
            action,
            intent: previous.intent,
          }),
        });
      }
    );

    return Atom.writable<BorrowWithdrawFormIntent, BorrowWithdrawFormAction>(
      (context) => context.get(storeAtom).intent,
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

        return resolveBorrowRepayFormView({
          address: current.scope.address,
          context: current.action.pendingContext,
          intent: context.get(borrowRepayIntentAtom(current.formKey)),
          tokenBalances,
        });
      },
      (context, action) => {
        const current = getCurrentPositionAction(
          (atom) => context.get(atom),
          key
        );
        if (current?.action.pendingContext.type === "repay") {
          context.set(borrowRepayIntentAtom(current.formKey), action);
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

        return resolveBorrowWithdrawFormView({
          address: current.scope.address,
          context: current.action.pendingContext,
          intent: context.get(borrowWithdrawIntentAtom(current.formKey)),
        });
      },
      (context, action) => {
        const current = getCurrentPositionAction(
          (atom) => context.get(atom),
          key
        );
        if (current?.action.pendingContext.type === "withdraw") {
          context.set(borrowWithdrawIntentAtom(current.formKey), action);
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

const resetPositionActionIntents = (
  context: Atom.FnContext,
  key: BorrowPositionActionRouteKey,
  scope: WalletScopeKey
) => {
  const formKey = makeFormKey(key, scope);
  context.set(borrowRepayIntentAtom(formKey), { type: "reset" });
  context.set(borrowWithdrawIntentAtom(formKey), { type: "reset" });
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
    resetPositionActionIntents(context, key, scope);
    context.set(borrowActionFormAtom, {
      ...key,
      scope,
      type: "preparePositionAction",
    });
  }
).pipe(Atom.withLabel("stageBorrowPositionActionAtom"));
