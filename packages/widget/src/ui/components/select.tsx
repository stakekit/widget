import { Select as BaseSelect } from "@base-ui/react/select";
import * as stylex from "@stylexjs/stylex";

import type { FixedIconName } from "../icons/glyphs";
import { Icon } from "../primitives/icon";
import { scrollStyles } from "../primitives/scroll";
import { usePortalProps } from "../theme/portal-container";
import { borderWidth, focusRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { layer } from "../tokens/layer.stylex";
import { motion } from "../tokens/motion.stylex";
import { overlaySize, popupOffset } from "../tokens/overlay.stylex";
import { radius } from "../tokens/radius.stylex";
import { controlHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";
import { hitAreaStyles } from "./hit-area";
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
  /**
   * Draws the trigger as a square icon button in place of a field showing the
   * choice, for a choice beside another control, such as a sort beside a
   * search field. Its name says the choice; `marked` dots it, such as while
   * the choice is not the default.
   */
  readonly iconTrigger?: {
    readonly icon: FixedIconName;
    readonly marked?: boolean;
  };
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
  iconTrigger,
}: SelectProps<T>) => {
  const portalProps = usePortalProps();
  const chosen = options.find((option) => option.value === value);

  return (
    <BaseSelect.Root<T>
      items={options}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
      disabled={disabled}
    >
      {iconTrigger === undefined ? (
        <BaseSelect.Trigger
          aria-label={label}
          {...stylex.props(
            styles.trigger,
            styles.fieldTrigger,
            sizeStyles[size],
            hitAreaStyles.coarse
          )}
        >
          <BaseSelect.Value
            placeholder={placeholder}
            {...stylex.props(styles.value)}
          />
          <BaseSelect.Icon {...stylex.props(styles.icon)}>
            <Icon name="CaretDownIcon" size="sm" />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>
      ) : (
        <BaseSelect.Trigger
          aria-label={chosen ? `${label}: ${chosen.label}` : label}
          {...stylex.props(
            styles.trigger,
            sizeStyles[size],
            iconTriggerSizeStyles[size],
            hitAreaStyles.coarse
          )}
        >
          <Icon name={iconTrigger.icon} size={size === "sm" ? "sm" : "md"} />
          {iconTrigger.marked === true && (
            <span aria-hidden {...stylex.props(styles.mark)} />
          )}
        </BaseSelect.Trigger>
      )}
      <BaseSelect.Portal {...portalProps}>
        <BaseSelect.Positioner
          alignItemWithTrigger={false}
          // A narrow icon trigger's list grows from its end, into the room
          // beside it.
          align={iconTrigger === undefined ? "center" : "end"}
          sideOffset={Number.parseFloat(popupOffset.list)}
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
    alignItems: "center",
    backgroundColor: {
      default: color.surface,
      ":hover:not([data-disabled])": color.surfaceHover,
    },
    boxSizing: "border-box",
    color: { default: color.text, ":is([data-disabled])": color.textMuted },
    cursor: { default: "pointer", ":is([data-disabled])": "not-allowed" },
    display: "inline-flex",
    flexShrink: 0,
    justifyContent: "center",
    outlineColor: color.focusRing,
    outlineOffset: focusRing.offset,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
    transitionDuration: motion.fast,
    transitionProperty: "background-color, border-color",
    transitionTimingFunction: motion.easing,
  },
  fieldTrigger: {
    gap: space[8],
    paddingInline: space[12],
    fontFamily: font.sans,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    justifyContent: "space-between",
    lineHeight: lineHeight.body,
    textAlign: "start",
    whiteSpace: "nowrap",
    width: "100%",
  },
  // A dot in the icon trigger's top end corner, inside its edge.
  mark: {
    borderRadius: radius.pill,
    backgroundColor: color.accent,
    insetBlockStart: space[6],
    insetInlineEnd: space[6],
    pointerEvents: "none",
    position: "absolute",
    height: space[6],
    width: space[6],
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

/** The icon trigger is square: as wide as it is tall. */
const iconTriggerSizeStyles = stylex.create({
  sm: { padding: 0, width: controlHeight.sm },
  md: { padding: 0, width: controlHeight.md },
  lg: { padding: 0, width: controlHeight.lg },
});
