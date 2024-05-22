import type { AxiosInstance } from "axios";
import type { i18n } from "i18next";
import { useCallback, useSyncExternalStore } from "react";
import { BehaviorSubject } from "rxjs";

interface RichError {
  message: string;
  details?: { [key: string]: unknown };
}

const $richError = new BehaviorSubject<RichError | null>(null);

export const attachRichErrorsInterceptor = (
  apiClient: AxiosInstance,
  i18n: i18n
) =>
  apiClient.interceptors.response.use(undefined, (error) => {
    if (
      i18n.exists(`errors.${error?.response?.data?.message}`) &&
      !error?.config?.url.includes("gas-estimate") // temp ignore gas estimate errors
    ) {
      $richError.next(error.response.data);
    }

    return Promise.reject(error);
  });

export const useRichErrors = () => {
  const error = useSyncExternalStore(
    useCallback((onChange) => {
      const sub = $richError.subscribe(onChange);

      return () => {
        sub.unsubscribe();
      };
    }, []),
    useCallback(() => $richError.value, []),
    useCallback(() => $richError.value, [])
  );

  const resetError = () => $richError.next(null);

  return { error, resetError };
};
