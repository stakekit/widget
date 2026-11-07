import * as stylex from "@stylexjs/stylex";
import { createElement } from "react";
import {
  containerWidth,
  controlHeight,
  tokenTriggerHeight,
} from "../tokens/size.stylex";
import {
  flexItemStyles,
  type LayoutElementProps,
  layoutStyles,
  paddingBlockStyles,
  paddingInlineStyles,
  type Responsive,
  type Space,
} from "./layout";
import { scrollStyles } from "./scroll";

type BoxProps = LayoutElementProps & {
  readonly padding?: Responsive<Space>;
  /** Wins over `padding` on the block axis. */
  readonly paddingBlock?: Responsive<Space>;
  /** Wins over `padding` on the inline axis. */
  readonly paddingInline?: Responsive<Space>;
  /** `full` fills the parent; `fit` shrinks to the content. */
  readonly width?: keyof typeof widthStyles;
  /** Caps the width at a container size. */
  readonly maxWidth?: keyof typeof maxWidthStyles;
  /**
   * Holds at least a control height, or a pill `Tabs` list's (`tabs`), such
   * as a row kept for controls that are not shown yet, so what follows does
   * not move when they appear.
   */
  readonly minHeight?: keyof typeof minHeightStyles;
  /** Takes the remaining space in a row or column. */
  readonly grow?: boolean;
  readonly position?: keyof typeof positionStyles;
  readonly overflow?: keyof typeof overflowStyles;
};

/** A block with padding, a named width, position and overflow. */
export const Box = ({
  as = "div",
  padding = 0,
  paddingBlock = padding,
  paddingInline = padding,
  width,
  maxWidth,
  minHeight,
  grow = false,
  position,
  overflow,
  children,
  testId,
  hostHook,
  ...rest
}: BoxProps) =>
  createElement(
    as,
    {
      ...rest,
      "data-testid": testId,
      "data-rk": hostHook,
      ...stylex.props(
        styles.root,
        layoutStyles.paddingBlock,
        layoutStyles.paddingInline,
        paddingBlockStyles(paddingBlock),
        paddingInlineStyles(paddingInline),
        width && widthStyles[width],
        maxWidth && maxWidthStyles[maxWidth],
        minHeight && minHeightStyles[minHeight],
        grow && flexItemStyles.grow,
        position && positionStyles[position],
        overflow && overflowStyles[overflow],
        overflow === "auto" && scrollStyles.stableGutter
      ),
    },
    children
  );

const styles = stylex.create({
  root: { margin: 0, listStyle: "none", boxSizing: "border-box", minWidth: 0 },
});

const widthStyles = stylex.create({
  full: { width: "100%" },
  fit: { width: "fit-content" },
});

const maxWidthStyles = stylex.create({
  sm: { maxWidth: containerWidth.sm },
  md: { maxWidth: containerWidth.md },
  split: { maxWidth: containerWidth.split },
});

const minHeightStyles = stylex.create({
  controlSm: { minHeight: controlHeight.sm },
  controlMd: { minHeight: controlHeight.md },
  controlLg: { minHeight: controlHeight.lg },
  tabs: { minHeight: tokenTriggerHeight.tabs },
});

const positionStyles = stylex.create({
  relative: { position: "relative" },
  sticky: { insetBlockStart: 0, position: "sticky" },
});

const overflowStyles = stylex.create({
  hidden: { overflow: "hidden" },
  auto: { overflow: "auto" },
});
