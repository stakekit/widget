import type { AxiosInstance } from "axios";
import { useCallback, useSyncExternalStore } from "react";
import {
  type GeolocationError,
  GeolocationErrorType,
} from "../domain/types/errors";

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

const isGeoLocationError = (data: unknown): data is GeolocationError =>
  typeof data === "object" &&
  data !== null &&
  "type" in data &&
  data.type === GeolocationErrorType.GEO_LOCATION;

export const handleGeoBlockResponse = ({
  data,
  status,
}: {
  data: unknown;
  status?: number;
}) => {
  if (status !== 403 || !isGeoLocationError(data)) {
    return;
  }

  const regionCode = (data.regionCode as unknown as string) ?? ""; // wrong type in API

  _isGeoBlocked = {
    tags: new Set(data.tags ?? []),
    countryCode: data.countryCode ?? "",
    regionCode,
  };
  notify();
};

export const attachGeoBlockInterceptor = (apiClient: AxiosInstance) =>
  apiClient.interceptors.response.use(undefined, (error) => {
    handleGeoBlockResponse({
      data: error?.response?.data,
      status: error?.response?.status,
    });

    return Promise.reject(error);
  });

export const useGeoBlock = () =>
  useSyncExternalStore(
    useCallback((onChange) => {
      const unsub = subscribe(onChange);

      return () => {
        unsub();
      };
    }, []),
    useCallback(() => _isGeoBlocked, []),
    useCallback(() => _isGeoBlocked, []),
  );
