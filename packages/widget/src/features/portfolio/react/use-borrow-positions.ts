import { useAtomValue } from "@effect/atom-react";
import { currentPortfolioBorrowPositionsAtom } from "../state/read-models/positions";

export const usePortfolioBorrowPositions = () =>
  useAtomValue(currentPortfolioBorrowPositionsAtom);
