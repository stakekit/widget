import * as stylex from "@stylexjs/stylex";

/** Control heights; a host may change them. */
export const controlHeight = stylex.defineVars({
  sm: "32px",
  md: "40px",
  lg: "48px",
});

/**
 * The least hit area of a control under a coarse pointer (`pointer.coarse`),
 * whatever its drawn size: a touch target's 44px.
 */
export const hitArea = stylex.defineConsts({
  coarse: "44px",
});

/** Icon sizes; `xl` is for an icon that illustrates, as in a `Spot`. */
export const iconSize = stylex.defineConsts({
  sm: "16px",
  md: "20px",
  lg: "24px",
  xl: "32px",
});

/** A `Steps` marker: the circle that shows a step's status. */
export const stepMarkerSize = stylex.defineConsts({
  md: "24px",
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

/**
 * A list row's least height: `condensed`, a condensed row with a `sm` avatar,
 * which a virtualized list of them also takes as a row's expected height.
 */
export const listRowHeight = stylex.defineConsts({
  condensed: "40px",
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
 * Avatar sizes: `sm` sits in a row of text, `lg` heads an asset's or an
 * action's details, `hero` a completed action's summary and `xl` a
 * position's or a finished transaction's page.
 * `control` and `card` are not steps of the scale but roles: the avatar that
 * leads a control, a token trigger or a condensed picker row, sized to that
 * control's height, and the avatar that leads a card's heading, such as an
 * account's, as tall as a heading over a caption.
 */
export const avatarSize = stylex.defineConsts({
  xs: "16px",
  sm: "24px",
  control: "28px",
  md: "32px",
  card: "40px",
  lg: "48px",
  hero: "56px",
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
  card: "16px",
  lg: "20px",
  hero: "22px",
  xl: "32px",
});

/**
 * A token trigger's height: `md` a touch-sized pill around a `control`
 * avatar; `sm` a wallet header's pill around an `sm` avatar, as tall as a
 * small control. `tabs` is a role, not a step: as tall as a `Tabs` list, on
 * the 4px grid, so the tabs and the pills beside them share one row height.
 */
export const tokenTriggerHeight = stylex.defineConsts({
  sm: "32px",
  tabs: "40px",
  md: "44px",
});

/** Named widths, one per container size. */
export const containerWidth = stylex.defineConsts({
  sm: "400px",
  md: "520px",
  split: "960px",
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

/**
 * A `Spot`'s disc: `md` heads a message in a page section, `lg` a dialog or a
 * notice that fills the Widget, inside a `halo` ring.
 */
export const spotSize = stylex.defineConsts({
  md: "48px",
  lg: "64px",
  halo: "96px",
});

/**
 * The least height of the Widget's frame, per frame width, so the frame
 * keeps its height between pages and states: a short page, such as an empty
 * list or an error, centers in it instead of shrinking the Widget.
 */
export const frameMinHeight = stylex.defineConsts({
  narrow: "640px",
  wide: "720px",
});

/** Stand-in heights for blocks taller than a control, such as an amount panel. */
export const skeletonHeight = stylex.defineConsts({
  panel: "112px",
  section: "160px",
});
