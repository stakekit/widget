import type { PropsWithChildren } from "react";
import {
  AppContainer,
  type PageTransition,
} from "../../features/widget-shell/composition";
import type { WidgetLayout } from "../../services/config/widget-config-model";
import type { LayoutAttributeValue } from "../../shared/styles/theme/ids";

const compactPageTransition = {
  initial: { opacity: 0, scale: 1, translateY: "-15px" },
  animate: {
    opacity: 1,
    translateY: 0,
    transition: { duration: 0.5, delay: 0.1 },
  },
  exit: {
    opacity: 0,
    filter: "blur(8px)",
    scale: 0.8,
    transition: { duration: 0.4 },
  },
} satisfies PageTransition;

const dashboardPageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4, delay: 0.05 } },
  exit: { opacity: 0, filter: "blur(8px)", transition: { duration: 0.1 } },
} satisfies PageTransition;

/**
 * How the shell presents each Layout: the Layout attribute that scopes
 * Layout-specific styles, and the page enter and exit animation.
 */
const layoutPresentation: Readonly<
  Record<
    WidgetLayout,
    {
      readonly attribute: LayoutAttributeValue;
      readonly pageTransition: PageTransition;
    }
  >
> = {
  Compact: { attribute: "compact", pageTransition: compactPageTransition },
  Dashboard: {
    attribute: "dashboard",
    pageTransition: dashboardPageTransition,
  },
};

/** The shell's app container presented for the given Layout. */
export const LayoutAppContainer = ({
  layout,
  children,
}: PropsWithChildren<{ readonly layout: WidgetLayout }>) => {
  const { attribute, pageTransition } = layoutPresentation[layout];

  return (
    <AppContainer layout={attribute} pageTransition={pageTransition}>
      {children}
    </AppContainer>
  );
};
