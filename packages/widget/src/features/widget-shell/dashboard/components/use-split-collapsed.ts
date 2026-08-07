import { isSplitCollapsedWidth } from "../../../../shared/styles/tokens/breakpoints";
import { useAppContainerWidth } from "./app-container";

/**
 * JS counterpart of `splitExpandedContainerQuery`. Both resolve against the
 * app container width so embedded dashboards stay internally consistent.
 */
export const useSplitCollapsed = () => {
  const appContainerWidth = useAppContainerWidth();

  return appContainerWidth !== null && isSplitCollapsedWidth(appContainerWidth);
};
