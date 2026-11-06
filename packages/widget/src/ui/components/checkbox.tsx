import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useId } from "react";

import { Icon } from "../primitives/icon";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { radius } from "../tokens/radius.stylex";
import { selectionControlSize } from "../tokens/size.stylex";
import { choiceLabelStyles } from "./choice-label";
import { focusRingStyles } from "./focus-ring";

type CheckboxProps = {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  /**
   * The visible label; clicking it toggles the checkbox. It may hold emphasis
   * or a link, such as the terms to agree to.
   */
  readonly label: ReactNode;
  readonly disabled?: boolean;
};

/**
 * A choice to confirm, such as agreeing to terms. Space toggles it; its state
 * is the `checkbox` role's checked state.
 */
export const Checkbox = ({
  checked,
  onCheckedChange,
  label,
  disabled = false,
}: CheckboxProps) => {
  const id = useId();
  return (
    <label
      htmlFor={id}
      {...stylex.props(
        choiceLabelStyles.root,
        disabled && choiceLabelStyles.disabled
      )}
    >
      <BaseCheckbox.Root
        id={id}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next)}
        disabled={disabled}
        {...stylex.props(styles.box, focusRingStyles.visible)}
      >
        <BaseCheckbox.Indicator {...stylex.props(styles.indicator)}>
          <Icon name="CheckIcon" size="sm" />
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
      <span>{label}</span>
    </label>
  );
};

const styles = stylex.create({
  box: {
    margin: 0,
    padding: 0,
    borderColor: {
      default: color.textMuted,
      ":is([data-checked])": color.accent,
      ":is([data-disabled])": color.border,
    },
    borderRadius: radius.badge,
    borderStyle: "solid",
    borderWidth: borderWidth.thick,
    alignItems: "center",
    backgroundColor: {
      default: color.background,
      ":is([data-checked])": color.accent,
      ":is([data-disabled])": color.surface,
    },
    boxSizing: "border-box",
    color: { default: color.onAccent, ":is([data-disabled])": color.textMuted },
    cursor: { default: "pointer", ":is([data-disabled])": "not-allowed" },
    display: "inline-flex",
    flexShrink: 0,
    justifyContent: "center",
    transitionDuration: motion.fast,
    transitionProperty: "background-color, border-color",
    transitionTimingFunction: motion.easing,
    height: selectionControlSize.checkbox,
    width: selectionControlSize.checkbox,
  },
  indicator: { display: "flex" },
});
