import type { YieldMetadata } from "../../../../../../domain/earn/yield";
import type { Token } from "../../../../../../domain/token/token";
import { config } from "../../../../../config/widget-defaults";
import type { WidgetPresentation } from "../../../../widget-presentation";
import { useWidgetPresentation } from "../../../../widget-presentation";

type VariantTokenUrls = {
  mainUrl: string | undefined;
  fallbackUrl: string | undefined;
  name: string;
  providerIcon: string | undefined;
};

export const useVariantTokenUrls = (
  token: Token,
  metadata?: Pick<YieldMetadata, "logoURI" | "name" | "provider">
): VariantTokenUrls => {
  const { hostTokenIconMapping, mapTokenIconUrl } = useWidgetPresentation();

  return getVariantTokenUrls({
    token,
    metadata,
    hostTokenIconMapping,
    mapTokenIconUrl,
  });
};

const getVariantTokenUrls = ({
  token,
  metadata,
  hostTokenIconMapping,
  mapTokenIconUrl,
}: {
  token: Token;
  metadata: Pick<YieldMetadata, "logoURI" | "name" | "provider"> | undefined;
  hostTokenIconMapping: WidgetPresentation["hostTokenIconMapping"];
  mapTokenIconUrl: WidgetPresentation["mapTokenIconUrl"];
}): VariantTokenUrls => {
  if (metadata) {
    const mainUrl =
      hostTokenIconMapping &&
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

  const mainUrl = hostTokenIconMapping
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
};

const skETHIconUrlsSuffix = ["/tokens/eth.svg", "/tokens/steth2.svg"];
const zerionMATICIcon = (address: string) =>
  `${config.zerion.iconsByAddress}${address}.png`;
const zerionETHIcon = `${config.zerion.iconsByAddress}eth.png`;
