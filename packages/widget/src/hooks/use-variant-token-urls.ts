import { config } from "@sk-widget/config";
import { useSettings } from "@sk-widget/providers/settings";
import type { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import { useMemo } from "react";

export const useVariantTokenUrls = (
  token: TokenDto,
  metadata?: YieldMetadataDto
): {
  mainUrl: string | undefined;
  fallbackUrl: string | undefined;
  name: string;
  providerIcon: string | undefined;
} => {
  const { variant } = useSettings();

  return useMemo(() => {
    if (metadata) {
      return {
        mainUrl: metadata.logoURI,
        fallbackUrl: metadata.logoURI ?? token.logoURI,
        name: metadata.name,
        providerIcon: metadata.provider?.logoURI,
      };
    }

    let mainUrl = token.logoURI;

    if (variant === "zerion") {
      /**
       * Use Zerion's token icons
       */
      if (token.address && token.symbol === "MATIC") {
        mainUrl = `${config.zerion.iconsByAddress}${token.address}.png`;
      } else if (token.symbol === "ETH") {
        mainUrl = `${config.zerion.iconsByAddress}eth.png`;
      }
    }

    return {
      mainUrl,
      fallbackUrl: token.logoURI,
      name: token.name,
      providerIcon: undefined,
    };
  }, [token, metadata, variant]);
};
