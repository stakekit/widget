import * as stylex from "@stylexjs/stylex";

/**
 * The one viewport query, used only for how an overlay is presented: a bottom
 * sheet below 520px wide, a centered dialog from 520px up. In-Widget layout
 * responds to container width instead.
 */
export const viewport = stylex.defineConsts({
  dialog: "@media (min-width: 520px)",
} as const);
