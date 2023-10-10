import { useCallback } from "react";
import { useSKWallet } from "./wallet/use-sk-wallet";
import { useStakeDispatch } from "../state/stake";

export const useLogout = () => {
  const { disconnect, isConnected } = useSKWallet();
  const appDispatch = useStakeDispatch();

  return useCallback(() => {
    if (!isConnected) return;

    disconnect();
    appDispatch({ type: "state/reset" });
  }, [appDispatch, disconnect, isConnected]);
};
