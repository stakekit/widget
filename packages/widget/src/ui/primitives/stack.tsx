import * as stylex from "@stylexjs/stylex";
import { createElement } from "react";
import {
  type Align,
  alignStyles,
  type Direction,
  directionStyles,
  flexItemStyles,
  gapStyles,
  type Justify,
  justifyStyles,
  type LayoutElementProps,
  layoutStyles,
  type Responsive,
  type Space,
} from "./layout";

type StackProps = LayoutElementProps & {
  readonly direction?: Responsive<Direction>;
  /** Space between children; the only space a Stack adds. */
  readonly gap?: Responsive<Space>;
  /** Cross-axis alignment. */
  readonly align?: Responsive<Align>;
  /** Main-axis distribution. */
  readonly justify?: Responsive<Justify>;
  readonly wrap?: boolean;
  /** Takes the remaining space in a parent row or column. */
  readonly grow?: boolean;
};

/** Lays out its children in a row or a column. */
export const Stack = ({
  as = "div",
  direction = "column",
  gap = 0,
  align = "stretch",
  justify = "start",
  wrap = false,
  grow = false,
  children,
  testId,
  hostHook,
  ...rest
}: StackProps) =>
  createElement(
    as,
    {
      ...rest,
      "data-testid": testId,
      "data-rk": hostHook,
      ...stylex.props(
        styles.root,
        layoutStyles.direction,
        layoutStyles.gap,
        layoutStyles.align,
        layoutStyles.justify,
        directionStyles(direction),
        gapStyles(gap),
        alignStyles(align),
        justifyStyles(justify),
        wrap && styles.wrap,
        grow && flexItemStyles.grow
      ),
    },
    children
  );

const styles = stylex.create({
  root: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    boxSizing: "border-box",
    display: "flex",
    minWidth: 0,
  },
  wrap: { flexWrap: "wrap" },
});
