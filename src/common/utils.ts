import { AxiosError } from "axios";
import { waitForMs } from "../utils";
import { EitherAsync } from "purify-ts";

export const isAxiosError = (error: unknown): error is AxiosError => {
  return !!(error && (error as AxiosError).isAxiosError);
};

export const shouldRetryRequest = (error: AxiosError) =>
  !!(error.response?.status && error.response.status >= 500);

const _shouldRetry = ({
  error,
  retryCount,
  retryTimes,
}: {
  error: unknown;
  retryCount: number;
  retryTimes: number;
}) =>
  isAxiosError(error) && shouldRetryRequest(error) && retryCount < retryTimes;

/**
 *
 * @summary Retry with exponential backoff. Fire once + retry times
 */
export const withRequestErrorRetry = <
  T extends () => Promise<any>,
  E = unknown,
>({
  fn,
  retryTimes = 2,
  shouldRetry,
}: {
  fn: T;
  retryTimes?: number;
  shouldRetry?: (error: unknown, retryCount: number) => boolean;
}) => {
  let retryCount = 0;

  const newFn = (): EitherAsync<E, Awaited<ReturnType<T>>> => {
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
            await waitForMs(2 ** (retryCount + 1) * 1000);

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
