import * as stylex from "@stylexjs/stylex";
import type { AriaAttributes, AriaRole, ReactNode } from "react";

import type { HostHook } from "../host-hook";
import { containerBand } from "../tokens/container.stylex";
import { gutter } from "../tokens/presentation.stylex";
import { gridTrack } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { columnsVars as v } from "./layout.stylex";

/** Sets a layout primitive's flex direction. */
export const directionStyles = stylex.create({
  row: { flexDirection: "row" },
  column: { flexDirection: "column" },
  rowReverse: { flexDirection: "row-reverse" },
  columnReverse: { flexDirection: "column-reverse" },
});

/** Sets the space between a layout primitive's children. */
export const gapStyles = stylex.create({
  0: { gap: space[0] },
  2: { gap: space[2] },
  4: { gap: space[4] },
  6: { gap: space[6] },
  8: { gap: space[8] },
  12: { gap: space[12] },
  16: { gap: space[16] },
  20: { gap: space[20] },
  24: { gap: space[24] },
  32: { gap: space[32] },
  40: { gap: space[40] },
  48: { gap: space[48] },
  64: { gap: space[64] },
  section: { gap: space.section },
  gutter: { gap: gutter.size },
});

/** Sets a layout primitive's cross-axis alignment. */
export const alignStyles = stylex.create({
  start: { alignItems: "flex-start" },
  center: { alignItems: "center" },
  end: { alignItems: "flex-end" },
  stretch: { alignItems: "stretch" },
  baseline: { alignItems: "baseline" },
});

/** Sets a layout primitive's main-axis distribution. */
export const justifyStyles = stylex.create({
  start: { justifyContent: "flex-start" },
  center: { justifyContent: "center" },
  end: { justifyContent: "flex-end" },
  between: { justifyContent: "space-between" },
});

/** Sets a layout primitive's block-axis padding. */
export const paddingBlockStyles = stylex.create({
  0: { paddingBlock: space[0] },
  2: { paddingBlock: space[2] },
  4: { paddingBlock: space[4] },
  6: { paddingBlock: space[6] },
  8: { paddingBlock: space[8] },
  12: { paddingBlock: space[12] },
  16: { paddingBlock: space[16] },
  20: { paddingBlock: space[20] },
  24: { paddingBlock: space[24] },
  32: { paddingBlock: space[32] },
  40: { paddingBlock: space[40] },
  48: { paddingBlock: space[48] },
  64: { paddingBlock: space[64] },
  section: { paddingBlock: space.section },
  gutter: { paddingBlock: gutter.size },
});

/** Sets a layout primitive's inline-axis padding. */
export const paddingInlineStyles = stylex.create({
  0: { paddingInline: space[0] },
  2: { paddingInline: space[2] },
  4: { paddingInline: space[4] },
  6: { paddingInline: space[6] },
  8: { paddingInline: space[8] },
  12: { paddingInline: space[12] },
  16: { paddingInline: space[16] },
  20: { paddingInline: space[20] },
  24: { paddingInline: space[24] },
  32: { paddingInline: space[32] },
  40: { paddingInline: space[40] },
  48: { paddingInline: space[48] },
  64: { paddingInline: space[64] },
  section: { paddingInline: space.section },
  gutter: { paddingInline: gutter.size },
});

const ONE = "minmax(0, 1fr)";
const TWO = "repeat(2, minmax(0, 1fr))";
const THREE = "repeat(3, minmax(0, 1fr))";
const FOUR = "repeat(4, minmax(0, 1fr))";
const METRICS = `repeat(auto-fit, minmax(min(${gridTrack.metricMin}, 100%), 1fr))`;
const SPLIT = `minmax(0, ${gridTrack.splitAside}) minmax(0, 1fr)`;
// A centre cell at its content's width between two equal flanks, so the
// centre stays centred whatever each flank holds. Where the row is too
// narrow for that, each flank keeps its content's width and the centre
// gives up space first, so it never covers a flank's control.
const FLANKED =
  "minmax(max-content, 1fr) minmax(0, auto) minmax(max-content, 1fr)";

// A single `columns` value sets the track list itself.
const columnsFixed = stylex.create({
  1: { gridTemplateColumns: ONE },
  2: { gridTemplateColumns: TWO },
  3: { gridTemplateColumns: THREE },
  4: { gridTemplateColumns: FOUR },
  metrics: { gridTemplateColumns: METRICS },
  split: { gridTemplateColumns: SPLIT },
  flanked: { gridTemplateColumns: FLANKED },
});

