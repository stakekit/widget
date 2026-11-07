import { Select as BaseSelect } from "@base-ui/react/select";
import * as stylex from "@stylexjs/stylex";
import { Icon } from "../primitives/icon";
import { scrollStyles } from "../primitives/scroll";
import { usePortalContainer } from "../theme/portal-container";
import { borderWidth, focusRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { layer } from "../tokens/layer.stylex";
import { motion } from "../tokens/motion.stylex";
import { overlaySize } from "../tokens/overlay.stylex";
import { radius } from "../tokens/radius.stylex";
import { controlHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";
import { popupStyles } from "./popup-styles";

/** One choice: what it stores and what it shows. */
export type SelectOption<T extends string = string> = {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean;
};

type SelectProps<T extends string> = {
  readonly options: ReadonlyArray<SelectOption<T>>;
  /** The chosen option's value; `null` shows the placeholder. */
  readonly value: NoInfer<T> | null;
  readonly onValueChange: (value: T) => void;
  /** Names the trigger and the list. */
  readonly label: string;
  /** Shown while nothing is chosen. */
  readonly placeholder?: string;
  readonly size?: keyof typeof sizeStyles;
  readonly disabled?: boolean;
};

/** A control that opens a list of options and shows the chosen one. */
export const Select = <const T extends string>({
  options,
  value,
  onValueChange,
  label,
  placeholder,
  size = "md",
  disabled = false,
}: SelectProps<T>) => {
  const container = usePortalContainer();

  return (
    <BaseSelect.Root<T>
      items={options}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
      disabled={disabled}
    >
      <BaseSelect.Trigger
        aria-label={label}
        {...stylex.props(styles.trigger, sizeStyles[size])}
      >
        <BaseSelect.Value
          placeholder={placeholder}
          {...stylex.props(styles.value)}
        />
        <BaseSelect.Icon {...stylex.props(styles.icon)}>
          <Icon name="CaretDownIcon" size="sm" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal container={container}>
        <BaseSelect.Positioner
          alignItemWithTrigger={false}
          sideOffset={4}
          {...stylex.props(popupStyles.positioner, styles.positioner)}
        >
          <BaseSelect.Popup
            {...stylex.props(popupStyles.surface, styles.popup)}
          >
            <BaseSelect.List
              aria-label={label}
              {...stylex.props(styles.list, scrollStyles.stableGutter)}
            >
              {options.map((option) => (
                <BaseSelect.Item
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  disabled={option.disabled}
                  {...stylex.props(popupStyles.item, styles.item)}
                >
                  <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator {...stylex.props(styles.indicator)}>
                    <Icon name="CheckIcon" size="sm" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
};

const styles = stylex.create({
  trigger: {
    borderColor: {
      default: color.borderStrong,
      ":is([data-disabled])": color.border,
    },
    borderRadius: radius.control,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    gap: space[8],
    paddingInline: space[12],
    alignItems: "center",
    backgroundColor: {
      default: color.surface,
      ":hover:not([data-disabled])": color.surfaceHover,
    },
    boxSizing: "border-box",
    color: { default: color.text, ":is([data-disabled])": color.textMuted },
    cursor: { default: "pointer", ":is([data-disabled])": "not-allowed" },
    display: "inline-flex",
    fontFamily: font.sans,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    justifyContent: "space-between",
    lineHeight: lineHeight.body,
    outlineColor: color.focusRing,
    outlineOffset: focusRing.offset,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
    textAlign: "start",
    transitionDuration: motion.fast,
    transitionProperty: "background-color, border-color",
    transitionTimingFunction: motion.easing,
    whiteSpace: "nowrap",
    width: "100%",
  },
  value: {
    overflow: "hidden",
    color: { default: "inherit", ":is([data-placeholder])": color.textMuted },
    textOverflow: "ellipsis",
    minWidth: 0,
  },
  icon: {
    color: color.textMuted,
    display: "flex",
    flexShrink: 0,
  },
  positioner: { zIndex: layer.dropdown },
  popup: { minWidth: "var(--anchor-width)" },
  list: {
    padding: space[4],
    boxSizing: "border-box",
    outlineStyle: "none",
    maxHeight: `min(var(--available-height), ${overlaySize.selectMaxHeight})`,
    overflowY: "auto",
  },
  item: { justifyContent: "space-between" },
  indicator: {
    color: color.accentText,
    display: "flex",
  },
});

const sizeStyles = stylex.create({
  sm: { height: controlHeight.sm },
  md: { height: controlHeight.md },
  lg: { height: controlHeight.lg },
});
