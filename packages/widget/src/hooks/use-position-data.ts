import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { usePositionsData } from "./use-positions-data";

export const usePositionData = ({
  integrationId,
}: {
  integrationId: string | undefined;
}) => {
  const { data, ...rest } = usePositionsData();

  const val = useMemo(
    () =>
      Maybe.fromRecord({
        id: Maybe.fromNullable(integrationId),
        data: Maybe.fromNullable(data),
      }).chainNullable((val) => val.data.get(val.id)),
    [integrationId, data]
  );

  return { data: val, ...rest };
};
