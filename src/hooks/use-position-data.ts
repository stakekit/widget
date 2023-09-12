import { useMemo } from "react";
import { usePositionsData } from "./use-positions-data";
import { Maybe } from "purify-ts";

export const usePositionData = (id?: string) => {
  const { data, isLoading } = usePositionsData();

  const val = useMemo(
    () =>
      Maybe.fromNullable(id).chain((id) => Maybe.fromNullable(data.get(id))),
    [id, data]
  );

  return { position: val, isLoading };
};
