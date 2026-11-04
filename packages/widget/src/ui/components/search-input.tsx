import { Input } from "@base-ui/react/input";
import * as stylex from "@stylexjs/stylex";
import { useRef } from "react";
import { Icon } from "../primitives/icon";
import { borderWidth, focusRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { radius } from "../tokens/radius.stylex";
import { controlHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { font, fontSize, lineHeight } from "../tokens/typography.stylex";
import { useFieldState } from "./field";
import { IconButton } from "./icon-button";

type SearchInputProps = {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  /** Names the input, unless a `Field` label does. */
  readonly label?: string;
  readonly placeholder?: string;
  /** Names the button that clears the query. */
  readonly clearLabel: string;
  /** Also disabled by an enclosing disabled `Field`. */
  readonly disabled?: boolean;
};

/**
 * A search field, such as the token search of a select sheet. A clear button
 * shows once there is a query and hands focus back to the field; Escape also
 * clears it, and only reaches an enclosing dialog once the field is empty.
 */
export const SearchInput = ({
  value,
  onValueChange,
  label,
  placeholder,
  clearLabel,
  disabled: disabledProp = false,
}: SearchInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  // Base UI disables the input itself under a disabled Field; the box and
  // the clear button follow the same state.
  const field = useFieldState();
  const disabled = disabledProp || field.disabled;

  return (
    <div {...stylex.props(styles.box, disabled && styles.disabled)}>
      <Icon name="SearchIcon" size="sm" tone="muted" />
      <Input
        ref={inputRef}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={value}
        onValueChange={(next) => onValueChange(next)}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || value === "") return;
          event.preventDefault();
          event.stopPropagation();
          onValueChange("");
        }}
        {...stylex.props(styles.input)}
      />
      {value !== "" && !disabled && (
        <IconButton
          icon="XIcon"
          label={clearLabel}
          size="xs"
          onClick={() => {
            onValueChange("");
            inputRef.current?.focus();
          }}
        />
      )}
    </div>
  );
};
const styles = stylex.create({
  // The ring marks the whole box while its input has focus.
  box: {
    borderColor: color.borderStrong,
    borderRadius: radius.control,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    gap: space[8],
    paddingInline: space[12],
    alignItems: "center",
    backgroundColor: color.surface,
    boxSizing: "border-box",
    display: "flex",
    outlineColor: color.focusRing,
    outlineOffset: focusRing.offset,
    outlineStyle: {
      default: "none",
      ":has(input:focus-visible)": "solid",
    },
    outlineWidth: focusRing.width,
    transitionDuration: motion.fast,
    transitionProperty: "border-color",
    transitionTimingFunction: motion.easing,
    height: controlHeight.md,
  },
  disabled: { borderColor: color.border, cursor: "not-allowed" },
  input: {
    margin: 0,
    padding: 0,
    borderStyle: "none",
    appearance: "none",
    backgroundColor: "transparent",
    color: { default: color.text, ":disabled": color.textMuted },
    flexGrow: 1,
    fontFamily: font.sans,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    outlineStyle: "none",
    minWidth: 0,
    "::-webkit-search-cancel-button": { appearance: "none" },
    "::placeholder": { color: color.textMuted },
  },
});
