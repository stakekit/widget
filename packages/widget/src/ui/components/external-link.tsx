import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { Icon } from "../primitives/icon";
import { color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import { focusRingStyles } from "./focus-ring";

/**
 * An inline link to another site, such as a block explorer. It opens in a new
 * tab without giving that page access to this one, and says so: the trailing
 * icon is named `newTabLabel`. It takes the surrounding type role.
 */
export const ExternalLink = ({
  href,
  newTabLabel,
  children,
}: {
  readonly href: string;
  /** Names the trailing icon, such as "opens in a new tab". */
  readonly newTabLabel: string;
  readonly children: ReactNode;
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    {...stylex.props(styles.root, focusRingStyles.visible)}
  >
    {children}
    <Icon name="ExternalLinkIcon" size="sm" label={newTabLabel} />
  </a>
);

const styles = stylex.create({
  root: {
    borderRadius: radius.badge,
    gap: space[4],
    textDecoration: { default: "none", ":hover": "underline" },
    alignItems: "center",
    color: color.accentText,
    display: "inline-flex",
  },
});
