import * as stylex from "@stylexjs/stylex";
import type { ButtonHTMLAttributes, Ref } from "react";
import { TokenAvatar } from "../components/avatar";
import { focusRingStyles } from "../components/focus-ring";
import type { HostHook } from "../host-hook";
import { Icon } from "../primitives/icon";
import { Text } from "../primitives/text";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { presentationMarker } from "../tokens/presentation.stylex";
import { radius } from "../tokens/radius.stylex";
import { tokenTriggerHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { tokenTrigger } from "../tokens/token-trigger.stylex";
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
  /** Renders as the trigger's `data-testid`. */
  readonly testId?: string;
  /** Renders as the trigger's `data-rk`, for hosts that locate it. */
  readonly hostHook?: HostHook;
  /**
   * An account address: draws the account's generated avatar in place of the
   * token's logo, as in a wallet's account trigger. `token.name` stays the
   * text.
   */
  readonly account?: string;
  /**
   * `md`, the default, is the touch-sized pill beside an amount, raised off
   * its panel. `sm` and `tabs` are a wallet header's network or account pill,
   * filled like a pill `Tabs` list to stand off the frame: `sm` as tall as a
   * small control, `tabs` as tall as the list it sits beside.
   */
  readonly size?: "sm" | "tabs" | "md";
};

/**
 * The chosen token beside an amount: its logo with the network badge and its
 * symbol on a raised pill, or the chosen network or account in a wallet
 * header. As a button it shows a caret and forwards its ref and props, so it
 * can be a `Modal` or `SelectSheet` trigger.
 */
export const TokenTrigger = ({
  token,
  readOnly = false,
  testId,
  hostHook,
  account,
  size = "md",
  ...rest
}: TokenTriggerProps) => {
  const avatarSize = size === "md" ? "control" : "sm";
  // The smaller sizes are filled flat rather than raised.
  const flat = size !== "md";
  const content = (
    <>
      {account === undefined ? (
        <TokenAvatar {...token} size={avatarSize} decorative />
      ) : (
        <TokenAvatar account={account} size={avatarSize} />
      )}
      {size === "md" ? (
        <Text variant="heading" as="span" weight="semibold" truncate>
          {token.name}
        </Text>
      ) : (
        <Text as="span" weight="semibold" truncate>
          {token.name}
        </Text>
      )}
    </>
  );

  if (readOnly) {
    return (
      <span
        data-testid={testId}
        data-rk={hostHook}
        {...stylex.props(
          styles.root,
          sizeStyles[size],
          styles.readOnly,
          flat && styles.flat
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      {...rest}
      type="button"
      data-testid={testId}
      data-rk={hostHook}
      {...stylex.props(
        styles.root,
        sizeStyles[size],
        styles.button,
        flat && styles.flat,
        focusRingStyles.visible
      )}
    >
      {content}
      <Icon name="CaretDownIcon" size="sm" tone="muted" />
    </button>
  );
};

// Raised off the card it sits in (`tokenTrigger`, which a preset can set
// flat in its card), except under the `elevated` surface style: there the
// card itself is raised, so the trigger fills with `surface` and edges in
// `border` instead (a dark raised card can share its fill), keeping
// elevation to one level. Every enabled trigger tints on hover.
const styles = stylex.create({
  root: {
    margin: 0,
    borderColor: {
      default: "transparent",
      [stylex.when.ancestor(
        '[data-sk-surface-style="elevated"]',
        presentationMarker
      )]: color.border,
    },
    borderRadius: tokenTrigger.radius,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    gap: space[6],
    paddingBlock: 0,
    alignItems: "center",
    backgroundColor: {
      default: tokenTrigger.fill,
      [stylex.when.ancestor(
        '[data-sk-surface-style="elevated"]',
        presentationMarker
      )]: color.surface,
    },
    boxShadow: {
      default: tokenTrigger.shadow,
      [stylex.when.ancestor(
        '[data-sk-surface-style="elevated"]',
        presentationMarker
      )]: "none",
    },
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
    // The hover rule's `:not(:disabled)` outranks the ancestor condition.
    backgroundColor: {
      default: tokenTrigger.fill,
      ":hover:not(:disabled)": color.surfaceHover,
      [stylex.when.ancestor(
        '[data-sk-surface-style="elevated"]',
        presentationMarker
      )]: color.surface,
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
  // Filled like a pill tabs list rather than raised: a raised pill is white
  // on a white frame in light. Under the `outlined` surface style it is
  // outlined instead, white with a thin edge, like its cards. Only a button,
  // which can be enabled, tints on hover. It rounds as the other pill
  // controls do, not as the trigger beside an amount.
  flat: {
    borderColor: {
      default: "transparent",
      [stylex.when.ancestor(
        '[data-sk-surface-style="outlined"]',
        presentationMarker
      )]: color.border,
    },
    borderRadius: radius.pillControl,
    backgroundColor: {
      default: color.surface,
      ":enabled:hover": color.surfaceHover,
      [stylex.when.ancestor(
        '[data-sk-surface-style="outlined"]',
        presentationMarker
      )]: color.surfaceRaised,
    },
    boxShadow: "none",
  },
});

const sizeStyles = stylex.create({
  sm: { height: tokenTriggerHeight.sm },
  tabs: { height: tokenTriggerHeight.tabs },
  md: {
    gap: space[8],
    paddingInlineStart: space[6],
    height: tokenTriggerHeight.md,
  },
});
