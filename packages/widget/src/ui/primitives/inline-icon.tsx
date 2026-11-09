import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { space } from "../tokens/space.stylex";
import { lineHeight } from "../tokens/typography.stylex";
import type { TypeRole } from "./type-role";

/**
 * An icon or spinner set inline at the start of a run of text and centered on
 * its first line, so wrapped lines start at the text's own left edge, under
 * the icon, rather than beside it. Place it inside the `Text`, before the
 * text; `variant` is that `Text`'s type role, whose line height the icon box
 * takes.
 */
export const InlineIcon = ({
  variant,
  gap,
  children,
}: {
  readonly variant: TypeRole;
  /** The space between the icon and the text after it. */
  readonly gap: keyof typeof gapStyles;
  /** An `Icon` or `Spinner` no taller than the role's line height. */
  readonly children: ReactNode;
}) => (
  <span {...stylex.props(styles.root(lineHeight[variant]), gapStyles[gap])}>
    {children}
  </span>
);

const styles = stylex.create({
  root: (height: string) => ({
    alignItems: "center",
    display: "inline-flex",
    verticalAlign: "top",
    height,
  }),
});

const gapStyles = stylex.create({
  4: { marginInlineEnd: space[4] },
  8: { marginInlineEnd: space[8] },
});
