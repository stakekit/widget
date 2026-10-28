import type { PropsWithChildren } from "react";
import {
  type LayoutAttributeValue,
  layoutAttribute,
} from "../../../shared/styles/theme/ids";
import { Box } from "../../../shared/ui/primitives/box";
import { useElementAtomRef } from "../react/use-element-atom-ref";
import { appContainerElementAtom } from "../state/app-container";
import { type PageTransition, PageTransitionContext } from "./animation-page";
import { appContainer } from "./layout.css";

/**
 * The shell's root element: scopes Layout-specific styles through the Layout
 * attribute and provides the page enter and exit animation.
 */
export const AppContainer = ({
  layout,
  pageTransition,
  children,
}: PropsWithChildren<{
  readonly layout: LayoutAttributeValue;
  readonly pageTransition: PageTransition;
}>) => {
  const appContainerRef = useElementAtomRef(appContainerElementAtom);

  return (
    <Box
      ref={appContainerRef}
      {...{ [layoutAttribute]: layout }}
      className={appContainer({ layout })}
    >
      <PageTransitionContext value={pageTransition}>
        {children}
      </PageTransitionContext>
    </Box>
  );
};
