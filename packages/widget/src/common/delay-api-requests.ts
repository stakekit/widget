import type { AxiosInstance } from "axios";
import { config } from "../config";

const delayMap = new Map<Record<string, never>, Record<string, never>>();
const subs = new Map<() => void, () => void>();

const subscribe = (fn: () => void) => {
  subs.set(fn, fn);

  return () => {
    subs.delete(fn);
  };
};

const notify = () => {
  subs.forEach((fn) => fn());
};

const checkDelay = () => {
  if (delayMap.size === 0) return Promise.resolve();

  let unsub: () => void;

  return new Promise((res) => {
    unsub = subscribe(() => res(null));
  }).then(() => unsub());
};

export const attachDelayInterceptor = (apiClient: AxiosInstance) =>
  apiClient.interceptors.response.use(async (response) => {
    await checkDelay();

    return response;
  });

/**
 *
 * Delay API requests; E.g. until the animation is finished
 */
export const delayAPIRequests = () => {
  if (config.env.isTestMode) return () => {};

  const key = {};
  delayMap.set(key, key);

  return () => {
    delayMap.delete(key);

    if (delayMap.size === 0) {
      notify();
    }
  };
};
