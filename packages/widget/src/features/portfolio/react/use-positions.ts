import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useSKWallet } from "../../wallet/index";
import {
  type PositionItem,
  positionsTableDataAtom,
} from "../state/read-models/positions";

export const usePositions = () => {
  const positionsResult = useAtomValue(positionsTableDataAtom);
  const positions = AsyncResult.getOrElse(
    positionsResult,
    (): PositionItem[] => []
  );
  const { isConnected } = useSKWallet();
  const showPositions =
    isConnected &&
    (positions.length > 0 ||
      (!positionsResult.waiting && !AsyncResult.isFailure(positionsResult)));

  return {
    listData: ["header" as const, ...positions],
    positions,
    positionsResult,
    showPositions,
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
