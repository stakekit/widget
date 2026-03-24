import { Maybe } from "purify-ts";
import { useMemo } from "react";
import type { BalanceDataKey } from "../domain/types/positions";
import { usePositionData } from "./use-position-data";

export const usePositionBalances = ({
  balanceId,
  integrationId,
}: {
  integrationId: string | undefined;
  balanceId: string | undefined;
}) => {
  const { data, ...rest } = usePositionData({ integrationId });

  const value = useMemo(
    () =>
      Maybe.fromRecord({
        positionData: data,
        balanceId: Maybe.fromNullable(balanceId as BalanceDataKey),
      }).chainNullable((val) => {
        const balanceData =
          val.positionData.balanceData.get(val.balanceId) ??
          val.positionData.balanceData.values().next().value;

        if (!balanceData) {
          return undefined;
        }

        return {
          ...balanceData,
          rewardRate: val.positionData.rewardRate,
        };
      }),
    [balanceId, data]
  );

  return { data: value, ...rest };
};
