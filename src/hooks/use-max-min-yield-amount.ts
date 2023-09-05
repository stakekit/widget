import { YieldDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { getMaxAmount } from "../domain";
import { useTokenAvailableAmount } from "./api/use-token-available-amount";
import { PositionBalancesByType } from "../domain/types/positions";

export const useMaxMinYieldAmount = ({
  type,
  yieldOpportunity,
  positionBalancesByType,
}: {
  yieldOpportunity: Maybe<YieldDto>;
} & (
  | {
      type: "enter";
      positionBalancesByType?: never;
    }
  | {
      type: "exit";
      positionBalancesByType: Maybe<PositionBalancesByType>;
    }
)) => {
  const stakeTokenAvailableAmount = useTokenAvailableAmount({
    tokenDto: yieldOpportunity.map((y) => y.token),
  });

  const availableAmount = useMemo(
    () =>
      type === "enter"
        ? stakeTokenAvailableAmount.data ?? new BigNumber(0)
        : positionBalancesByType
            .chain((p) =>
              Maybe.fromNullable(p.get("staked")).altLazy(() =>
                Maybe.fromNullable(p.get("available"))
              )
            )
            .map((b) => new BigNumber(b.amount))
            .orDefault(new BigNumber(0)),
    [positionBalancesByType, stakeTokenAvailableAmount.data, type]
  );

  const minIntegrationAmount = useMemo(
    () =>
      yieldOpportunity
        .chainNullable(
          (y) =>
            (type === "enter" ? y.args.enter : y.args.exit)?.args?.amount
              ?.minimum
        )
        .mapOrDefault((a) => new BigNumber(a), new BigNumber(0)),
    [type, yieldOpportunity]
  );

  const maxIntegrationAmount = useMemo(
    () =>
      yieldOpportunity
        .chainNullable(
          (y) =>
            (type === "enter" ? y.args.enter : y.args.exit)?.args?.amount
              ?.maximum
        )
        .mapOrDefault(
          (a) => new BigNumber(a),
          new BigNumber(Number.POSITIVE_INFINITY)
        ),
    [type, yieldOpportunity]
  );

  const maxEnterOrExitAmount = useMemo(
    () =>
      getMaxAmount({
        availableAmount,
        gasEstimateTotal: new BigNumber(0),
        integrationMaxLimit: maxIntegrationAmount,
      }),
    [maxIntegrationAmount, availableAmount]
  );

  const minEnterOrExitAmount = minIntegrationAmount;

  return {
    minEnterOrExitAmount,
    maxEnterOrExitAmount,
  };
};
