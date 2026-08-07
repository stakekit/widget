import { useMemo } from "react";
import type { AppToken } from "../../../../../../domain/schema/legacy-models";
import type { YieldMetadata } from "../../../../../../domain/types/yields";
import { config } from "../../../../../config/widget-defaults";
import { useWidgetPresentation } from "../../../../widget-presentation";

export const useVariantTokenUrls = (
  token: AppToken,
  metadata?: Pick<YieldMetadata, "logoURI" | "name" | "provider">
): {
  mainUrl: string | undefined;
  fallbackUrl: string | undefined;
  name: string;
  providerIcon: string | undefined;
} => {
  const { mapTokenIconUrl, variant } = useWidgetPresentation();

  return useMemo(() => {
    if (metadata) {
      const mainUrl =
        variant === "zerion" &&
        skETHIconUrlsSuffix.some((suffix) => metadata.logoURI.endsWith(suffix))
          ? zerionETHIcon
          : metadata.logoURI;

      return {
        mainUrl,
        fallbackUrl: metadata.logoURI ?? token.logoURI,
        name: metadata.name,
        providerIcon: metadata.provider?.logoURI,
      };
    }

    const mappedUrl = mapTokenIconUrl(token);

    if (mappedUrl) {
      return {
        mainUrl: mappedUrl,
        fallbackUrl: mappedUrl,
        name: token.name,
        providerIcon: undefined,
      };
    }

    const mainUrl =
      variant === "zerion"
        ? (() => {
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
          })()
        : token.logoURI;

    return {
      mainUrl,
      fallbackUrl: token.logoURI,
      name: token.name,
      providerIcon: undefined,
    };
  }, [token, metadata, variant, mapTokenIconUrl]);
};

const skETHIconUrlsSuffix = ["/tokens/eth.svg", "/tokens/steth2.svg"];
const zerionMATICIcon = (address: string) =>
  `${config.zerion.iconsByAddress}${address}.png`;
const zerionETHIcon = `${config.zerion.iconsByAddress}eth.png`;
