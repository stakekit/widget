import * as stylex from "@stylexjs/stylex";

/** Control heights; a host may change them. */
export const controlHeight = stylex.defineVars({
  sm: "32px",
  md: "40px",
  lg: "48px",
});

/** Icon sizes. */
export const iconSize = stylex.defineConsts({
  sm: "16px",
  md: "20px",
  lg: "24px",
});

/** A `Steps` marker: the circle that shows a step's status. */
export const stepMarkerSize = stylex.defineConsts({
  md: "28px",
});

/**
 * Checkbox and switch boxes. The switch thumb travels the track's width less
 * its height.
 */
export const selectionControlSize = stylex.defineConsts({
  checkbox: "20px",
  switchWidth: "36px",
  switchHeight: "20px",
  switchThumb: "16px",
});

/** Height caps a scroll area can take; unset, it fills its parent. */
export const scrollAreaMaxHeight = stylex.defineConsts({
  sm: "200px",
  md: "320px",
  lg: "480px",
});

/** A time-series chart's height, axes included. */
export const chartHeight = stylex.defineConsts({
  md: "160px",
});

/**
 * Avatar sizes: `sm` sits in a row of text, `lg` heads the account dialog and
 * `xl` a position's or a finished transaction's page. `control` is not a step
 * of the scale but a role: the avatar that leads a control, a token trigger
 * or a condensed picker row, sized to that control's height.
 */
export const avatarSize = stylex.defineConsts({
  xs: "16px",
  sm: "24px",
  control: "28px",
  md: "32px",
  lg: "48px",
  xl: "80px",
});

/**
 * The network badge on a token avatar, per avatar size: about two fifths of
 * the avatar, its ring included, so it stays inside the avatar's footprint.
 */
export const avatarBadgeSize = stylex.defineConsts({
  xs: "7px",
  sm: "10px",
  control: "12px",
  md: "14px",
  lg: "20px",
  xl: "32px",
});

/** A token trigger's height: a touch-sized pill around a `control` avatar. */
export const tokenTriggerHeight = stylex.defineConsts({
  md: "44px",
});

/** Named widths, one per container size. */
export const containerWidth = stylex.defineConsts({
  sm: "400px",
  md: "520px",
  split: "800px",
});

/** The widest a `WidgetFrame` grows: a frame that lays out a split view. */
export const frameMaxWidth = stylex.defineConsts({
  wide: "1000px",
});

/**
 * Grid tracks: the narrowest metric before metrics wrap, and the aside of the
 * split view.
 */
export const gridTrack = stylex.defineConsts({
  metricMin: "120px",
  splitAside: "380px",
});

/**
 * The least height of a split view's secondary pane, which otherwise takes
 * the primary pane's height and scrolls what overflows it.
 */
export const splitPaneMinHeight = stylex.defineConsts({
  secondary: "620px",
});

/** The one-pixel box that keeps visually hidden content readable. */
export const visuallyHiddenBox = stylex.defineConsts({
  size: "1px",
  margin: "-1px",
});

/** Illustration sizes: `md` beside a message, `lg` heading a dialog. */
export const illustrationSize = stylex.defineConsts({
  md: "240px",
  lg: "320px",
});

/** Stand-in heights for blocks taller than a control, such as an amount panel. */
export const skeletonHeight = stylex.defineConsts({
  panel: "112px",
  section: "160px",
});
