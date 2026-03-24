import type { AxiosInstance } from "axios";
import type { i18n } from "i18next";
import { useCallback, useSyncExternalStore } from "react";
import { BehaviorSubject } from "rxjs";

interface RichError {
  message: string;
  details?: { [key: string]: unknown };
}

const $richError = new BehaviorSubject<RichError | null>(null);

const isRichError = (error: unknown): error is RichError =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof error.message === "string";

export const handleRichErrorResponse = ({
  data,
  i18n,
  url,
}: {
  data: unknown;
  i18n: i18n;
  url?: string;
}) => {
  if (!isRichError(data)) {
    return;
  }

  if (i18n.exists(`errors.${data.message}`) && !url?.includes("gas-estimate")) {
    $richError.next(data);
  }
};

export const attachRichErrorsInterceptor = (
  apiClient: AxiosInstance,
  i18n: i18n,
) =>
  apiClient.interceptors.response.use(undefined, (error) => {
    handleRichErrorResponse({
      data: error?.response?.data,
      i18n,
      url: error?.config?.url,
    });

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
    useCallback(() => $richError.value, []),
  );

  const resetError = () => $richError.next(null);

  return { error, resetError };
};
