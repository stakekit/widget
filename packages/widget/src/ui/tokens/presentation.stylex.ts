import * as stylex from "@stylexjs/stylex";
import { controlHeight } from "./size.stylex";

/**
 * Presentation settings: values application composition picks per Layout,
 * named after the difference. The defaults are the Compact Layout's; the
 * theme root declares the ones requested on itself, so values that reference
 * other tokens resolve against the root's (not `:root`'s) tokens.
 */
export const presentation = stylex.defineVars({
  callToActionHeight: controlHeight.lg,
  gutter: "16px",
});
