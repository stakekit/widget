import {
  GroupedVirtuoso,
  GroupedVirtuosoProps,
  Virtuoso,
  VirtuosoProps,
} from "react-virtuoso";
import { ReactNode, useState } from "react";
import { breakpoints } from "../../../styles/tokens/breakpoints";
import clsx from "clsx";
import { hideScrollbar, renderAllItems } from "./style.css";

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

  const hasMoreThan10Items = props.data && props.data.length > 10;

  return (
    <Virtuoso
      overscan={{ main: 50, reverse: 50 }}
      style={{
        ...style,
        height: isTabletOrBigger
          ? hasMoreThan10Items
            ? maxHeight
            : "100%"
          : "65vh",
      }}
      className={clsx([hideScrollbar, className], {
        [renderAllItems]: !hasMoreThan10Items,
      })}
      {...props}
    />
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

  const hasMoreThan10Items = data && data.length > 10;

  return (
    <GroupedVirtuoso
      overscan={{ main: 50, reverse: 50 }}
      style={{
        ...style,
        height: isTabletOrBigger
          ? hasMoreThan10Items
            ? maxHeight
            : "100%"
          : "65vh",
      }}
      className={clsx([hideScrollbar, className], {
        [renderAllItems]: !hasMoreThan10Items,
      })}
      {...props}
    />
  );
};

const useIsTabletOrBigger = () => {
  const [windowWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 0
  );

  return windowWidth >= breakpoints.tablet;
};
