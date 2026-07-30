import { useAtom, useAtomValue } from "@effect/atom-react";
import type { BorrowPositionAction } from "../model/position-details-model";
import {
  borrowCollateralToggleFormAtom,
  borrowRepayFormAtom,
  borrowWithdrawFormAtom,
  makeBorrowPositionActionRouteKey,
} from "../state/position-action-form";

export const useBorrowRepayForm = (action: BorrowPositionAction) =>
  useAtom(borrowRepayFormAtom(makeBorrowPositionActionRouteKey(action)));

export const useBorrowWithdrawForm = (action: BorrowPositionAction) =>
  useAtom(borrowWithdrawFormAtom(makeBorrowPositionActionRouteKey(action)));

export const useBorrowCollateralToggleForm = (action: BorrowPositionAction) =>
  useAtomValue(
    borrowCollateralToggleFormAtom(makeBorrowPositionActionRouteKey(action))
  );
