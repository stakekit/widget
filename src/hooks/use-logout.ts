import { useCallback } from "react";
import { useSKWallet } from "./wallet/use-sk-wallet";
import { useStakeDispatch } from "../state/stake";
import { APIManager } from "@stakekit/api-hooks";
import { useQueryClient } from "@tanstack/react-query";

export const useLogout = () => {
  const { disconnect, isConnected } = useSKWallet();
  const appDispatch = useStakeDispatch();
  const queryClient = useQueryClient();

  return useCallback(() => {
    if (!isConnected) return;

    disconnect();
    appDispatch({ type: "state/reset" });
    APIManager.getQueryClient()?.removeQueries();
    queryClient.removeQueries();
  }, [appDispatch, disconnect, isConnected, queryClient]);
};
