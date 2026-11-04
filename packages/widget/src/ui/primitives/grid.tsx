import * as stylex from "@stylexjs/stylex";
import { createElement } from "react";
import {
  type Align,
  alignStyles,
  type Columns,
  columnsStyles,
  flexItemStyles,
  gapStyles,
  type LayoutElementProps,
  layoutStyles,
  type Responsive,
  type Space,
} from "./layout";

type GridProps = LayoutElementProps & {
  /**
   * One to four equal columns, or a named template: `metrics` fits as many
   * metric columns as the width allows, `split` is the split view's aside and
   * main pane.
   */
  readonly columns?: Responsive<Columns>;
  readonly gap?: Responsive<Space>;
  /** Cross-axis alignment of each cell. */
  readonly align?: Responsive<Align>;
  /** Takes the remaining space in a parent row or column. */
  readonly grow?: boolean;
};

/** Lays out its children in columns. */
export const Grid = ({
  as = "div",
  columns = 1,
  gap = 0,
  align = "stretch",
  grow = false,
  children,
  ...rest
}: GridProps) =>
  createElement(
    as,
    {
      ...rest,
      ...stylex.props(
        styles.root,
        layoutStyles.columns,
        layoutStyles.gap,
        layoutStyles.align,
        columnsStyles(columns),
        gapStyles(gap),
        alignStyles(align),
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
    display: "grid",
    minWidth: 0,
  },
});
