import type { SupportedSKChains } from "@sk-widget/domain/types/chains";
import { useSettings } from "@sk-widget/providers/settings";
import type { SettingsProps } from "@sk-widget/providers/settings/types";
import { getNetworkLogo } from "@sk-widget/utils";
import type { Networks } from "@stakekit/common";
import { Maybe } from "purify-ts";
import { useMemo } from "react";

export const getVariantNetworkUrl = ({
  chainIconMapping,
  network,
}: {
  network: Networks;
  chainIconMapping: SettingsProps["chainIconMapping"];
}) => {
  const chainMappingResult = Maybe.fromNullable(chainIconMapping)
    .chainNullable((mapping) => {
      if (typeof mapping === "function") {
        return mapping(network as SupportedSKChains);
      }

      return mapping[network as SupportedSKChains];
    })
    .extractNullable();

  if (chainMappingResult) {
    return chainMappingResult;
  }

  return getNetworkLogo(network);
};

export const useVariantNetworkUrls = (network: Networks) => {
  const { chainIconMapping } = useSettings();

  return useMemo(
    () => getVariantNetworkUrl({ chainIconMapping, network }),
    [chainIconMapping, network]
  );
};
