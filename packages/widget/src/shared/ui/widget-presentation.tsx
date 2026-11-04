import { createContext, type PropsWithChildren, useContext } from "react";
import type { Token } from "../../domain/token/token";
import type { WidgetVariant } from "../styles/recipe-variant";
import type { LayoutAttributeValue } from "../styles/theme/ids";

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
  /** Replace selected token icons with the host's icon set. */
  readonly hostTokenIconMapping: boolean;
  /**
   * The Layout attribute portaled kit roots repeat, so Layout-scoped styles
   * reach content rendered outside the app container. Not for branching.
   */
  readonly layout: LayoutAttributeValue;
  readonly locale: string;
  readonly mapNetworkIconUrl: (network: Token["network"]) => string | undefined;
  readonly mapTokenIconUrl: (token: Token) => string | undefined;
  readonly portalContainer: HTMLElement | undefined;
  readonly variant: WidgetVariant;
};

const unmappedIconUrl = () => undefined;

const defaultWidgetPresentation: WidgetPresentation = {
  disableInputAutoResize: false,
  hideNetworkLogo: false,
  hostTokenIconMapping: false,
  layout: "compact",
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
