import { useMemo } from "react";
import { config } from "../../../../../config";
import type { AppToken } from "../../../../../domain/schema/legacy-models";
import type { YieldMetadata } from "../../../../../domain/types/yields";
import { useSettings } from "../../../../../providers/settings";

export const useVariantTokenUrls = (
  token: AppToken,
  metadata?: Pick<YieldMetadata, "logoURI" | "name" | "provider">
): {
  mainUrl: string | undefined;
  fallbackUrl: string | undefined;
  name: string;
  providerIcon: string | undefined;
} => {
  const { variant, tokenIconMapping } = useSettings();

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

    const mappedUrl = tokenIconMapping
      ? (() => {
          const mapping = tokenIconMapping;
          if (typeof mapping === "function") {
            return mapping(token as Parameters<typeof mapping>[0]);
          }

          return mapping[token.symbol];
        })()
      : null;

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
  }, [token, metadata, variant, tokenIconMapping]);
};

const skETHIconUrlsSuffix = ["/tokens/eth.svg", "/tokens/steth2.svg"];
const zerionMATICIcon = (address: string) =>
  `${config.zerion.iconsByAddress}${address}.png`;
const zerionETHIcon = `${config.zerion.iconsByAddress}eth.png`;
