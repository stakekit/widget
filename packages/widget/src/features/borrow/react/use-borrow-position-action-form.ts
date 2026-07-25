import { useAtom } from "@effect/atom-react";
import { useTokenBalancesScan } from "../../portfolio/state";
import type {
  BorrowRepayActionContext,
  BorrowWithdrawActionContext,
} from "../model/position-action-context";
import {
  resolveBorrowRepayFormView,
  resolveBorrowWithdrawFormView,
} from "../model/position-action-form";
import type { BorrowPositionAction } from "../model/position-details-model";
import {
  borrowRepayFormAtom,
  borrowWithdrawFormAtom,
  makeBorrowPositionActionFormKey,
} from "../state/position-action-form";

export const useBorrowRepayForm = ({
  action,
  context,
}: {
  readonly action: BorrowPositionAction;
  readonly context: BorrowRepayActionContext;
}) => {
  const [intent, dispatch] = useAtom(
    borrowRepayFormAtom(makeBorrowPositionActionFormKey(action))
  );
  const tokenBalances = useTokenBalancesScan();

  return [
    resolveBorrowRepayFormView({
      address: action.reviewState.request.address,
      context,
      intent,
      tokenBalances: tokenBalances.data ?? null,
    }),
    dispatch,
  ] as const;
};

export const useBorrowWithdrawForm = ({
  action,
  context,
}: {
  readonly action: BorrowPositionAction;
  readonly context: BorrowWithdrawActionContext;
}) => {
  const [intent, dispatch] = useAtom(
    borrowWithdrawFormAtom(makeBorrowPositionActionFormKey(action))
  );

  return [
    resolveBorrowWithdrawFormView({
      address: action.reviewState.request.address,
      context,
      intent,
    }),
    dispatch,
  ] as const;
};
