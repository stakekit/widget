import { useEffect, useState } from "react";
import { APIManager } from "@stakekit/api-hooks";

export const useGeoBlock = () => {
  const [isGeoBlocked, setIsGeoBlocked] = useState<
    false | { tags: Set<string>; countryCode: string; regionCode?: string }
  >(false);

  useEffect(() => {
    const apiInstance = APIManager.getInstance();

    if (!apiInstance) return;

    const id = apiInstance.interceptors.response.use(undefined, (error) => {
      if (
        error?.response?.status === 403 &&
        error.response.data?.type === "GEO_LOCATION"
      ) {
        setIsGeoBlocked({
          tags: new Set(error.response.data.tags ?? []),
          countryCode: error.response.data.countryCode ?? "",
          regionCode: error.response.data.regionCode ?? "",
        });
      }

      return Promise.reject(error);
    });

    return () => {
      apiInstance.interceptors.response.eject(id);
    };
  }, []);

  return isGeoBlocked;
};
