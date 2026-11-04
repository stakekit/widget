import type { Token } from "../../../../../../domain/token/token";
import { networkLogoUrl } from "../../../../../assets/network-logo";
import { useWidgetPresentation } from "../../../../widget-presentation";

export const useVariantNetworkUrls = (network: Token["network"]) => {
  const { mapNetworkIconUrl } = useWidgetPresentation();

  return mapNetworkIconUrl(network) || networkLogoUrl(network);
};
