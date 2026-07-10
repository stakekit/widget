import type { GeolocationError } from "../schema/legacy-models";

const GeolocationErrorType = {
  GEO_LOCATION: "GEO_LOCATION",
} as const;

export type { GeolocationError };
export { GeolocationErrorType };
