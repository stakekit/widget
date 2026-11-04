import { Switch as BaseSwitch } from "@base-ui/react/switch";
import * as stylex from "@stylexjs/stylex";
import { useId } from "react";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { radius } from "../tokens/radius.stylex";
import { selectionControlSize } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { choiceLabelStyles } from "./choice-label";
import { focusRingStyles } from "./focus-ring";

type SwitchProps = {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  /** The visible label; clicking it toggles the switch. */
  readonly label: string;
  readonly disabled?: boolean;
  /** Puts the label before the switch, as in a settings row. */
  readonly labelFirst?: boolean;
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
        {...stylex.props(styles.track, focusRingStyles.visible)}
      >
        <BaseSwitch.Thumb {...stylex.props(styles.thumb)} />
      </BaseSwitch.Root>
      {label}
    </label>
  );
};

const styles = stylex.create({
  labelFirst: { flexDirection: "row-reverse", justifyContent: "space-between" },
  // Off is a muted track and on the accent; the thumb's position says it too.
  track: {
    margin: 0,
    padding: space[2],
    borderRadius: radius.pill,
    borderStyle: "none",
    backgroundColor: {
      default: color.textMuted,
      ":is([data-checked])": color.accent,
      ":is([data-disabled])": color.border,
    },
    boxSizing: "border-box",
    cursor: { default: "pointer", ":is([data-disabled])": "not-allowed" },
    display: "inline-flex",
    flexShrink: 0,
    transitionDuration: motion.fast,
    transitionProperty: "background-color",
    transitionTimingFunction: motion.easing,
    height: selectionControlSize.switchHeight,
    width: selectionControlSize.switchWidth,
  },
  thumb: {
    borderRadius: radius.pill,
    backgroundColor: {
      default: color.background,
      ":is([data-checked])": color.onAccent,
      ":is([data-disabled])": color.surface,
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
