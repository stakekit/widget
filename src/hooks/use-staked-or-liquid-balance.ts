import { useMemo } from "react";
import { Maybe } from "purify-ts";
import { PositionBalancesByType } from "../domain/types/positions";

export const useStakedOrLiquidBalance = (
  positionBalancesByType: Maybe<PositionBalancesByType>
) => {
  return useMemo(
    () =>
      positionBalancesByType.chain((pbbt) =>
        Maybe.fromNullable(pbbt.get("staked"))
          .altLazy(() => Maybe.fromNullable(pbbt.get("available")))
          .altLazy(() => Maybe.fromNullable(pbbt.get("rewards")))
      ),
    [positionBalancesByType]
  );
};
