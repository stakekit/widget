import { useOutletContext } from "react-router";
import type { MarketPosition } from "../../../../domain/borrow/market-position";
import type {
  BorrowPositionAction,
  getBorrowPositionDetailsModel,
} from "../../model/position-details-model";
import type { useBorrowPosition } from "../../react/use-borrow-positions";

export type BorrowPositionContext = {
  readonly actions: BorrowPositionAction[];
  readonly borrowPosition: ReturnType<typeof useBorrowPosition>;
  readonly model: ReturnType<typeof getBorrowPositionDetailsModel> | null;
  readonly position: MarketPosition | null;
};

export const useBorrowPositionContext = () =>
  useOutletContext<BorrowPositionContext>();

export const getBorrowPositionBasePath = (marketId: string | undefined) =>
  marketId ? `/positions/borrow/${marketId}` : "/positions";
