import { APIManager } from "@stakekit/api-hooks";
import { useState } from "react";
import { ErrorsSet, errorsSet } from "../utils/errors";

interface RichError {
  message: ErrorsSet;
  details?: { [key: string]: any };
}

export const useRichErrors = () => {
  const [error, setError] = useState<RichError>();

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
