import { useOutletContext } from "react-router";
import type { Position } from "../../../../domain/borrow/position";
import type {
  BorrowPositionAction,
  getBorrowPositionDetailsModel,
} from "../../model/position-details-model";
import type { useBorrowPosition } from "../../react/use-borrow-positions";

export type BorrowPositionContext = {
  readonly actions: BorrowPositionAction[];
  readonly borrowPosition: ReturnType<typeof useBorrowPosition>;
  readonly model: ReturnType<typeof getBorrowPositionDetailsModel> | null;
  readonly position: Position | null;
};

export const useBorrowPositionContext = () =>
  useOutletContext<BorrowPositionContext>();

export const getBorrowPositionBasePath = (marketId: string | undefined) =>
  marketId ? `/positions/borrow/${marketId}` : "/positions";
