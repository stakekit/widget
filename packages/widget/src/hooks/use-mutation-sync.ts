import type {
  DefaultError,
  QueryClient,
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import type { DependencyList } from "react";
import { useSavedRef } from "./use-saved-ref";
import { useUpdateEffect } from "./use-update-effect";

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
