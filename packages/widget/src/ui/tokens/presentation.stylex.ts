import * as stylex from "@stylexjs/stylex";

import { controlHeight } from "./size.stylex";

// Presentation Settings carried as values, one variable group per setting so
// the theme root applies one theme per setting's value and they compose: a
// theme replaces only other themes over its own group. The defaults are the
// theme root's defaults; the theme root declares the requested ones on
// itself, so values that reference other tokens resolve against the root's
// (not `:root`'s) tokens.

/** The call-to-action height: the `md` or `lg` control height. */
export const callToAction = stylex.defineVars({
  height: controlHeight.lg,
});

/** The gap between a page's sections and its edge. */
export const gutter = stylex.defineVars({
  size: "16px",
});

/**
 * Marks the theme root and the host portal container, which carry the
 * Presentation Settings that change which styles apply rather than a value:
 * `data-sk-tabs-indicator` (`underline`, `pill` or `tint`) and
 * `data-sk-surface-style` (`filled`, `elevated` or `outlined`). A component
 * reads one with an ancestor condition written in its own style map:
 * `[stylex.when.ancestor('[data-sk-tabs-indicator="pill"]', presentationMarker)]`.
 */
export const presentationMarker = stylex.defineMarker();
