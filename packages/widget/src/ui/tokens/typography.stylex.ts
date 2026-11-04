import * as stylex from "@stylexjs/stylex";

/** The system stacks; a host may replace them. */
export const font = stylex.defineVars({
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
});

/** A host may lighten or strengthen the scale. */
export const fontWeight = stylex.defineVars({
  regular: "400",
  medium: "500",
  semibold: "600",
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
