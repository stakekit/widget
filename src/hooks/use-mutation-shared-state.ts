import {
  MutationKey,
  MutationState,
  useMutationState,
} from "@tanstack/react-query";
import { List } from "purify-ts";
import { useMemo } from "react";

export const useMutationSharedState = <TData>({
  mutationKey,
}: {
  mutationKey: MutationKey;
}): MutationState<TData> | undefined => {
  const mutationState = useMutationState({
    filters: { mutationKey, exact: true },
    select: (mutation) => mutation.state as MutationState<TData>,
  });

  return useMemo(() => List.last(mutationState).extract(), [mutationState]);
};
