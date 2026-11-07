import { useAtomValue } from "@effect/atom-react";

import { useSKWallet } from "../../wallet/index";
import {
  currentPortfolioBorrowPositionsAtom,
  isBorrowPositionAtRisk,
  type PositionItem,
  positionsViewAtom,
} from "../state/read-models/positions";

const noPositions: ReadonlyArray<PositionItem> = [];

export const usePositions = () => {
  const positionsView = useAtomValue(positionsViewAtom);
  const positions =
    positionsView._tag === "Ready" ? positionsView.value : noPositions;
  const isConnected = useSKWallet()?.status === "connected";

  return {
    positions,
    positionsView,
    // A refetch or a failed refetch keeps shown positions on screen.
    showPositions: isConnected && positionsView._tag === "Ready",
  };
};

/**
 * How many positions ask for the user's attention: Earn positions with an
 * action or rewards to claim, and borrow positions in the caution or danger
 * risk band.
 */
export const usePortfolioPendingActionsCount = () => {
  const { positions } = usePositions();
  const borrowPositions = useAtomValue(
    currentPortfolioBorrowPositionsAtom
  ).positions;
  const earnCount = positions.filter(
    (position) =>
      position.hasPendingClaimRewards || position.requiredAction !== null
  ).length;
  const borrowCount =
    borrowPositions._tag === "Ready"
      ? borrowPositions.value.filter(isBorrowPositionAtRisk).length
      : 0;

  return earnCount + borrowCount;
};
