import * as stylex from "@stylexjs/stylex";

/**
 * Container sizes, the only thresholds for in-Widget layout. Each query
 * applies from its width up and reads the nearest size container: the Widget
 * root and each `SplitView` pane are ones. Whether the Dashboard splits is
 * not a query: see `splitMarker`.
 */
export const container = stylex.defineConsts({
  sm: "@container (min-width: 400px)",
  md: "@container (min-width: 520px)",
});

/**
 * Marks a `WidgetFrame`, which carries `data-sk-split` while it is at least
 * 960 CSS px wide: a `SplitView` sets its panes side by side, a `Grid` uses
 * its `split` columns, and a `wide` frame lets its header span the frame,
 * under `[stylex.when.ancestor("[data-sk-split]", splitMarker)]`; narrower,
 * the Dashboard stacks in one column. The frame measures its width rather
 * than a container query reading it, because Safari's page zoom scales the
 * width a container query compares (WebKit bug 319197), so a zoomed-out
 * Safari stacked a frame wide enough to split.
 */
export const splitMarker = stylex.defineMarker();

/**
 * The container sizes as bands, each from its size up to the next. A property
 * that reads a value at more than one size uses these: queries of equal
 * specificity that overlap resolve by source order, which StyleX does not
 * guarantee, so a smaller size's value could win over a larger one's.
 */
export const containerBand = stylex.defineConsts({
  sm: "@container (400px <= width < 520px)",
  md: "@container (min-width: 520px)",
});
