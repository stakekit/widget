import * as LegacyApi from "../../generated/api/legacy-schema";

export const GeolocationError = LegacyApi.GeolocationError;
export type GeolocationError = typeof GeolocationError.Type;

const GeolocationErrorType = {
  GEO_LOCATION: "GEO_LOCATION",
} as const;

export { GeolocationErrorType };
