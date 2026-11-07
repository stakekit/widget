import { Schema } from "effect";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { Network } from "../../../domain/network/network";
import type { Token } from "../../../domain/token/token";
import { isWalletNetwork } from "../../../domain/wallet/network";
import { useWidgetConfig } from "../../../features/widget-configuration/index";
import {
  type WidgetPresentation,
  WidgetPresentationProvider,
} from "../../../shared/react/widget-presentation";

const isNetwork = Schema.is(Network);

/**
 * Populates the Widget Presentation from Widget Configuration, so shared
 * rendering helpers render host preferences without importing Widget
 * Configuration. Only host overrides are forwarded; the helpers own their
 * defaults.
 */
export const WidgetPresentationAdapter = ({ children }: PropsWithChildren) => {
  const { i18n } = useTranslation();
  const chainIconMapping = useWidgetConfig("chainIconMapping");
  const hideNetworkLogo = useWidgetConfig("hideNetworkLogo");
  const { hostTokenIconMapping } = useWidgetConfig("hostProfile");
  const tokenIconMapping = useWidgetConfig("tokenIconMapping");

  const value: WidgetPresentation = {
    hideNetworkLogo: !!hideNetworkLogo,
    hostTokenIconMapping,
    locale: i18n.resolvedLanguage ?? i18n.language,
    mapNetworkIconUrl: (network: Token["network"]) => {
      if (!isWalletNetwork(network)) return undefined;

      return typeof chainIconMapping === "function"
        ? chainIconMapping(network)
        : chainIconMapping?.[network];
    },
    mapTokenIconUrl: (token: Token) => {
      if (!tokenIconMapping) return undefined;
      if (typeof tokenIconMapping !== "function") {
        return tokenIconMapping[token.symbol];
      }

      // Hosts receive an `SKToken`, whose network is limited to `Network`.
      return isNetwork(token.network)
        ? tokenIconMapping({ ...token, network: token.network })
        : undefined;
    },
  };

  return (
    <WidgetPresentationProvider value={value}>
      {children}
    </WidgetPresentationProvider>
  );
};
