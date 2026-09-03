import { useAtom } from "@effect/atom-react";
import type { BorrowPositionAction } from "../model/details";
import {
  borrowRepayFormAtom,
  borrowWithdrawFormAtom,
  makeBorrowPositionActionRouteKey,
} from "../state/action-form";

export const useBorrowRepayForm = (action: BorrowPositionAction) =>
  useAtom(borrowRepayFormAtom(makeBorrowPositionActionRouteKey(action)));

export const useBorrowWithdrawForm = (action: BorrowPositionAction) =>
  useAtom(borrowWithdrawFormAtom(makeBorrowPositionActionRouteKey(action)));
