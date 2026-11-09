import * as stylex from "@stylexjs/stylex";
import {
  defaultRangeExtractor,
  type Range,
  useVirtualizer,
} from "@tanstack/react-virtual";
import {
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { scrollStyles } from "../primitives/scroll";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { color } from "../tokens/color.stylex";
import { layer } from "../tokens/layer.stylex";
import { iconSize, scrollAreaMaxHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { focusRingStyles } from "./focus-ring";
import { scrollFadeVars } from "./scroll-area.stylex";
import {
  scrollPaneMaxHeightStyles,
  scrollPaneStyles,
} from "./scroll-pane-styles";
import { Spinner } from "./spinner";

/**
 * A titled run of items; its title heads the run in the list. With
 * `leading`, such as the token's avatar, the title shows in normal case
 * after it; `caption`, such as "from 0.02%", aligns to the header's end.
 */
export type VirtualListGroup<T> = {
  readonly key: string;
  readonly label: string;
  readonly leading?: ReactNode | undefined;
  readonly caption?: string | undefined;
  readonly items: ReadonlyArray<T>;
};

type ItemsOrGroups<T> =
  | {
      readonly items: ReadonlyArray<T>;
      readonly groups?: never;
      readonly stickyHeaders?: never;
    }
  | {
      readonly groups: ReadonlyArray<VirtualListGroup<T>>;
      readonly items?: never;
      /** Keeps the current group's title at the top while its items scroll. */
      readonly stickyHeaders?: boolean;
    };

type VirtualListProps<T> = ItemsOrGroups<T> & {
  /**
   * Names the scrolling region, which keyboard users focus to scroll, or the
   * listbox.
   */
  readonly label: string;
  readonly getKey: (item: T) => string;
  /** `index` counts items across groups; group titles do not count. */
  readonly renderItem: (item: T, index: number) => ReactNode;
  /** A row's expected height in pixels until it is measured. */
  readonly estimateSize?: number | undefined;
  /** Caps the height; unset, the list fills its parent's height. */
  readonly maxHeight?: keyof typeof scrollPaneMaxHeightStyles;
  /**
   * With `maxHeight`, the list still asks its column for no more than the cap
   * (or its rows' height when shorter), but grows past it into the space the
   * column has left, such as a frame's minimum height, and shrinks below it
   * when the column is shorter. Its parent must be a column that stretches.
   */
  readonly grow?: boolean;
  /**
   * The item, by the same index as `renderItem`, kept scrolled into view, such
   * as the one arrow keys select.
   */
  readonly activeIndex?: number | undefined;
  /**
   * `listbox` when the rows are options a combobox or listbox owner selects;
   * `renderItem` then returns elements with the `option` role. The owner
   * keeps the keyboard, so the scrolling region is then no tab stop.
   */
  readonly listRole?: "list" | "listbox";
  /** Whether the listbox takes several choices. */
  readonly multiselectable?: boolean;
  /** The list element's id, for the control that owns it. */
  readonly listId?: string;
  /**
   * Called when the last row comes into view while `hasMore` is set, once per
   * set of rows (their count and last row): after a failed load it is called
   * again only once the rows change, also when a page lands before the last
   * row.
   */
  readonly onEndReached?: (() => void) | undefined;
  readonly hasMore?: boolean;
  /** Shows a spinner under the rows and holds `onEndReached`. */
  readonly loadingMore?: boolean;
  /** Names the spinner while more items load. */
  readonly loadingMoreLabel?: string | undefined;
  /**
   * What the rows keep past the end of their figures: `checkSlot` for a
   * picker's flat rows, which reserve their check's slot, so a group's
   * caption ends that much further in, over the figures.
   */
  readonly headerInsetEnd?: keyof typeof headerInsetEndStyles;
};

/** How far, in pixels, the rows run past the top and bottom edges. */
type ScrollEdges = { readonly start: number; readonly end: number };

/**
 * The distances are clamped well past a fade's depth, so scrolling through
 * the middle of a long list leaves them unchanged.
 */
const fadeReach = 64;

const scrollEdges = (element: HTMLElement): ScrollEdges => ({
  start: Math.round(Math.min(fadeReach, Math.max(0, element.scrollTop))),
  end: Math.round(
    Math.min(
      fadeReach,
      Math.max(
        0,
        element.scrollHeight - element.clientHeight - element.scrollTop
      )
    )
  ),
});

/** A group's header row: all of the group but its items. */
type GroupHeading = Omit<VirtualListGroup<never>, "items">;

type Row<T> =
  | {
      readonly kind: "header";
      readonly key: string;
      readonly group: GroupHeading;
    }
  | {
      readonly kind: "item";
      readonly key: string;
      readonly item: T;
      readonly index: number;
    };

const toRows = <T,>(
  props: ItemsOrGroups<T>,
  getKey: (item: T) => string
): ReadonlyArray<Row<T>> => {
  if (props.groups === undefined) {
    return props.items.map((item, index) => ({
      kind: "item",
      key: getKey(item),
      item,
      index,
    }));
  }
  const groupStarts: Array<number> = [];
  let groupStart = 0;
  for (const group of props.groups) {
    groupStarts.push(groupStart);
    groupStart += group.items.length;
  }
  return props.groups.flatMap(
    (group, groupIndex): ReadonlyArray<Row<T>> => [
      { kind: "header", key: `group:${group.key}`, group },
      ...group.items.map(
        (item, offset): Row<T> => ({
          kind: "item",
          key: getKey(item),
          item,
          index: (groupStarts[groupIndex] ?? 0) + offset,
        })
      ),
    ]
  );
};

/** The last header at or above `row`, the one that sticks while it scrolls. */
const headerAbove = (
  headerRows: ReadonlyArray<number>,
  row: number
): number | undefined => headerRows.findLast((header) => header <= row);

/** A group's title, after its avatar, with its caption at the end. */
const GroupHeader = ({ group }: { readonly group: GroupHeading }) => (
  <Stack direction="row" align="center" gap={8}>
    {group.leading !== undefined && (
      // The label names the group; its avatar is decoration.
      <span aria-hidden="true" {...stylex.props(styles.headerLeading)}>
        {group.leading}
      </span>
    )}
    <span {...stylex.props(styles.headerLabel)}>
      {group.leading === undefined ? (
        <Text variant="overline" tone="muted" as="div" truncate>
          {group.label}
        </Text>
      ) : (
        <Text weight="medium" truncate>
          {group.label}
        </Text>
      )}
    </span>
    {group.caption !== undefined && (
      <span {...stylex.props(styles.headerCaption)}>
        <Text variant="caption" tone="muted" numeric>
          {group.caption}
        </Text>
      </span>
    )}
  </Stack>
);

/**
 * A long list that renders only the rows in view, in a focusable scrolling
 * region. Rows are measured, so they may wrap and grow as the container
 * narrows; the list reads its own width, never the window's. The region is a
 * size container, so its rows' container sizes follow the list's width, such
 * as in a split view's narrow column. Items may come in titled groups, and
 * more load when the last row scrolls into view. An edge that cuts rows off
 * fades them out, deeper the more lies past it; a sticky group title marks
 * the top edge instead.
 */
export const VirtualList = <T,>({
  label,
  getKey,
  renderItem,
  estimateSize = 64,
  maxHeight,
  grow = false,
  activeIndex,
  listRole = "list",
  multiselectable = false,
  listId,
  onEndReached,
  hasMore = false,
  loadingMore = false,
  loadingMoreLabel,
  headerInsetEnd,
  ...itemsOrGroups
}: VirtualListProps<T>) => {
  // TanStack Virtual is not compiler-safe.
  "use no memo";
  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = toRows<T>(itemsOrGroups, getKey);
  const sticky = itemsOrGroups.stickyHeaders === true;
  const headerRows = rows.flatMap((row, rowIndex) =>
    row.kind === "header" ? [rowIndex] : []
  );

  const rangeExtractor = (range: Range) => {
    const visible = defaultRangeExtractor(range);
    const header = headerAbove(headerRows, range.startIndex);
    if (!sticky || header === undefined || visible.includes(header)) {
      return visible;
    }
    return [header, ...visible];
  };

  // biome-ignore lint/nursery/useReactCompiler: this component opts out with "use no memo", which Biome's incompatible-library check does not read.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    getItemKey: (rowIndex) => rows[rowIndex]?.key ?? rowIndex,
    overscan: 8,
    rangeExtractor,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const stickyRow = sticky
    ? headerAbove(headerRows, virtualizer.range?.startIndex ?? 0)
    : undefined;

  const lastRendered = virtualRows.at(-1)?.index ?? -1;
  const endReached = rows.length > 0 && lastRendered >= rows.length - 1;
  // The rows loaded so far: their count and last key. A page sorted in before
  // the same last row still changes the count.
  const loadedRows = `${rows.length}:${rows.at(-1)?.key ?? ""}`;
  // The rows more were asked after, so a failed load isn't retried in a loop
  // while `hasMore` stays set.
  const requestedAfter = useRef<string | undefined>(undefined);
  const requestMore = useEffectEvent(() => onEndReached?.());
  useEffect(() => {
    if (
      endReached &&
      hasMore &&
      !loadingMore &&
      requestedAfter.current !== loadedRows
    ) {
      requestedAfter.current = loadedRows;
      requestMore();
    }
  }, [endReached, hasMore, loadingMore, loadedRows]);

  const revealActive = useEffectEvent((itemIndex: number) => {
    const scrollElement = scrollRef.current;
    const rowIndex = rows.findIndex(
      (row) => row.kind === "item" && row.index === itemIndex
    );
    const measured = virtualizer.measurementsCache[rowIndex];
    if (scrollElement === null || measured === undefined) return;
    const header = sticky ? headerAbove(headerRows, rowIndex) : undefined;
    const covered =
      header === undefined
        ? 0
        : (virtualizer.measurementsCache[header]?.size ?? 0);
    if (measured.start - covered < scrollElement.scrollTop) {
      virtualizer.scrollToOffset(measured.start - covered);
    } else if (
      measured.end >
      scrollElement.scrollTop + scrollElement.clientHeight
    ) {
      virtualizer.scrollToIndex(rowIndex, { align: "end" });
    }
  });
  useEffect(() => {
    if (activeIndex !== undefined) revealActive(activeIndex);
  }, [activeIndex]);

  const totalSize = virtualizer.getTotalSize();

  const [edges, setEdges] = useState<ScrollEdges>({ start: 0, end: 0 });
  const updateEdges = (element: HTMLElement) => {
    const next = scrollEdges(element);
    setEdges((current) =>
      current.start === next.start && current.end === next.end ? current : next
    );
  };
  const measureEdges = useEffectEvent(() => {
    if (scrollRef.current !== null) updateEdges(scrollRef.current);
  });
  // Measured after each render, as rows load and settle their heights, and
  // as the region resizes; scrolling measures in `onScroll`. The observer is
  // created once: one created anew while the rows' own observer settles
  // their heights would miss its first notification.
  useEffect(() => {
    measureEdges();
  });
  useEffect(() => {
    const element = scrollRef.current;
    if (element === null) return;
    const resizes = new ResizeObserver(() => measureEdges());
    resizes.observe(element);
    return () => resizes.disconnect();
  }, []);
  const listProps = {
    id: listId,
    ...stylex.props(styles.list, dynamicStyles.height(totalSize)),
  };
  const listRows = virtualRows.map((virtualRow) => {
    const row = rows[virtualRow.index];
    if (row === undefined) return null;
    const isSticky = virtualRow.index === stickyRow;
    return (
      <div
        key={virtualRow.key}
        ref={virtualizer.measureElement}
        data-index={virtualRow.index}
        role={
          row.kind === "item" && listRole === "list"
            ? "listitem"
            : "presentation"
        }
        {...stylex.props(
          isSticky
            ? styles.stickyRow
            : [styles.row, dynamicStyles.offset(virtualRow.start)],
          row.kind === "header" && styles.header,
          row.kind === "header" &&
            headerInsetEnd !== undefined &&
            headerInsetEndStyles[headerInsetEnd]
        )}
      >
        {row.kind === "header" ? (
          <GroupHeader group={row.group} />
        ) : (
          renderItem(row.item, row.index)
        )}
      </div>
    );
  });

  const loadingMoreRow = loadingMore && (
    <div {...stylex.props(styles.loadingMore)}>
      {loadingMoreLabel === undefined ? (
        <Spinner />
      ) : (
        <Spinner label={loadingMoreLabel} />
      )}
    </div>
  );
  const rootProps = {
    ref: scrollRef,
    onScroll: (event: { readonly currentTarget: HTMLElement }) =>
      updateEdges(event.currentTarget),
    ...stylex.props(
      scrollPaneStyles.pane,
      styles.root,
      scrollStyles.stableGutter,
      focusRingStyles.visible,
      focusRingStyles.inset,
      dynamicStyles.fade(sticky ? 0 : edges.start, edges.end),
      maxHeight && scrollPaneMaxHeightStyles[maxHeight],
      maxHeight && grow && styles.grow,
      maxHeight && grow && growBasisStyles[maxHeight](totalSize)
    ),
  };

  // As a listbox the owner keeps the keyboard, so the region is neither a
  // tab stop, where the arrow keys would scroll but not select, nor a second
  // named landmark.
  if (listRole === "listbox") {
    return (
      <div tabIndex={-1} {...rootProps}>
        <div
          role="listbox"
          aria-label={label}
          aria-multiselectable={multiselectable || undefined}
          {...listProps}
        >
          {listRows}
        </div>
        {loadingMoreRow}
      </div>
    );
  }
  return (
    <section
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must take focus so keyboard users can scroll it (WCAG 2.1.1, axe scrollable-region-focusable), as ScrollArea's viewport does.
      tabIndex={0}
      aria-label={label}
      {...rootProps}
    >
      {/* The list takes the region's name. */}
      {/* biome-ignore lint/a11y/useSemanticElements: group headers are presentation rows, which an ARIA list allows but a <ul>, holding only <li>, does not. */}
      <div role="list" {...listProps}>
        {listRows}
      </div>
      {loadingMoreRow}
    </section>
  );
};

const styles = stylex.create({
  root: {
    containerType: "inline-size",
    flexGrow: 1,
    scrollbarWidth: "thin",
    height: "100%",
    minHeight: 0,
    overflowY: "auto",
    width: "100%",
  },
  // Grown, it lifts its cap: its flex basis below is what it asks for, and
  // the column's leftover space is what it takes beyond that. Its minimum
  // stays 0, so a shorter column shrinks it.
  grow: { maxHeight: "none", minHeight: 0 },
  list: {
    position: "relative",
    width: "100%",
  },
  row: {
    insetInlineStart: 0,
    position: "absolute",
    top: 0,
    width: "100%",
  },
  stickyRow: {
    position: "sticky",
    zIndex: layer.sticky,
    top: 0,
    width: "100%",
  },
  header: {
    paddingBlock: space[8],
    // As a `ListRow`'s, so a title lines up with its rows' avatars.
    paddingInline: space[12],
    backgroundColor: color.background,
    // Its padding falls inside the row's width, so it ends where items do.
    boxSizing: "border-box",
  },
  headerLeading: { display: "flex", flexShrink: 0 },
  headerLabel: { flexGrow: 1, minWidth: 0 },
  headerCaption: { flexShrink: 0, whiteSpace: "nowrap" },
  loadingMore: {
    paddingBlock: space[16],
    display: "flex",
    justifyContent: "center",
  },
});

// The header's own padding plus the space a flat `ListRow` reserves for its
// check after its values: the row's gap and the check's width.
const headerInsetEndStyles = stylex.create({
  checkSlot: {
    paddingInlineEnd: `calc(${space[12]} + ${space[12]} + ${iconSize.md})`,
  },
});

// Grown, the list asks for its rows' height up to its cap.
const growBasisStyles = stylex.create({
  sm: (total: number) => ({
    flexBasis: `min(${total}px, ${scrollAreaMaxHeight.sm})`,
  }),
  md: (total: number) => ({
    flexBasis: `min(${total}px, ${scrollAreaMaxHeight.md})`,
  }),
  lg: (total: number) => ({
    flexBasis: `min(${total}px, ${scrollAreaMaxHeight.lg})`,
  }),
});

// Virtualizer sizes and scroll distances are runtime values.
const dynamicStyles = stylex.create({
  // How far the rows run past each edge, which sets its fade
  // (`scrollPaneStyles.pane`).
  fade: (start: number, end: number) => ({
    [scrollFadeVars.start]: `${start}px`,
    [scrollFadeVars.end]: `${end}px`,
  }),
  height: (total: number) => ({ height: `${total}px` }),
  offset: (start: number) => ({ transform: `translateY(${start}px)` }),
});
