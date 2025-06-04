import { isAxiosError } from "axios";
import { EitherAsync } from "purify-ts";
import { waitForMs } from "../utils";

const _shouldRetry = ({
  error,
  retryCount,
  retryTimes,
}: {
  error: unknown;
  retryCount: number;
  retryTimes: number;
}) => {
  const res =
    isAxiosError(error) &&
    error?.code !== "ERR_CANCELED" &&
    (!error.response?.status || error.response.status >= 500) &&
    retryCount < retryTimes;

  return res;
};

/**
 *
 * @summary Retry with exponential backoff. Fire once + retry times
 */
export const withRequestErrorRetry = <T, E = unknown>({
  fn,
  retryTimes = 2,
  shouldRetry,
  retryWaitForMs,
}: {
  fn: () => Promise<T>;
  retryTimes?: number;
  shouldRetry?: (error: unknown, retryCount: number) => boolean;
  retryWaitForMs?: () => number;
}) => {
  let retryCount = 0;

  const newFn = (): EitherAsync<E, T> => {
    return EitherAsync(async () => {
      try {
        return await fn();
      } catch (error) {
        let err = error;

        while (
          shouldRetry?.(error, retryCount) ??
          _shouldRetry({ error: err, retryCount, retryTimes })
        ) {
          try {
            await waitForMs(retryWaitForMs?.() ?? 2 ** (retryCount + 1) * 1000);

            return await fn();
          } catch (newError) {
            err = newError;
            retryCount++;
          }
        }

        throw err;
      }
    });
  };

  return newFn();
};
