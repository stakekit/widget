import {
  darkTheme,
  lightTheme,
  type SKAppProps,
  type SKTheme,
} from "../src/index.package";
import {
  type ConnectionSettings,
  connectionProps,
} from "./connection-settings";
import {
  mountedBorrowEnabled,
  mountedColorScheme,
  type PlaygroundConfig,
} from "./playground-config";

/**
 * A host's customized legacy theme: the accent, its label, the canvas and
 * the button radius carry over to `appearance`; the bold weight and the
 * tooltip no longer apply, which the development warning lists.
 */
const customizedLegacyTheme: SKTheme = {
  color: {
    primaryButtonBackground: "#E8590C",
    primaryButtonColor: "#FFFFFF",
    background: "#FFF8F0",
    tooltipBackground: "#3B2F2F",
  },
  borderRadius: { baseContract: { primaryButton: "8px" } },
  fontWeight: { bold: "800" },
};

const legacyThemeSamples: Readonly<
  Record<PlaygroundConfig["legacyTheme"], SKTheme | undefined>
> = {
  none: undefined,
  lightTheme,
  darkTheme,
  customized: customizedLegacyTheme,
};

/** Widget mount props for a playground config; the host wallet is added by the caller. */
export const toWidgetProps = (
  config: PlaygroundConfig,
  connection: ConnectionSettings
): SKAppProps => {
  const providerOrder = Object.entries(config.yieldProviderOrder).map(
    ([category, providerIds]) => [category, [...providerIds]] as const
  );
  const legacyTheme = legacyThemeSamples[config.legacyTheme];
  const props: SKAppProps = {
    apiKey: connection.apiKey || import.meta.env.VITE_API_KEY,
    variant: config.variant,
    appearance: { colorScheme: mountedColorScheme(config) },
    ...(legacyTheme && { theme: legacyTheme }),
    dashboardVariant: config.dashboardVariant,
    borrowEnabled: mountedBorrowEnabled(config),
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
