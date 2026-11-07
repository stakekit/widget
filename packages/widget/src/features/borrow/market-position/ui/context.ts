import { useOutletContext } from "react-router";
import type { BorrowPositionAction } from "../model/details";

/**
 * The amount action the position's page has chosen, and a request to focus
 * its amount: each new value above zero asks for it, as the risk alert's
 * Repay does. Choosing an action's button leaves it at zero.
 */
export type BorrowPositionActionSelection = {
  readonly actionId: string | null;
  readonly focusRequest: number;
};

export type BorrowPositionContext = {
  readonly actions: BorrowPositionAction[];
  readonly selection: BorrowPositionActionSelection;
  readonly onSelectAction: (actionId: string) => void;
};

export const useBorrowPositionContext = () =>
  useOutletContext<BorrowPositionContext>();
