import {
  GroupedVirtuoso,
  GroupedVirtuosoProps,
  Virtuoso,
  VirtuosoProps,
} from "react-virtuoso";
import { Box } from "../box";
import { Fragment, ReactNode, useState } from "react";
import { breakpoints } from "../../../styles/tokens/breakpoints";
import clsx from "clsx";
import { container, hideScrollbar } from "./style.css";

const defaultMaxHeight = 600;

export const VirtualList = <ItemData = any, Context = any>({
  style,
  className,
  ...props
}: VirtuosoProps<ItemData, Context> & {
  data: ItemData[] | undefined;
  maxHeight?: number;
  itemContent: (index: number, data: ItemData) => ReactNode;
}) => {
  const maxHeight = props.maxHeight ?? defaultMaxHeight;

  const isTabletOrBigger = useIsTabletOrBigger();

  return props.data && props.data.length >= 10 ? (
    <Virtuoso
      overscan={{ main: 50, reverse: 50 }}
      style={{ ...style, height: isTabletOrBigger ? maxHeight : "65vh" }}
      className={clsx([hideScrollbar, className])}
      {...props}
    />
  ) : (
    <Box
      className={clsx([hideScrollbar, container, className])}
      style={{
        ...style,
        maxHeight: maxHeight ?? defaultMaxHeight,
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
  ...props
}: GroupedVirtuosoProps<ItemData, Context> & {
  maxHeight?: number;
  itemContent: (index: number, groupIndex: number) => ReactNode;
  groupContent: (index: number) => ReactNode;
  data: ItemData[] | undefined;
}) => {
  const maxHeight = props.maxHeight ?? defaultMaxHeight;

  const isTabletOrBigger = useIsTabletOrBigger();

  return data && data.length >= 10 ? (
    <GroupedVirtuoso
      style={{ ...style, height: isTabletOrBigger ? maxHeight : "65vh" }}
      className={clsx([hideScrollbar, className])}
      {...props}
    />
  ) : (
    <Box
      className={clsx([hideScrollbar, container, className])}
      style={{
        ...style,
        maxHeight: maxHeight ?? defaultMaxHeight,
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
