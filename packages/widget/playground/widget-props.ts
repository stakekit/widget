import { darkTheme, lightTheme, type SKAppProps } from "../src/index.package";
import {
  type ConnectionSettings,
  connectionProps,
} from "./connection-settings";
import type { PlaygroundConfig } from "./playground-config";

/** Widget mount props for a playground config; the host wallet is added by the caller. */
export const toWidgetProps = (
  config: PlaygroundConfig,
  connection: ConnectionSettings
): SKAppProps => {
  const providerOrder = Object.entries(config.yieldProviderOrder).map(
    ([category, providerIds]) => [category, [...providerIds]] as const
  );
  const props: SKAppProps = {
    apiKey: connection.apiKey || import.meta.env.VITE_API_KEY,
    variant: config.variant,
    theme: config.theme === "dark" ? darkTheme : lightTheme,
    dashboardVariant: config.dashboardVariant,
    borrowEnabled: config.borrowEnabled,
    hideGasFee: config.hideGasFee,
    onMountAnimationComplete: () =>
      console.info("[playground] mount animation complete"),
    ...(config.language !== "auto" && { language: config.language }),
    ...(providerOrder.length > 0 && {
      yieldProviderOrder: Object.fromEntries(providerOrder),
    }),
    ...(connection.apiUrl && { baseUrl: connection.apiUrl }),
    ...(connection.yieldsApiUrl && { yieldsApiUrl: connection.yieldsApiUrl }),
    ...(connection.borrowApiUrl && { borrowApiUrl: connection.borrowApiUrl }),
    ...(config.trackingLog && {
      tracking: {
        trackEvent: (event, properties) =>
          console.info(`[playground track] event: ${event}`, properties ?? ""),
        trackPageView: (page, properties) =>
          console.info(`[playground track] page: ${page}`, properties ?? ""),
      },
    }),
  };

  // Extra props come from the link, so a crafted link could point the API URL
  // elsewhere and receive the API key. Connection props come only from storage.
  const extraProps = Object.fromEntries(
    Object.entries(config.extraProps).filter(([prop]) => {
      const isConnectionProp = connectionProps.includes(prop);
      if (isConnectionProp) {
        console.warn(
          `[playground] Ignoring ${prop} from the link's extra props`
        );
      }
      return !isConnectionProp;
    })
  );

  // Extra props are unchecked JSON, applied last on purpose.
  return Object.assign({}, props, extraProps);
};
