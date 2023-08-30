import { useCallback } from "react";
import { useStakeDispatch } from "../state/stake";

export const useResetApp = () => {
  const appDispatch = useStakeDispatch();

  return useCallback(() => {
    appDispatch({ type: "state/reset" });
  }, [appDispatch]);
};
