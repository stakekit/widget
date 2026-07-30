import { useOutletContext } from "react-router";
import type { MarketPosition } from "../../../../domain/borrow/positions/market-position";
import type { useBorrowPosition } from "../../positions/react/use-borrow-positions";
import type {
  BorrowPositionAction,
  getBorrowPositionDetailsModel,
} from "../model/details";

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
