import { useOutletContext } from "react-router";
import type { MarketPosition } from "../../../../domain/borrow/positions/market-position";
import type { useBorrowPosition } from "../../positions/index";
import type {
  BorrowPositionAction,
  getBorrowPositionDetailsModel,
} from "../model/details";

/**
 * The action tab the position's page shows, and a request to focus its
 * amount: each new value above zero asks for it, as the risk alert's Repay
 * does. Choosing a tab leaves it at zero.
 */
export type BorrowPositionActionSelection = {
  readonly actionId: string | null;
  readonly focusRequest: number;
};

export type BorrowPositionContext = {
  readonly actions: BorrowPositionAction[];
  readonly borrowPosition: ReturnType<typeof useBorrowPosition>;
  readonly model: ReturnType<typeof getBorrowPositionDetailsModel> | null;
  readonly position: MarketPosition | null;
  readonly selection: BorrowPositionActionSelection;
  readonly onSelectAction: (actionId: string) => void;
};

export const useBorrowPositionContext = () =>
  useOutletContext<BorrowPositionContext>();
