import { useMemo } from "react";
import type { Network } from "../../../../../domain/schema/network-model";
import type { SupportedSKChains } from "../../../../../domain/types/chains";
import { useSettings } from "../../../../../providers/settings";
import type { SettingsProps } from "../../../../../providers/settings/types";
import { getNetworkLogo } from "../../../../../utils";

export const getVariantNetworkUrl = ({
  chainIconMapping,
  network,
}: {
  network: Network;
  chainIconMapping: SettingsProps["chainIconMapping"];
}) => {
  const chainMappingResult = chainIconMapping
    ? (() => {
        const mapping = chainIconMapping;
        if (typeof mapping === "function") {
          return mapping(network as SupportedSKChains);
        }

        return mapping[network as SupportedSKChains];
      })()
    : null;

  if (chainMappingResult) {
    return chainMappingResult;
  }

  return getNetworkLogo(network);
};

export const useVariantNetworkUrls = (network: Network) => {
  const { chainIconMapping } = useSettings();

  return useMemo(
    () => getVariantNetworkUrl({ chainIconMapping, network }),
    [chainIconMapping, network]
  );
};
