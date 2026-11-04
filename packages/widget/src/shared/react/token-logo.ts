import type { YieldMetadata } from "../../domain/earn/yield";
import type { Token } from "../../domain/token/token";
import { networkLogoUrl } from "../assets/network-logo";
import { config } from "../config/widget-defaults";
import {
  useWidgetPresentation,
  type WidgetPresentation,
} from "./widget-presentation";

/**
 * A token's logo as plain values, shaped to spread into the Design System's
 * `TokenAvatar` and to pass as its patterns' `TokenLogo`.
 */
export type ResolvedTokenLogo = {
  /** The symbol or name: the avatar's label and its fallback's initial. */
  readonly name: string;
  readonly src?: string;
  /** The badge: the network's logo, or the provider's with `badge: "provider"`. */
  readonly networkSrc?: string;
};

export type TokenLogoOptions = {
  /** A yield's metadata: its logo and name stand for the token's. */
  readonly metadata?:
    | Pick<YieldMetadata, "logoURI" | "name" | "provider">
    | undefined;
  /**
   * The badge on the logo: the token's network (unless the host hides
   * network logos), the yield provider's logo, or none.
   */
  readonly badge?: "network" | "provider" | "none";
};

/**
 * Resolves token logos with the host's icon mappings, for lists that map many
 * tokens in one render.
 */
export const useTokenLogoResolver = (): ((
  token: Token,
  options?: TokenLogoOptions
) => ResolvedTokenLogo) => {
  const presentation = useWidgetPresentation();

  return (token, options) => resolveTokenLogo(presentation, token, options);
};

/** A token's logo resolved with the host's icon mappings. */
export const useTokenLogo = (
  token: Token,
  options?: TokenLogoOptions
): ResolvedTokenLogo =>
  resolveTokenLogo(useWidgetPresentation(), token, options);

const resolveTokenLogo = (
  {
    hideNetworkLogo,
    hostTokenIconMapping,
    mapNetworkIconUrl,
    mapTokenIconUrl,
  }: WidgetPresentation,
  token: Token,
  options: TokenLogoOptions | undefined
): ResolvedTokenLogo => {
  const { name, src, providerSrc } = tokenUrls({
    hostTokenIconMapping,
    mapTokenIconUrl,
    metadata: options?.metadata,
    token,
  });
  const networkSrc = (() => {
    switch (options?.badge ?? "network") {
      case "none":
        return undefined;
      case "provider":
        return providerSrc;
      case "network":
        return hideNetworkLogo
          ? undefined
          : mapNetworkIconUrl(token.network) || networkLogoUrl(token.network);
    }
  })();

  return {
    name,
    ...(src ? { src } : {}),
    ...(networkSrc ? { networkSrc } : {}),
  };
};

const tokenUrls = ({
  token,
  metadata,
  hostTokenIconMapping,
  mapTokenIconUrl,
}: {
  readonly token: Token;
  readonly metadata: TokenLogoOptions["metadata"];
  readonly hostTokenIconMapping: boolean;
  readonly mapTokenIconUrl: WidgetPresentation["mapTokenIconUrl"];
}): {
  readonly name: string;
  readonly src: string | undefined;
  readonly providerSrc: string | undefined;
} => {
  if (metadata) {
    const usesZerionEth =
      hostTokenIconMapping &&
      skETHIconUrlsSuffix.some((suffix) => metadata.logoURI.endsWith(suffix));

    return {
      name: metadata.name,
      src: usesZerionEth ? zerionETHIcon : metadata.logoURI || token.logoURI,
      providerSrc: metadata.provider?.logoURI,
    };
  }

  const mappedUrl = mapTokenIconUrl(token);
  if (mappedUrl) {
    return { name: token.name, src: mappedUrl, providerSrc: undefined };
  }

  return {
    name: token.name,
    src: hostTokenIconMapping ? zerionTokenIcon(token) : token.logoURI,
    providerSrc: undefined,
  };
};

/** Zerion's icons for the tokens a host with its own icon set replaces. */
const zerionTokenIcon = (token: Token) => {
  if (token.address && token.symbol === "MATIC") {
    return `${config.zerion.iconsByAddress}${token.address}.png`;
  }
  if (token.symbol === "ETH") return zerionETHIcon;
  return token.logoURI;
};

const skETHIconUrlsSuffix = ["/tokens/eth.svg", "/tokens/steth2.svg"];
const zerionETHIcon = `${config.zerion.iconsByAddress}eth.png`;

/** A network's logo URL, with the host's network icon mapping. */
export const useNetworkLogo = (network: Token["network"]): string => {
  const { mapNetworkIconUrl } = useWidgetPresentation();
  return mapNetworkIconUrl(network) || networkLogoUrl(network);
};
