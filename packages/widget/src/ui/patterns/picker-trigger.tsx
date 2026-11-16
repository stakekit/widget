import * as stylex from "@stylexjs/stylex";
import type { ButtonHTMLAttributes, Ref } from "react";

import { TokenAvatar } from "../components/avatar";
import { focusRingStyles } from "../components/focus-ring";
import { hitAreaStyles } from "../components/hit-area";
import type { HostHook } from "../host-hook";
import { Icon } from "../primitives/icon";
import { Text } from "../primitives/text";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { opacity } from "../tokens/opacity.stylex";
import { pickerTrigger } from "../tokens/picker-trigger.stylex";
import { presentationMarker } from "../tokens/presentation.stylex";
import { radius } from "../tokens/radius.stylex";
import { pickerTriggerHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { font } from "../tokens/typography.stylex";
import type { TokenLogo } from "./token";

type PickerTriggerProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "style" | "children" | "type"
> & {
  readonly ref?: Ref<HTMLButtonElement>;
  /**
   * The trigger's text and name: the chosen item's, such as a token's
   * symbol, or the action it opens, such as "Change".
   */
  readonly label: string;
  /**
   * The chosen item's logo, before the label; its fallback shows the label's
   * initials. Unset, the label stands alone.
   */
  readonly logo?: Omit<TokenLogo, "name">;
  /**
   * Shows the choice without a caret or a button, when there is nothing
   * else to choose. The button props then do not apply.
   */
  readonly readOnly?: boolean;
  /** Renders as the trigger's `data-testid`. */
  readonly testId?: string;
  /** Renders as the trigger's `data-rk`, for hosts that locate it. */
  readonly hostHook?: HostHook;
  /**
   * An account address: draws the account's generated avatar in place of a
   * logo, as in a wallet's account trigger. `label` stays the text.
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
 * What opens a picker, such as a `SelectSheet` or a wallet's `Modal`: the
 * chosen token beside an amount, with its logo and network badge, on a
 * raised pill; the chosen network or account in a wallet header; or, with
 * no logo, the action that changes a choice shown beside it ("Change"). As a
 * button it shows a caret and forwards its ref and props, so it can be a
 * `Modal` or `SelectSheet` trigger.
 */
export const PickerTrigger = ({
  label,
  logo,
  readOnly = false,
  testId,
  hostHook,
  account,
  size = "md",
  ...rest
}: PickerTriggerProps) => {
  const avatarSize = size === "md" ? "control" : "sm";
  // The smaller sizes are filled flat rather than raised.
  const flat = size !== "md";
  const labelOnly = account === undefined && logo === undefined;
  const avatar = (() => {
    if (account !== undefined) {
      return <TokenAvatar account={account} size={avatarSize} />;
    }
    if (logo === undefined) return null;
    return <TokenAvatar {...logo} name={label} size={avatarSize} decorative />;
  })();
  const content = (
    <>
      {avatar}
      {size === "md" ? (
        <Text variant="heading" as="span" weight="semibold" truncate>
          {label}
        </Text>
      ) : (
        <Text as="span" weight="semibold" truncate>
          {label}
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
          labelOnly && styles.labelOnly,
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
        labelOnly && styles.labelOnly,
        styles.button,
        flat && styles.flat,
        // A header pill is shorter than a finger; the amount's pill is not.
        flat && hitAreaStyles.coarse,
        focusRingStyles.visible
      )}
    >
      {content}
      <Icon name="CaretDownIcon" size="sm" tone="muted" />
    </button>
  );
};

// Raised off the card it sits in (`pickerTrigger`, which a preset can set
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
    borderRadius: pickerTrigger.radius,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    gap: space[6],
    paddingBlock: 0,
    alignItems: "center",
    backgroundColor: {
      default: pickerTrigger.fill,
      [stylex.when.ancestor(
        '[data-sk-surface-style="elevated"]',
        presentationMarker
      )]: color.surface,
    },
    boxShadow: {
      default: pickerTrigger.shadow,
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
  // With no avatar the label sits as far in as a button's.
  labelOnly: { paddingInlineStart: space[12] },
  readOnly: { cursor: "default" },
  button: {
    appearance: "none",
    // The hover rule's `:not(:disabled)` outranks the ancestor condition.
    backgroundColor: {
      default: pickerTrigger.fill,
      ":hover:not(:disabled)": color.surfaceHover,
      [stylex.when.ancestor(
        '[data-sk-surface-style="elevated"]',
        presentationMarker
      )]: color.surface,
    },
    color: color.text,
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    opacity: { default: 1, ":disabled": opacity.disabled },
    paddingInlineEnd: space[8],
    transform: {
      default: "none",
      ":active:not(:disabled)": motion.press,
    },
    transitionDuration: motion.fast,
    transitionProperty: "background-color, opacity, transform",
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
    // A header pill gives way, its name truncating, so one row holds them.
    flexShrink: 1,
  },
});

const sizeStyles = stylex.create({
  sm: { height: pickerTriggerHeight.sm },
  tabs: { height: pickerTriggerHeight.tabs },
  md: {
    gap: space[8],
    paddingInlineStart: space[6],
    height: pickerTriggerHeight.md,
  },
});
