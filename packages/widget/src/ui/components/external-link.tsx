import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { Icon } from "../primitives/icon";
import { color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import {
  ButtonContent,
  type ButtonLookProps,
  buttonLook,
} from "./button-styles";
import { focusRingStyles } from "./focus-ring";

type ExternalLinkProps = {
  readonly href: string;
  /** Names the trailing icon, such as "opens in a new tab". */
  readonly newTabLabel: string;
  /** Called as the link opens, such as to record the visit. */
  readonly onClick?: (() => void) | undefined;
  /**
   * Draws the link as a button with this look, for an action that leaves for
   * another site, such as viewing an account on a block explorer. The
   * new-tab icon takes the end.
   */
  readonly button?: Omit<ButtonLookProps, "iconEnd">;
  readonly children: ReactNode;
};

/**
 * A link to another site, such as a block explorer. It opens in a new tab
 * without giving that page access to this one, and says so: the trailing
 * icon is named `newTabLabel`. Inline, it takes the surrounding type role;
 * with `button`, it has a button's look.
 */
export const ExternalLink = ({
  href,
  newTabLabel,
  onClick,
  button,
  children,
}: ExternalLinkProps) => {
  const link = { href, target: "_blank", rel: "noopener noreferrer", onClick };

  if (button) {
    const size = button.size ?? "md";
    return (
      <a
        {...link}
        {...buttonLook(
          button.variant ?? "secondary",
          size,
          button.share ?? false
        )}
      >
        <ButtonContent
          size={size}
          iconStart={button.iconStart}
          iconEnd="ExternalLinkIcon"
          iconEndLabel={newTabLabel}
        >
          {children}
        </ButtonContent>
      </a>
    );
  }

  return (
    <a {...link} {...stylex.props(styles.root, focusRingStyles.visible)}>
      {children}
      <Icon name="ExternalLinkIcon" size="sm" label={newTabLabel} />
    </a>
  );
};

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
