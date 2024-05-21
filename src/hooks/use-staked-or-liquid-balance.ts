import { Maybe } from "purify-ts";
import { useMemo } from "react";
import type { PositionBalancesByType } from "../domain/types/positions";

export const useStakedOrLiquidBalance = (
  positionBalancesByType: Maybe<PositionBalancesByType>
) => {
  return useMemo(
    () =>
      positionBalancesByType.chain((pbbt) =>
        Maybe.fromNullable(pbbt.get("staked")).altLazy(() =>
          Maybe.fromNullable(pbbt.get("available"))
        )
      ),
    [positionBalancesByType]
  );
};
