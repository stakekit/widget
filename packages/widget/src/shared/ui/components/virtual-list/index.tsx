import {
  useVirtualizer,
  type VirtualizerOptions,
} from "@tanstack/react-virtual";
import clsx from "clsx";
import { Array as EArray, Option } from "effect";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { breakpoints } from "../../../styles/tokens/breakpoints";
import {
  Box,
  type BoxDataAttributes,
  type BoxProps,
} from "../../primitives/box";
import { Spinner } from "../../primitives/spinner";
import { absoluteWrapper, container, relativeWrapper } from "./style.css";

type InfiniteScrollProps =
  | {
      hasNextPage: boolean;
      isFetchingNextPage: boolean;
      fetchNextPage: () => void;
    }
  | {
      hasNextPage?: never;
      isFetchingNextPage?: never;
      fetchNextPage?: never;
    };

type VirtualListProps<T> = {
  data: T[];
  itemContent: (index: number, item: T) => React.ReactNode;
  estimateSize: VirtualizerOptions<Element, Element>["estimateSize"];
  className?: BoxProps["className"];
  maxHeight?: number;
} & InfiniteScrollProps;

type VirtualGroupListProps = {
  itemContent: (index: number, groupIndex: number) => React.ReactNode;
  groupContent: (index: number) => React.ReactNode;
  increaseViewportBy?: { bottom: number; top: number };
  groupCounts: number[];
  className?: BoxProps["className"];
  maxHeight?: number;
  estimateSize: VirtualizerOptions<Element, Element>["estimateSize"];
} & InfiniteScrollProps;

export const VirtualList = <ItemData,>({
  data,
  itemContent,
  className,
  estimateSize,
  maxHeight = 600,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: VirtualListProps<ItemData>) => {
  "use no memo";
  const innerRef = useRef<HTMLDivElement>(null);

  const isTabletOrBigger = useIsTabletOrBigger();

  // Biome does not recognize the React Compiler's "use no memo" directive.
  // biome-ignore lint/nursery/useReactCompiler: TanStack Virtual is not compiler-safe.
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => innerRef.current,
    estimateSize,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  const isEndReached = useMemo(
    () => (virtualItems.at(-1)?.index ?? -1) >= data.length - 1,
    [virtualItems, data.length]
  );

  const requestNextPage = useEffectEvent(() => fetchNextPage?.());

  useEffect(() => {
    if (isEndReached && hasNextPage && !isFetchingNextPage) {
      requestNextPage();
    }
  }, [isEndReached, hasNextPage, isFetchingNextPage]);

  const _maxHeight = isTabletOrBigger ? maxHeight : "max(65vh, 400px)";

  return (
    <Box ref={innerRef} className={clsx([container, className])}>
      <Box
        className={relativeWrapper}
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          maxHeight: _maxHeight,
          minHeight: "100px",
        }}
      >
        <Box
          className={absoluteWrapper}
          style={{
            transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
          }}
        >
          {virtualItems.map((virtualItem) => {
            const item = EArray.get(data, virtualItem.index);

            if (Option.isNone(item)) return null;

            return (
              <Box
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={rowVirtualizer.measureElement}
              >
                {itemContent(virtualItem.index, item.value)}
              </Box>
            );
          })}
          {isFetchingNextPage && (
            <Box justifyContent="center" display="flex" my="4">
              <Spinner />
            </Box>
          )}
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
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  ...rest
}: VirtualGroupListProps & BoxDataAttributes) => {
  "use no memo";
  const innerRef = useRef<HTMLDivElement>(null);

  const isTabletOrBigger = useIsTabletOrBigger();

  // Biome does not recognize the React Compiler's "use no memo" directive.
  // biome-ignore lint/nursery/useReactCompiler: TanStack Virtual is not compiler-safe.
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
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const requestNextPage = useEffectEvent(() => fetchNextPage?.());

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

  const isEndReached = useMemo(
    () => (virtualItems.at(-1)?.index ?? -1) >= resultArray.length - 1,
    [virtualItems, resultArray.length]
  );

  useEffect(() => {
    if (isEndReached && hasNextPage && !isFetchingNextPage) {
      requestNextPage();
    }
  }, [isEndReached, hasNextPage, isFetchingNextPage]);

  const _maxHeight = isTabletOrBigger ? maxHeight : "max(65vh, 500px)";

  return (
    <Box ref={innerRef} className={clsx([container, className])} {...rest}>
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
            const itemOption = EArray.get(resultArray, virtualItem.index);

            if (Option.isNone(itemOption)) return null;

            const item = itemOption.value;
            const type = item.type;

            return (
              <Box
                data-index={virtualItem.index}
                key={virtualItem.key}
                ref={rowVirtualizer.measureElement}
              >
                {type === "child"
                  ? itemContent(item.index, item.parentIndex)
                  : groupContent(item.index)}
              </Box>
            );
          })}
          {isFetchingNextPage && (
            <Box justifyContent="center" display="flex" my="4">
              <Spinner />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

const useIsTabletOrBigger = () => {
  const [windowWidth] = useState(() => window.innerWidth);

  return windowWidth >= breakpoints.tablet;
};
