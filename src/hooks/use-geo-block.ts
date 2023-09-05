import { useCallback, useState, useSyncExternalStore } from "react";
import { APIManager } from "@stakekit/api-hooks";

let _isGeoBlocked:
  | false
  | { tags: Set<string>; countryCode: string; regionCode?: string } = false;

export const useGeoBlock = () => {
  const [apiInstance] = useState(() => APIManager.getInstance());

  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = apiInstance!.interceptors.response.use(undefined, (error) => {
        if (
          error?.response?.status === 403 &&
          error.response.data?.type === "GEO_LOCATION"
        ) {
          _isGeoBlocked = {
            tags: new Set(error.response.data.tags ?? []),
            countryCode: error.response.data.countryCode ?? "",
            regionCode: error.response.data.regionCode ?? "",
          };
          onChange();
        }

        return Promise.reject(error);
      });

      return () => {
        apiInstance!.interceptors.response.eject(id);
      };
    },
    [apiInstance]
  );

  const getSnapshot = useCallback(() => _isGeoBlocked, []);

  const getServerSnapshot = useCallback(() => _isGeoBlocked, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};
