import { useState } from "react";
import { VirtuosoProps } from "react-virtuoso";
import { breakpoints } from "../../../styles/tokens/breakpoints";

export const useVirtualListHeight = (
  maxHeight = 600,
  minHeight = 50
): Pick<VirtualListProps, "style" | "totalListHeightChanged"> => {
  const [windowWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 0
  );
  const [height, setHeight] = useState(minHeight);

  const isTabletOrBigger = windowWidth >= breakpoints.tablet;

  const totalListHeightChanged: VirtualListProps["totalListHeightChanged"] = (
    totalHeight
  ) => {
    if (windowWidth < breakpoints.tablet || totalHeight === 0) return;

    if (totalHeight >= maxHeight || totalHeight > height) {
      setHeight(Math.min(maxHeight, totalHeight));
    }
  };

  return {
    style: { height: isTabletOrBigger ? `${height}px` : "65vh" },
    totalListHeightChanged,
  };
};

type VirtualListProps = VirtuosoProps<unknown, unknown>;
