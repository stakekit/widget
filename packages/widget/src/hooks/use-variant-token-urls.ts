import { config } from "@sk-widget/config";
import { useSettings } from "@sk-widget/providers/settings";
import type { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
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
      const mainUrl = Maybe.fromFalsy(variant === "zerion")
        .filter(() =>
          skETHIconUrlsSuffix.some((v) => metadata.logoURI.endsWith(v))
        )
        .map(() => zerionETHIcon)
        .orDefault(metadata.logoURI);

      return {
        mainUrl,
        fallbackUrl: metadata.logoURI ?? token.logoURI,
        name: metadata.name,
        providerIcon: metadata.provider?.logoURI,
      };
    }

    const mainUrl = Maybe.fromFalsy(variant === "zerion")
      .map(() => {
        /**
         * Use Zerion's token icons
         */
        if (token.address && token.symbol === "MATIC") {
          return zerionMATICIcon(token.address);
        }

        if (token.symbol === "ETH") {
          return zerionETHIcon;
        }
        return token.logoURI;
      })
      .orDefault(token.logoURI);

    return {
      mainUrl,
      fallbackUrl: token.logoURI,
      name: token.name,
      providerIcon: undefined,
    };
  }, [token, metadata, variant]);
};

const skETHIconUrlsSuffix = ["/tokens/eth.svg", "/tokens/steth2.svg"];
const zerionMATICIcon = (address: string) =>
  `${config.zerion.iconsByAddress}${address}.png`;
const zerionETHIcon = `${config.zerion.iconsByAddress}eth.png`;
