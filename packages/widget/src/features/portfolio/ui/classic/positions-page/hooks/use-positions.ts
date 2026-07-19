import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useSKWallet } from "../../../../../wallet/react/use-wallet";
import {
  type PositionItem,
  positionsTableDataAtom,
} from "../../../../resources/positions";

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
