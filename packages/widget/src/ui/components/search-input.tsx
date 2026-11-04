import { Input } from "@base-ui/react/input";
import * as stylex from "@stylexjs/stylex";
import { type RefObject, useRef } from "react";
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
  /** The input, such as for a dialog to focus when it opens. */
  readonly inputRef?: RefObject<HTMLInputElement | null>;
  /**
   * Makes the field a combobox over a listbox of results: focus stays in the
   * field while the arrow keys move through the options and Enter picks one.
   */
  readonly listbox?: {
    /** The listbox's id. */
    readonly id: string;
    /** Whether the listbox shows, such as not while there are no results. */
    readonly expanded: boolean;
    /** The id of the option the keys have reached. */
    readonly activeOptionId?: string;
    readonly onKey: (key: ListboxKey) => void;
  };
  /** Renders as the input's `data-testid`. */
  readonly testId?: string;
};

/** The keys a search field hands to the listbox it controls. */
type ListboxKey = "ArrowDown" | "ArrowUp" | "Enter";

const listboxKeys: Partial<Record<string, ListboxKey>> = {
  ArrowDown: "ArrowDown",
  ArrowUp: "ArrowUp",
  Enter: "Enter",
};

/**
 * A search field, such as the token search of a select sheet. A clear button
 * shows once there is a query and hands focus back to the field; Escape also
 * clears it, and only reaches an enclosing dialog once the field is empty.
 * With `listbox` it is a combobox that moves through the listbox's options.
 */
export const SearchInput = ({
  value,
  onValueChange,
  label,
  placeholder,
  clearLabel,
  disabled: disabledProp = false,
  inputRef: inputRefProp,
  listbox,
  testId,
}: SearchInputProps) => {
  const ownInputRef = useRef<HTMLInputElement>(null);
  const inputRef = inputRefProp ?? ownInputRef;
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
        data-testid={testId}
        {...(listbox === undefined
          ? {}
          : ({
              role: "combobox",
              "aria-autocomplete": "list",
              "aria-controls": listbox.expanded ? listbox.id : undefined,
              "aria-expanded": listbox.expanded,
              "aria-activedescendant": listbox.expanded
                ? listbox.activeOptionId
                : undefined,
            } as const))}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={value}
        onValueChange={(next) => onValueChange(next)}
        onKeyDown={(event) => {
          // While an IME composes, its keys pick and commit characters.
          if (event.nativeEvent.isComposing) return;
          const listboxKey = listboxKeys[event.key];
          if (listbox !== undefined && listboxKey !== undefined) {
            event.preventDefault();
            listbox.onKey(listboxKey);
            return;
          }
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
