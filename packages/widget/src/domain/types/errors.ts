import type {
  GeolocationError,
  StakeKitErrorDto,
} from "../../generated/api/legacy";

const GeolocationErrorType = {
  GEO_LOCATION: "GEO_LOCATION",
} as const;

export type { GeolocationError, StakeKitErrorDto };
export { GeolocationErrorType };
