import { useAppContainerWidth } from "../providers/app-container";
import { isSplitCollapsedWidth } from "../styles/tokens/breakpoints";

/**
 * JS counterpart of `splitExpandedContainerQuery`. Both must resolve against
 * the app container width so the layout stays consistent when the dashboard is
 * embedded in a host that is narrower than the viewport.
 */
export const useSplitCollapsed = () => {
  const appContainerWidth = useAppContainerWidth();

  return appContainerWidth !== null && isSplitCollapsedWidth(appContainerWidth);
};
