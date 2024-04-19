import type { YieldDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { getMaxAmount } from "../domain";
import { useTokenAvailableAmount } from "./api/use-token-available-amount";
import type { PositionBalancesByType } from "../domain/types/positions";
import { useForceMaxAmount } from "./use-force-max-amount";

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
      (type === "enter"
        ? Maybe.fromNullable(stakeTokenAvailableAmount.data)
        : positionBalancesByType
            .chain((p) =>
              Maybe.fromNullable(p.get("staked")).altLazy(() =>
                Maybe.fromNullable(p.get("available"))
              )
            )
            .map((b) =>
              b.reduce((acc, val) => acc.plus(val.amount), new BigNumber(0))
            )
            .map((b) => new BigNumber(b))
      ).alt(Maybe.of(new BigNumber(0))),
    [positionBalancesByType, stakeTokenAvailableAmount.data, type]
  );

  const forceMax = useForceMaxAmount({
    type,
    integration: yieldOpportunity,
  });

  const minIntegrationAmount = useMemo(() => {
    return (
      forceMax
        ? availableAmount
        : yieldOpportunity
            .chainNullable(
              (y) =>
                (type === "enter" ? y.args.enter : y.args.exit)?.args?.amount
                  ?.minimum
            )
            .map((a) => new BigNumber(a))
    ).orDefault(new BigNumber(0));
  }, [availableAmount, forceMax, type, yieldOpportunity]);

  const maxIntegrationAmount = useMemo(() => {
    return (
      forceMax
        ? availableAmount
        : yieldOpportunity
            .chainNullable(
              (y) =>
                (type === "enter" ? y.args.enter : y.args.exit)?.args?.amount
                  ?.maximum
            )
            .map((a) => new BigNumber(a))
    ).orDefault(new BigNumber(Number.POSITIVE_INFINITY));
  }, [availableAmount, forceMax, type, yieldOpportunity]);

  const maxEnterOrExitAmount = useMemo(
    () =>
      getMaxAmount({
        availableAmount: availableAmount.orDefault(new BigNumber(0)),
        gasEstimateTotal: new BigNumber(0),
        integrationMaxLimit: maxIntegrationAmount,
      }),
    [maxIntegrationAmount, availableAmount]
  );

  const minEnterOrExitAmount = minIntegrationAmount;

  return useMemo(
    () => ({
      minEnterOrExitAmount,
      maxEnterOrExitAmount,
    }),
    [maxEnterOrExitAmount, minEnterOrExitAmount]
  );
};
