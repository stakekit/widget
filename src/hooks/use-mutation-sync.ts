import {
  DefaultError,
  QueryClient,
  UseMutationOptions,
  UseMutationResult,
  useMutation,
} from "@tanstack/react-query";
import { DependencyList } from "react";
import { useUpdateEffect } from "./use-update-effect";
import { useSavedRef } from "./use-saved-ref";

export const useMutationSync = <
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext> & {
    syncOn?: DependencyList;
  },
  queryClient?: QueryClient
): UseMutationResult<TData, TError, TVariables, TContext> => {
  const mutationState = useMutation(options, queryClient);

  const mutationStateRef = useSavedRef(mutationState);

  useUpdateEffect(() => {
    if (
      mutationStateRef.current.status === "error" ||
      mutationStateRef.current.status === "success"
    ) {
      mutationState.reset();
    }
  }, options.syncOn ?? []);

  return mutationState;
};
