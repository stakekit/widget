import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import type { Network } from "../../../domain/network/network";
import type { Token } from "../../../domain/token/token";
import { useWidgetConfig } from "../../../features/widget-configuration/index";
import type { SupportedSKChains } from "../../../services/wallet/supported-chains";
import {
  type WidgetPresentation,
  WidgetPresentationProvider,
} from "../../../shared/ui/widget-presentation";

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
  const portalContainer = useWidgetConfig("portalContainer");
  const tokenIconMapping = useWidgetConfig("tokenIconMapping");
  const variant = useWidgetConfig("variant");

  const value: WidgetPresentation = {
    disableInputAutoResize: !!disableResizingInputFontSize,
    hideNetworkLogo: !!hideNetworkLogo,
    locale: i18n.resolvedLanguage ?? i18n.language,
    mapNetworkIconUrl: (network: Network) =>
      typeof chainIconMapping === "function"
        ? chainIconMapping(network as SupportedSKChains)
        : chainIconMapping?.[network as SupportedSKChains],
    mapTokenIconUrl: (token: Token) => {
      if (!tokenIconMapping) return undefined;

      return typeof tokenIconMapping === "function"
        ? tokenIconMapping(token as Parameters<typeof tokenIconMapping>[0])
        : tokenIconMapping[token.symbol];
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
