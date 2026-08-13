import type { Network } from "../../../../domain/network/network";
import type { SettingsProps } from "../../../../public-api/types";
import type { SupportedSKChains } from "../../../../services/wallet/supported-chains";
import { getWalletNetworkLogo } from "./assets";

export const getVariantNetworkUrl = ({
  chainIconMapping,
  network,
}: {
  readonly chainIconMapping: SettingsProps["chainIconMapping"];
  readonly network: Network;
}) => {
  const mappedNetwork =
    typeof chainIconMapping === "function"
      ? chainIconMapping(network as SupportedSKChains)
      : chainIconMapping?.[network as SupportedSKChains];

  return mappedNetwork || getWalletNetworkLogo(network);
};
