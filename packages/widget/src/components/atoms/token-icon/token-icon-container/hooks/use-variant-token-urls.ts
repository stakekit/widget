import type { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { config } from "../../../../../config";
import { useSettings } from "../../../../../providers/settings";

export const useVariantTokenUrls = (
  token: TokenDto,
  metadata?: YieldMetadataDto
): {
  mainUrl: string | undefined;
  fallbackUrl: string | undefined;
  name: string;
  providerIcon: string | undefined;
} => {
  const { variant, tokenIconMapping } = useSettings();

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

    const tokenMappingResult = Maybe.fromNullable(tokenIconMapping)
      .chainNullable((mapping) => {
        if (typeof mapping === "function") {
          return mapping(token);
        }

        return mapping[token.symbol];
      })
      .map((url) => ({
        mainUrl: url,
        fallbackUrl: url,
        name: token.name,
        providerIcon: undefined,
      }))
      .extractNullable();

    if (tokenMappingResult) {
      return tokenMappingResult;
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
  }, [token, metadata, variant, tokenIconMapping]);
};

const skETHIconUrlsSuffix = ["/tokens/eth.svg", "/tokens/steth2.svg"];
const zerionMATICIcon = (address: string) =>
  `${config.zerion.iconsByAddress}${address}.png`;
const zerionETHIcon = `${config.zerion.iconsByAddress}eth.png`;
