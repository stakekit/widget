import * as stylex from "@stylexjs/stylex";
import { createContext, type ReactNode, use, useId } from "react";
import { Icon } from "../primitives/icon";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { borderWidth, focusRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { selectionControlSize } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { interactiveStyles } from "./interactive-styles";

const InListGroup = createContext(false);

type CommonProps = {
  /** An avatar: `TokenAvatar`, `Avatar` or an icon. */
  readonly leading?: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  /** Badges beside the title. */
  readonly badges?: ReactNode;
  /** The trailing figure, such as a formatted balance. */
  readonly value?: string;
  /** Context under the value, such as its fiat equivalent. */
  readonly subvalue?: string;
  /**
   * Label-value rows under the row's main line, such as a validator's
   * commission and staked balance.
   */
  readonly details?: ReadonlyArray<{
    readonly label: string;
    readonly value: string;
  }>;
};

type ListRowProps = CommonProps &
  (
    | {
        /** Makes the row a button. */
        readonly onClick: () => void;
        readonly selected?: boolean;
        /**
         * Shows a check box for `selected` in place of the selection ring, as
         * in a list that takes several choices.
         */
        readonly check?: boolean;
        readonly disabled?: boolean;
        readonly option?: never;
      }
    | {
        /**
         * Makes the row an option of a listbox whose owner, such as a
         * combobox, keeps focus and marks the option its keys reached.
         */
        readonly option: ListRowOption;
        readonly onClick?: never;
        readonly selected?: never;
        readonly check?: never;
        readonly disabled?: never;
      }
    | {
        readonly onClick?: never;
        readonly selected?: never;
        readonly check?: never;
        readonly disabled?: never;
        readonly option?: never;
      }
  );

type ListRowOption = {
  /** The option's id, for the owner's `aria-activedescendant`. */
  readonly id: string;
  readonly selected: boolean;
  /** The option the owner's keys reached; it shows the focus ring. */
  readonly active: boolean;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
  /**
   * Shows a check box for `selected` in place of the selection ring, as in a
   * listbox that takes several choices.
   */
  readonly check?: boolean;
  /**
   * The title of the group the option is in, given as its description: a
   * virtualized listbox can't wrap its options in groups.
   */
  readonly groupLabel?: string;
  /**
   * Where the option sits in the whole list, of which only the rows in view
   * render. Leave `count` unset while more options may load.
   */
  readonly position?: { readonly index: number; readonly count?: number };
};

/**
 * One row of a list: a leading avatar, a title and subtitle with badges, and
 * a trailing value over its subvalue in tabular figures, and optional
 * detail rows under them. With `onClick` the row is a button; `selected`
 * reads as pressed. With `option` it is an option of a listbox. With `check`
 * a check box shows the selection, for a choice of several.
 */
export const ListRow = ({
  leading,
  title,
  subtitle,
  badges,
  value,
  subvalue,
  details,
  onClick,
  selected,
  check = false,
  disabled,
  option,
}: ListRowProps) => {
  const grouped = use(InListGroup);
  const groupLabelId = useId();
  const checked = option === undefined ? selected === true : option.selected;
  const checkBox = (option?.check ?? check) && (
    <span
      aria-hidden="true"
      {...stylex.props(styles.check, checked && styles.checked)}
    >
      {checked && <Icon name="CheckIcon" size="sm" />}
    </span>
  );
  const main = (
    <>
      {checkBox}
      {leading !== undefined && (
        <span {...stylex.props(styles.leading)}>{leading}</span>
      )}
      <Stack as="span" gap={2} grow>
        <Stack as="span" direction="row" align="center" gap={8}>
          <Text weight="medium" truncate>
            {title}
          </Text>
          {badges}
        </Stack>
        {subtitle !== undefined && (
          <Text variant="caption" tone="muted" truncate>
            {subtitle}
          </Text>
        )}
      </Stack>
      {(value !== undefined || subvalue !== undefined) && (
        <Stack as="span" gap={2} align="end">
          {value !== undefined && (
            <Text weight="medium" numeric>
              {value}
            </Text>
          )}
          {subvalue !== undefined && (
            <Text variant="caption" tone="muted" numeric>
              {subvalue}
            </Text>
          )}
        </Stack>
      )}
    </>
  );
  const content =
    details === undefined || details.length === 0 ? (
      main
    ) : (
      <Stack as="span" gap={8} grow>
        <span {...stylex.props(styles.main)}>{main}</span>
        <Stack as="span" gap={4}>
          {details.map((detail) => (
            <Stack
              key={detail.label}
              as="span"
              direction="row"
              justify="between"
              gap={16}
            >
              <Text variant="caption" tone="muted">
                {detail.label}
              </Text>
              <Text variant="caption" numeric>
                {detail.value}
              </Text>
            </Stack>
          ))}
        </Stack>
      </Stack>
    );
  const row = (() => {
    if (option !== undefined) {
      const select = option.disabled === true ? undefined : option.onSelect;
      const { groupLabel, position } = option;
      return (
        // Focus stays on the owner; tabIndex -1 keeps the option out of the
        // tab order, and pressing it doesn't pull focus from the owner.
        <div
          role="option"
          id={option.id}
          tabIndex={-1}
          aria-selected={option.selected}
          aria-disabled={option.disabled === true || undefined}
          aria-describedby={groupLabel === undefined ? undefined : groupLabelId}
          aria-posinset={
            position === undefined ? undefined : position.index + 1
          }
          aria-setsize={
            position === undefined ? undefined : (position.count ?? -1)
          }
          onMouseDown={(event) => event.preventDefault()}
          onClick={select}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              select?.();
            }
          }}
          {...stylex.props(
            styles.root,
            interactiveStyles.root,
            styles.interactive,
            option.selected &&
              option.check !== true &&
              interactiveStyles.selected,
            option.active && styles.active,
            option.disabled === true && styles.optionDisabled
          )}
        >
          {content}
          {groupLabel !== undefined && (
            // A hidden element still describes the option that refers to it.
            <span id={groupLabelId} hidden>
              {groupLabel}
            </span>
          )}
        </div>
      );
    }
    if (onClick === undefined) {
      return <div {...stylex.props(styles.root)}>{content}</div>;
    }
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
        {...stylex.props(
          styles.root,
          interactiveStyles.root,
          styles.interactive,
          selected === true && !check && interactiveStyles.selected
        )}
      >
        {content}
      </button>
    );
  })();

  return grouped ? <li>{row}</li> : row;
};

