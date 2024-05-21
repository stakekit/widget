import { useMemo } from "react";
import type { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import { useSettings } from "@sk-widget/providers/settings";
import { config } from "@sk-widget/config";

export const useVariantTokenUrls = (
  token: TokenDto,
  metadata?: YieldMetadataDto
) => {
  const { variant } = useSettings();
  return useMemo(() => {
    let mainUrl = metadata?.logoURI ?? token.logoURI;

    const fallbackUrl = metadata?.logoURI ?? token.logoURI;
    const name = metadata?.name ?? token.name;

    if (variant === "zerion") {
      /**
       * Use Zerion's ETH token for yields that are native staking on Ethereum
       */
      if (metadata) {
        if (
          metadata.type === "staking" &&
          metadata.token.network === "ethereum"
        ) {
          mainUrl = `${config.zerion.iconsByAddress}eth.png`;
        }
      } else {
        /**
         * Use Zerion's token icons
         */
        if (token.address) {
          mainUrl = `${config.zerion.iconsByAddress}${token.address}.png`;
        } else if (token.network === "ethereum") {
          mainUrl = `${config.zerion.iconsByAddress}eth.png`;
        } else {
          mainUrl = `${config.zerion.iconsByNetwork}${token.network}.png`;
        }
      }
    }

    return { mainUrl, fallbackUrl, name };
  }, [token, metadata, variant]);
};
