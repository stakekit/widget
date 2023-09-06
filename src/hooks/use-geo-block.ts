import { useCallback, useSyncExternalStore } from "react";
import {
  APIManager,
  GeolocationError,
  GeolocationErrorType,
} from "@stakekit/api-hooks";

let _isGeoBlocked:
  | false
  | { tags: Set<string>; countryCode: string; regionCode?: string } = false;

const subs = new Map<
  (val: typeof _isGeoBlocked) => void,
  (val: typeof _isGeoBlocked) => void
>();

const notify = () => subs.forEach((cb) => cb(_isGeoBlocked));

const subscribe = (callback: (val: typeof _isGeoBlocked) => void) => {
  subs.set(callback, callback);
  return () => subs.delete(callback);
};

APIManager.getInstance()!.interceptors.response.use(undefined, (error) => {
  if (
    error?.response?.status === 403 &&
    error.response.data?.type === GeolocationErrorType.GEO_LOCATION
  ) {
    const geoLocationErr = error.response.data as GeolocationError;

    const regionCode = (geoLocationErr.regionCode as unknown as string) ?? ""; // wrong type in API

    _isGeoBlocked = {
      tags: new Set(geoLocationErr.tags ?? []),
      countryCode: geoLocationErr.countryCode ?? "",
      regionCode,
    };
    notify();
  }

  return Promise.reject(error);
});

export const useGeoBlock = () => {
  return useSyncExternalStore(
    useCallback((onChange) => {
      const unsub = subscribe(onChange);

      return () => {
        unsub();
      };
    }, []),
    useCallback(() => _isGeoBlocked, []),
    useCallback(() => _isGeoBlocked, [])
  );
};
