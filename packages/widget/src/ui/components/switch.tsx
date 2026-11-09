import { Switch as BaseSwitch } from "@base-ui/react/switch";
import * as stylex from "@stylexjs/stylex";
import { useId } from "react";

import type { HostHook } from "../host-hook";
import { VisuallyHidden } from "../primitives/visually-hidden";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { opacity } from "../tokens/opacity.stylex";
import { radius } from "../tokens/radius.stylex";
import { selectionControlSize } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { choiceLabelStyles } from "./choice-label";
import { focusRingStyles } from "./focus-ring";
import { hitAreaStyles } from "./hit-area";

type SwitchProps = {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  /** The visible label; clicking it toggles the switch. */
  readonly label: string;
  readonly disabled?: boolean;
  /** Puts the label before the switch, as in a settings row. */
  readonly labelFirst?: boolean;
  /**
   * Keeps the label for assistive technology only, where the row around the
   * switch already shows what it sets, such as an asset's name.
   */
  readonly labelHidden?: boolean;
  /** Renders as the switch's `data-testid`. */
  readonly testId?: string;
  /** Renders as the switch's `data-rk`, for hosts that locate it. */
  readonly hostHook?: HostHook;
};

/**
 * An on/off setting that applies at once, such as using an asset as
 * collateral. Space toggles it; its state is the `switch` role's checked state.
 */
export const Switch = ({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  labelFirst = false,
  labelHidden = false,
  testId,
  hostHook,
}: SwitchProps) => {
  const id = useId();
  return (
    <label
      htmlFor={id}
      {...stylex.props(
        choiceLabelStyles.root,
        labelFirst && styles.labelFirst,
        disabled && choiceLabelStyles.disabled
      )}
    >
      <BaseSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next)}
        disabled={disabled}
        data-testid={testId}
        data-rk={hostHook}
        {...stylex.props(
          styles.track,
          hitAreaStyles.coarse,
          focusRingStyles.visible
        )}
      >
        <BaseSwitch.Thumb {...stylex.props(styles.thumb)} />
      </BaseSwitch.Root>
      {labelHidden ? <VisuallyHidden>{label}</VisuallyHidden> : label}
    </label>
  );
};

const styles = stylex.create({
  labelFirst: { flexDirection: "row-reverse", justifyContent: "space-between" },
  // Off is a muted track and on the accent; the thumb's position says it too.
  // Disabled, it keeps its on or off look at the disabled opacity.
  track: {
    margin: 0,
    padding: space[2],
    borderRadius: radius.pill,
    borderStyle: "none",
    backgroundColor: {
      default: color.textMuted,
      ":is([data-checked])": color.accent,
    },
    boxSizing: "border-box",
    cursor: { default: "pointer", ":is([data-disabled])": "not-allowed" },
    display: "inline-flex",
    flexShrink: 0,
    opacity: { default: 1, ":is([data-disabled])": opacity.disabled },
    transitionDuration: motion.fast,
    transitionProperty: "background-color, opacity",
    transitionTimingFunction: motion.easing,
    height: selectionControlSize.switchHeight,
    width: selectionControlSize.switchWidth,
  },
  thumb: {
    borderRadius: radius.pill,
    backgroundColor: {
      default: color.background,
      ":is([data-checked])": color.onAccent,
    },
    display: "block",
    transform: {
      default: "none",
      ":is([data-checked])": `translateX(calc(${selectionControlSize.switchWidth} - ${selectionControlSize.switchHeight}))`,
    },
    transitionDuration: motion.fast,
    transitionProperty: "transform, background-color",
    transitionTimingFunction: motion.easing,
    height: selectionControlSize.switchThumb,
    width: selectionControlSize.switchThumb,
  },
});
