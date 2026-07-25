import { Data } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { BorrowNetwork } from "../../../domain/borrow/network";
import {
  type BorrowTransactionFlowReview,
  startBorrowTransactionFlowAtom,
} from "../../borrow-transaction-flow/state";
import {
  applyBorrowRepayFormAction,
  applyBorrowWithdrawFormAction,
  type BorrowRepayFormAction,
  type BorrowRepayFormIntent,
  type BorrowWithdrawFormAction,
  type BorrowWithdrawFormIntent,
  makeDefaultBorrowRepayFormIntent,
  makeDefaultBorrowWithdrawFormIntent,
} from "../model/position-action-form";
import type { BorrowPositionAction } from "../model/position-details-model";
import { borrowActionFormAtom } from "./action-form";

/**
 * Identifies one position action form. Wallet owner and network are part of the
 * identity so a form staged for one Wallet Scope is never reused for another.
 */
class BorrowPositionActionFormKey extends Data.Class<{
  readonly actionId: string;
  readonly marketId: string;
  readonly network: BorrowNetwork;
  readonly owner: string;
}> {}

export const makeBorrowPositionActionFormKey = (action: BorrowPositionAction) =>
  new BorrowPositionActionFormKey({
    actionId: action.id,
    marketId: action.reviewState.request.args.marketId,
    network: action.reviewState.summary.network,
    owner: action.reviewState.request.address.toLowerCase(),
  });

export const borrowRepayFormAtom = Atom.family(
  (_key: BorrowPositionActionFormKey) => {
    const intentAtom = Atom.make<BorrowRepayFormIntent>(
      makeDefaultBorrowRepayFormIntent()
    );

    return Atom.writable<BorrowRepayFormIntent, BorrowRepayFormAction>(
      (context) => context.get(intentAtom),
      (context, action) =>
        context.set(
          intentAtom,
          applyBorrowRepayFormAction({
            action,
            intent: context.get(intentAtom),
          })
        )
    );
  }
);

export const borrowWithdrawFormAtom = Atom.family(
  (_key: BorrowPositionActionFormKey) => {
    const intentAtom = Atom.make<BorrowWithdrawFormIntent>(
      makeDefaultBorrowWithdrawFormIntent()
    );

    return Atom.writable<BorrowWithdrawFormIntent, BorrowWithdrawFormAction>(
      (context) => context.get(intentAtom),
      (context, action) =>
        context.set(
          intentAtom,
          applyBorrowWithdrawFormAction({
            action,
            intent: context.get(intentAtom),
          })
        )
    );
  }
);

export const startBorrowPositionActionReviewAtom = Atom.fnSync(
  (reviewState: BorrowTransactionFlowReview, context) => {
    context.set(borrowActionFormAtom, {
      reviewState,
      type: "prepareReview",
    });
    context.set(startBorrowTransactionFlowAtom, {
      ...reviewState,
      entry: {
        _tag: "BorrowPosition",
        marketId: reviewState.request.args.marketId,
      },
    });
  }
).pipe(Atom.withLabel("startBorrowPositionActionReviewAtom"));

/**
 * Opens a position action from the actions list: the staged form starts from a
 * clean intent, so a previously abandoned amount never reappears.
 */
export const stageBorrowPositionActionAtom = Atom.fnSync(
  (action: BorrowPositionAction, context) => {
    const key = makeBorrowPositionActionFormKey(action);

    context.set(borrowRepayFormAtom(key), { type: "reset" });
    context.set(borrowWithdrawFormAtom(key), { type: "reset" });
    context.set(borrowActionFormAtom, {
      context: action.pendingContext,
      type: "preparePositionAction",
    });
  }
).pipe(Atom.withLabel("stageBorrowPositionActionAtom"));
