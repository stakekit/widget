import { APIManager } from "@stakekit/api-hooks";
import { config } from "../config";

const delayMap = new Map<{}, {}>();
const subs = new Map<{}, () => void>();

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

APIManager.getInstance()!.interceptors.request.use(async (config) => {
  await checkDelay();

  return config;
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
