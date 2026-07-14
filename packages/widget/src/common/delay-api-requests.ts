import { config } from "../config";

const delays = new Set<Record<string, never>>();
const subscribers = new Set<() => void>();

const subscribe = (fn: () => void) => {
  subscribers.add(fn);

  return () => {
    subscribers.delete(fn);
  };
};

const notify = () => {
  subscribers.forEach((fn) => fn());
};

const checkDelay = () => {
  if (delays.size === 0) return Promise.resolve();

  let unsub: () => void;

  return new Promise((res) => {
    unsub = subscribe(() => res(null));
  }).then(() => unsub());
};

export const waitForDelayedApiRequests = () => checkDelay();

/**
 *
 * Delay API requests; E.g. until the animation is finished
 */
export const delayAPIRequests = () => {
  if (config.env.isTestMode) return () => {};

  const key = {};
  delays.add(key);

  return () => {
    delays.delete(key);

    if (delays.size === 0) {
      notify();
    }
  };
};
