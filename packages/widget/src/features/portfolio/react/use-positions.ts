import { useAtomValue } from "@effect/atom-react";
import { useSKWallet } from "../../wallet/index";
import {
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
    listData: ["header" as const, ...positions],
    positions,
    positionsView,
    // A refetch or a failed refetch keeps shown positions on screen.
    showPositions: isConnected && positionsView._tag === "Ready",
  };
};

export const usePortfolioPendingActionsCount = () => {
  const { positions } = usePositions();

  return positions.reduce(
    (count, position) =>
      position.hasPendingClaimRewards || position.actionRequired
        ? count + 1
        : count,
    0
  );
};
