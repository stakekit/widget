import { useCallback, useSyncExternalStore } from "react";
import { BehaviorSubject } from "rxjs";
import { config } from "../config";

export interface RichError {
  message: string;
  details?: { [key: string]: unknown };
}

const $richError = new BehaviorSubject<RichError | null>(null);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isRichError = (error: unknown): error is RichError =>
  isRecord(error) &&
  "message" in error &&
  typeof error.message === "string" &&
  error.type !== "GEO_LOCATION";

const resetRichError = () => $richError.next(null);

const allowedUrls = [config.env.apiUrl, config.env.yieldsApiUrl];

export const handleRichErrorResponse = ({
  data,
  url,
}: {
  data: unknown;
  url?: string;
}) => {
  if (
    !isRichError(data) ||
    !url ||
    !allowedUrls.some((allowedUrl) => url.startsWith(allowedUrl))
  ) {
    return;
  }

  if (!url?.includes("gas-estimate")) {
    $richError.next(data);
  }
};

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

  return { error, resetError: resetRichError };
};
