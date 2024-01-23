import { APIManager } from "@stakekit/api-hooks";
import { useState } from "react";
import { ErrorsSet, errorsSet } from "../utils/errors";

interface ReachError {
  message: ErrorsSet;
  details?: { [key: string]: any };
}

export const useReachErrors = () => {
  const [error, setError] = useState<ReachError>();

  APIManager.getInstance()!.interceptors.response.use(undefined, (error) => {
    if (errorsSet.has(error.response.data.message)) {
      setError(error.response.data);
    }

    return Promise.reject(error);
  });

  const resetError = () => {
    setError(undefined);
  };

  return { error, resetError };
};
