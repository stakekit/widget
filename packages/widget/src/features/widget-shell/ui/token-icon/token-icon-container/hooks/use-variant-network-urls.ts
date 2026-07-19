import { useMemo } from "react";
import { useWidgetConfig } from "../../../../../../app/config/use-widget-config";
import type { Network } from "../../../../../../domain/schema/network-model";
import { getVariantNetworkUrl } from "../../../../../../services/wallet/network-icon";

export const useVariantNetworkUrls = (network: Network) => {
  const chainIconMapping = useWidgetConfig("chainIconMapping");

  return useMemo(
    () => getVariantNetworkUrl({ chainIconMapping, network }),
    [chainIconMapping, network]
  );
};
