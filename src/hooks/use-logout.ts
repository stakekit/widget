import { useCallback } from "react";
import { useSKWallet } from "./wallet/use-sk-wallet";
import { useStakeDispatch } from "../state/stake";
import { APIManager, getTokenGetTokensQueryKey } from "@stakekit/api-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { config } from "../config";

export const useLogout = () => {
  const { disconnect, isConnected } = useSKWallet();
  const appDispatch = useStakeDispatch();
  const queryClient = useQueryClient();

  return useCallback(() => {
    if (!isConnected) return;

    disconnect();
    appDispatch({ type: "state/reset" });
    APIManager.getQueryClient()?.removeQueries({
      predicate: (query) =>
        // keep default tokens on logout
        query.queryKey[0] !== getTokenGetTokensQueryKey()[0],
    });
    queryClient.removeQueries({
      // keep app core data
      predicate: (query) => query.queryKey[0] !== config.appPrefix,
    });
  }, [appDispatch, disconnect, isConnected, queryClient]);
};
