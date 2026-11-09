import { createContext, type PropsWithChildren, useContext } from "react";

import type { Token } from "../../domain/token/token";

/**
 * The host's rendering preferences that shared rendering helpers need.
 *
 * Shared code must not read Widget Configuration, so it declares the narrow
 * contract it needs and the application composition seam supplies it. Every
 * member describes how the host wants content rendered, not what the Widget
 * currently shows.
 */
export type WidgetPresentation = {
  readonly hideNetworkLogo: boolean;
  /** Replace selected token icons with the host's icon set. */
  readonly hostTokenIconMapping: boolean;
  readonly locale: string;
  readonly mapNetworkIconUrl: (network: Token["network"]) => string | undefined;
  readonly mapTokenIconUrl: (token: Token) => string | undefined;
};

const unmappedIconUrl = () => undefined;

const defaultWidgetPresentation: WidgetPresentation = {
  hideNetworkLogo: false,
  hostTokenIconMapping: false,
  locale: "en",
  mapNetworkIconUrl: unmappedIconUrl,
  mapTokenIconUrl: unmappedIconUrl,
};

const WidgetPresentationContext = createContext(defaultWidgetPresentation);

export const WidgetPresentationProvider = ({
  children,
  value,
}: PropsWithChildren<{ value: WidgetPresentation }>) => (
  <WidgetPresentationContext.Provider value={value}>
    {children}
  </WidgetPresentationContext.Provider>
);

export const useWidgetPresentation = () =>
  useContext(WidgetPresentationContext);