/** Rows read as one list, under an optional overline heading. */
export const ListGroup = ({
  label,
  children,
}: {
  readonly label?: string;
  readonly children: ReactNode;
}) => {
  const labelId = useId();

  return (
    <InListGroup value>
      <Stack gap={8}>
        {label !== undefined && (
          <Text variant="overline" tone="muted" id={labelId}>
            {label}
          </Text>
        )}
        <Stack
          as="ul"
          gap={8}
          aria-labelledby={label === undefined ? undefined : labelId}
        >
          {children}
        </Stack>
      </Stack>
    </InListGroup>
  );
};

const styles = stylex.create({
  root: {
    margin: 0,
    borderColor: "transparent",
    borderRadius: radius.control,
    borderStyle: "none",
    gap: space[12],
    paddingBlock: space[12],
    paddingInline: space[12],
    alignItems: "center",
    backgroundColor: color.surface,
    boxSizing: "border-box",
    color: color.text,
    display: "flex",
    minWidth: 0,
  },
  interactive: {
    backgroundColor: {
      default: color.surface,
      ":hover:not(:disabled)": color.surfaceHover,
    },
    display: "flex",
  },
  main: {
    gap: space[12],
    alignItems: "center",
    display: "flex",
    minWidth: 0,
  },
  leading: { display: "flex", flexShrink: 0 },
  check: {
    borderColor: color.textMuted,
    borderRadius: radius.pill,
    borderStyle: "solid",
    borderWidth: borderWidth.thick,
    alignItems: "center",
    boxSizing: "border-box",
    color: color.onAccent,
    display: "flex",
    flexShrink: 0,
    justifyContent: "center",
    height: selectionControlSize.checkbox,
    width: selectionControlSize.checkbox,
  },
  checked: { borderColor: color.accent, backgroundColor: color.accent },
  // The focus ring marks the option the owner's keys reached, as focus would.
  active: {
    backgroundColor: color.surfaceHover,
    outlineColor: color.focusRing,
    outlineOffset: focusRing.offset,
    outlineStyle: "solid",
    outlineWidth: focusRing.width,
  },
  optionDisabled: {
    backgroundColor: color.surface,
    color: color.textMuted,
    cursor: "not-allowed",
    // A div never matches `:disabled`, so the press scale is undone here.
    transform: "none",
  },
});
