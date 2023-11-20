import {
  GroupedVirtuoso,
  GroupedVirtuosoProps,
  Virtuoso,
  VirtuosoProps,
} from "react-virtuoso";
import { Fragment, ReactNode, useState } from "react";
import { breakpoints } from "../../../styles/tokens/breakpoints";
import clsx from "clsx";
import { container, hideScrollbar, virtualContainer } from "./style.css";
import { Box } from "../box";

export const VirtualList = <ItemData = any, Context = any>({
  style,
  className,
  maxHeight = 600,
  ...props
}: VirtuosoProps<ItemData, Context> & {
  data: ItemData[] | undefined;
  maxHeight?: number;
  itemContent: (index: number, data: ItemData) => ReactNode;
}) => {
  const isTabletOrBigger = useIsTabletOrBigger();

  const hasMoreThan10Items = props.data && props.data.length > 10;

  return hasMoreThan10Items ? (
    <Virtuoso
      overscan={{ main: 100, reverse: 100 }}
      style={{
        ...style,
        height: isTabletOrBigger ? maxHeight : "max(65vh, 500px)",
      }}
      className={clsx([hideScrollbar, virtualContainer, className])}
      {...props}
    />
  ) : (
    <Box
      className={clsx([hideScrollbar, container, className])}
      style={{
        ...style,
        ...(isTabletOrBigger ? { maxHeight } : { height: "max(65vh, 500px)" }),
      }}
    >
      {props.data?.map((item, i) => (
        <Fragment key={i}>{props.itemContent(i, item)}</Fragment>
      ))}
    </Box>
  );
};

export const GroupedVirtualList = <ItemData = any, Context = any>({
  data,
  style,
  className,
  maxHeight = 600,
  ...props
}: GroupedVirtuosoProps<ItemData, Context> & {
  maxHeight?: number;
  itemContent: (index: number, groupIndex: number) => ReactNode;
  groupContent: (index: number) => ReactNode;
  data: ItemData[] | undefined;
}) => {
  const isTabletOrBigger = useIsTabletOrBigger();

  const hasMoreThan10Items = data && data.length > 10;

  const height = isTabletOrBigger ? maxHeight : "max(65vh, 500px)";

  return hasMoreThan10Items ? (
    <GroupedVirtuoso
      style={{ ...style, height }}
      className={clsx([hideScrollbar, virtualContainer, className])}
      {...props}
    />
  ) : (
    <Box
      className={clsx([hideScrollbar, container, className])}
      style={{
        ...style,
        ...(isTabletOrBigger ? { maxHeight } : { height: "max(65vh, 500px)" }),
      }}
    >
      {
        props.groupCounts?.reduce(
          (acc, next, groupIndex) => {
            const Content = (
              <Fragment key={`group-${groupIndex}`}>
                {props.groupContent(groupIndex)}

                {Array.from({ length: next }).map((_, i) => {
                  return (
                    <Fragment key={`item-${acc.currIdx}-${i}`}>
                      {props.itemContent(acc.currIdx + i, groupIndex)}
                    </Fragment>
                  );
                })}
              </Fragment>
            );

            return {
              items: [...acc.items, Content],
              currIdx: acc.currIdx + next,
            };
          },
          { items: [], currIdx: 0 } as {
            items: ReactNode[];
            currIdx: number;
          }
        ).items
      }
    </Box>
  );
};

const useIsTabletOrBigger = () => {
  const [windowWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 0
  );

  return windowWidth >= breakpoints.tablet;
};
