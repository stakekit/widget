import type { Network } from "../../../../domain/network/network";
import { isWalletNetwork } from "../../../../domain/wallet/network";
import type { SettingsProps } from "../../../../public-api/types";
import { getWalletNetworkLogo } from "./assets";

export const getVariantNetworkUrl = ({
  chainIconMapping,
  network,
}: {
  readonly chainIconMapping: SettingsProps["chainIconMapping"];
  readonly network: Network;
}) => {
  const getMappedNetwork = () => {
    if (!isWalletNetwork(network)) return undefined;
    if (typeof chainIconMapping === "function") {
      return chainIconMapping(network);
    }

    return chainIconMapping?.[network];
  };

  return getMappedNetwork() || getWalletNetworkLogo(network);
};
