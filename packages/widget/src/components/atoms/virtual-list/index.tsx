import { Box, type BoxProps } from "@sk-widget/components/atoms/box";
import { useObserveElementRect } from "@sk-widget/providers/virtual-scroll";
import { breakpoints } from "@sk-widget/styles/tokens/breakpoints";
import { MaybeWindow } from "@sk-widget/utils/maybe-window";
import {
  type VirtualizerOptions,
  useVirtualizer,
} from "@tanstack/react-virtual";
import clsx from "clsx";
import { useMemo, useRef, useState } from "react";
import {
  absoluteWrapper,
  container,
  relativeWrapper,
} from "../virtual-list/style.css";

export const VirtualList = <ItemData = unknown>({
  data,
  itemContent,
  className,
  estimateSize,
  maxHeight = 600,
}: {
  data: ItemData[];
  itemContent: (index: number, item: ItemData) => React.ReactNode;
  estimateSize: VirtualizerOptions<Element, Element>["estimateSize"];
  className?: BoxProps["className"];
  maxHeight?: number;
}) => {
  const innerRef = useRef<HTMLDivElement>(null);

  const observeElementRect = useObserveElementRect();
  const isTabletOrBigger = useIsTabletOrBigger();

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => innerRef.current,
    estimateSize,
    overscan: 10,
    ...(observeElementRect && { observeElementRect }),
  });

  const _maxHeight = isTabletOrBigger ? maxHeight : "max(65vh, 500px)";

  return (
    <Box ref={innerRef} className={clsx([container, className])}>
      <Box
        className={relativeWrapper}
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          maxHeight: _maxHeight,
        }}
      >
        <Box
          className={absoluteWrapper}
          style={{
            transform: `translateY(${
              rowVirtualizer.getVirtualItems()[0]?.start ?? 0
            }px)`,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => (
            <Box
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={rowVirtualizer.measureElement}
            >
              {itemContent(virtualItem.index, data[virtualItem.index])}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export const GroupedVirtualList = ({
  itemContent,
  groupContent,
  increaseViewportBy,
  groupCounts,
  className,
  maxHeight = 600,
  estimateSize,
}: {
  itemContent: (index: number, groupIndex: number) => React.ReactNode;
  groupContent: (index: number) => React.ReactNode;
  increaseViewportBy?: { bottom: number; top: number };
  groupCounts: number[];
  className?: BoxProps["className"];
  maxHeight?: number;
  estimateSize: VirtualizerOptions<Element, Element>["estimateSize"];
}) => {
  const innerRef = useRef<HTMLDivElement>(null);

  const isTabletOrBigger = useIsTabletOrBigger();
  const observeElementRect = useObserveElementRect();

  const rowVirtualizer = useVirtualizer({
    count: groupCounts.reduce(
      (acc, numChildren) => acc + numChildren,
      groupCounts.length
    ),
    getScrollElement: () => innerRef.current,
    estimateSize,
    overscan: 10,
    paddingStart: increaseViewportBy?.top,
    paddingEnd: increaseViewportBy?.bottom,
    ...(observeElementRect && { observeElementRect }),
  });

  type ParentResult = {
    type: "parent";
    index: number;
  };

  type ChildResult = {
    type: "child";
    index: number;
    parentIndex: number;
  };

  type ResultsArray = ParentResult | ChildResult;

  const { resultArray } = useMemo(
    () =>
      groupCounts.reduce(
        (acc, numChildren, parentIndex) => {
          acc.resultArray.push({ type: "parent", index: parentIndex });

          acc.resultArray.push(
            ...Array.from(
              { length: numChildren },
              (_, i) =>
                ({
                  type: "child",
                  index: acc.childIndex + i,
                  parentIndex: parentIndex,
                }) satisfies ChildResult
            )
          );

          acc.childIndex += numChildren;

          return acc;
        },
        { resultArray: [] as ResultsArray[], childIndex: 0 }
      ),
    [groupCounts]
  );

  const _maxHeight = isTabletOrBigger ? maxHeight : "max(65vh, 500px)";

  return (
    <Box ref={innerRef} className={clsx([container, className])}>
      <Box
        className={relativeWrapper}
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          maxHeight: _maxHeight,
        }}
      >
        <Box
          className={absoluteWrapper}
          style={{
            transform: `translateY(${
              rowVirtualizer.getVirtualItems()[0]?.start ?? 0
            }px)`,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const item = resultArray[virtualItem.index];
            const type = item.type;

            return (
              <Box
                ref={rowVirtualizer.measureElement}
                data-index={virtualItem.index}
                key={virtualItem.index}
              >
                {type === "child"
                  ? itemContent(item.index, item.parentIndex)
                  : groupContent(item.index)}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

const useIsTabletOrBigger = () => {
  const [windowWidth] = useState(() =>
    MaybeWindow.map((w) => w.innerWidth).orDefault(0)
  );

  return windowWidth >= breakpoints.tablet;
};