// A responsive `columns` value sets one variable per container size. A size's
// map sets its own variable and every larger one, so a value applies from its
// size up; `columnsStyles` applies the maps smallest first.
const columnsBase = stylex.create({
  1: { [v.base]: ONE, [v.sm]: ONE, [v.md]: ONE, [v.split]: ONE },
  2: { [v.base]: TWO, [v.sm]: TWO, [v.md]: TWO, [v.split]: TWO },
  3: { [v.base]: THREE, [v.sm]: THREE, [v.md]: THREE, [v.split]: THREE },
  4: { [v.base]: FOUR, [v.sm]: FOUR, [v.md]: FOUR, [v.split]: FOUR },
  metrics: {
    [v.base]: METRICS,
    [v.sm]: METRICS,
    [v.md]: METRICS,
    [v.split]: METRICS,
  },
  split: { [v.base]: SPLIT, [v.sm]: SPLIT, [v.md]: SPLIT, [v.split]: SPLIT },
  flanked: {
    [v.base]: FLANKED,
    [v.sm]: FLANKED,
    [v.md]: FLANKED,
    [v.split]: FLANKED,
  },
});
const columnsSm = stylex.create({
  1: { [v.sm]: ONE, [v.md]: ONE, [v.split]: ONE },
  2: { [v.sm]: TWO, [v.md]: TWO, [v.split]: TWO },
  3: { [v.sm]: THREE, [v.md]: THREE, [v.split]: THREE },
  4: { [v.sm]: FOUR, [v.md]: FOUR, [v.split]: FOUR },
  metrics: { [v.sm]: METRICS, [v.md]: METRICS, [v.split]: METRICS },
  split: { [v.sm]: SPLIT, [v.md]: SPLIT, [v.split]: SPLIT },
  flanked: { [v.sm]: FLANKED, [v.md]: FLANKED, [v.split]: FLANKED },
});
const columnsMd = stylex.create({
  1: { [v.md]: ONE, [v.split]: ONE },
  2: { [v.md]: TWO, [v.split]: TWO },
  3: { [v.md]: THREE, [v.split]: THREE },
  4: { [v.md]: FOUR, [v.split]: FOUR },
  metrics: { [v.md]: METRICS, [v.split]: METRICS },
  split: { [v.md]: SPLIT, [v.split]: SPLIT },
  flanked: { [v.md]: FLANKED, [v.split]: FLANKED },
});
const columnsSplit = stylex.create({
  1: { [v.split]: ONE },
  2: { [v.split]: TWO },
  3: { [v.split]: THREE },
  4: { [v.split]: FOUR },
  metrics: { [v.split]: METRICS },
  split: { [v.split]: SPLIT },
  flanked: { [v.split]: FLANKED },
});

// Reads the responsive `columns` variables at each container size.
const columnsBySize = stylex.create({
  read: {
    gridTemplateColumns: {
      default: v.base,
      [containerBand.sm]: v.sm,
      [containerBand.md]: v.md,
      [containerBand.split]: v.split,
    },
  },
});

/** A flex direction a `Stack` can take. */
export type Direction = keyof typeof directionStyles;

/** A step on the spacing scale, or the named `section` and `gutter` insets. */
export type Space = keyof typeof gapStyles;

/** A cross-axis alignment. */
export type Align = keyof typeof alignStyles;

/** A main-axis distribution. */
export type Justify = keyof typeof justifyStyles;

/** A column count, or the named `metrics`, `split` and `flanked` tracks. */
type Columns = keyof typeof columnsFixed;

/**
 * Columns that can change with the container's width: `base` applies at
 * every width, and `sm`, `md` and `split` from their container size up.
 */
export type ResponsiveColumns =
  | Columns
  | ({ readonly base: Columns } & Partial<
      Record<"sm" | "md" | "split", Columns>
    >);

/** The styles that set a grid's columns, smallest container size first. */
export const columnsStyles = (value: ResponsiveColumns) => {
  if (typeof value !== "object") return [columnsFixed[value]];
  const { base, sm, md, split } = value;
  return [
    columnsBySize.read,
    columnsBase[base],
    sm !== undefined && columnsSm[sm],
    md !== undefined && columnsMd[md],
    split !== undefined && columnsSplit[split],
  ];
};

/** The elements a layout primitive can render. */
type LayoutElement =
  | "div"
  | "span"
  | "section"
  | "article"
  | "header"
  | "footer"
  | "aside"
  | "nav"
  | "main"
  | "ul"
  | "ol"
  | "li";

/** Props every layout primitive passes through to its element. */
export type LayoutElementProps = {
  readonly as?: LayoutElement;
  readonly id?: string;
  readonly role?: AriaRole;
  readonly children?: ReactNode;
  /** Rendered as `data-testid`, for tests and hosts that locate the element. */
  readonly testId?: string | undefined;
  /** Rendered as `data-rk`, a hook a host's stylesheet or script relies on. */
  readonly hostHook?: HostHook;
} & Pick<
  AriaAttributes,
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  | "aria-live"
  | "aria-busy"
>;

/** Shared by the layout primitives: `grow` takes the remaining space in a row. */
export const flexItemStyles = stylex.create({
  grow: { flexGrow: 1, minWidth: 0 },
});
