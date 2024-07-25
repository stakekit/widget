import { config } from "@sk-widget/config";
import { useSettings } from "@sk-widget/providers/settings";
import { getNetworkLogo } from "@sk-widget/utils";
import type { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import type { Networks } from "@stakekit/common";
import { useMemo } from "react";

export const useVariantTokenUrls = (
  token: TokenDto,
  metadata?: YieldMetadataDto,
  customLogo?: string,
  customNetworkLogo?: string
) => {
  const { variant } = useSettings();
  return useMemo(() => {
    let mainUrl = customLogo ?? metadata?.logoURI ?? token.logoURI;

    const fallbackUrl = customLogo ?? metadata?.logoURI ?? token.logoURI;
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
        } else if (token.symbol === "ETH") {
          mainUrl = `${config.zerion.iconsByAddress}eth.png`;
        } else {
          mainUrl = `${config.zerion.iconsByNetwork}${token.network}.png`;
        }
      }
    }

    /**
     * Network specific token icons
     */
    const networkLogo =
      customNetworkLogo ?? getNetworkLogo(token.network as Networks);

    return { mainUrl, fallbackUrl, name, networkLogo };
  }, [token, metadata, variant, customLogo, customNetworkLogo]);
};
