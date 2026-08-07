import type { Network } from "../../domain/schema/network-model";
import type { SupportedSKChains } from "../../domain/types/chains";
import type { SettingsProps } from "../../public-api/types";
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
