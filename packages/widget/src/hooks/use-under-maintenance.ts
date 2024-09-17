import type { AxiosInstance } from "axios";
import { useCallback, useSyncExternalStore } from "react";

const ENDPOINT_BLACKLIST = ["/v1/yields/enabled/networks", "/v1/tokens"];

const block_map = new Map<string, boolean>();

let _isUnderMaintenance = false;

const subs = new Map<
  (val: typeof _isUnderMaintenance) => void,
  (val: typeof _isUnderMaintenance) => void
>();

const notify = () => subs.forEach((cb) => cb(_isUnderMaintenance));

const subscribe = (callback: (val: typeof _isUnderMaintenance) => void) => {
  subs.set(callback, callback);
  return () => subs.delete(callback);
};

export const attachMaintenanceInterceptor = (apiClient: AxiosInstance) =>
  apiClient.interceptors.response.use(undefined, (error) => {
    if (error?.response?.status === 500) {
      if (ENDPOINT_BLACKLIST.every((endpoint) => block_map.has(endpoint))) {
        _isUnderMaintenance = true;
        notify();
      } else {
        block_map.set(new URL(error.response.config.url).pathname, true);
      }
    }

    return Promise.reject(error);
  });

export const useUnderMaintenance = () =>
  useSyncExternalStore(
    useCallback((onChange) => {
      const unsub = subscribe(onChange);

      return () => {
        unsub();
      };
    }, []),
    useCallback(() => _isUnderMaintenance, []),
    useCallback(() => _isUnderMaintenance, [])
  );
