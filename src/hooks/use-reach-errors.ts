import { APIManager } from "@stakekit/api-hooks";
import { signal, useSignalEffect } from "@preact/signals-react";
import { useState } from "react";
import { errorsSet } from "../utils/errors";

export const reachErrorKey = signal<ReachError | undefined>(undefined);

interface ReachError {
  message: string;
  details?: { [key: string]: any };
}

APIManager.getInstance()!.interceptors.response.use(undefined, (error) => {
  reachErrorKey.value = error.response.data as ReachError;
  return Promise.reject(error);
});

export const useReachErrors = () => {
  const [error, setError] = useState<ReachError>();

  useSignalEffect(() => {
    if (reachErrorKey.value === undefined) {
      return setError(undefined);
    }
    
    if (errorsSet.has(reachErrorKey.value.message)) {
      setError(reachErrorKey.value);
    }
  });

  const resetError = () => {
    reachErrorKey.value = undefined;
  };

  return { error, resetError };
};
