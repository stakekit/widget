import clsx from "clsx";
import type { ForwardedRef, ReactNode } from "react";
import { Fragment, forwardRef, useState } from "react";
import type {
  GroupedVirtuosoProps,
  VirtuosoHandle,
  VirtuosoProps,
} from "react-virtuoso";
import { GroupedVirtuoso, Virtuoso } from "react-virtuoso";
import { breakpoints } from "../../../styles/tokens/breakpoints";
import { MaybeWindow } from "../../../utils/maybe-window";
import { Box } from "../box";
import { container, hideScrollbar } from "./style.css";

declare module "react" {
  // biome-ignore lint/complexity/noBannedTypes: <explanation>
  function forwardRef<T, P = {}>(
    render: (props: P, ref: React.Ref<T>) => React.ReactElement | null
  ): (props: P & React.RefAttributes<T>) => React.ReactElement | null;
}

function _VirtualList<ItemData = unknown, Context = unknown>(
  {
    style,
    className,
    maxHeight = 600,
    ...props
  }: VirtuosoProps<ItemData, Context> & {
    data: ItemData[] | undefined;
    maxHeight?: number;
    itemContent: (index: number, data: ItemData) => ReactNode;
  },
  ref: ForwardedRef<VirtuosoHandle>
) {
  const isTabletOrBigger = useIsTabletOrBigger();

  const hasMoreThan10Items = props.data && props.data.length > 10;

  return hasMoreThan10Items ? (
    <Virtuoso
      ref={ref}
      style={{
        ...style,
        height: isTabletOrBigger ? maxHeight : "max(65vh, 500px)",
      }}
      className={clsx([hideScrollbar, className])}
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
}

export const VirtualList = forwardRef(_VirtualList);

export const GroupedVirtualList = <ItemData = unknown, Context = unknown>({
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
      className={clsx([hideScrollbar, className])}
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
    MaybeWindow.map((w) => w.innerWidth).orDefault(0)
  );

  return windowWidth >= breakpoints.tablet;
};
