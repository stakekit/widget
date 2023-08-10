import { APIManager } from "@stakekit/api-hooks";
import { useCallback } from "react";
import { queryClient } from "../services/query-client";
import { useStakeDispatch } from "../state/stake";

export const useResetApp = () => {
  const appDispatch = useStakeDispatch();

  return useCallback(() => {
    appDispatch({ type: "state/reset" });
    APIManager.getQueryClient()?.resetQueries();
    queryClient.resetQueries();
  }, [appDispatch]);
};
