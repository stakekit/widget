import { useCallback } from "react";
import { useSKWallet } from "./wallet/use-sk-wallet";
import { useStakeDispatch } from "../state/stake";
import { APIManager, getTokenGetTokensQueryKey } from "@stakekit/api-hooks";
import { useQueryClient } from "@tanstack/react-query";

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
        query.queryKey[0] !== getTokenGetTokensQueryKey()[0], // keep default tokens on logout
    });
    queryClient.removeQueries();
  }, [appDispatch, disconnect, isConnected, queryClient]);
};
