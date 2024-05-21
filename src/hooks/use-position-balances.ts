import { Maybe } from "purify-ts";
import { useMemo } from "react";
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
        balanceId: Maybe.fromNullable(balanceId),
      }).chainNullable((val) =>
        val.positionData.balanceData.get(val.balanceId)
      ),
    [balanceId, data]
  );

  return { data: value, ...rest };
};
