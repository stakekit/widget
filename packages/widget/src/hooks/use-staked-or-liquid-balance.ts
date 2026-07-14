import { useMemo } from "react";
import type { PositionBalancesByType } from "../domain/types/positions";

export const useStakedOrLiquidBalance = (
  positionBalancesByType: PositionBalancesByType | null
) => {
  return useMemo(
    () => positionBalancesByType?.get("active") ?? null,
    [positionBalancesByType]
  );
};
