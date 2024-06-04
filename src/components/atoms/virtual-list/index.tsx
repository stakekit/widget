import { Box, type BoxProps } from "@sk-widget/components/atoms/box";
import { useObserveElementRect } from "@sk-widget/providers/virtual-scroll";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import {
  type ForwardedRef,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import {
  absoluteWrapper,
  container,
  relativeWrapper,
} from "../virtual-list/style.css";

declare module "react" {
  // biome-ignore lint/complexity/noBannedTypes: <explanation>
  function forwardRef<T, P = {}>(
    render: (props: P, ref: React.Ref<T>) => React.ReactElement | null
  ): (props: P & React.RefAttributes<T>) => React.ReactElement | null;
}

const _VirtualList = <ItemData = unknown>(
  props: {
    data: ItemData[];
    itemContent: (index: number, item: ItemData) => React.ReactNode;
    className?: BoxProps["className"];
  },
  ref: ForwardedRef<HTMLDivElement>
) => {
  const innerRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => innerRef.current!, []);
  const { data, itemContent, className } = props;

  const observeElementRect = useObserveElementRect();

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => innerRef.current,
    ...(observeElementRect && { observeElementRect }),
    estimateSize: () => 68,
    overscan: 10,
  });

  return (
    <>
      <Box ref={innerRef} className={clsx([container, className])}>
        <Box
          className={relativeWrapper}
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
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
    </>
  );
};

export const VirtualList = forwardRef(_VirtualList);

const _GroupedVirtualList = (
  props: {
    itemContent: (index: number, groupIndex: number) => React.ReactNode;
    increaseViewportBy?: { bottom: number; top: number };
    groupCounts: number[];
    groupContent: (index: number) => React.ReactNode;
    className?: BoxProps["className"];
  },
  ref: ForwardedRef<HTMLDivElement>
) => {
  const innerRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => innerRef.current!, []);
  const {
    increaseViewportBy,
    itemContent,
    groupCounts,
    groupContent,
    className,
  } = props;

  const observeElementRect = useObserveElementRect();

  const rowVirtualizer = useVirtualizer({
    count: groupCounts.reduce(
      (acc, numChildren) => acc + numChildren,
      groupCounts.length
    ),
    getScrollElement: () => innerRef.current,
    ...(observeElementRect && { observeElementRect }),
    estimateSize: () => 50,
    overscan: 10,
    paddingStart: increaseViewportBy?.top,
    paddingEnd: increaseViewportBy?.bottom,
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
  const [resultArray] = groupCounts.reduce(
    ([acc, childIndex], numChildren, parentIndex) => {
      acc.push({ type: "parent", index: parentIndex });
      acc.push(
        ...Array.from({ length: numChildren }, (_, i) => ({
          type: "child" as const,
          index: childIndex + i,
          parentIndex: parentIndex,
        }))
      );
      return [acc, childIndex + numChildren];
    },
    [[] as ResultsArray[], 0]
  );

  return (
    <>
      <Box ref={innerRef} className={clsx([container, className])}>
        <Box
          className={relativeWrapper}
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
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
    </>
  );
};

export const GroupedVirtualList = forwardRef(_GroupedVirtualList);
