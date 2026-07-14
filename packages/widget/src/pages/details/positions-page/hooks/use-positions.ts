import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  type PositionItem,
  positionsTableDataAtom,
} from "../../../../hooks/api/position-atoms";
import { useSKWallet } from "../../../../providers/wallet/react/use-wallet";

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
