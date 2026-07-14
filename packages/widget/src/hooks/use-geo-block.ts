import { useSyncExternalStore } from "react";
import {
  type GeolocationError,
  GeolocationErrorType,
} from "../domain/types/errors";

let _isGeoBlocked:
  | false
  | { tags: Set<string>; countryCode: string; regionCode?: string } = false;

const subscribers = new Set<() => void>();

const getSnapshot = () => _isGeoBlocked;

const notify = () => subscribers.forEach((callback) => callback());

const subscribe = (callback: () => void) => {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
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

export const useGeoBlock = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
