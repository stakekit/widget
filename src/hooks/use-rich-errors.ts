import { AxiosInstance } from "axios";
import { i18n } from "i18next";
import { useCallback, useSyncExternalStore } from "react";
import { Observable } from "../utils/observable";

interface RichError {
  message: string;
  details?: { [key: string]: any };
}

const $richError = new Observable<RichError | null>(null);

export const attachRichErrorsInterceptor = (
  apiClient: AxiosInstance,
  i18n: i18n
) =>
  apiClient.interceptors.response.use(undefined, (error) => {
    if (i18n.exists(`errors.${error.response.data.message}`)) {
      $richError.next(error.response.data);
    }

    return Promise.reject(error);
  });

export const useRichErrors = () => {
  const error = useSyncExternalStore(
    useCallback((onChange) => {
      const unsub = $richError.subscribe(onChange);

      return () => {
        unsub();
      };
    }, []),
    useCallback(() => $richError.value, []),
    useCallback(() => $richError.value, [])
  );

  const resetError = () => $richError.next(null);

  return { error, resetError };
};
