import { useMemo } from "react";
import type { Network } from "../../../../../../domain/network/network";
import { networkLogoUrl } from "../../../../../assets/network-logo";
import { useWidgetPresentation } from "../../../../widget-presentation";

export const useVariantNetworkUrls = (network: Network) => {
  const { mapNetworkIconUrl } = useWidgetPresentation();

  return useMemo(
    () => mapNetworkIconUrl(network) || networkLogoUrl(network),
    [mapNetworkIconUrl, network]
  );
};
