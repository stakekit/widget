import * as stylex from "@stylexjs/stylex";
import { controlHeight } from "./size.stylex";

/**
 * Presentation settings: values application composition picks per Layout,
 * named after the difference. The defaults are the Compact Layout's; the
 * theme root applies the ones requested.
 */
export const presentation = stylex.defineVars({
  callToActionHeight: controlHeight.lg,
  gutter: "16px",
});
