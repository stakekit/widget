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
} from "../../../shared/ui/widget-presentation";

const isNetwork = Schema.is(Network);

/**
 * Populates the shared UI kit's rendering environment from widget config, so
 * `shared/ui` components render host preferences without importing
 * Widget Configuration. Only host overrides are forwarded; the kit owns its defaults.
 */
export const WidgetPresentationAdapter = ({ children }: PropsWithChildren) => {
  const { i18n } = useTranslation();
  const chainIconMapping = useWidgetConfig("chainIconMapping");
  const disableResizingInputFontSize = useWidgetConfig(
    "disableResizingInputFontSize"
  );
  const hideNetworkLogo = useWidgetConfig("hideNetworkLogo");
  const { hostTokenIconMapping } = useWidgetConfig("hostProfile");
  const layout = useWidgetConfig("layout");
  const portalContainer = useWidgetConfig("portalContainer");
  const tokenIconMapping = useWidgetConfig("tokenIconMapping");
  const variant = useWidgetConfig("variant");

  const value: WidgetPresentation = {
    disableInputAutoResize: !!disableResizingInputFontSize,
    hideNetworkLogo: !!hideNetworkLogo,
    hostTokenIconMapping,
    layout: layout === "Dashboard" ? "dashboard" : "compact",
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
    portalContainer,
    variant,
  };

  return (
    <WidgetPresentationProvider value={value}>
      {children}
    </WidgetPresentationProvider>
  );
};
