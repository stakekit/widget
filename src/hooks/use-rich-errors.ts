import { APIManager } from "@stakekit/api-hooks";
import { useEffect, useState } from "react";
import { ErrorsSet, errorsSet } from "../utils/errors";

interface RichError {
  message: ErrorsSet;
  details?: { [key: string]: any };
}

export const useRichErrors = () => {
  const [error, setError] = useState<RichError>();

  useEffect(() => {
    const id = APIManager.getInstance()!.interceptors.response.use(
      undefined,
      (error) => {
        if (errorsSet.has(error.response.data.message)) {
          setError(error.response.data);
        }

        return Promise.reject(error);
      }
    );

    return () => APIManager.getInstance()!.interceptors.response.eject(id);
  }, []);

  const resetError = () => {
    setError(undefined);
  };

  return { error, resetError };
};
