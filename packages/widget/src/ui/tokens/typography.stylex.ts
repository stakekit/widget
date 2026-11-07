import * as stylex from "@stylexjs/stylex";

const systemSans =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * The system stacks; no webfont is loaded, and an Appearance Preset sets its
 * own system stack. `figure` sets amounts, rates and balances (the `display`
 * and `metric` roles, and tabular text): the sans stack unless a preset sets
 * figures apart, such as Porto's monospace numerals. A host's `sans`
 * replaces `figure` too, so the host's font wins over a preset's.
 */
export const font = stylex.defineVars({
  sans: systemSans,
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  figure: systemSans,
});

/**
 * Letter spacing: the large `display` figures draw tighter than their
 * glyphs' default, as large type does.
 */
export const tracking = stylex.defineConsts({
  display: "-0.02em",
});

/** A host may lighten or strengthen the scale. */
export const fontWeight = stylex.defineVars({
  regular: "400",
  medium: "500",
  semibold: "600",
});

/**
 * The weight of the big figures a page leads with, the `display` role and
 * the amount being entered. An Appearance Preset may set it apart from the
 * scale, such as a regular-weight amount over semibold headings.
 */
export const figureWeight = stylex.defineVars({
  display: "600",
});

/**
 * The `heading` role's weight: a step of the scale under the title's
 * `semibold`, `medium`, so the two read apart. The theme root sets it from
 * the scale beside the preset's and host's weights, so they reach it; an
 * Appearance Preset may keep its headings at `semibold`, as Utila does.
 */
export const roleWeight = stylex.defineVars({
  heading: "500",
});

/**
 * Type role sizes, in px so the host page's root font size does not scale
 * them. Each role pairs with the line height of the same key.
 */
export const fontSize = stylex.defineConsts({
  display: "32px",
  title: "20px",
  heading: "16px",
  metric: "18px",
  body: "14px",
  label: "13px",
  caption: "12px",
  overline: "11px",
});

export const lineHeight = stylex.defineConsts({
  display: "40px",
  title: "28px",
  heading: "24px",
  metric: "24px",
  body: "20px",
  label: "18px",
  caption: "16px",
  overline: "16px",
});

/**
 * The sizes an amount input steps down through as its amount fills it, from
 * the `display` role's size. Each keeps the `display` line height, so the
 * input's height holds still.
 */
export const displayShrinkSize = stylex.defineConsts({
  step0: fontSize.display,
  step1: "28px",
  step2: "24px",
  step3: "20px",
});
