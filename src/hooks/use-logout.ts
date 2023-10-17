import { useCallback } from "react";
import { useStakeDispatch } from "../state/stake";
import { useSKWallet } from "../providers/sk-wallet";

export const useLogout = () => {
  const { disconnect } = useSKWallet();
  const appDispatch = useStakeDispatch();

  return useCallback(() => {
    disconnect();
    appDispatch({ type: "state/reset" });
  }, [appDispatch, disconnect]);
};
