import type { GeolocationError } from "../../domain/schema/legacy-models";
import { GeolocationErrorType } from "../../domain/types/errors";

type GeoBlockState =
  | false
  | { tags: Set<string>; countryCode: string; regionCode?: string };

let current: GeoBlockState = false;
const subscribers = new Set<() => void>();

export const getGeoBlockSnapshot = () => current;

export const subscribeToGeoBlock = (callback: () => void) => {
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
  if (status !== 403 || !isGeoLocationError(data)) return;

  current = {
    tags: new Set(data.tags ?? []),
    countryCode: data.countryCode ?? "",
    regionCode: (data.regionCode as unknown as string) ?? "",
  };

  for (const subscriber of subscribers) subscriber();
};
