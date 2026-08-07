import { createContext, type PropsWithChildren, useContext } from "react";
import type { AppToken } from "../../domain/schema/legacy-models";
import type { Network } from "../../domain/schema/network-model";
import type { WidgetVariant } from "../styles/recipe-variant";

/**
 * Host-owned rendering environment for the shared UI kit.
 *
 * `shared/ui` must not read widget configuration, so the kit declares the
 * narrow contract it needs and the application composition seam supplies it.
 * Every member describes how the host wants the kit rendered, not what the
 * widget currently shows.
 */
export type WidgetPresentation = {
  readonly disableInputAutoResize: boolean;
  readonly hideNetworkLogo: boolean;
  readonly locale: string;
  readonly mapNetworkIconUrl: (network: Network) => string | undefined;
  readonly mapTokenIconUrl: (token: AppToken) => string | undefined;
  readonly portalContainer: HTMLElement | undefined;
  readonly variant: WidgetVariant;
};

const unmappedIconUrl = () => undefined;

const defaultWidgetPresentation: WidgetPresentation = {
  disableInputAutoResize: false,
  hideNetworkLogo: false,
  locale: "en",
  mapNetworkIconUrl: unmappedIconUrl,
  mapTokenIconUrl: unmappedIconUrl,
  portalContainer: undefined,
  variant: "default",
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
