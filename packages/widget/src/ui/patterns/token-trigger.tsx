import * as stylex from "@stylexjs/stylex";
import type { ButtonHTMLAttributes, Ref } from "react";
import { TokenAvatar } from "../components/avatar";
import { focusRingStyles } from "../components/focus-ring";
import { Icon } from "../primitives/icon";
import { Text } from "../primitives/text";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { elevation } from "../tokens/elevation.stylex";
import { motion } from "../tokens/motion.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import { font } from "../tokens/typography.stylex";
import type { TokenLogo } from "./token";

type TokenTriggerProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "style" | "children" | "type"
> & {
  readonly ref?: Ref<HTMLButtonElement>;
  /** The chosen token; its name shows as the trigger's text. */
  readonly token: TokenLogo;
  /**
   * Shows the token without a caret or a button, when there is no other
   * token to choose. The button props then do not apply.
   */
  readonly readOnly?: boolean;
};

/**
 * The chosen token beside an amount: its logo with the network badge and its
 * symbol on a raised pill. As a button it shows a caret and forwards its ref
 * and props, so it can be a `Modal` or `SelectSheet` trigger.
 */
export const TokenTrigger = ({
  token,
  readOnly = false,
  ...rest
}: TokenTriggerProps) => {
  const content = (
    <>
      <TokenAvatar {...token} size="sm" decorative />
      <Text weight="semibold" truncate>
        {token.name}
      </Text>
    </>
  );

  if (readOnly) {
    return (
      <span {...stylex.props(styles.root, styles.readOnly)}>{content}</span>
    );
  }

  return (
    <button
      {...rest}
      type="button"
      {...stylex.props(styles.root, styles.button, focusRingStyles.visible)}
    >
      {content}
      <Icon name="CaretDownIcon" size="sm" tone="muted" />
    </button>
  );
};

const styles = stylex.create({
  root: {
    margin: 0,
    borderColor: "transparent",
    borderRadius: radius.pill,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    gap: space[6],
    paddingBlock: space[4],
    alignItems: "center",
    backgroundColor: color.surfaceRaised,
    boxShadow: elevation.raised,
    boxSizing: "border-box",
    color: color.text,
    display: "inline-flex",
    flexShrink: 0,
    fontFamily: font.sans,
    paddingInlineEnd: space[12],
    paddingInlineStart: space[4],
    maxWidth: "100%",
    minWidth: 0,
  },
  readOnly: { cursor: "default" },
  button: {
    appearance: "none",
    backgroundColor: {
      default: color.surfaceRaised,
      ":hover:not(:disabled)": color.surfaceHover,
    },
    color: { default: color.text, ":disabled": color.textMuted },
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    paddingInlineEnd: space[8],
    transform: {
      default: "none",
      ":active:not(:disabled)": motion.press,
    },
    transitionDuration: motion.fast,
    transitionProperty: "background-color, transform",
    transitionTimingFunction: motion.easing,
  },
});
