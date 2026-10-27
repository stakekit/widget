import type { PropsWithChildren } from "react";
import type { WidgetLayout } from "../../../services/config/widget-config-model";
import {
  type LayoutAttributeValue,
  layoutAttribute,
} from "../../../shared/styles/theme/ids";
import { Box } from "../../../shared/ui/primitives/box";
import { useElementAtomRef } from "../react/use-element-atom-ref";
import { appContainerElementAtom } from "../state/app-container";
import {
  compactPageTransition,
  dashboardPageTransition,
  type PageTransition,
  PageTransitionContext,
} from "./animation-page";
import { appContainer } from "./layout.css";

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

export const AppContainer = ({
  layout,
  children,
}: PropsWithChildren<{ readonly layout: WidgetLayout }>) => {
  const appContainerRef = useElementAtomRef(appContainerElementAtom);
  const { attribute, pageTransition } = layoutPresentation[layout];

  return (
    <Box
      ref={appContainerRef}
      {...{ [layoutAttribute]: attribute }}
      className={appContainer({ layout: attribute })}
    >
      <PageTransitionContext value={pageTransition}>
        {children}
      </PageTransitionContext>
    </Box>
  );
};
