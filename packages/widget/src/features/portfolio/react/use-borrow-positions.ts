import { useAtomValue } from "@effect/atom-react";
import { currentPortfolioBorrowPositionsAtom } from "../resources/positions";

export const usePortfolioBorrowPositions = () =>
  useAtomValue(currentPortfolioBorrowPositionsAtom);
