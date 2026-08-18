import { Data, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../../app/runtime/app-runtime";
import { BorrowFeatureDisabled } from "../../../../domain/borrow/availability";
import type { MarketId } from "../../../../domain/borrow/ids";
import type { BorrowNetwork } from "../../../../domain/borrow/network";
import { widgetConfigAtom } from "../../../../features/widget-configuration/index";
import {
  sameWalletScopeOwner,
  type WalletScopeKey,
  type WalletScopeOwnerKey,
  walletScopeOwnerKey,
} from "../../../../services/wallet/wallet-scope";
import { startBorrowTransactionFlowAtom } from "../../../borrow-transaction-flow/index";
import { tokenBalancesScanAtom } from "../../../portfolio/index";
import { walletScopeAtom } from "../../../wallet/index";
import { currentBorrowPositionsAtom } from "../../positions/index";
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
  readonly owner: WalletScopeOwnerKey;
}> {}

const makeFormKey = (
  key: BorrowPositionActionRouteKey,
  scope: WalletScopeKey
) =>
  new BorrowPositionActionFormKey({
    ...key,
    owner: walletScopeOwnerKey(scope),
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
    };

type BorrowPositionActionAttemptAction =
  | { readonly _tag: "Repay"; readonly action: BorrowRepayFormAction }
  | { readonly _tag: "Withdraw"; readonly action: BorrowWithdrawFormAction };

type ActivePositionActionIntent = Readonly<{
  readonly attempt: BorrowPositionActionAttempt;
  readonly key: BorrowPositionActionFormKey | null;
  readonly owner: WalletScopeOwnerKey | null;
}>;

type ActivePositionActionIntentCommand =
  | (BorrowPositionActionAttemptAction & {
      readonly key: BorrowPositionActionFormKey;
    })
  | { readonly _tag: "Reset" };

const samePositionActionForm = (
  first: BorrowPositionActionFormKey,
  second: BorrowPositionActionFormKey
) =>
  first.actionId === second.actionId &&
  first.marketId === second.marketId &&
  first.network === second.network &&
  sameWalletScopeOwner(first.owner, second.owner);

const makeInitialPositionActionIntent = (): ActivePositionActionIntent => ({
  attempt: { _tag: "Uninitialized" },
  key: null,
  owner: null,
});

const makePositionActionIntentForOwner = (
  owner: WalletScopeOwnerKey | null
): ActivePositionActionIntent => ({
  ...makeInitialPositionActionIntent(),
  owner,
});

const activeBorrowPositionActionIntentAtom = Atom.writable<
  ActivePositionActionIntent,
  ActivePositionActionIntentCommand
>(
  (context) => {
    const scope = context.get(walletScopeAtom);
    const owner = scope ? walletScopeOwnerKey(scope) : null;
    const previous = context
      .self<ActivePositionActionIntent>()
      .pipe(Option.getOrElse(makeInitialPositionActionIntent));
    const sameOwner =
      previous.owner && owner
        ? sameWalletScopeOwner(previous.owner, owner)
        : previous.owner === owner;

    return sameOwner ? previous : makePositionActionIntentForOwner(owner);
  },
  (context, command) => {
    const scope = context.get(walletScopeAtom);
    const owner = scope ? walletScopeOwnerKey(scope) : null;
    if (command._tag === "Reset") {
      context.setSelf(makePositionActionIntentForOwner(owner));
      return;
    }

    const previous = context.get(activeBorrowPositionActionIntentAtom);
    const attempt =
      previous.key && samePositionActionForm(previous.key, command.key)
        ? previous.attempt
        : ({ _tag: "Uninitialized" } as const);

    switch (command._tag) {
      case "Repay": {
        const intent =
          attempt._tag === "Repay"
            ? attempt.intent
            : makeDefaultBorrowRepayFormIntent();
        context.setSelf({
          attempt: {
            _tag: "Repay",
            intent: applyBorrowRepayFormAction({
              action: command.action,
              intent,
            }),
          },
          key: command.key,
          owner: command.key.owner,
        });
        return;
      }
      case "Withdraw": {
        const intent =
          attempt._tag === "Withdraw"
            ? attempt.intent
            : makeDefaultBorrowWithdrawFormIntent();
        context.setSelf({
          attempt: {
            _tag: "Withdraw",
            intent: applyBorrowWithdrawFormAction({
              action: command.action,
              intent,
            }),
          },
          key: command.key,
          owner: command.key.owner,
        });
        return;
      }
    }
  }
).pipe(Atom.withLabel("activeBorrowPositionActionIntentAtom"));

export const resetBorrowMarketPositionIntentForOwnerAtom = Atom.fnSync(
  (owner: WalletScopeOwnerKey, context) => {
    const scope = context(walletScopeAtom);
    if (scope && sameWalletScopeOwner(walletScopeOwnerKey(scope), owner)) {
      context.set(activeBorrowPositionActionIntentAtom, { _tag: "Reset" });
    }
  }
).pipe(Atom.withLabel("resetBorrowMarketPositionIntentForOwnerAtom"));

const getActivePositionActionAttempt = (
  context: Atom.AtomContext,
  key: BorrowPositionActionFormKey
): BorrowPositionActionAttempt => {
  const active = context.get(activeBorrowPositionActionIntentAtom);
  if (!active.key || !samePositionActionForm(active.key, key)) {
    return { _tag: "Uninitialized" };
  }

  return active.attempt;
};

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
          context.get(activeBorrowPositionActionIntentAtom);
          return null;
        }

        const balancesResult = context.get(tokenBalancesScanAtom).result;
        const tokenBalances = balancesResult.pipe(
          AsyncResult.value,
          Option.getOrElse(() => null)
        );

        const attempt = getActivePositionActionAttempt(
          context,
          current.formKey
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
          context.set(activeBorrowPositionActionIntentAtom, {
            _tag: "Repay",
            action,
            key: current.formKey,
          });
          context.refreshSelf();
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
          context.get(activeBorrowPositionActionIntentAtom);
          return null;
        }

        const attempt = getActivePositionActionAttempt(
          context,
          current.formKey
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
          context.set(activeBorrowPositionActionIntentAtom, {
            _tag: "Withdraw",
            action,
            key: current.formKey,
          });
          context.refreshSelf();
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
